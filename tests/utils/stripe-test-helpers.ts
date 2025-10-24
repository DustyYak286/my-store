/**
 * Stripe Test Helpers
 * 
 * Utilities for testing with Stripe's test environment including
 * test card numbers, webhook simulation, and test data generation.
 */

import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';

// Stripe test card numbers for different scenarios
export const TEST_CARDS = {
  // Successful payments
  VISA_SUCCESS: '4242424242424242',
  VISA_DEBIT: '4000056655665556',
  MASTERCARD: '5555555555554444',
  AMEX: '378282246310005',
  
  // Cards that require 3D Secure authentication
  VISA_3DS_REQUIRED: '4000002500003155',
  VISA_3DS_NOT_SUPPORTED: '4000007560000009',
  
  // Declined cards
  GENERIC_DECLINE: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  LOST_CARD: '4000000000009987',
  STOLEN_CARD: '4000000000009979',
  EXPIRED_CARD: '4000000000000069',
  INCORRECT_CVC: '4000000000000127',
  PROCESSING_ERROR: '4000000000000119',
  
  // International cards
  VISA_ROMANIA: '4000006200000007', // Romanian card
  
  // Corporate and prepaid cards
  VISA_CORPORATE: '4000000000000010',
  VISA_PREPAID: '4000000000000002',
} as const;

export const TEST_CVC = '123';
export const TEST_EXPIRY = { month: 12, year: 2025 };

/**
 * Create a test payment method using Stripe test cards
 */
export async function createTestPaymentMethod(
  cardNumber: string = TEST_CARDS.VISA_SUCCESS,
  options: {
    cvc?: string;
    exp_month?: number;
    exp_year?: number;
    billing_details?: Stripe.PaymentMethodCreateParams.BillingDetails;
  } = {}
): Promise<Stripe.PaymentMethod> {
  const stripe = getStripe();
  
  const paymentMethod = await stripe.paymentMethods.create({
    type: 'card',
    card: {
      number: cardNumber,
      exp_month: options.exp_month || TEST_EXPIRY.month,
      exp_year: options.exp_year || TEST_EXPIRY.year,
      cvc: options.cvc || TEST_CVC,
    },
    billing_details: options.billing_details || {
      name: 'Test User',
      email: 'test@example.com',
      address: {
        line1: 'Str. Test 123',
        city: 'Bucharest',
        postal_code: '123456',
        country: 'RO',
      },
    },
  });

  return paymentMethod;
}

/**
 * Simulate a successful payment using Stripe test cards
 */
export async function simulateSuccessfulPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  
  // Create test payment method
  const paymentMethod = await createTestPaymentMethod(TEST_CARDS.VISA_SUCCESS);
  
  // Confirm the payment intent
  const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethod.id,
    return_url: 'http://localhost:3000/checkout/success',
  });

  return confirmedPaymentIntent;
}

/**
 * Simulate a declined payment using Stripe test cards
 */
export async function simulateDeclinedPayment(
  paymentIntentId: string,
  declineType: keyof typeof TEST_CARDS = 'GENERIC_DECLINE'
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  
  // Create test payment method with declining card
  const paymentMethod = await createTestPaymentMethod(TEST_CARDS[declineType]);
  
  try {
    // This should fail
    const confirmedPaymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethod.id,
      return_url: 'http://localhost:3000/checkout/error',
    });
    return confirmedPaymentIntent;
  } catch (error) {
    // Re-fetch the payment intent to get updated status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  }
}

/**
 * Create a test webhook event for payment intent succeeded
 */
export function createTestWebhookEvent(
  eventType: string,
  paymentIntent: Stripe.PaymentIntent,
  options: {
    created?: number;
    livemode?: boolean;
    pending_webhooks?: number;
  } = {}
): Stripe.Event {
  const event: Stripe.Event = {
    id: `evt_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    object: 'event',
    api_version: '2024-06-20',
    created: options.created || Math.floor(Date.now() / 1000),
    data: {
      object: paymentIntent,
      previous_attributes: undefined,
    },
    livemode: options.livemode || false,
    pending_webhooks: options.pending_webhooks || 1,
    request: {
      id: `req_test_${Date.now()}`,
      idempotency_key: null,
    },
    type: eventType as Stripe.Event.Type,
  };

  return event;
}

/**
 * Generate webhook signature for testing webhook endpoints
 */
export function generateTestWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number
): string {
  const crypto = require('crypto');
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  
  return `t=${ts},v1=${signature}`;
}

/**
 * Create complete test webhook request
 */
export function createTestWebhookRequest(
  event: Stripe.Event,
  webhookSecret: string,
  options: {
    timestamp?: number;
    origin?: string;
    userAgent?: string;
  } = {}
): Request {
  const payload = JSON.stringify(event);
  const signature = generateTestWebhookSignature(
    payload,
    webhookSecret,
    options.timestamp
  );

  return new Request('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
      'user-agent': options.userAgent || 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
      ...(options.origin && { origin: options.origin }),
    },
    body: payload,
  });
}

/**
 * Test payment amounts in Romanian Lei (RON)
 */
export const TEST_AMOUNTS = {
  MIN_VALID: 2.50,      // Minimum valid amount
  BELOW_MIN: 1.00,      // Below minimum (should fail)
  STANDARD: 29.99,      // Standard test amount
  LARGE: 999.99,        // Large amount
  MAX_VALID: 4999999,   // Maximum valid amount
  ABOVE_MAX: 5000000,   // Above maximum (should fail)
} as const;

/**
 * Convert RON to bani (smallest currency unit for Stripe)
 */
export function ronToBani(amountInRon: number): number {
  return Math.round(amountInRon * 100);
}

/**
 * Convert bani to RON
 */
export function baniToRon(amountInBani: number): number {
  return amountInBani / 100;
}

/**
 * Wait for a webhook to be processed (useful in integration tests)
 */
export async function waitForWebhookProcessing(
  paymentIntentId: string,
  maxWaitTime: number = 10000,
  checkInterval: number = 500
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe();
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'processing' && paymentIntent.status !== 'requires_confirmation') {
      return paymentIntent;
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error(
    `Webhook processing timeout: PaymentIntent ${paymentIntentId} ` +
    `still processing after ${maxWaitTime}ms`
  );
}

/**
 * Cleanup test payment intents (useful for test cleanup)
 */
export async function cleanupTestPaymentIntents(
  testPrefix: string = 'test_integration'
): Promise<void> {
  // Dynamic import to avoid module-level loading issues
  const { getStripe } = await import('@/lib/stripe');
  const stripe = getStripe();
  
  try {
    // List recent payment intents
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
      created: {
        gte: Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000), // Last 24 hours
      },
    });

    // Cancel any test payment intents that are still processing
    for (const pi of paymentIntents.data) {
      if (
        pi.metadata?.orderId?.includes(testPrefix) &&
        (pi.status === 'requires_payment_method' || 
         pi.status === 'requires_confirmation' ||
         pi.status === 'processing')
      ) {
        try {
          await stripe.paymentIntents.cancel(pi.id);
          console.log(`Cleaned up test payment intent: ${pi.id}`);
        } catch (error) {
          // Ignore cleanup errors
          console.warn(`Failed to cleanup payment intent ${pi.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup test payment intents:', error);
  }
}

/**
 * Generate test payment data for API requests
 */
export function createTestPaymentData(overrides: any = {}) {
  return {
    customerInfo: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+40123456789',
      ...overrides.customerInfo
    },
    shippingAddress: {
      fullName: 'John Doe',
      streetAddress: 'Str. Test 123',
      city: 'Bucharest',
      postalCode: '123456',
      country: 'RO',
      state: 'B',
      ...overrides.shippingAddress
    },
    billingAddress: {
      fullName: 'John Doe', 
      streetAddress: 'Str. Test 123',
      city: 'Bucharest',
      postalCode: '123456',
      country: 'RO',
      state: 'B',
      ...overrides.billingAddress
    },
    items: [
      {
        id: 1,
        name: 'Test Product',
        price: 29.99,
        quantity: 1,
        image: '/test-product.jpg'
      }
    ],
    currency: 'ron',
    clientRequestId: `test_${Date.now()}`,
    ...overrides
  };
}

export default {
  TEST_CARDS,
  TEST_CVC,
  TEST_EXPIRY,
  TEST_AMOUNTS,
  createTestPaymentMethod,
  simulateSuccessfulPayment,
  simulateDeclinedPayment,
  createTestWebhookEvent,
  generateTestWebhookSignature,
  createTestWebhookRequest,
  createTestPaymentData,
  ronToBani,
  baniToRon,
  waitForWebhookProcessing,
  cleanupTestPaymentIntents,
};