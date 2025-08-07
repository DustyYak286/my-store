/**
 * Client-Side Stripe Instance and Utilities
 * 
 * Provides Stripe.js integration for client-side payment processing
 * including Elements setup, payment confirmation, and error handling.
 */

'use client';

import { loadStripe, Stripe, StripeElements, StripeError } from '@stripe/stripe-js';
import { stripeConfig, getClientStripeOptions } from '@/config/stripe';

// ====== STRIPE INSTANCE ======

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Get or create the client-side Stripe instance
 * Implements singleton pattern with promise caching
 * @returns Promise that resolves to Stripe instance
 */
export const getStripe = async (): Promise<Stripe | null> => {
  if (!stripePromise) {
    stripePromise = loadStripe(
      stripeConfig.publishableKey,
      getClientStripeOptions()
    );
  }
  
  return stripePromise;
};

// ====== ELEMENTS UTILITIES ======

/**
 * Client-side payment confirmation with comprehensive error handling
 * @param stripe Stripe instance
 * @param elements Elements instance
 * @param clientSecret Payment intent client secret
 * @param confirmationData Additional confirmation data
 * @returns Payment confirmation result
 */
export const confirmPayment = async (
  stripe: Stripe,
  elements: StripeElements,
  clientSecret: string,
  confirmationData?: {
    return_url?: string;
    payment_method_data?: {
      billing_details?: {
        name?: string;
        email?: string;
        address?: {
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
        };
      };
    };
  }
): Promise<{
  success: boolean;
  paymentIntent?: Stripe.PaymentIntent;
  error?: {
    type: string;
    code?: string;
    message: string;
    category: 'card' | 'authentication' | 'network' | 'validation' | 'unknown';
    isRetryable: boolean;
  };
}> => {
  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: confirmationData?.return_url || window.location.origin + '/checkout/success',
        payment_method_data: confirmationData?.payment_method_data,
      },
      redirect: 'if_required',
    });
    
    if (error) {
      const categorizedError = categorizeClientStripeError(error);
      
      console.warn('⚠️ Payment confirmation failed:', {
        type: error.type,
        code: error.code,
        message: error.message,
        category: categorizedError.category,
      });
      
      return {
        success: false,
        error: {
          type: error.type,
          code: error.code,
          message: categorizedError.userMessage,
          category: categorizedError.category,
          isRetryable: categorizedError.isRetryable,
        },
      };
    }
    
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      console.log('✅ Payment confirmed successfully:', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
      });
      
      return {
        success: true,
        paymentIntent,
      };
    }
    
    // Handle other payment intent statuses
    const statusMessage = getPaymentIntentStatusMessage(paymentIntent?.status);
    return {
      success: false,
      error: {
        type: 'payment_intent_status',
        message: statusMessage,
        category: 'unknown',
        isRetryable: false,
      },
    };
    
  } catch (error) {
    console.error('❌ Payment confirmation error:', error);
    
    return {
      success: false,
      error: {
        type: 'network_error',
        message: 'Network error occurred. Please check your connection and try again.',
        category: 'network',
        isRetryable: true,
      },
    };
  }
};

/**
 * Process 3D Secure authentication redirect
 * @param stripe Stripe instance
 * @param clientSecret Payment intent client secret
 * @returns Authentication result
 */
export const handleNextAction = async (
  stripe: Stripe,
  clientSecret: string
): Promise<{
  success: boolean;
  paymentIntent?: Stripe.PaymentIntent;
  error?: {
    type: string;
    code?: string;
    message: string;
    category: string;
  };
}> => {
  try {
    const { error, paymentIntent } = await stripe.handleNextAction({
      clientSecret,
    });
    
    if (error) {
      const categorizedError = categorizeClientStripeError(error);
      
      return {
        success: false,
        error: {
          type: error.type,
          code: error.code,
          message: categorizedError.userMessage,
          category: categorizedError.category,
        },
      };
    }
    
    return {
      success: true,
      paymentIntent: paymentIntent || undefined,
    };
    
  } catch (error) {
    console.error('❌ Next action handling error:', error);
    
    return {
      success: false,
      error: {
        type: 'network_error',
        message: 'Authentication failed. Please try again.',
        category: 'network',
      },
    };
  }
};

// ====== ERROR HANDLING ======

/**
 * Categorize client-side Stripe errors for better UX
 * @param error Stripe error from client-side operations
 * @returns Error category and user-friendly information
 */
export const categorizeClientStripeError = (error: StripeError): {
  category: 'card' | 'authentication' | 'network' | 'validation' | 'unknown';
  isRetryable: boolean;
  userMessage: string;
  severity: 'low' | 'medium' | 'high';
} => {
  const { type, code } = error;
  
  // Card errors - user can potentially fix
  if (type === 'card_error') {
    const cardMessages: Record<string, string> = {
      'card_declined': 'Your card was declined. Please try a different payment method.',
      'insufficient_funds': 'Insufficient funds. Please try a different card.',
      'expired_card': 'Your card has expired. Please use a different card.',
      'incorrect_cvc': 'Your card\'s security code is incorrect. Please check and try again.',
      'processing_error': 'There was an error processing your card. Please try again.',
      'incorrect_number': 'Your card number is incorrect. Please check and try again.',
    };
    
    return {
      category: 'card',
      isRetryable: code === 'processing_error',
      userMessage: cardMessages[code || ''] || 'Your card was declined. Please try a different payment method.',
      severity: 'medium',
    };
  }
  
  // Validation errors - usually user input issues
  if (type === 'validation_error') {
    return {
      category: 'validation',
      isRetryable: true,
      userMessage: 'Please check your payment information and try again.',
      severity: 'low',
    };
  }
  
  // API connection errors - network issues
  if (type === 'api_connection_error') {
    return {
      category: 'network',
      isRetryable: true,
      userMessage: 'Network error. Please check your connection and try again.',
      severity: 'medium',
    };
  }
  
  // API errors - server issues
  if (type === 'api_error') {
    return {
      category: 'network',
      isRetryable: true,
      userMessage: 'Payment service temporarily unavailable. Please try again.',
      severity: 'high',
    };
  }
  
  // Authentication errors - 3D Secure, etc.
  if (type === 'authentication_error') {
    return {
      category: 'authentication',
      isRetryable: true,
      userMessage: 'Authentication failed. Please try again.',
      severity: 'medium',
    };
  }
  
  // Rate limit errors
  if (type === 'rate_limit_error') {
    return {
      category: 'network',
      isRetryable: true,
      userMessage: 'Too many requests. Please wait a moment and try again.',
      severity: 'medium',
    };
  }
  
  // Invalid request errors
  if (type === 'invalid_request_error') {
    return {
      category: 'validation',
      isRetryable: false,
      userMessage: 'Invalid payment request. Please refresh the page and try again.',
      severity: 'high',
    };
  }
  
  // Unknown errors
  return {
    category: 'unknown',
    isRetryable: false,
    userMessage: 'An unexpected error occurred. Please try again or contact support.',
    severity: 'high',
  };
};

/**
 * Get user-friendly message for payment intent status
 * @param status Payment intent status
 * @returns User-friendly status message
 */
export const getPaymentIntentStatusMessage = (status?: string): string => {
  const statusMessages: Record<string, string> = {
    'requires_payment_method': 'Please provide a payment method.',
    'requires_confirmation': 'Please confirm your payment.',
    'requires_action': 'Additional authentication required.',
    'processing': 'Your payment is being processed...',
    'requires_capture': 'Payment authorized. Processing order...',
    'canceled': 'Payment was canceled.',
    'succeeded': 'Payment successful!',
  };
  
  return statusMessages[status || ''] || 'Payment status unknown. Please try again.';
};

// ====== PAYMENT METHOD DETECTION ======

/**
 * Detect available payment methods based on user agent and capabilities
 * @returns Available payment method information
 */
export const detectAvailablePaymentMethods = (): {
  applePay: boolean;
  googlePay: boolean;
  card: boolean;
} => {
  // Basic detection - can be enhanced with actual capability checking
  const isAppleDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 0);
  
  const isAndroid = /Android/.test(navigator.userAgent);
  
  return {
    applePay: isAppleDevice && window.ApplePaySession?.canMakePayments?.() === true,
    googlePay: isAndroid || /Chrome/.test(navigator.userAgent),
    card: true, // Always available
  };
};

/**
 * Check if Apple Pay is available and configured
 * @returns Promise that resolves to Apple Pay availability
 */
export const checkApplePayAvailability = async (): Promise<boolean> => {
  try {
    // Check if Apple Pay is available on this device
    if (!window.ApplePaySession || !ApplePaySession.canMakePayments) {
      return false;
    }
    
    // Check if user has cards configured
    return ApplePaySession.canMakePayments();
  } catch {
    return false;
  }
};

/**
 * Check if Google Pay is available
 * @returns Promise that resolves to Google Pay availability
 */
export const checkGooglePayAvailability = async (): Promise<boolean> => {
  try {
    // Basic check - in real implementation, you'd use Google Pay API
    return /Chrome|Android/.test(navigator.userAgent);
  } catch {
    return false;
  }
};

// ====== UTILITY FUNCTIONS ======

/**
 * Generate a unique idempotency key for payment operations
 * @returns Unique idempotency key
 */
export const generateIdempotencyKey = (): string => {
  return `payment_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Format amount for display in Elements
 * @param amount Amount in smallest currency unit (bani)
 * @returns Formatted amount
 */
export const formatAmountForDisplay = (amount: number): string => {
  return (amount / 100).toFixed(2);
};

/**
 * Validate payment form before submission
 * @param elements Elements instance
 * @returns Validation result
 */
export const validatePaymentForm = async (
  elements: StripeElements
): Promise<{
  isValid: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  
  // Get the card element or payment element
  const cardElement = elements.getElement('card');
  const paymentElement = elements.getElement('payment');
  
  if (!cardElement && !paymentElement) {
    errors.push('No payment method available');
    return { isValid: false, errors };
  }
  
  // Additional validation can be added here
  // For now, rely on Stripe's built-in validation
  
  return { isValid: errors.length === 0, errors };
};

/**
 * Safe error logging for client-side errors
 * @param error Error to log
 * @param context Additional context
 */
export const logClientError = (
  error: unknown,
  context: Record<string, unknown> = {}
): void => {
  const errorInfo = {
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...context,
  };
  
  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('Client-side payment error:', errorInfo);
  }
  
  // In production, you might want to send to error tracking service
  // Example: Sentry, LogRocket, etc.
};

// Export the main getStripe function as default
export default getStripe;