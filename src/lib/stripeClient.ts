/**
 * Stripe Client Wrapper
 * 
 * Centralized Stripe client that can be easily mocked in tests.
 * This abstraction allows unit/integration tests to mock Stripe operations
 * while contract and E2E tests use the real client.
 */

import Stripe from 'stripe'
import { stripeConfig } from '@/config/stripe'

// Create the actual Stripe client
const createStripeClient = (): Stripe => {
  return new Stripe(stripeConfig.secretKey, {
    apiVersion: '2025-07-30.basil', // Use latest stable API version
    timeout: 30000, // 30 second timeout
    maxNetworkRetries: 2, // Retry failed requests
    telemetry: false, // Disable telemetry in production
  })
}

// Singleton instance
let stripeInstance: Stripe | null = null

/**
 * Get the Stripe client instance
 * Creates a singleton to avoid multiple client instances
 */
export const getStripeClient = (): Stripe => {
  if (!stripeInstance) {
    stripeInstance = createStripeClient()
  }
  return stripeInstance
}

/**
 * Reset the Stripe client instance (useful for tests)
 */
export const resetStripeClient = (): void => {
  stripeInstance = null
}

/**
 * Core Stripe operations abstraction
 * These functions wrap common Stripe operations and can be mocked in tests
 */
export const stripeOperations = {
  /**
   * Create a payment intent
   */
  createPaymentIntent: async (params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent> => {
    const stripe = getStripeClient()
    return stripe.paymentIntents.create(params)
  },

  /**
   * Retrieve a payment intent
   */
  retrievePaymentIntent: async (id: string): Promise<Stripe.PaymentIntent> => {
    const stripe = getStripeClient()
    return stripe.paymentIntents.retrieve(id)
  },

  /**
   * Confirm a payment intent
   */
  confirmPaymentIntent: async (id: string, params?: Stripe.PaymentIntentConfirmParams): Promise<Stripe.PaymentIntent> => {
    const stripe = getStripeClient()
    return stripe.paymentIntents.confirm(id, params)
  },

  /**
   * Update a payment intent
   */
  updatePaymentIntent: async (id: string, params: Stripe.PaymentIntentUpdateParams): Promise<Stripe.PaymentIntent> => {
    const stripe = getStripeClient()
    return stripe.paymentIntents.update(id, params)
  },

  /**
   * Cancel a payment intent
   */
  cancelPaymentIntent: async (id: string): Promise<Stripe.PaymentIntent> => {
    const stripe = getStripeClient()
    return stripe.paymentIntents.cancel(id)
  },

  /**
   * Construct webhook event from payload and signature
   */
  constructWebhookEvent: (payload: string, signature: string, secret: string): Stripe.Event => {
    const stripe = getStripeClient()
    return stripe.webhooks.constructEvent(payload, signature, secret)
  },

  /**
   * List payment methods
   */
  listPaymentMethods: async (params?: Stripe.PaymentMethodListParams): Promise<Stripe.ApiList<Stripe.PaymentMethod>> => {
    const stripe = getStripeClient()
    return stripe.paymentMethods.list(params)
  },

  /**
   * Create a customer
   */
  createCustomer: async (params: Stripe.CustomerCreateParams): Promise<Stripe.Customer> => {
    const stripe = getStripeClient()
    return stripe.customers.create(params)
  },

  /**
   * Retrieve a customer
   */
  retrieveCustomer: async (id: string): Promise<Stripe.Customer> => {
    const stripe = getStripeClient()
    return stripe.customers.retrieve(id)
  },
}

// Export the client for direct access when needed (e.g., complex operations)
export { getStripeClient as stripe }

// Default export for convenience
export default getStripeClient