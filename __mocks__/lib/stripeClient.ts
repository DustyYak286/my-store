/**
 * Mock Stripe Client for Unit and Integration Tests
 * 
 * This mock provides predictable responses for Stripe operations,
 * allowing tests to focus on business logic rather than external API calls.
 */

import type Stripe from 'stripe'

// Mock data generators
const generateMockPaymentIntent = (overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent => ({
  id: 'pi_test_1234567890',
  object: 'payment_intent',
  amount: 2999,
  amount_capturable: 0,
  amount_details: {},
  amount_received: 0,
  application: null,
  application_fee_amount: null,
  automatic_payment_methods: null,
  canceled_at: null,
  cancellation_reason: null,
  capture_method: 'automatic',
  charges: {
    object: 'list',
    data: [],
    has_more: false,
    total_count: 0,
    url: '/v1/charges?payment_intent=pi_test_1234567890'
  },
  client_secret: 'pi_test_1234567890_secret_test123',
  confirmation_method: 'automatic',
  created: Math.floor(Date.now() / 1000),
  currency: 'ron',
  customer: null,
  description: null,
  invoice: null,
  last_payment_error: null,
  latest_charge: null,
  livemode: false,
  metadata: {},
  next_action: null,
  on_behalf_of: null,
  payment_method: null,
  payment_method_options: {},
  payment_method_types: ['card'],
  processing: null,
  receipt_email: null,
  review: null,
  setup_future_usage: null,
  shipping: null,
  statement_descriptor: null,
  statement_descriptor_suffix: null,
  status: 'requires_payment_method',
  transfer_data: null,
  transfer_group: null,
  ...overrides
})

const generateMockCustomer = (overrides: Partial<Stripe.Customer> = {}): Stripe.Customer => ({
  id: 'cus_test_1234567890',
  object: 'customer',
  address: null,
  balance: 0,
  created: Math.floor(Date.now() / 1000),
  currency: null,
  default_source: null,
  delinquent: false,
  description: null,
  discount: null,
  email: 'test@example.com',
  invoice_prefix: 'TEST',
  invoice_settings: {
    custom_fields: null,
    default_payment_method: null,
    footer: null,
    rendering_options: null
  },
  livemode: false,
  metadata: {},
  name: 'Test Customer',
  next_invoice_sequence: 1,
  phone: null,
  preferred_locales: [],
  shipping: null,
  tax_exempt: 'none',
  test_clock: null,
  ...overrides
})

const generateMockWebhookEvent = (overrides: Partial<Stripe.Event> = {}): Stripe.Event => ({
  id: 'evt_test_1234567890',
  object: 'event',
  api_version: '2024-10-28.acacia',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: generateMockPaymentIntent(),
    previous_attributes: {}
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: 'req_test_1234567890',
    idempotency_key: null
  },
  type: 'payment_intent.created',
  ...overrides
})

// Mock implementation of stripe operations
export const stripeOperations = {
  createPaymentIntent: jest.fn(async (params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent> => {
    // Simulate validation errors
    if (params.amount < 250) { // 2.50 RON minimum
      const error = new Error('Amount must be at least 250 (2.50 RON)') as any
      error.type = 'StripeInvalidRequestError'
      error.code = 'amount_too_small'
      throw error
    }

    return generateMockPaymentIntent({
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata || {},
      status: 'requires_payment_method'
    })
  }),

  retrievePaymentIntent: jest.fn(async (id: string): Promise<Stripe.PaymentIntent> => {
    if (id === 'pi_nonexistent') {
      const error = new Error('No such payment_intent: pi_nonexistent') as any
      error.type = 'StripeInvalidRequestError'
      error.code = 'resource_missing'
      throw error
    }

    return generateMockPaymentIntent({ id })
  }),

  confirmPaymentIntent: jest.fn(async (id: string, params?: Stripe.PaymentIntentConfirmParams): Promise<Stripe.PaymentIntent> => {
    return generateMockPaymentIntent({
      id,
      status: 'succeeded',
      charges: {
        object: 'list',
        data: [{
          id: 'ch_test_1234567890',
          object: 'charge',
          amount: 2999,
          currency: 'ron',
          status: 'succeeded'
        }] as any,
        has_more: false,
        total_count: 1,
        url: `/v1/charges?payment_intent=${id}`
      }
    })
  }),

  cancelPaymentIntent: jest.fn(async (id: string): Promise<Stripe.PaymentIntent> => {
    return generateMockPaymentIntent({
      id,
      status: 'canceled',
      canceled_at: Math.floor(Date.now() / 1000),
      cancellation_reason: 'requested_by_customer'
    })
  }),

  constructWebhookEvent: jest.fn((payload: string, signature: string, secret: string): Stripe.Event => {
    // In real implementation, this would validate the signature
    // For mocks, we return a predictable event
    return generateMockWebhookEvent({
      data: {
        object: JSON.parse(payload),
        previous_attributes: {}
      }
    })
  }),

  listPaymentMethods: jest.fn(async (params?: Stripe.PaymentMethodListParams): Promise<Stripe.ApiList<Stripe.PaymentMethod>> => {
    return {
      object: 'list',
      data: [],
      has_more: false,
      url: '/v1/payment_methods'
    } as Stripe.ApiList<Stripe.PaymentMethod>
  }),

  createCustomer: jest.fn(async (params: Stripe.CustomerCreateParams): Promise<Stripe.Customer> => {
    return generateMockCustomer({
      email: params.email,
      name: params.name,
      metadata: params.metadata || {}
    })
  }),

  retrieveCustomer: jest.fn(async (id: string): Promise<Stripe.Customer> => {
    if (id === 'cus_nonexistent') {
      const error = new Error('No such customer: cus_nonexistent') as any
      error.type = 'StripeInvalidRequestError'
      error.code = 'resource_missing'
      throw error
    }

    return generateMockCustomer({ id })
  }),
}

// Mock the client itself
export const getStripeClient = jest.fn(() => ({
  paymentIntents: {
    create: stripeOperations.createPaymentIntent,
    retrieve: stripeOperations.retrievePaymentIntent,
    confirm: stripeOperations.confirmPaymentIntent,
    cancel: stripeOperations.cancelPaymentIntent,
  },
  webhooks: {
    constructEvent: stripeOperations.constructWebhookEvent,
  },
  paymentMethods: {
    list: stripeOperations.listPaymentMethods,
  },
  customers: {
    create: stripeOperations.createCustomer,
    retrieve: stripeOperations.retrieveCustomer,
  },
}))

export const resetStripeClient = jest.fn()

// Default export
export default getStripeClient

// Export mock stripe client as named export for convenience
export const stripe = getStripeClient