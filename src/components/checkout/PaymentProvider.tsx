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
  clientSecret?: string;
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
  const { cartTotal } = useCart();

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
      '.Input::placeholder': '#9ca3af', // gray-400
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
  // Note: Include clientSecret for Payment Intent mode, or mode for Setup mode
  const hasValidClientSecret = clientSecret && clientSecret.length > 0;
  const options: StripeElementsOptions = hasValidClientSecret 
    ? {
        // Payment Intent mode - use when we have a valid clientSecret
        clientSecret,
        appearance,
        locale: 'en',
      }
    : {
        // Setup mode - collect payment method without immediate charge
        mode: 'setup',
        currency: 'ron', // Required for setup mode
        appearance,
        locale: 'en',
      };

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 PaymentProvider initialized:', {
      hasValidClientSecret,
      clientSecretPreview: clientSecret ? `${clientSecret.substring(0, 15)}...` : 'undefined',
      elementsMode: hasValidClientSecret ? 'Payment Intent mode' : 'Setup mode',
      optionsKeys: Object.keys(options),
      currency: hasValidClientSecret ? 'from clientSecret' : 'ron'
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