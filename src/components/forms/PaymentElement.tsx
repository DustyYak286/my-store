"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  PaymentElement as StripePaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { StripePaymentElementOptions } from '@stripe/stripe-js';
import { checkoutConfig } from '@/config/checkout';
import { categorizeClientStripeError } from '@/lib/stripe-client';

export interface PaymentElementProps {
  /** Label for the payment element */
  label?: string;
  /** Whether the payment element is required */
  required?: boolean;
  /** Whether the payment element is disabled */
  disabled?: boolean;
  /** Custom error message to display */
  error?: string;
  /** Callback when payment validation changes */
  onValidationChange?: (isValid: boolean) => void;
  /** Callback when payment element is ready */
  onReady?: () => void;
  /** Callback when payment element is focused */
  onFocus?: () => void;
  /** Callback when payment element loses focus */
  onBlur?: () => void;
  /** Custom styling options for Stripe Elements */
  elementOptions?: Partial<StripePaymentElementOptions>;
  /** Additional CSS classes */
  className?: string;
  /** Show loading state */
  loading?: boolean;
}

/**
 * PaymentElement Component
 * 
 * A reusable wrapper around Stripe's PaymentElement with:
 * - Consistent styling with the existing form design system
 * - Comprehensive error handling and validation
 * - Loading states and user feedback
 * - Accessibility compliance
 * - Integration with checkout configuration
 * - Real-time validation status reporting
 */
export const PaymentElement: React.FC<PaymentElementProps> = ({
  label = "Payment Information",
  required = true,
  disabled = false,
  error: externalError,
  onValidationChange,
  onReady,
  onFocus,
  onBlur,
  elementOptions = {},
  className = "",
  loading = false,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  
  // Internal state
  const [isElementReady, setIsElementReady] = useState(false);
  const [isElementFocused, setIsElementFocused] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // Computed states
  const displayError = externalError || internalError;
  const isDisabled = disabled || loading || !stripe || !elements;
  const showLoading = loading || !stripe || !elements || !isElementReady;

  // Generate unique IDs for accessibility
  const elementId = `payment-element-${Math.random().toString(36).substring(2, 9)}`;
  const labelId = `${elementId}-label`;
  const errorId = `${elementId}-error`;
  const descriptionId = `${elementId}-description`;

  // Default element options with design system integration
  const defaultElementOptions: StripePaymentElementOptions = {
    layout: {
      type: 'tabs',
      defaultCollapsed: false,
      radios: false,
      spacedAccordionItems: false,
    },
    fields: {
      billingDetails: {
        name: 'auto',
        email: 'auto',
        phone: 'auto',
        address: {
          line1: 'auto',
          line2: 'auto',
          city: 'auto',
          state: 'auto',
          postalCode: 'auto',
          country: 'auto',
        },
      },
    },
    terms: {
      card: 'auto',
    },
    wallets: {
      applePay: 'auto',
      googlePay: 'auto',
    },
    ...elementOptions,
  };

  // Handle element changes (validation, completion, errors)
  const handleChange = useCallback((event: any) => {
    setIsValidating(true);
    
    if (event.error) {
      const categorizedError = categorizeClientStripeError(event.error);
      setInternalError(categorizedError.userMessage);
      setIsComplete(false);
      onValidationChange?.(false);
    } else {
      setInternalError(null);
      setIsComplete(event.complete);
      onValidationChange?.(event.complete);
    }
    
    setIsValidating(false);
  }, [onValidationChange]);

  // Handle element ready state
  const handleReady = useCallback(() => {
    setIsElementReady(true);
    setInternalError(null);
    onReady?.();
  }, [onReady]);

  // Handle element focus
  const handleFocus = useCallback(() => {
    setIsElementFocused(true);
    setInternalError(null);
    onFocus?.();
  }, [onFocus]);

  // Handle element blur
  const handleBlur = useCallback(() => {
    setIsElementFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Clear internal errors when external error changes
  useEffect(() => {
    if (externalError) {
      setInternalError(null);
    }
  }, [externalError]);

  // Handle Stripe/Elements initialization
  useEffect(() => {
    if (!stripe || !elements) {
      setIsElementReady(false);
    }
  }, [stripe, elements]);

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Label */}
      <label 
        id={labelId}
        className="block text-sm font-medium" 
        style={{ color: checkoutConfig.ui.primaryColor }}
      >
        {label} {required && <span className="text-red-500" aria-label="required">*</span>}
      </label>

      {/* Payment Element Container */}
      <div className="relative">
        {/* Loading Overlay */}
        {showLoading && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-20 rounded-lg border border-gray-300">
            <div className="flex items-center text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
              Loading payment form...
            </div>
          </div>
        )}

        {/* Disabled Overlay */}
        {isDisabled && !showLoading && (
          <div className="absolute inset-0 bg-gray-50/75 cursor-not-allowed rounded-lg z-10"></div>
        )}

        {/* Stripe Payment Element */}
        <div 
          className={`
            relative transition-all duration-200 rounded-lg border
            ${displayError 
              ? 'border-red-500 ring-2 ring-red-200' 
              : isElementFocused 
                ? 'border-transparent ring-2'
                : 'border-gray-300 hover:border-gray-400'
            }
            ${isDisabled ? 'opacity-50' : ''}
          `}
          style={
            isElementFocused && !displayError
              ? { '--tw-ring-color': `${checkoutConfig.ui.primaryColor}33` } as React.CSSProperties
              : undefined
          }
        >
          <div className="p-4">
            {stripe && elements ? (
              <StripePaymentElement
                id={elementId}
                options={defaultElementOptions}
                onChange={handleChange}
                onReady={handleReady}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            ) : (
              <div className="space-y-3">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation Status */}
      {isValidating && !displayError && (
        <div className="flex items-center text-sm text-gray-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-2"></div>
          Validating payment information...
        </div>
      )}

      {/* Completion Status */}
      {isComplete && !displayError && !isValidating && (
        <div className="flex items-center text-sm text-green-600">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Payment information is valid
        </div>
      )}

      {/* Error Display */}
      {displayError && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <svg 
            className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <div>
            <h4 className="text-sm font-medium text-red-800 mb-1">
              Payment Information Error
            </h4>
            <p 
              id={errorId} 
              className="text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {displayError}
            </p>
          </div>
        </div>
      )}

      {/* Security Information */}
      <div 
        id={descriptionId}
        className="bg-gray-50 rounded-lg p-3"
      >
        <div className="flex items-center text-xs text-gray-600">
          <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="font-medium">Secured by Stripe</span>
          <span className="mx-2">•</span>
          <span>256-bit SSL encryption</span>
          <span className="mx-2">•</span>
          <span>PCI DSS compliant</span>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Your payment information is processed securely and never stored on our servers.
        </div>
      </div>

      {/* Supported Payment Methods */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
        <span>Accepted payment methods:</span>
        <div className="flex items-center space-x-2">
          {/* Card Icons */}
          <div className="flex items-center space-x-1">
            {/* Visa */}
            <div className="w-6 h-4 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">
              V
            </div>
            {/* Mastercard */}
            <div className="w-6 h-4 bg-red-500 rounded text-white text-xs flex items-center justify-center font-bold">
              MC
            </div>
            {/* American Express */}
            <div className="w-6 h-4 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">
              AX
            </div>
            {/* Generic */}
            <div className="w-6 h-4 bg-gray-400 rounded text-white text-xs flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
              </svg>
            </div>
          </div>
          
          {/* Digital Wallets */}
          <div className="flex items-center space-x-1 ml-2">
            {/* Apple Pay */}
            <div className="w-8 h-4 bg-black rounded flex items-center justify-center">
              <svg className="w-4 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </div>
            
            {/* Google Pay */}
            <div className="w-8 h-4 bg-white border border-gray-300 rounded flex items-center justify-center">
              <svg className="w-4 h-2.5" viewBox="0 0 41 17" fill="none">
                <path d="M19.26 17c-4.61 0-8.36-3.72-8.36-8.5S14.65 0 19.26 0s8.36 3.72 8.36 8.5-3.75 8.5-8.36 8.5zm0-15.3c-3.72 0-6.73 3.04-6.73 6.8 0 3.76 3.01 6.8 6.73 6.8s6.73-3.04 6.73-6.8c0-3.76-3.01-6.8-6.73-6.8z" fill="#EA4335"/>
                <path d="M8.25 17c-4.56 0-8.25-3.72-8.25-8.5S3.69 0 8.25 0c2.25 0 4.31.91 5.82 2.56l-2.14 2.14C10.82 3.58 9.58 3.06 8.25 3.06c-2.97 0-5.38 2.44-5.38 5.44s2.41 5.44 5.38 5.44c1.95 0 3.33-.78 4.11-1.89H8.25V9.91h7.73c.08.42.12.86.12 1.42 0 4.64-3.11 7.67-7.85 7.67z" fill="#4285F4"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden accessibility elements */}
      <div className="sr-only">
        <div id={descriptionId}>
          This payment form is secured by Stripe and uses industry-standard encryption. 
          Your payment information is processed securely and never stored on our servers.
        </div>
      </div>
    </div>
  );
};