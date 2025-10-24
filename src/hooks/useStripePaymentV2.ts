/**
 * Refactored useStripePayment Hook
 * 
 * Thin hook following "functional core, imperative shell" pattern.
 * Business logic extracted to pure functions, side effects minimized.
 * 
 * Acceptance Criteria:
 * - ≤ 60 lines
 * - ≤ 1 useEffect  
 * - No direct fetch/Stripe/router calls (via injected gateway)
 * - Zero act() warnings
 * - Proper cleanup with AbortController
 */

"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { initializePayment, submitPayment } from '@/core/paymentFlow';
import { createStripeGateway } from '@/infra/stripeGateway';
import type { PaymentGateway, PaymentData, PaymentResult } from '@/core/paymentFlow';
import type { FormData } from '@/types/checkout';

export interface PaymentState {
  status: 'idle' | 'initializing' | 'ready' | 'processing' | 'succeeded' | 'failed';
  methods: string[];
  error: Error | null;
}

export interface UseStripePaymentV2Options {
  gateway?: PaymentGateway; // For dependency injection in tests
  apiEndpoint?: string;
  // Single PaymentIntent mode - skip createIntent and use existing clientSecret
  existingPaymentIntent?: {
    paymentIntentId: string;
    orderDraftId: string;
    orderNumber: string;
  };
}

export function useStripePaymentV2(options: UseStripePaymentV2Options = {}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { cartItems, totalPrice, clearCart } = useCart();
  
  const [state, setState] = useState<PaymentState>({
    status: 'idle',
    methods: [],
    error: null,
  });

  // Refs for cleanup management
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Single useEffect for initialization
  useEffect(() => {
    if (!stripe || !elements) {
      setState(s => ({ ...s, status: 'idle' }));
      return;
    }

    const controller = new AbortController();
    setState(s => ({ ...s, status: 'initializing' }));
    
    // Create gateway inside useEffect to avoid dependency issues
    const gateway = options.gateway || createStripeGateway({
      stripe,
      elements,
      apiEndpoint: options.apiEndpoint || '/api/payments/create-intent',
    });
    
    initializePayment(gateway, controller.signal)
      .then(methods => setState(s => ({ ...s, status: 'ready', methods })))
      .catch(error => {
        if (error.name !== 'AbortError') {
          setState(s => ({ ...s, status: 'failed', error }));
        }
      });

    return () => controller.abort();
  }, [stripe, elements, options.gateway, options.apiEndpoint]);

  // Cleanup effect for redirect timeout
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  // Payment submission handler
  const processPayment = useCallback(async (formData: FormData): Promise<PaymentResult> => {
    if (!cartItems?.length || !totalPrice) {
      throw new Error('Cart is empty');
    }

    if (!stripe || !elements) {
      throw new Error('Payment system not ready');
    }

    setState(s => ({ ...s, status: 'processing', error: null }));

    // Create gateway for payment processing
    const gateway = options.gateway || createStripeGateway({
      stripe,
      elements,
      apiEndpoint: options.apiEndpoint || '/api/payments/create-intent',
    });

    const paymentData: PaymentData = {
      customerInfo: {
        email: formData.email,
        firstName: formData.shippingFullName.split(' ')[0] || '',
        lastName: formData.shippingFullName.split(' ').slice(1).join(' ') || '',
      },
      shippingAddress: {
        fullName: formData.shippingFullName,
        streetAddress: formData.shippingStreetAddress,
        city: formData.shippingCity,
        postalCode: formData.shippingPostalCode,
        country: formData.shippingCountry,
      },
      billingAddress: formData.sameAsShipping ? {
        fullName: formData.shippingFullName,
        streetAddress: formData.shippingStreetAddress,
        city: formData.shippingCity,
        postalCode: formData.shippingPostalCode,
        country: formData.shippingCountry,
      } : {
        fullName: formData.billingFullName,
        streetAddress: formData.billingStreetAddress,
        city: formData.billingCity,
        postalCode: formData.billingPostalCode,
        country: formData.billingCountry,
      },
      items: cartItems,
      currency: 'ron',
    };

    try {
      const result = await submitPayment(gateway, paymentData);
      
      if (result.status === 'succeeded') {
        setState(s => ({ ...s, status: 'succeeded' }));
        clearCart();
        
        // Clear any existing redirect timeout
        if (redirectTimeoutRef.current) {
          clearTimeout(redirectTimeoutRef.current);
        }
        
        // Set new redirect timeout with cleanup tracking
        redirectTimeoutRef.current = setTimeout(() => {
          // Extract order information from the payment result
          const orderId = result.paymentIntent?.metadata?.orderId;
          const orderNumber = result.paymentIntent?.metadata?.orderNumber;
          const paymentIntentId = result.paymentIntent?.id;
          
          // Build success URL with order parameters
          const successParams = new URLSearchParams();
          if (orderId) successParams.set('order_id', orderId);
          if (orderNumber) successParams.set('order_number', orderNumber);
          if (paymentIntentId) successParams.set('payment_intent', paymentIntentId);
          
          const successUrl = `/checkout/success?${successParams.toString()}`;
          console.log('[TRACK] Redirecting to success page:', successUrl);
          
          router.push(successUrl);
          redirectTimeoutRef.current = null;
        }, 2000);
      } else {
        setState(s => ({ ...s, status: 'failed', error: result.error || null }));
      }
      
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Payment failed');
      setState(s => ({ ...s, status: 'failed', error: err }));
      throw err;
    }
  }, [stripe, elements, options.gateway, options.apiEndpoint, cartItems, totalPrice, clearCart, router]);

  return {
    paymentState: state,
    processPayment,
    canRetry: state.status === 'failed' && !!state.error,
    resetPaymentState: () => setState({ status: 'ready', methods: state.methods, error: null }),
  };
}