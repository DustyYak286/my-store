"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import { checkoutConfig } from '@/config/checkout';
import { useCart } from '@/context/CartContext';
import { detectAvailablePaymentMethods, detectPaymentMethodsWithStripe } from '@/lib/stripe-client';
import PaymentMethodSelector from './PaymentMethodSelector';
import CardPaymentForm from './CardPaymentForm';
import DigitalWalletButtons from './DigitalWalletButtons';
import { 
  validatePaymentAmount, 
  formatCurrency, 
  PAYMENT_LIMITS,
  PAYMENT_ERROR_MESSAGES 
} from '@/constants/payments';

interface PaymentSectionProps {
  onPaymentMethodChange?: (method: 'card' | 'apple_pay' | 'google_pay') => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
}

export type PaymentMethod = 'card' | 'apple_pay' | 'google_pay';

/**
 * PaymentSection Component
 * 
 * Main payment interface that provides:
 * - Payment method selection (cards, Apple Pay, Google Pay)
 * - Stripe Elements integration for secure payment input
 * - Real-time validation and error feedback
 * - Consistent styling with checkout form
 * - Accessibility compliance
 */
export default function PaymentSection({ 
  onPaymentMethodChange, 
  onValidationChange,
  disabled = false
}: PaymentSectionProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { totalPrice: cartTotal, cartItems, cartCount } = useCart();
  
  // Debug logging for cart state
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 PaymentSection cart state:', {
      cartTotal,
      cartItemsCount: cartItems.length,
      cartCount,
      cartTotalType: typeof cartTotal,
      isValidCartTotal: typeof cartTotal === 'number' && !isNaN(cartTotal) && cartTotal > 0
    });
  }
  
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card'); // Default to card
  const [availableMethods, setAvailableMethods] = useState({
    card: true,
    applePay: false,
    googlePay: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [paymentFormValid, setPaymentFormValid] = useState(false);
  const [amountValidation, setAmountValidation] = useState<{
    isValid: boolean;
    error?: string;
    warning?: string;
  }>({ isValid: true });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Initialize available payment methods
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const initializePaymentMethods = async () => {
      try {
        if (!isMounted) return;
        setIsLoading(true);
        
        // Use enhanced Stripe-based detection if Stripe is available
        let detected;
        if (stripe) {
          try {
            detected = await detectPaymentMethodsWithStripe(stripe, Math.round(cartTotal * 100));
          } catch (stripeError) {
            if (!isMounted) return; // Bail out if unmounted
            console.warn('Stripe-based detection failed, falling back to basic detection:', stripeError);
            detected = detectAvailablePaymentMethods();
          }
        } else {
          // Use basic detection if Stripe is not yet loaded
          detected = detectAvailablePaymentMethods();
        }
        
        if (!isMounted) return; // Bail out if unmounted
        
        setAvailableMethods({
          card: true, // Card payment should always be available
          applePay: detected.applePay,
          googlePay: detected.googlePay,
        });
        
        // Set default method to card, but allow user to choose
        // Only auto-select if current method is not available
        if (selectedMethod === 'apple_pay' && !detected.applePay) {
          if (!isMounted) return; // Bail out if unmounted
          setSelectedMethod('card');
        } else if (selectedMethod === 'google_pay' && !detected.googlePay) {
          if (!isMounted) return; // Bail out if unmounted
          setSelectedMethod('card');
        }
        
        console.log('Payment methods initialized:', {
          detected,
          selectedMethod,
          cartTotal,
        });
      } catch (error) {
        if (!isMounted) return; // Bail out if unmounted
        console.error('Failed to initialize payment methods:', error);
        // Fallback to card only
        setAvailableMethods({
          card: true, // Card payment should always be available
          applePay: false,
          googlePay: false,
        });
        setSelectedMethod('card');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializePaymentMethods();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [stripe, cartTotal, selectedMethod]);

  // Notify parent of payment method changes
  useEffect(() => {
    onPaymentMethodChange?.(selectedMethod);
  }, [selectedMethod, onPaymentMethodChange]);

  // Validate payment amount
  const validateAmount = useCallback(() => {
    if (typeof cartTotal !== 'number' || cartTotal <= 0) {
      return {
        isValid: false,
        error: 'Invalid cart total. Please refresh and try again.',
      };
    }

    const validation = validatePaymentAmount(cartTotal);
    setAmountValidation(validation);
    return validation;
  }, [cartTotal]);

  // Run amount validation when cart total changes
  useEffect(() => {
    validateAmount();
  }, [validateAmount]);

  // Comprehensive validation state management
  const updateValidationState = useCallback(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Amount validation
    const amountCheck = validateAmount();
    if (!amountCheck.isValid && amountCheck.error) {
      errors.push(amountCheck.error);
    }

    // Payment method validation
    if (!availableMethods[selectedMethod === 'apple_pay' ? 'applePay' : selectedMethod === 'google_pay' ? 'googlePay' : 'card']) {
      errors.push(`Selected payment method (${selectedMethod.replace('_', ' ')}) is not available.`);
    }

    // Form validation for card payments
    if (selectedMethod === 'card' && !paymentFormValid) {
      // Don't show generic error if there are already specific validation errors
      if (errors.length === 0) {
        warnings.push('Please complete payment information to continue.');
      }
    }

    // Stripe readiness validation
    if (!stripe || !elements) {
      warnings.push('Payment system is still loading...');
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);

    // Overall validation state
    const isOverallValid = errors.length === 0 && 
                          amountCheck.isValid && 
                          (selectedMethod === 'card' ? paymentFormValid : true) &&
                          !!stripe && !!elements;

    onValidationChange?.(isOverallValid);
  }, [
    validateAmount,
    availableMethods, 
    selectedMethod, 
    paymentFormValid, 
    stripe, 
    elements, 
    onValidationChange
  ]);

  // Update validation state when dependencies change
  useEffect(() => {
    updateValidationState();
  }, [updateValidationState]);

  const handleMethodChange = (method: PaymentMethod) => {
    setSelectedMethod(method);
  };

  const handleCardValidationChange = (isValid: boolean) => {
    setPaymentFormValid(isValid);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 
          className="text-lg font-semibold border-b border-gray-200 pb-2" 
          style={{ color: checkoutConfig.ui.primaryColor }}
        >
          Payment Information
        </h3>
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 
          className="text-lg font-semibold border-b border-gray-200 pb-2 flex-1" 
          style={{ color: checkoutConfig.ui.primaryColor }}
        >
          <svg 
            className="w-5 h-5 inline-block mr-2 mb-1" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" 
            />
          </svg>
          Payment Information
        </h3>
        
        {/* Security Badge */}
        <div className="flex items-center text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
          Secured by Stripe
        </div>
      </div>

      {/* Payment Method Selector */}
      <PaymentMethodSelector
        availableMethods={availableMethods}
        selectedMethod={selectedMethod}
        onMethodChange={handleMethodChange}
        disabled={disabled}
      />

      {/* Payment Forms */}
      <div className="mt-6">
        {selectedMethod === 'card' && (
          <CardPaymentForm
            onValidationChange={handleCardValidationChange}
            disabled={disabled}
          />
        )}

        {(selectedMethod === 'apple_pay' || selectedMethod === 'google_pay') && (
          <DigitalWalletButtons
            selectedMethod={selectedMethod}
            amount={cartTotal}
            disabled={disabled}
          />
        )}
      </div>

      {/* Payment Security Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg 
            className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              Your payment information is secure
            </h4>
            <p className="text-sm text-blue-700">
              We use industry-standard encryption to protect your payment details. 
              Your card information is processed securely by Stripe and never stored on our servers.
            </p>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="space-y-2">
          {validationErrors.map((error, index) => (
            <div key={index} className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <svg 
                className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-1">
                  Validation Error
                </h4>
                <p className="text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && validationErrors.length === 0 && (
        <div className="space-y-2">
          {validationWarnings.map((warning, index) => (
            <div key={index} className="flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <svg 
                className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              <div>
                <h4 className="text-sm font-medium text-amber-800 mb-1">
                  Validation Status
                </h4>
                <p className="text-sm text-amber-700">
                  {warning}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Amount Display with Validation Status */}
      <div className={`rounded-lg p-4 border-2 transition-all duration-200 ${
        !amountValidation.isValid 
          ? 'bg-red-50 border-red-200' 
          : cartTotal < PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY * 2 
            ? 'bg-amber-50 border-amber-200' 
            : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-sm font-medium text-gray-700">Total Amount:</span>
            {!amountValidation.isValid && (
              <p className="text-xs text-red-600">{amountValidation.error}</p>
            )}
            {cartTotal < PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY * 2 && amountValidation.isValid && (
              <p className="text-xs text-amber-600">
                Minimum recommended: {formatCurrency(PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY * 2)}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className={`text-lg font-bold ${
              !amountValidation.isValid ? 'text-red-900' : 'text-gray-900'
            }`}>
              {formatCurrency(cartTotal)}
            </span>
            <div className="text-xs text-gray-500 mt-1">
              Limit: {formatCurrency(PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY)} - {formatCurrency(PAYMENT_LIMITS.MAX_AMOUNT_DISPLAY)}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Validation Status */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            validationErrors.length === 0 
              ? validationWarnings.length === 0 
                ? 'bg-green-500' 
                : 'bg-amber-500'
              : 'bg-red-500'
          }`}></div>
          <span className={`text-sm ${
            validationErrors.length === 0 
              ? validationWarnings.length === 0 
                ? 'text-green-700' 
                : 'text-amber-700'
              : 'text-red-700'
          }`}>
            {validationErrors.length === 0 
              ? validationWarnings.length === 0 
                ? 'Payment ready' 
                : `${validationWarnings.length} warning${validationWarnings.length > 1 ? 's' : ''}`
              : `${validationErrors.length} error${validationErrors.length > 1 ? 's' : ''}`
            }
          </span>
        </div>
        <div className="text-gray-500">
          Method: {selectedMethod.replace('_', ' ')}
        </div>
      </div>
    </div>
  );
}