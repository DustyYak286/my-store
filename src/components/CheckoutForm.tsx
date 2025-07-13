"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/useToast";
import Toast from "./Toast";

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
    sameAsShipping: true,
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error when user starts typing
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Handle "Same as shipping" checkbox
  const handleSameAsShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      sameAsShipping: checked,
      // Auto-fill billing address if checked
      ...(checked && {
        billingFullName: prev.shippingFullName,
        billingStreetAddress: prev.shippingStreetAddress,
        billingCity: prev.shippingCity,
        billingPostalCode: prev.shippingPostalCode,
        billingCountry: prev.shippingCountry,
      }),
    }));
  };

  // Auto-fill billing address when shipping address changes and sameAsShipping is true
  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // If same as shipping is checked, update corresponding billing field
      if (prev.sameAsShipping) {
        const billingFieldMap: { [key: string]: string } = {
          shippingFullName: "billingFullName",
          shippingStreetAddress: "billingStreetAddress", 
          shippingCity: "billingCity",
          shippingPostalCode: "billingPostalCode",
          shippingCountry: "billingCountry",
        };
        
        const billingField = billingFieldMap[name];
        if (billingField) {
          (newData as any)[billingField] = value;
        }
      }
      
      return newData;
    });

    // Clear error when user starts typing
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Shipping address validation
    if (!formData.shippingFullName.trim()) {
      newErrors.shippingFullName = "Full name is required";
    }
    if (!formData.shippingStreetAddress.trim()) {
      newErrors.shippingStreetAddress = "Street address is required";
    }
    if (!formData.shippingCity.trim()) {
      newErrors.shippingCity = "City is required";
    }
    if (!formData.shippingPostalCode.trim()) {
      newErrors.shippingPostalCode = "Postal code is required";
    }
    if (!formData.shippingCountry.trim()) {
      newErrors.shippingCountry = "Country is required";
    }

    // Billing address validation (only if not same as shipping)
    if (!formData.sameAsShipping) {
      if (!formData.billingFullName.trim()) {
        newErrors.billingFullName = "Full name is required";
      }
      if (!formData.billingStreetAddress.trim()) {
        newErrors.billingStreetAddress = "Street address is required";
      }
      if (!formData.billingCity.trim()) {
        newErrors.billingCity = "City is required";
      }
      if (!formData.billingPostalCode.trim()) {
        newErrors.billingPostalCode = "Postal code is required";
      }
      if (!formData.billingCountry.trim()) {
        newErrors.billingCountry = "Country is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear the cart
      clearCart();
      
      // Show success toast
      showToast("Thank you for your order!", "success");
      
      // Redirect to homepage after a short delay
      setTimeout(() => {
        router.push("/");
      }, 2000);
      
    } catch (error) {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Input field component for consistency
  const InputField = ({ 
    label, 
    name, 
    type = "text", 
    value, 
    onChange, 
    error, 
    required = true 
  }: {
    label: string;
    name: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    required?: boolean;
  }) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[#7C4D59]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C4D59] focus:border-transparent transition-colors ${
          error ? "border-red-500" : "border-gray-300"
        }`}
        placeholder={`Enter ${label.toLowerCase()}`}
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );

  // Select field component for consistency
  const SelectField = ({ 
    label, 
    name, 
    value, 
    onChange, 
    options, 
    error, 
    required = true 
  }: {
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
    error?: string;
    required?: boolean;
  }) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[#7C4D59]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C4D59] focus:border-transparent transition-colors ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );

  const countries = [
    "United States", "Canada", "United Kingdom", "Australia", "Germany", 
    "France", "Italy", "Spain", "Netherlands", "Belgium", "Other"
  ];

  return (
    <>
      <form onSubmit={handlePlaceOrder} className="space-y-8">
        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#7C4D59] border-b border-gray-200 pb-2">
            Contact Information
          </h3>
          <InputField
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
          />
        </div>

        {/* Shipping Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#7C4D59] border-b border-gray-200 pb-2">
            Shipping Address
          </h3>
          <InputField
            label="Full Name"
            name="shippingFullName"
            value={formData.shippingFullName}
            onChange={handleShippingChange}
            error={errors.shippingFullName}
          />
          <InputField
            label="Street Address"
            name="shippingStreetAddress"
            value={formData.shippingStreetAddress}
            onChange={handleShippingChange}
            error={errors.shippingStreetAddress}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="City"
              name="shippingCity"
              value={formData.shippingCity}
              onChange={handleShippingChange}
              error={errors.shippingCity}
            />
            <InputField
              label="Postal Code"
              name="shippingPostalCode"
              value={formData.shippingPostalCode}
              onChange={handleShippingChange}
              error={errors.shippingPostalCode}
            />
          </div>
          <SelectField
            label="Country"
            name="shippingCountry"
            value={formData.shippingCountry}
            onChange={handleShippingChange}
            options={countries}
            error={errors.shippingCountry}
          />
        </div>

        {/* Billing Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#7C4D59] border-b border-gray-200 pb-2">
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
              className="w-4 h-4 text-[#7C4D59] border-gray-300 rounded focus:ring-[#7C4D59] focus:ring-2"
            />
            <label htmlFor="sameAsShipping" className="text-sm font-medium text-[#7C4D59]">
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
                error={errors.billingFullName}
              />
              <InputField
                label="Street Address"
                name="billingStreetAddress"
                value={formData.billingStreetAddress}
                onChange={handleChange}
                error={errors.billingStreetAddress}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="City"
                  name="billingCity"
                  value={formData.billingCity}
                  onChange={handleChange}
                  error={errors.billingCity}
                />
                <InputField
                  label="Postal Code"
                  name="billingPostalCode"
                  value={formData.billingPostalCode}
                  onChange={handleChange}
                  error={errors.billingPostalCode}
                />
              </div>
              <SelectField
                label="Country"
                name="billingCountry"
                value={formData.billingCountry}
                onChange={handleChange}
                options={countries}
                error={errors.billingCountry}
              />
            </>
          )}
        </div>

        {/* Place Order Button */}
        <div className="pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#7C4D59] text-white font-semibold py-4 px-8 rounded-lg shadow-sm hover:bg-[#633a48] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Processing..." : "Place Order"}
          </button>
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