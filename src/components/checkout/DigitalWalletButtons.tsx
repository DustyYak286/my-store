"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import { PaymentRequest, PaymentRequestPaymentMethodEvent } from '@stripe/stripe-js';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/hooks/useToast';
import { PaymentMethod } from './PaymentSection';
import { formatCurrency } from '@/constants/payments';
import { logClientError, generateIdempotencyKey } from '@/lib/stripe-client';

interface DigitalWalletButtonsProps {
  selectedMethod: PaymentMethod;
  amount: number;
  disabled?: boolean;
  onPaymentStart?: () => void;
  onPaymentSuccess?: (paymentIntent: any) => void;
  onPaymentError?: (error: string) => void;
}

/**
 * DigitalWalletButtons Component
 * 
 * Handles Apple Pay and Google Pay integration with:
 * - Stripe Payment Request API for proper wallet detection
 * - Secure payment flow with payment intent creation
 * - Comprehensive error handling and user feedback
 * - 3D Secure authentication support
 * - Integration with existing cart and order management
 */
export default function DigitalWalletButtons({
  selectedMethod,
  amount,
  disabled = false,
  onPaymentStart,
  onPaymentSuccess,
  onPaymentError,
}: DigitalWalletButtonsProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { cartItems, clearCart } = useCart();
  const { showToast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canMakePayment, setCanMakePayment] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate amount
  const isValidAmount = typeof amount === 'number' && !isNaN(amount) && amount > 0;
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 DigitalWalletButtons props:', {
      amount,
      isValidAmount,
      cartItemsCount: cartItems.length,
      selectedMethod
    });
  }

  // Create payment intent for digital wallet
  const createPaymentIntent = useCallback(async (paymentMethodId: string) => {
    try {
      const idempotencyKey = generateIdempotencyKey();
      
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to bani (smallest currency unit)
          currency: 'ron',
          payment_method_id: paymentMethodId,
          automatic_payment_methods: {
            enabled: false, // We're specifying a specific payment method
          },
          cart_items: cartItems,
          payment_method_types: ['card'],
          capture_method: 'automatic',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      return await response.json();
    } catch (error) {
      logClientError(error, {
        context: 'digital_wallet_payment_intent_creation',
        amount,
        cartItemsCount: cartItems.length,
      });
      throw error;
    }
  }, [amount, cartItems]);

  // Initialize payment request
  useEffect(() => {
    const initializePaymentRequest = async () => {
      if (!stripe) {
        setIsInitializing(false);
        return;
      }

      // Validate amount before creating payment request
      if (!isValidAmount) {
        console.error('❌ DigitalWalletButtons: Invalid amount for payment request:', amount);
        setError(`Invalid payment amount: ${amount}. Please add items to cart.`);
        setIsInitializing(false);
        return;
      }

      if (!cartItems.length) {
        setError('Cart is empty');
        setIsInitializing(false);
        return;
      }

      try {
        setIsInitializing(true);
        setError(null);

        console.log('🔧 Creating payment request with amount:', amount);

        const pr = stripe.paymentRequest({
          country: 'RO',
          currency: 'ron',
          total: {
            label: 'Store Purchase',
            amount: Math.round(amount * 100), // Convert to bani
          },
          displayItems: cartItems.map(item => {
            const itemPrice = item.price.discount ?? item.price.original;
            const itemTotal = Math.round(itemPrice * item.quantity * 100);
            return {
              label: `${item.name} × ${item.quantity}`,
              amount: itemTotal,
            };
          }),
          requestPayerName: true,
          requestPayerEmail: true,
          requestPayerPhone: false,
          requestShipping: false,
        });

        // Check if payment methods are actually available
        const canMakePayment = await pr.canMakePayment();
        
        if (canMakePayment) {
          // Filter for the specific payment method we want
          const hasApplePay = canMakePayment.applePay && selectedMethod === 'apple_pay';
          const hasGooglePay = canMakePayment.googlePay && selectedMethod === 'google_pay';
          
          if (hasApplePay || hasGooglePay) {
            setCanMakePayment(true);
            setPaymentRequest(pr);
          } else {
            setCanMakePayment(false);
            setError(`${selectedMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay'} is not available on this device or browser.`);
          }
        } else {
          setCanMakePayment(false);
          setError('Digital wallets are not supported on this device or browser.');
        }
      } catch (err) {
        console.error('Failed to initialize payment request:', err);
        setCanMakePayment(false);
        setError('Failed to initialize digital wallet payment.');
        logClientError(err, {
          context: 'digital_wallet_initialization',
          selectedMethod,
        });
      } finally {
        setIsInitializing(false);
      }
    };

    initializePaymentRequest();
  }, [stripe, amount, cartItems, selectedMethod, isValidAmount]);

  // Handle payment method selection
  useEffect(() => {
    if (!paymentRequest) return;

    const handlePaymentMethod = async (event: PaymentRequestPaymentMethodEvent) => {
      try {
        setIsProcessing(true);
        onPaymentStart?.();
        
        showToast({
          type: 'info',
          message: 'Processing your payment...',
          duration: 3000,
        });

        // Create payment intent with the selected payment method
        const { clientSecret, orderId, error: intentError } = await createPaymentIntent(event.paymentMethod.id);
        
        if (intentError || !clientSecret) {
          throw new Error(intentError || 'Failed to create payment intent');
        }

        // Confirm the payment
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: event.paymentMethod.id,
        });

        if (confirmError) {
          console.error('Payment confirmation failed:', confirmError);
          event.complete('fail');
          
          const errorMessage = confirmError.message || 'Payment failed. Please try again.';
          onPaymentError?.(errorMessage);
          showToast({
            type: 'error',
            message: errorMessage,
            duration: 5000,
          });
          return;
        }

        if (paymentIntent?.status === 'succeeded') {
          event.complete('success');
          
          // Clear cart on successful payment
          clearCart();
          
          onPaymentSuccess?.(paymentIntent);
          showToast({
            type: 'success',
            message: 'Payment successful! Your order has been confirmed.',
            duration: 5000,
          });

          // Redirect to success page
          setTimeout(() => {
            window.location.href = `/checkout/success?order_id=${orderId}&payment_intent=${paymentIntent.id}`;
          }, 1500);
        } else {
          // Handle other payment statuses
          event.complete('fail');
          const statusMessage = `Payment status: ${paymentIntent?.status}. Please try again.`;
          onPaymentError?.(statusMessage);
          showToast({
            type: 'error',
            message: statusMessage,
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Digital wallet payment failed:', error);
        event.complete('fail');
        
        const errorMessage = error instanceof Error ? error.message : 'Payment failed. Please try again.';
        onPaymentError?.(errorMessage);
        showToast({
          type: 'error',
          message: errorMessage,
          duration: 5000,
        });
        
        logClientError(error, {
          context: 'digital_wallet_payment_processing',
          selectedMethod,
          amount,
        });
      } finally {
        setIsProcessing(false);
      }
    };

    paymentRequest.on('paymentmethod', handlePaymentMethod);

    return () => {
      paymentRequest.off('paymentmethod', handlePaymentMethod);
    };
  }, [paymentRequest, stripe, createPaymentIntent, onPaymentStart, onPaymentSuccess, onPaymentError, showToast, clearCart, selectedMethod, amount]);

  // Handle invalid amount
  if (!isValidAmount) {
    return (
      <div className="text-center py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-amber-600 text-sm">
            <p className="font-medium">Cart is empty or invalid</p>
            <p className="mt-1">Please add items to your cart to use digital wallets.</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state while initializing
  if (isInitializing) {
    return (
      <div className="text-center py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded-lg w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Checking {selectedMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay'} availability...
        </p>
      </div>
    );
  }

  // Error state or unsupported
  if (!stripe || !canMakePayment || error) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="max-w-sm mx-auto">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            {selectedMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay'} Not Available
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            {error || (selectedMethod === 'apple_pay' 
              ? 'Apple Pay is not supported on this device or browser.'
              : 'Google Pay is not supported on this device or browser.'
            )}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              <strong>To use {selectedMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay'}:</strong>
            </p>
            <ul className="text-xs text-blue-600 mt-1 list-disc list-inside space-y-1">
              {selectedMethod === 'apple_pay' ? (
                <>
                  <li>Use Safari browser on iPhone, iPad, or Mac</li>
                  <li>Have cards set up in Apple Wallet</li>
                  <li>Enable Touch ID, Face ID, or passcode</li>
                  <li>Ensure device supports Apple Pay</li>
                </>
              ) : (
                <>
                  <li>Use Chrome, Edge, or Android browser</li>
                  <li>Sign in to your Google account</li>
                  <li>Save payment methods in Google Pay</li>
                  <li>Allow payment permissions for this site</li>
                </>
              )}
            </ul>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Please select card payment to continue with your purchase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Button Container */}
      <div className="relative">
        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-20 rounded-lg">
            <div className="bg-white rounded-lg shadow-lg p-4 flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <div className="text-sm text-gray-700">
                <div className="font-medium">Processing payment...</div>
                <div className="text-xs text-gray-500">Please don't close this window</div>
              </div>
            </div>
          </div>
        )}

        {/* Disabled Overlay */}
        {disabled && !isProcessing && (
          <div className="absolute inset-0 bg-gray-50/75 cursor-not-allowed rounded-lg z-10"></div>
        )}

        {/* Stripe Payment Request Button */}
        <div className="w-full">
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  type: selectedMethod === 'apple_pay' ? 'default' : 'default',
                  theme: 'dark',
                  height: '48px',
                },
              },
            }}
          />
        </div>
      </div>

      {/* Payment Method Info */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            {selectedMethod === 'apple_pay' ? (
              <div className="w-8 h-8 bg-black rounded flex items-center justify-center mr-3">
                <svg className="w-5 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 bg-white border border-gray-300 rounded flex items-center justify-center mr-3">
                <svg className="w-5 h-3" viewBox="0 0 41 17" fill="none">
                  <path d="M19.26 17c-4.61 0-8.36-3.72-8.36-8.5S14.65 0 19.26 0s8.36 3.72 8.36 8.5-3.75 8.5-8.36 8.5zm0-15.3c-3.72 0-6.73 3.04-6.73 6.8 0 3.76 3.01 6.8 6.73 6.8s6.73-3.04 6.73-6.8c0-3.76-3.01-6.8-6.73-6.8z" fill="#EA4335"/>
                  <path d="M8.25 17c-4.56 0-8.25-3.72-8.25-8.5S3.69 0 8.25 0c2.25 0 4.31.91 5.82 2.56l-2.14 2.14C10.82 3.58 9.58 3.06 8.25 3.06c-2.97 0-5.38 2.44-5.38 5.44s2.41 5.44 5.38 5.44c1.95 0 3.33-.78 4.11-1.89H8.25V9.91h7.73c.08.42.12.86.12 1.42 0 4.64-3.11 7.67-7.85 7.67z" fill="#4285F4"/>
                </svg>
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                {selectedMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay'}
              </h4>
              <p className="text-xs text-gray-600">
                Quick and secure payment
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(amount)}
            </div>
            <div className="text-xs text-gray-500">
              Total amount
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="flex items-center text-green-600">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Secure</span>
          </div>
          <div className="flex items-center text-blue-600">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span>Instant</span>
          </div>
          <div className="flex items-center text-purple-600">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            <span>Private</span>
          </div>
        </div>
      </div>

      {/* Purchase Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h5 className="text-sm font-medium text-gray-900 mb-2">Purchase Summary</h5>
        <div className="space-y-1">
          {cartItems.slice(0, 3).map((item) => (
            <div key={item.id} className="flex justify-between text-xs text-gray-600">
              <span>{item.name} × {item.quantity}</span>
              <span>{formatCurrency((item.price.discount ?? item.price.original) * item.quantity)}</span>
            </div>
          ))}
          {cartItems.length > 3 && (
            <div className="text-xs text-gray-500">
              + {cartItems.length - 3} more item{cartItems.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
          <div className="border-t border-gray-200 pt-1 mt-2">
            <div className="flex justify-between text-sm font-medium text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Terms Notice */}
      <div className="text-xs text-gray-500 space-y-2">
        <div className="flex items-center justify-center">
          <svg className="w-4 h-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
          <span>Your payment information is secured by Stripe</span>
        </div>
        <p className="text-center">
          By completing this payment, you agree to our{' '}
          <a href="/terms" className="text-blue-600 hover:text-blue-700 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">
            Privacy Policy
          </a>.
        </p>
      </div>
    </div>
  );
}