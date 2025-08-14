"use client";

import React, { useState } from "react";
import { useCheckoutForm } from "@/hooks/useCheckoutForm";
import { ContactInfoSection } from "@/components/checkout/ContactInfoSection";
import { ShippingAddressSection } from "@/components/checkout/ShippingAddressSection";
import { BillingAddressSection } from "@/components/checkout/BillingAddressSection";
import PaymentProvider from "@/components/checkout/PaymentProvider";
import PaymentSection from "@/components/checkout/PaymentSection";
import { checkoutConfig, getCountriesFromEnv } from "@/config/checkout";
import Toast from "./Toast";
import { useToast } from "@/hooks/useToast";

/**
 * Refactored CheckoutForm component
 * 
 * Now much more maintainable with extracted:
 * - Form field components (InputField, SelectField)
 * - Section components (ContactInfo, ShippingAddress, BillingAddress)
 * - Form logic in custom hook (useCheckoutForm)
 * - Types in separate file
 * - Utilities in separate files
 */
export default function CheckoutForm() {
  const { toast, hideToast } = useToast();
  const {
    formData,
    errors,
    isSubmitting,
    isFormValid,
    handleChange,
    handleBlur,
    handleSameAsShippingChange,
    handleSubmit
  } = useCheckoutForm();

  // Payment state management
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [isPaymentValid, setIsPaymentValid] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>('');

  // Get countries using utility function for consistent SSR/client rendering
  const countries = getCountriesFromEnv();

  // Combined form validity includes payment validation
  const isCheckoutFormValid = isFormValid && isPaymentValid;

  // Handle payment method changes
  const handlePaymentMethodChange = (method: 'card' | 'apple_pay' | 'google_pay') => {
    setSelectedPaymentMethod(method);
  };

  // Handle payment validation changes
  const handlePaymentValidationChange = (isValid: boolean) => {
    setIsPaymentValid(isValid);
  };

  return (
    <>
      <PaymentProvider clientSecret={clientSecret}>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Contact Information Section */}
          <ContactInfoSection
            formData={formData}
            errors={errors}
            onChange={handleChange}
            onBlur={handleBlur}
          />

          {/* Shipping Address Section */}
          <ShippingAddressSection
            formData={formData}
            errors={errors}
            onChange={handleChange}
            onBlur={handleBlur}
            countries={countries}
          />

          {/* Billing Address Section */}
          <BillingAddressSection
            formData={formData}
            errors={errors}
            onChange={handleChange}
            onBlur={handleBlur}
            onSameAsShippingChange={handleSameAsShippingChange}
            countries={countries}
          />

          {/* Payment Information Section */}
          <PaymentSection
            onPaymentMethodChange={handlePaymentMethodChange}
            onValidationChange={handlePaymentValidationChange}
            disabled={isSubmitting}
          />

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={!isCheckoutFormValid || isSubmitting}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
                isCheckoutFormValid && !isSubmitting
                  ? 'hover:opacity-90 focus:ring-4 focus:ring-offset-2'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ 
                backgroundColor: checkoutConfig.ui.primaryColor,
                '--tw-ring-color': checkoutConfig.ui.primaryColor 
              } as React.CSSProperties}
              aria-label={isSubmitting ? "Processing payment..." : "Complete Order"}
              aria-describedby="submit-help"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing Payment...
                </div>
              ) : (
                `Complete Order${selectedPaymentMethod === 'card' ? ' with Card' : selectedPaymentMethod === 'apple_pay' ? ' with Apple Pay' : ' with Google Pay'}`
              )}
            </button>
            {!isCheckoutFormValid && !isSubmitting && (
              <p id="submit-help" className="text-sm text-gray-500 mt-2 text-center">
                {!isFormValid 
                  ? checkoutConfig.messages.formIncomplete 
                  : 'Please complete payment information to continue'
                }
              </p>
            )}
          </div>
        </form>
      </PaymentProvider>
      
      {/* Toast notifications */}
      {toast && <Toast {...toast} onClose={hideToast} />}
    </>
  );
}