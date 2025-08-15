"use client";

import React, { useState, useCallback } from "react";
import { useCheckoutForm } from "@/hooks/useCheckoutForm";
import { useStripePayment } from "@/hooks/useStripePayment";
import { ContactInfoSection } from "@/components/checkout/ContactInfoSection";
import { ShippingAddressSection } from "@/components/checkout/ShippingAddressSection";
import { BillingAddressSection } from "@/components/checkout/BillingAddressSection";
import PaymentProvider from "@/components/checkout/PaymentProvider";
import PaymentSection from "@/components/checkout/PaymentSection";
import { checkoutConfig, getCountriesFromEnv } from "@/config/checkout";
import Toast from "./Toast";
import { useToast } from "@/hooks/useToast";
import type { PaymentResult, PaymentError } from "@/hooks/useStripePayment";

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
interface CheckoutFormInnerProps {
  formData: any;
  errors: any;
  isFormValid: boolean;
  handleChange: any;
  handleBlur: any;
  handleSameAsShippingChange: any;
  validateForm: any;
  clientSecret: string | undefined;
  onPaymentMethodChange: (method: 'card' | 'apple_pay' | 'google_pay') => void;
  onPaymentValidationChange: (isValid: boolean) => void;
}

function CheckoutFormInner({
  formData,
  errors,
  isFormValid,
  handleChange,
  handleBlur,
  handleSameAsShippingChange,
  validateForm,
  clientSecret,
  onPaymentMethodChange,
  onPaymentValidationChange,
}: CheckoutFormInnerProps) {
  // Payment state management
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [isPaymentValid, setIsPaymentValid] = useState(false);

  // Initialize Stripe payment processing hook (now inside Stripe Elements context)
  const {
    paymentState,
    processPayment,
    cancelPayment,
    resetPaymentState,
    canRetry,
    timeElapsed,
    isTimeout
  } = useStripePayment({
    enableRetry: true,
    maxAttempts: 3,
    timeoutMs: 60000, // 60 seconds
    warningTimeoutMs: 30000, // 30 seconds
    enableDoubleSubmissionPrevention: true,
    onPaymentStart: () => {
      console.log('🔄 Payment processing started');
    },
    onPaymentSuccess: (result: PaymentResult) => {
      console.log('✅ Payment successful:', result);
    },
    onPaymentError: (error: PaymentError) => {
      console.error('❌ Payment failed:', error);
    },
    onTimeout: () => {
      console.warn('⏰ Payment timeout occurred');
    },
    onRetryAttempt: (attempt: number, maxAttempts: number) => {
      console.log(`🔄 Payment retry attempt ${attempt}/${maxAttempts}`);
    },
  });

  // Get countries using utility function for consistent SSR/client rendering
  const countries = getCountriesFromEnv();

  // Combined form validity includes payment validation
  const isCheckoutFormValid = isFormValid && isPaymentValid;

  // Combined processing state from both form and payment
  const isProcessing = paymentState.isProcessing || paymentState.isSubmitting;

  // Handle payment method changes
  const handlePaymentMethodChange = useCallback((method: 'card' | 'apple_pay' | 'google_pay') => {
    setSelectedPaymentMethod(method);
    onPaymentMethodChange(method);
  }, [onPaymentMethodChange]);

  // Handle payment validation changes
  const handlePaymentValidationChange = useCallback((isValid: boolean) => {
    setIsPaymentValid(isValid);
    onPaymentValidationChange(isValid);
  }, [onPaymentValidationChange]);

  // Enhanced form submission with payment processing
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔄 Form submission started');

    // First validate the form data
    if (!validateForm()) {
      console.warn('⚠️ Form validation failed');
      return;
    }

    // Check if payment is valid
    if (!isPaymentValid) {
      console.warn('⚠️ Payment validation failed');
      return;
    }

    // Reset any previous payment state
    resetPaymentState();

    try {
      // Process payment with integrated flow
      console.log('🔄 Starting payment processing...');
      const result = await processPayment(formData);
      
      if (result.success) {
        console.log('✅ Payment completed successfully');
        // Success handling is done in the useStripePayment hook
        // (cart clearing, toast notifications, redirect)
      } else {
        console.error('❌ Payment failed:', result.error);
        // Error handling is done in the useStripePayment hook
        // (error messages, retry logic, etc.)
      }
    } catch (error) {
      console.error('❌ Unexpected error during payment processing:', error);
      // This should be handled by the useStripePayment hook, but just in case
    }
  }, [validateForm, isPaymentValid, resetPaymentState, processPayment, formData]);

  // Handle payment cancellation
  const handleCancelPayment = useCallback(() => {
    cancelPayment();
  }, [cancelPayment]);

  return (
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
        disabled={isProcessing}
      />

          {/* Enhanced Submit Button with Payment State */}
          <div className="pt-6 space-y-4">
            {/* Payment Status Display */}
            {paymentState.hasStarted && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isProcessing ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    ) : paymentState.lastError ? (
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                    
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        {isProcessing ? (
                          `Processing Payment... (Attempt ${paymentState.currentAttempt}/3)`
                        ) : paymentState.lastError ? (
                          'Payment Failed'
                        ) : (
                          'Payment Ready'
                        )}
                      </p>
                      {timeElapsed > 0 && (
                        <p className="text-xs text-blue-700">
                          Time elapsed: {Math.ceil(timeElapsed / 1000)}s
                          {isTimeout && ' (Timeout reached)'}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {isProcessing && (
                    <button
                      type="button"
                      onClick={handleCancelPayment}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                
                {paymentState.lastError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800">{paymentState.lastError.message}</p>
                    {canRetry && (
                      <p className="text-xs text-red-600 mt-1">
                        You can retry this payment ({paymentState.currentAttempt}/{3} attempts used)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Main Submit Button */}
            <button
              type="submit"
              disabled={!isCheckoutFormValid || isProcessing}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
                isCheckoutFormValid && !isProcessing
                  ? 'hover:opacity-90 focus:ring-4 focus:ring-offset-2'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ 
                backgroundColor: checkoutConfig.ui.primaryColor,
                '--tw-ring-color': checkoutConfig.ui.primaryColor 
              } as React.CSSProperties}
              aria-label={isProcessing ? "Processing payment..." : "Complete Order"}
              aria-describedby="submit-help"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {paymentState.currentAttempt > 1 
                    ? `Retrying Payment... (${paymentState.currentAttempt}/3)`
                    : 'Processing Payment...'
                  }
                </div>
              ) : paymentState.lastError && canRetry ? (
                'Retry Payment'
              ) : (
                `Complete Order${selectedPaymentMethod === 'card' ? ' with Card' : selectedPaymentMethod === 'apple_pay' ? ' with Apple Pay' : ' with Google Pay'}`
              )}
            </button>
            
            {/* Help Text */}
            {!isCheckoutFormValid && !isProcessing && (
              <p id="submit-help" className="text-sm text-gray-500 mt-2 text-center">
                {!isFormValid 
                  ? checkoutConfig.messages.formIncomplete 
                  : 'Please complete payment information to continue'
                }
              </p>
            )}
            
            {/* Payment Security Note */}
            {isCheckoutFormValid && !isProcessing && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                🔒 Your payment information is encrypted and secure
              </p>
            )}
          </div>
    </form>
  );
}

export default function CheckoutForm() {
  const { toast, hideToast } = useToast();
  const {
    formData,
    errors,
    isFormValid,
    handleChange,
    handleBlur,
    handleSameAsShippingChange,
    validateForm
  } = useCheckoutForm();

  // Payment state management
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [isPaymentValid, setIsPaymentValid] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | undefined>(undefined); // undefined until Payment Intent is created

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
        <CheckoutFormInner
          formData={formData}
          errors={errors}
          isFormValid={isFormValid}
          handleChange={handleChange}
          handleBlur={handleBlur}
          handleSameAsShippingChange={handleSameAsShippingChange}
          validateForm={validateForm}
          clientSecret={clientSecret}
          onPaymentMethodChange={handlePaymentMethodChange}
          onPaymentValidationChange={handlePaymentValidationChange}
        />
      </PaymentProvider>
      
      {/* Toast notifications */}
      {toast && <Toast {...toast} onClose={hideToast} />}
    </>
  );
}