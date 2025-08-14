"use client";

import React, { useState, useEffect } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { StripePaymentElementOptions } from '@stripe/stripe-js';

interface CardPaymentFormProps {
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
}

/**
 * CardPaymentForm Component
 * 
 * Stripe Elements integration for card payments with:
 * - PaymentElement for comprehensive payment method support
 * - Real-time validation feedback
 * - Error handling and display
 * - Accessibility compliance
 * - Custom styling to match design system
 */
export default function CardPaymentForm({
  onValidationChange,
  disabled = false,
}: CardPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // PaymentElement configuration
  const paymentElementOptions: StripePaymentElementOptions = {
    layout: {
      type: 'tabs',
      defaultCollapsed: false,
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
  };

  // Monitor Stripe and Elements readiness
  useEffect(() => {
    if (stripe && elements) {
      setIsReady(true);
    }
  }, [stripe, elements]);

  // Handle real-time validation
  const handlePaymentElementChange = (event: any) => {
    setIsValidating(true);
    
    if (event.error) {
      setError(event.error.message);
      onValidationChange?.(false);
    } else {
      setError(null);
      // PaymentElement is considered valid when no errors and complete
      onValidationChange?.(event.complete);
    }
    
    setIsValidating(false);
  };

  const handlePaymentElementReady = () => {
    setIsReady(true);
    setError(null);
  };

  const handlePaymentElementFocus = () => {
    setError(null);
  };

  const handlePaymentElementBlur = () => {
    // Additional validation could be performed here
  };

  if (!stripe || !elements) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payment Element Container */}
      <div className="relative">
        {/* Loading Overlay */}
        {!isReady && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-lg">
            <div className="flex items-center text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Loading payment form...
            </div>
          </div>
        )}

        {/* Stripe PaymentElement */}
        <div className={`transition-opacity duration-200 ${isReady ? 'opacity-100' : 'opacity-50'}`}>
          <PaymentElement
            id="payment-element"
            options={paymentElementOptions}
            onChange={handlePaymentElementChange}
            onReady={handlePaymentElementReady}
            onFocus={handlePaymentElementFocus}
            onBlur={handlePaymentElementBlur}
          />
        </div>

        {/* Disabled Overlay */}
        {disabled && (
          <div className="absolute inset-0 bg-gray-50/75 cursor-not-allowed rounded-lg"></div>
        )}
      </div>

      {/* Error Display */}
      {error && (
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
            <p className="text-sm text-red-700">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Validation Status */}
      {isValidating && (
        <div className="flex items-center text-sm text-gray-600">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-2"></div>
          Validating payment information...
        </div>
      )}

      {/* Payment Security Information */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center text-xs text-gray-600">
          <svg className="w-4 h-4 mr-2 text-green-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="font-medium">256-bit SSL encryption</span>
          <span className="mx-2">•</span>
          <span>PCI DSS compliant</span>
          <span className="mx-2">•</span>
          <span>Your data is never stored</span>
        </div>
      </div>

      {/* Supported Card Types */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
        <span>Accepted payment methods:</span>
        <div className="flex items-center space-x-2">
          {/* Visa */}
          <div className="flex items-center space-x-1">
            <div className="w-6 h-4 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">
              V
            </div>
          </div>
          {/* Mastercard */}
          <div className="w-6 h-4 bg-red-500 rounded text-white text-xs flex items-center justify-center font-bold">
            MC
          </div>
          {/* American Express */}
          <div className="w-6 h-4 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">
            AX
          </div>
          {/* Discover */}
          <div className="w-6 h-4 bg-orange-500 rounded text-white text-xs flex items-center justify-center font-bold">
            D
          </div>
          {/* Generic */}
          <div className="w-6 h-4 bg-gray-400 rounded text-white text-xs flex items-center justify-center">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}