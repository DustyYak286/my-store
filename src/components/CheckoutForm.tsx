"use client";

import React from "react";
import { useCheckoutForm } from "@/hooks/useCheckoutForm";
import { ContactInfoSection } from "@/components/checkout/ContactInfoSection";
import { ShippingAddressSection } from "@/components/checkout/ShippingAddressSection";
import { BillingAddressSection } from "@/components/checkout/BillingAddressSection";
import { checkoutConfig } from "@/config/checkout";
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

  // Get countries from configuration
  const countries = checkoutConfig.countries;

  return (
    <>
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

        {/* Submit Button */}
        <div className="pt-6">
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
              isFormValid && !isSubmitting
                ? 'hover:opacity-90 focus:ring-4 focus:ring-offset-2'
                : 'opacity-50 cursor-not-allowed'
            }`}
            style={{ 
              backgroundColor: checkoutConfig.ui.primaryColor,
              '--tw-ring-color': checkoutConfig.ui.primaryColor 
            } as React.CSSProperties}
            aria-label={isSubmitting ? "Processing order..." : "Place order"}
            aria-describedby="submit-help"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
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
      
      {/* Toast notifications */}
      {toast && <Toast {...toast} onClose={hideToast} />}
    </>
  );
}