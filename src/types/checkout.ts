/**
 * Types for checkout form functionality
 */

export interface FormData {
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

export interface ValidationRules {
  customValidator: (value: string, context?: { sameAsShipping: boolean }) => string | null;
}

export interface FormErrors extends Partial<FormData> {}

export interface FormTouched extends Record<string, boolean> {}

export interface UseCheckoutFormReturn {
  formData: FormData;
  errors: FormErrors;
  touched: FormTouched;
  isSubmitting: boolean;
  isFormValid: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  handleSameAsShippingChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  validateForm: () => boolean;
}