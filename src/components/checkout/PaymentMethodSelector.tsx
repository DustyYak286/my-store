"use client";

import React from 'react';
import { PaymentMethod } from './PaymentSection';

interface PaymentMethodSelectorProps {
  availableMethods: {
    card: boolean;
    applePay: boolean;
    googlePay: boolean;
  };
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

/**
 * PaymentMethodSelector Component
 * 
 * Provides a clean interface for selecting payment methods with:
 * - Visual payment method icons
 * - Clear selection states
 * - Accessibility support
 * - Responsive design
 */
export default function PaymentMethodSelector({
  availableMethods,
  selectedMethod,
  onMethodChange,
  disabled = false,
}: PaymentMethodSelectorProps) {
  const paymentMethods = [
    {
      id: 'card' as PaymentMethod,
      name: 'Card',
      description: 'Credit or Debit Card',
      icon: (
        <div className="flex space-x-1">
          {/* Visa */}
          <div className="w-8 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">
            V
          </div>
          {/* Mastercard */}
          <div className="w-8 h-5 bg-red-500 rounded text-white text-xs flex items-center justify-center font-bold">
            MC
          </div>
          {/* Generic card */}
          <div className="w-8 h-5 bg-gray-400 rounded text-white text-xs flex items-center justify-center">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
            </svg>
          </div>
        </div>
      ),
      available: availableMethods.card,
    },
    {
      id: 'apple_pay' as PaymentMethod,
      name: 'Apple Pay',
      description: 'Pay with Touch ID or Face ID',
      icon: (
        <div className="w-12 h-8 bg-black rounded flex items-center justify-center">
          <svg className="w-6 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
        </div>
      ),
      available: availableMethods.applePay,
    },
    {
      id: 'google_pay' as PaymentMethod,
      name: 'Google Pay',
      description: 'Quick & secure payments',
      icon: (
        <div className="w-12 h-8 bg-white border border-gray-300 rounded flex items-center justify-center">
          <svg className="w-6 h-4" viewBox="0 0 41 17" fill="none">
            <path d="M19.26 17c-4.61 0-8.36-3.72-8.36-8.5S14.65 0 19.26 0s8.36 3.72 8.36 8.5-3.75 8.5-8.36 8.5zm0-15.3c-3.72 0-6.73 3.04-6.73 6.8 0 3.76 3.01 6.8 6.73 6.8s6.73-3.04 6.73-6.8c0-3.76-3.01-6.8-6.73-6.8z" fill="#EA4335"/>
            <path d="M8.25 17c-4.56 0-8.25-3.72-8.25-8.5S3.69 0 8.25 0c2.25 0 4.31.91 5.82 2.56l-2.14 2.14C10.82 3.58 9.58 3.06 8.25 3.06c-2.97 0-5.38 2.44-5.38 5.44s2.41 5.44 5.38 5.44c1.95 0 3.33-.78 4.11-1.89H8.25V9.91h7.73c.08.42.12.86.12 1.42 0 4.64-3.11 7.67-7.85 7.67z" fill="#4285F4"/>
            <path d="M29.76 13.36c-1.56 0-2.96-.64-3.76-1.69l2.07-1.95c.48.72 1.23 1.17 2.07 1.17.83 0 1.58-.45 2.06-1.17l2.07 1.95c-.8 1.05-2.2 1.69-3.76 1.69h.25z" fill="#FBBC04"/>
            <path d="M40.5 9.91h-7.73v-2.14h7.61c.08.42.12.86.12 1.42v.72z" fill="#EA4335"/>
          </svg>
        </div>
      ),
      available: availableMethods.googlePay,
    },
  ].filter(method => method.available);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700 block">
        Select Payment Method
      </label>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paymentMethods.map((method) => (
          <button
            key={method.id}
            type="button"
            disabled={disabled}
            onClick={() => onMethodChange(method.id)}
            className={`
              relative flex items-center p-4 border-2 rounded-lg transition-all duration-200
              ${selectedMethod === method.id
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            `}
            aria-pressed={selectedMethod === method.id}
            aria-describedby={`${method.id}-description`}
          >
            {/* Selection Indicator */}
            <div className="flex-shrink-0 mr-3">
              <div className={`
                w-4 h-4 rounded-full border-2 flex items-center justify-center
                ${selectedMethod === method.id 
                  ? 'border-blue-500 bg-blue-500' 
                  : 'border-gray-300 bg-white'
                }
              `}>
                {selectedMethod === method.id && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
            </div>

            {/* Payment Method Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {method.name}
                </span>
                <div className="ml-2">
                  {method.icon}
                </div>
              </div>
              <p 
                id={`${method.id}-description`}
                className="text-xs text-gray-500"
              >
                {method.description}
              </p>
            </div>

            {/* Selected Checkmark */}
            {selectedMethod === method.id && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {paymentMethods.length === 0 && (
        <div className="text-center py-6 text-gray-500">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No payment methods available</p>
        </div>
      )}
    </div>
  );
}