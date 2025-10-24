"use client";

import { useState, useCallback, useEffect } from "react";
import { checkoutConfig } from "@/config/checkout";
import type { FormData, ValidationRules, FormErrors, FormTouched, UseCheckoutFormReturn } from "@/types/checkout";

/**
 * Custom hook for managing checkout form state and validation
 * Centralizes form logic for better maintainability
 */
export const useCheckoutForm = (): UseCheckoutFormReturn => {
  const [formData, setFormData] = useState<FormData>({
    email: "",
    shippingFullName: "",
    shippingStreetAddress: "",
    shippingCity: "",
    shippingPostalCode: "",
    shippingCountry: "",
    billingFullName: "",
    billingStreetAddress: "",
    billingCity: "",
    billingPostalCode: "",
    billingCountry: "",
    sameAsShipping: checkoutConfig.defaultSameAsShipping,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<FormTouched>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Validation rules for each field - consolidated into single source of truth
  const validationRules: Record<keyof FormData, ValidationRules> = {
    email: {
      customValidator: (value) => {
        if (!value.trim()) return "Email is required";
        if (!checkoutConfig.validation.emailRegex.test(value)) {
          return "Please enter a valid email address";
        }
        return null;
      }
    },
    shippingFullName: {
      customValidator: (value) => {
        if (!value.trim()) return "Full name is required";
        if (value.trim().length < checkoutConfig.validation.nameMinLength) {
          return `Name must be at least ${checkoutConfig.validation.nameMinLength} characters`;
        }
        if (value.trim().length > checkoutConfig.validation.nameMaxLength) {
          return `Name must be less than ${checkoutConfig.validation.nameMaxLength} characters`;
        }
        return null;
      }
    },
    shippingStreetAddress: {
      customValidator: (value) => {
        if (!value.trim()) return "Street address is required";
        if (value.trim().length < checkoutConfig.validation.addressMinLength) {
          return "Please enter a complete address";
        }
        return null;
      }
    },
    shippingCity: {
      customValidator: (value) => {
        if (!value.trim()) return "City is required";
        if (value.trim().length < checkoutConfig.validation.cityMinLength) {
          return `City name must be at least ${checkoutConfig.validation.cityMinLength} characters`;
        }
        return null;
      }
    },
    shippingPostalCode: {
      customValidator: (value) => {
        if (!value.trim()) return "Postal code is required";
        if (!checkoutConfig.validation.postalCodeRegex.test(value)) {
          return "Please enter a valid postal code";
        }
        return null;
      }
    },
    shippingCountry: {
      customValidator: (value) => {
        if (!value) return "Country is required";
        return null;
      }
    },
    billingFullName: {
      customValidator: (value, context) => {
        // Skip validation if same as shipping is checked
        if (context?.sameAsShipping) return null;
        if (!value.trim()) return "Full name is required";
        if (value.trim().length < checkoutConfig.validation.nameMinLength) {
          return `Name must be at least ${checkoutConfig.validation.nameMinLength} characters`;
        }
        if (value.trim().length > checkoutConfig.validation.nameMaxLength) {
          return `Name must be less than ${checkoutConfig.validation.nameMaxLength} characters`;
        }
        return null;
      }
    },
    billingStreetAddress: {
      customValidator: (value, context) => {
        // Skip validation if same as shipping is checked
        if (context?.sameAsShipping) return null;
        if (!value.trim()) return "Street address is required";
        if (value.trim().length < checkoutConfig.validation.addressMinLength) {
          return "Please enter a complete address";
        }
        return null;
      }
    },
    billingCity: {
      customValidator: (value, context) => {
        // Skip validation if same as shipping is checked
        if (context?.sameAsShipping) return null;
        if (!value.trim()) return "City is required";
        if (value.trim().length < checkoutConfig.validation.cityMinLength) {
          return `City name must be at least ${checkoutConfig.validation.cityMinLength} characters`;
        }
        return null;
      }
    },
    billingPostalCode: {
      customValidator: (value, context) => {
        // Skip validation if same as shipping is checked
        if (context?.sameAsShipping) return null;
        if (!value.trim()) return "Postal code is required";
        if (!checkoutConfig.validation.postalCodeRegex.test(value)) {
          return "Please enter a valid postal code";
        }
        return null;
      }
    },
    billingCountry: {
      customValidator: (value, context) => {
        // Skip validation if same as shipping is checked
        if (context?.sameAsShipping) return null;
        if (!value) return "Country is required";
        return null;
      }
    },
    sameAsShipping: {
      customValidator: () => null // No validation needed for checkbox
    }
  };

  // Validate a single field using consolidated validation logic
  const validateField = useCallback((name: keyof FormData, value: string | boolean): string => {
    const rules = validationRules[name];
    if (!rules) return "";

    const stringValue = String(value);
    const context = { sameAsShipping: formData.sameAsShipping };
    
    return rules.customValidator(stringValue, context) || "";
  }, [formData.sameAsShipping]);

  // Handle input changes with real-time validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    const fieldName = name as keyof FormData;
    const fieldValue = type === "checkbox" ? checked : value;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: fieldValue };
      
      // If same as shipping is checked and this is a shipping field, update corresponding billing field
      if (checkoutConfig.features.autoFillBilling && prev.sameAsShipping && typeof fieldValue === 'string') {
        const billingFieldMap: { [key: string]: string } = {
          shippingFullName: "billingFullName",
          shippingStreetAddress: "billingStreetAddress", 
          shippingCity: "billingCity",
          shippingPostalCode: "billingPostalCode",
          shippingCountry: "billingCountry",
        };
        
        const billingField = billingFieldMap[name];
        if (billingField) {
          (newData as any)[billingField] = fieldValue;
        }
      }
      
      return newData;
    });

    // Mark field as touched
    setTouched(prev => ({ ...prev, [name]: true }));

    // Clear any existing error for this field
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: "",
      }));
    }

    // Validate field in real-time if it's been touched
    if (checkoutConfig.features.realTimeValidation && (touched[name] || fieldValue)) {
      const error = validateField(fieldName, fieldValue as string | boolean);
      setErrors(prev => ({
        ...prev,
        [name]: error,
      }));
    }
  };

  // Handle field blur for validation
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const fieldName = name as keyof FormData;
    
    setTouched(prev => ({ ...prev, [name]: true }));
    
    const error = validateField(fieldName, value);
    setErrors(prev => ({
      ...prev,
      [name]: error,
    }));
  };

  // Handle "Same as shipping" checkbox
  const handleSameAsShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      sameAsShipping: checked,
      // Auto-fill billing address if checked and feature is enabled
      ...(checked && checkoutConfig.features.autoFillBilling && {
        billingFullName: prev.shippingFullName,
        billingStreetAddress: prev.shippingStreetAddress,
        billingCity: prev.shippingCity,
        billingPostalCode: prev.shippingPostalCode,
        billingCountry: prev.shippingCountry,
      }),
    }));

    // Clear billing errors if same as shipping is checked
    if (checked) {
      setErrors(prev => ({
        ...prev,
        billingFullName: "",
        billingStreetAddress: "",
        billingCity: "",
        billingPostalCode: "",
        billingCountry: "",
      }));
    }
  };

  // Check form validity
  useEffect(() => {
    const hasErrors = Object.values(errors).some(error => error);
    const hasAllRequiredFields = !!formData.email.trim() && 
      !!formData.shippingFullName.trim() && 
      !!formData.shippingStreetAddress.trim() && 
      !!formData.shippingCity.trim() && 
      !!formData.shippingPostalCode.trim() && 
      !!formData.shippingCountry &&
      (formData.sameAsShipping || (
        !!formData.billingFullName.trim() && 
        !!formData.billingStreetAddress.trim() && 
        !!formData.billingCity.trim() && 
        !!formData.billingPostalCode.trim() && 
        !!formData.billingCountry
      ));

    setIsFormValid(!hasErrors && hasAllRequiredFields);
  }, [formData, errors]);

  // Form validation for submission
  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};
    let isValid = true;

    // Validate all fields
    Object.keys(formData).forEach(key => {
      const fieldName = key as keyof FormData;
      const fieldValue = formData[fieldName];
      const error = validateField(fieldName, fieldValue as string | boolean);
      
      if (error) {
        (newErrors as any)[fieldName] = error;
        isValid = false;
      }
    });

    // Mark all fields as touched
    const allFieldsTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach(key => {
      allFieldsTouched[key] = true;
    });
    
    setTouched(allFieldsTouched);
    setErrors(newErrors);
    
    return isValid;
  };

  return {
    formData,
    errors,
    touched,
    isFormValid,
    handleChange,
    handleBlur,
    handleSameAsShippingChange,
    validateForm
  };
};