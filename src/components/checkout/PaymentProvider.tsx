"use client";

import React, { useEffect, useState, ReactNode } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { Appearance, StripeElementsOptions } from '@stripe/stripe-js';
import { getStripe } from '@/lib/stripe-client';
import { checkoutConfig } from '@/config/checkout';
import { useCart } from '@/context/CartContext';
import PaymentErrorBoundary from '@/components/PaymentErrorBoundary';

interface PaymentProviderProps {
  children: ReactNode;
  clientSecret?: string | undefined;
}

/**
 * Payment Provider Component
 * 
 * Wraps Stripe Elements provider with:
 * - Stripe instance initialization
 * - Elements configuration with custom styling
 * - Payment error boundary for graceful error handling
 * - Integration with existing design system
 */
export default function PaymentProvider({ children, clientSecret }: PaymentProviderProps) {
  const [stripePromise] = useState(() => getStripe());
  const { totalPrice } = useCart();

  // Stripe Elements appearance configuration to match design system
  const appearance: Appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: checkoutConfig.ui.primaryColor,
      colorBackground: '#ffffff',
      colorText: '#374151', // gray-700
      colorDanger: '#ef4444', // red-500
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
      // Match the existing input styling
      focusBoxShadow: '0 0 0 2px rgba(124, 77, 89, 0.2)',
      focusOutline: 'none',
    },
    rules: {
      '.Input': {
        border: '1px solid #d1d5db', // gray-300
        borderRadius: '8px',
        padding: '12px 14px',
        fontSize: '16px',
        color: '#374151', // gray-700
        backgroundColor: '#ffffff',
      },
      '.Input::placeholder': {
        color: '#9ca3af', // gray-400
      },
      '.Input:focus': {
        border: `1px solid ${checkoutConfig.ui.primaryColor}`,
        boxShadow: `0 0 0 2px rgba(124, 77, 89, 0.2)`,
        outline: 'none',
      },
      '.Input--invalid': {
        border: '1px solid #ef4444', // red-500
        boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)',
      },
      '.Label': {
        fontSize: '14px',
        fontWeight: '500',
        color: '#374151', // gray-700
        marginBottom: '6px',
      },
      '.Error': {
        fontSize: '14px',
        color: '#ef4444', // red-500
        marginTop: '4px',
      },
    },
  };

  // Elements options configuration
  // Always use Payment Intent mode now that we initialize with clientSecret on page load
  const hasValidClientSecret = clientSecret && clientSecret.length > 0;
  
  // If no clientSecret is provided, we'll wait for initialization
  if (!hasValidClientSecret) {
    console.log('[REDIRECT] PaymentProvider: No clientSecret provided, waiting for initialization...');
    return (
      <PaymentErrorBoundary
        onError={(error, errorInfo) => {
          console.error('Payment component error during initialization:', {
            error: error.message,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
          });
        }}
        onRetry={() => {
          console.log('Payment component retry triggered during initialization');
        }}
      >
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
            <div className="h-12 bg-gray-200 rounded mb-4"></div>
            <div className="h-12 bg-gray-200 rounded mb-4"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </PaymentErrorBoundary>
    );
  }

  // Payment Intent mode - use when we have a valid clientSecret
  const options: StripeElementsOptions = {
    clientSecret,
    appearance,
    locale: 'en',
  };

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('[CONFIG] PaymentProvider initialized:', {
      hasValidClientSecret: true, // Always true at this point
      clientSecretPreview: clientSecret ? `${clientSecret.substring(0, 15)}...` : 'undefined',
      elementsMode: 'Payment Intent mode', // Always payment mode now
      optionsKeys: Object.keys(options),
      currency: 'from clientSecret'
    });
  }

  return (
    <PaymentErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Payment component error:', {
          error: error.message,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        });
      }}
      onRetry={() => {
        // Could trigger a refresh of the payment intent
        console.log('Payment component retry triggered');
      }}
    >
      <Elements stripe={stripePromise} options={options}>
        {children}
      </Elements>
    </PaymentErrorBoundary>
  );
}