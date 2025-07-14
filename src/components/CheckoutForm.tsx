"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/useToast";
import Toast from "./Toast";
import { checkoutConfig } from "@/config/checkout";

// Helper function for autocomplete values
const getAutoCompleteValue = (fieldName: string): string => {
  const autoCompleteMap: Record<string, string> = {
    email: 'email',
    shippingFullName: 'shipping name',
    billingFullName: 'billing name',
    shippingStreetAddress: 'shipping street-address',
    billingStreetAddress: 'billing street-address',
    shippingCity: 'shipping address-level2',
    billingCity: 'billing address-level2',
    shippingPostalCode: 'shipping postal-code',
    billingPostalCode: 'billing postal-code',
    shippingCountry: 'shipping country',
    billingCountry: 'billing country'
  };
  return autoCompleteMap[fieldName] || 'off';
};

// Input field component for consistency
const InputField = ({ 
  label, 
  name, 
  type = "text", 
  value, 
  onChange, 
  onBlur,
  error, 
  required = true 
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
}) => {
  const fieldId = `field-${name}`;
  const errorId = `error-${name}`;
  
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-sm font-medium" style={{ color: checkoutConfig.ui.primaryColor }}>
        {label} {required && <span className="text-red-500" aria-label="required">*</span>}
      </label>
      <input
        id={fieldId}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
          error 
            ? "border-red-500 focus:ring-red-500" 
            : "border-gray-300 hover:border-gray-400"
        }`}
        style={
          !error 
            ? { '--tw-ring-color': checkoutConfig.ui.primaryColor } as React.CSSProperties
            : undefined
        }
        placeholder={`Enter ${label.toLowerCase()}`}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : "false"}
        autoComplete={getAutoCompleteValue(name)}
      />
      {error && (
        <p id={errorId} className="text-red-500 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

// Select field component for consistency
const SelectField = ({ 
  label, 
  name, 
  value, 
  onChange, 
  onBlur,
  options, 
  error, 
  required = true 
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string;
  required?: boolean;
}) => {
  const fieldId = `field-${name}`;
  const errorId = `error-${name}`;
  
  return (
    <div className="space-y-1">
      <label htmlFor={fieldId} className="block text-sm font-medium" style={{ color: checkoutConfig.ui.primaryColor }}>
        {label} {required && <span className="text-red-500" aria-label="required">*</span>}
      </label>
      <select
        id={fieldId}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
          error 
            ? "border-red-500 focus:ring-red-500" 
            : "border-gray-300 hover:border-gray-400"
        }`}
        style={
          !error 
            ? { '--tw-ring-color': checkoutConfig.ui.primaryColor } as React.CSSProperties
            : undefined
        }
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : "false"}
        autoComplete={getAutoCompleteValue(name)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-red-500 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

interface FormData {
  // Contact Information
  email: string;
  
  // Shipping Address
  shippingFullName: string;
  shippingStreetAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  
  // Billing Address
  billingFullName: string;
  billingStreetAddress: string;
  billingCity: string;
  billingPostalCode: string;
  billingCountry: string;
  
  // Same as shipping checkbox
  sameAsShipping: boolean;
}

interface ValidationRules {
  customValidator: (value: string, context?: { sameAsShipping: boolean }) => string | null;
}

export default function CheckoutForm() {
  const router = useRouter();
  const { clearCart } = useCart();
  const { toast, showToast, hideToast } = useToast();
  
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

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      
      // If same as shipping is checked and this is a shipping field, update corresponding billing field (configurable)
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

    // Validate field in real-time if it's been touched (configurable)
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
  };



  // Check form validity
  useEffect(() => {
    const requiredFields: (keyof FormData)[] = [
      'email', 'shippingFullName', 'shippingStreetAddress', 
      'shippingCity', 'shippingPostalCode', 'shippingCountry'
    ];

    if (!formData.sameAsShipping) {
      requiredFields.push(
        'billingFullName', 'billingStreetAddress', 'billingCity',
        'billingPostalCode', 'billingCountry'
      );
    }

    const hasErrors = Object.values(errors).some(error => error);
    const hasAllRequiredFields = requiredFields.every(field => {
      const value = formData[field];
      return value && String(value).trim();
    });

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

  // Handle form submission
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, checkoutConfig.processingDelay));
      
      // Clear the cart
      clearCart();
      
      // Show success toast
      showToast(checkoutConfig.messages.orderSuccess, "success");
      
      // Redirect to homepage after a short delay
      setTimeout(() => {
        router.push("/");
      }, checkoutConfig.redirectDelay);
      
    } catch (error) {
      showToast(checkoutConfig.messages.orderError, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get countries from configuration
  const countries = checkoutConfig.countries;

  return (
    <>
      <form onSubmit={handlePlaceOrder} className="space-y-8">
        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-gray-200 pb-2" style={{ color: checkoutConfig.ui.primaryColor }}>
            Contact Information
          </h3>
          <InputField
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.email}
          />
        </div>

        {/* Shipping Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b border-gray-200 pb-2" style={{ color: checkoutConfig.ui.primaryColor }}>
            Shipping Address
          </h3>
          <InputField
            label="Full Name"
            name="shippingFullName"
            value={formData.shippingFullName}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.shippingFullName}
          />
          <InputField
            label="Street Address"
            name="shippingStreetAddress"
            value={formData.shippingStreetAddress}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.shippingStreetAddress}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="City"
              name="shippingCity"
              value={formData.shippingCity}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.shippingCity}
            />
            <InputField
              label="Postal Code"
              name="shippingPostalCode"
              value={formData.shippingPostalCode}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.shippingPostalCode}
            />
          </div>
          <SelectField
            label="Country"
            name="shippingCountry"
            value={formData.shippingCountry}
            onChange={handleChange}
            onBlur={handleBlur}
            options={countries}
            error={errors.shippingCountry}
          />
        </div>

        {/* Billing Address */}
        {checkoutConfig.features.billingAddressSection && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b border-gray-200 pb-2" style={{ color: checkoutConfig.ui.primaryColor }}>
              Billing Address
            </h3>
            
            {/* Same as shipping checkbox */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="sameAsShipping"
                name="sameAsShipping"
                checked={formData.sameAsShipping}
                onChange={handleSameAsShippingChange}
                className="w-4 h-4 border-gray-300 rounded focus:ring-2"
                style={{ 
                  color: checkoutConfig.ui.primaryColor,
                  '--tw-ring-color': checkoutConfig.ui.primaryColor 
                } as React.CSSProperties}
              />
              <label htmlFor="sameAsShipping" className="text-sm font-medium" style={{ color: checkoutConfig.ui.primaryColor }}>
                Same as shipping address
              </label>
            </div>

            {/* Billing address fields (only show if not same as shipping) */}
            {!formData.sameAsShipping && (
              <>
                <InputField
                  label="Full Name"
                  name="billingFullName"
                  value={formData.billingFullName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.billingFullName}
                />
                <InputField
                  label="Street Address"
                  name="billingStreetAddress"
                  value={formData.billingStreetAddress}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.billingStreetAddress}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="City"
                    name="billingCity"
                    value={formData.billingCity}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.billingCity}
                  />
                  <InputField
                    label="Postal Code"
                    name="billingPostalCode"
                    value={formData.billingPostalCode}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.billingPostalCode}
                  />
                </div>
                <SelectField
                  label="Country"
                  name="billingCountry"
                  value={formData.billingCountry}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  options={countries}
                  error={errors.billingCountry}
                />
              </>
            )}
          </div>
        )}

        {/* Place Order Button */}
        <div className="pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className={`w-full font-semibold py-4 px-8 rounded-lg shadow-sm transition-all duration-200 ${
              isSubmitting || !isFormValid
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "text-white hover:shadow-md"
            }`}
            style={
              !(isSubmitting || !isFormValid) 
                ? { backgroundColor: checkoutConfig.ui.primaryColor } 
                : undefined
            }
            onMouseEnter={(e) => {
              if (!(isSubmitting || !isFormValid)) {
                e.currentTarget.style.backgroundColor = checkoutConfig.ui.primaryHoverColor;
              }
            }}
            onMouseLeave={(e) => {
              if (!(isSubmitting || !isFormValid)) {
                e.currentTarget.style.backgroundColor = checkoutConfig.ui.primaryColor;
              }
            }}
            aria-describedby="submit-help"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Place Order"
            )}
          </button>
          {!isFormValid && !isSubmitting && (
            <p id="submit-help" className="text-sm text-gray-500 mt-2 text-center">
              {checkoutConfig.messages.formIncomplete}
            </p>
          )}
        </div>
      </form>

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        type={toast.type}
      />
    </>
  );
} 