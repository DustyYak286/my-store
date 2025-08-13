/**
 * Server-Side Stripe Instance and Utilities
 * 
 * Provides a configured Stripe instance for server-side operations
 * including payment intent creation, webhook processing, and error handling.
 */

import Stripe from 'stripe';
import { stripeConfig, getServerStripeOptions, createStripeConfigError } from '@/config/stripe';

// ====== STRIPE INSTANCE ======

let stripeInstance: Stripe | null = null;

/**
 * Get or create the server-side Stripe instance
 * Implements singleton pattern with lazy initialization
 * @returns Configured Stripe instance
 */
export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    try {
      const options = getServerStripeOptions();
      stripeInstance = new Stripe(stripeConfig.secretKey, options);
      
      // Log successful initialization (safe for production)
      console.log(`✅ Stripe initialized (${stripeConfig.environmentLabel})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw createStripeConfigError(
        `Failed to initialize Stripe: ${message}`,
        'STRIPE_INIT_ERROR',
        { error: message, environment: stripeConfig.environmentLabel }
      );
    }
  }
  
  return stripeInstance;
};

// ====== PAYMENT INTENT UTILITIES ======

/**
 * Create a payment intent with proper error handling and logging
 * @param params Payment intent creation parameters
 * @param options Stripe request options (idempotencyKey, stripeAccount, etc.)
 * @returns Created payment intent
 */
export const createPaymentIntent = async (
  params: Stripe.PaymentIntentCreateParams,
  options?: Stripe.RequestOptions
): Promise<Stripe.PaymentIntent> => {
  const stripe = getStripe();
  
  try {
    console.log(`🔄 Creating payment intent for ${params.amount} ${params.currency}`, {
      orderId: params.metadata?.orderId,
      environment: stripeConfig.environmentLabel,
    });
    
    const paymentIntent = await stripe.paymentIntents.create(params, options);
    
    console.log(`✅ Payment intent created: ${paymentIntent.id}`, {
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      orderId: params.metadata?.orderId,
    });
    
    return paymentIntent;
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    
    console.error('❌ Payment intent creation failed:', {
      error: stripeError.message,
      type: stripeError.type,
      code: stripeError.code,
      orderId: params.metadata?.orderId,
      amount: params.amount,
    });
    
    // Re-throw with additional context
    throw createStripeConfigError(
      `Payment intent creation failed: ${stripeError.message}`,
      stripeError.code || 'PAYMENT_INTENT_ERROR',
      {
        type: stripeError.type,
        stripeCode: stripeError.code,
        orderId: params.metadata?.orderId,
        amount: params.amount,
      }
    );
  }
};

/**
 * Retrieve a payment intent with error handling
 * @param paymentIntentId Payment intent ID to retrieve
 * @returns Payment intent or null if not found
 */
export const retrievePaymentIntent = async (
  paymentIntentId: string
): Promise<Stripe.PaymentIntent | null> => {
  const stripe = getStripe();
  
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    
    if (stripeError.code === 'resource_missing') {
      console.warn(`⚠️ Payment intent not found: ${paymentIntentId}`);
      return null;
    }
    
    console.error('❌ Failed to retrieve payment intent:', {
      paymentIntentId,
      error: stripeError.message,
      code: stripeError.code,
    });
    
    throw createStripeConfigError(
      `Failed to retrieve payment intent: ${stripeError.message}`,
      stripeError.code || 'RETRIEVE_ERROR',
      { paymentIntentId, stripeCode: stripeError.code }
    );
  }
};

// ====== WEBHOOK UTILITIES ======

/**
 * Construct and verify a webhook event from raw request data
 * @param payload Raw webhook payload
 * @param signature Stripe signature header
 * @returns Verified Stripe event
 */
export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  const stripe = getStripe();
  
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeConfig.webhookSecret,
      stripeConfig.webhooks.tolerance
    );
    
    console.log(`✅ Webhook event verified: ${event.type}`, {
      eventId: event.id,
      created: event.created,
      livemode: event.livemode,
    });
    
    return event;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('❌ Webhook verification failed:', {
      error: errorMessage,
      hasSignature: !!signature,
      payloadLength: typeof payload === 'string' ? payload.length : payload.length,
    });
    
    throw createStripeConfigError(
      `Webhook verification failed: ${errorMessage}`,
      'WEBHOOK_VERIFICATION_ERROR',
      { hasSignature: !!signature, errorMessage }
    );
  }
};

/**
 * Process a payment intent webhook event
 * @param event Stripe webhook event
 * @returns Processing result with order information
 */
export const processPaymentIntentWebhook = (
  event: Stripe.Event
): {
  paymentIntentId: string;
  orderId: string | null;
  status: string;
  amount: number;
  currency: string;
} => {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  const result = {
    paymentIntentId: paymentIntent.id,
    orderId: paymentIntent.metadata?.orderId || null,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  };
  
  console.log(`🔄 Processing payment intent webhook:`, {
    eventType: event.type,
    paymentIntentId: result.paymentIntentId,
    orderId: result.orderId,
    status: result.status,
    amount: result.amount,
  });
  
  return result;
};

// ====== ERROR HANDLING UTILITIES ======

/**
 * Categorize Stripe errors for better handling
 * @param error Stripe error
 * @returns Error category and handling information
 */
export const categorizeStripeError = (error: Stripe.errors.StripeError): {
  category: 'card' | 'authentication' | 'rate_limit' | 'api' | 'validation' | 'unknown';
  isRetryable: boolean;
  userMessage: string;
  logLevel: 'warn' | 'error';
} => {
  const type = error.type as string;
  const code = error.code as string;
  
  // Card errors
  if (type === 'card_error') {
    const cardErrorCodes: Record<string, string> = {
      'card_declined': 'Your card was declined. Please try a different payment method.',
      'insufficient_funds': 'Insufficient funds. Please try a different payment method.',
      'expired_card': 'Your card has expired. Please try a different payment method.',
      'incorrect_cvc': 'Your card\'s security code is incorrect.',
      'processing_error': 'Error processing your card. Please try again.',
    };
    
    return {
      category: 'card',
      isRetryable: false,
      userMessage: cardErrorCodes[code || ''] || 'Your card was declined. Please try a different payment method.',
      logLevel: 'warn',
    };
  }
  
  // Authentication errors
  if (code === 'authentication_required' || code === 'three_d_secure_redirect') {
    return {
      category: 'authentication',
      isRetryable: true,
      userMessage: 'Additional authentication required. Please complete the verification.',
      logLevel: 'warn',
    };
  }
  
  // Rate limiting
  if (type === 'rate_limit_error') {
    return {
      category: 'rate_limit',
      isRetryable: true,
      userMessage: 'Too many requests. Please wait a moment and try again.',
      logLevel: 'warn',
    };
  }
  
  // API errors
  if (type === 'api_error') {
    return {
      category: 'api',
      isRetryable: true,
      userMessage: 'Payment service temporarily unavailable. Please try again.',
      logLevel: 'error',
    };
  }
  
  // Validation errors
  if (type === 'invalid_request_error') {
    return {
      category: 'validation',
      isRetryable: false,
      userMessage: 'Invalid payment information. Please check and try again.',
      logLevel: 'error',
    };
  }
  
  // Unknown errors
  return {
    category: 'unknown',
    isRetryable: false,
    userMessage: 'Payment failed. Please try again or contact support.',
    logLevel: 'error',
  };
};

/**
 * Handle and log Stripe errors consistently
 * @param error Stripe error
 * @param context Additional context for logging
 * @returns Formatted error information
 */
export const handleStripeError = (
  error: Stripe.errors.StripeError,
  context: Record<string, unknown> = {}
): {
  category: string;
  isRetryable: boolean;
  userMessage: string;
  logData: Record<string, unknown>;
} => {
  const errorInfo = categorizeStripeError(error);
  
  const logData = {
    error: error.message,
    type: error.type,
    code: error.code,
    category: errorInfo.category,
    isRetryable: errorInfo.isRetryable,
    ...context,
  };
  
  // Log based on severity
  if (errorInfo.logLevel === 'error') {
    console.error('❌ Stripe error:', logData);
  } else {
    console.warn('⚠️ Stripe warning:', logData);
  }
  
  return {
    category: errorInfo.category,
    isRetryable: errorInfo.isRetryable,
    userMessage: errorInfo.userMessage,
    logData,
  };
};

// ====== HEALTH CHECK UTILITIES ======

/**
 * Check Stripe API connectivity and configuration
 * @returns Health check result
 */
export const healthCheck = async (): Promise<{
  isHealthy: boolean;
  checks: Record<string, boolean>;
  errors: string[];
}> => {
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];
  
  try {
    // Test basic API connectivity
    const stripe = getStripe();
    checks.stripeInstance = true;
    
    // Test API key validity by making a simple request
    await stripe.paymentMethods.list({ limit: 1 });
    checks.apiConnectivity = true;
    
    // Test webhook secret exists
    checks.webhookSecret = !!stripeConfig.webhookSecret;
    
    // Test environment consistency
    const isTestKey = stripeConfig.secretKey.startsWith('sk_test_');
    const isDev = process.env.NODE_ENV === 'development';
    checks.environmentConsistency = (isTestKey && isDev) || (!isTestKey && !isDev);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMessage);
    
    checks.stripeInstance = false;
    checks.apiConnectivity = false;
  }
  
  const isHealthy = Object.values(checks).every(Boolean) && errors.length === 0;
  
  return { isHealthy, checks, errors };
};

// ====== MONITORING UTILITIES ======

/**
 * Get Stripe configuration metrics for monitoring
 * @returns Configuration metrics
 */
export const getConfigurationMetrics = () => ({
  environment: stripeConfig.environmentLabel,
  isTestMode: stripeConfig.isTestMode,
  apiVersion: stripeConfig.api.version,
  hasValidConfiguration: true, // If we get here, config is valid
  timestamp: new Date().toISOString(),
});

// Export the main Stripe instance getter as default
export default getStripe;