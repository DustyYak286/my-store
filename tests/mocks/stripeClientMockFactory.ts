/**
 * Stripe Client Mock Factory
 * 
 * Creates fresh, isolated Stripe mock instances for each test.
 * Provides realistic mock behaviors without shared state.
 */

import type Stripe from 'stripe'

export interface StripeOperationsInterface {
  createPaymentIntent(params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent>;
  retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent>;
  confirmPaymentIntent(id: string, params?: Stripe.PaymentIntentConfirmParams): Promise<Stripe.PaymentIntent>;
  cancelPaymentIntent(id: string): Promise<Stripe.PaymentIntent>;
  constructWebhookEvent(payload: string, signature: string, secret: string): Stripe.Event;
  listPaymentMethods(params?: Stripe.PaymentMethodListParams): Promise<Stripe.ApiList<Stripe.PaymentMethod>>;
  createCustomer(params: Stripe.CustomerCreateParams): Promise<Stripe.Customer>;
  retrieveCustomer(id: string): Promise<Stripe.Customer>;
}

export function createMockStripeOperations(): StripeOperationsInterface {
  // Helper to generate mock payment intent
  const generateMockPaymentIntent = (overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.PaymentIntent => ({
    id: 'pi_test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 11),
    object: 'payment_intent',
    amount: 2999,
    currency: 'ron',
    status: 'requires_payment_method',
    client_secret: 'pi_test_' + Date.now() + '_secret_' + Math.random().toString(36).substr(2, 9),
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    metadata: {},
    charges: { object: 'list', data: [], has_more: false, total_count: 0 },
    amount_capturable: 0,
    amount_details: {},
    amount_received: 0,
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: 'automatic',
    confirmation_method: 'automatic',
    customer: null,
    description: null,
    invoice: null,
    last_payment_error: null,
    latest_charge: null,
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
    transfer_data: null,
    transfer_group: null,
    ...overrides
  } as Stripe.PaymentIntent);

  return {
    createPaymentIntent: jest.fn(async (params: Stripe.PaymentIntentCreateParams): Promise<Stripe.PaymentIntent> => {
      // Simulate Stripe validation errors
      if (params.amount < 250) {
        const error = new Error('Amount must be at least 250 (2.50 RON)') as any;
        error.type = 'StripeInvalidRequestError';
        error.code = 'amount_too_small';
        throw error;
      }
      
      return generateMockPaymentIntent({
        amount: params.amount,
        currency: params.currency,
        metadata: params.metadata || {},
      });
    }),

    retrievePaymentIntent: jest.fn(async (id: string): Promise<Stripe.PaymentIntent> => {
      if (id === 'pi_nonexistent') {
        const error = new Error('No such payment_intent: ' + id) as any;
        error.type = 'StripeInvalidRequestError';
        error.code = 'resource_missing';
        throw error;
      }
      return generateMockPaymentIntent({ id });
    }),

    confirmPaymentIntent: jest.fn(async (id: string, params?: Stripe.PaymentIntentConfirmParams): Promise<Stripe.PaymentIntent> => {
      return generateMockPaymentIntent({ 
        id, 
        status: 'succeeded',
        charges: { object: 'list', data: [{ id: 'ch_test_123', status: 'succeeded' } as any], has_more: false, total_count: 1 }
      });
    }),

    cancelPaymentIntent: jest.fn(async (id: string): Promise<Stripe.PaymentIntent> => {
      return generateMockPaymentIntent({ 
        id, 
        status: 'canceled',
        canceled_at: Math.floor(Date.now() / 1000)
      });
    }),

    constructWebhookEvent: jest.fn((payload: string, signature: string, secret: string): Stripe.Event => {
      return {
        id: 'evt_test_' + Date.now(),
        object: 'event',
        type: 'payment_intent.created',
        data: { object: JSON.parse(payload), previous_attributes: {} },
        created: Math.floor(Date.now() / 1000),
        api_version: '2024-10-28.acacia',
        livemode: false,
        pending_webhooks: 1,
        request: { id: 'req_test_123', idempotency_key: null }
      } as Stripe.Event;
    }),

    listPaymentMethods: jest.fn(async (params?: Stripe.PaymentMethodListParams): Promise<Stripe.ApiList<Stripe.PaymentMethod>> => {
      return {
        object: 'list',
        data: [],
        has_more: false,
        url: '/v1/payment_methods'
      } as Stripe.ApiList<Stripe.PaymentMethod>;
    }),

    createCustomer: jest.fn(async (params: Stripe.CustomerCreateParams): Promise<Stripe.Customer> => {
      return {
        id: 'cus_test_' + Date.now(),
        object: 'customer',
        email: params.email,
        name: params.name,
        created: Math.floor(Date.now() / 1000),
        address: null,
        balance: 0,
        currency: null,
        default_source: null,
        delinquent: false,
        description: null,
        discount: null,
        invoice_prefix: 'TEST',
        invoice_settings: {
          custom_fields: null,
          default_payment_method: null,
          footer: null,
          rendering_options: null
        },
        livemode: false,
        metadata: params.metadata || {},
        next_invoice_sequence: 1,
        phone: null,
        preferred_locales: [],
        shipping: null,
        tax_exempt: 'none',
        test_clock: null,
      } as Stripe.Customer;
    }),

    retrieveCustomer: jest.fn(async (id: string): Promise<Stripe.Customer> => {
      if (id === 'cus_nonexistent') {
        const error = new Error('No such customer: ' + id) as any;
        error.type = 'StripeInvalidRequestError';
        error.code = 'resource_missing';
        throw error;
      }
      return { id, object: 'customer' } as Stripe.Customer;
    }),
  };
}

export function createMockStripeClient(operations: StripeOperationsInterface) {
  return jest.fn(() => ({
    paymentIntents: {
      create: operations.createPaymentIntent,
      retrieve: operations.retrievePaymentIntent,
      confirm: operations.confirmPaymentIntent,
      cancel: operations.cancelPaymentIntent,
    },
    webhooks: {
      constructEvent: operations.constructWebhookEvent,
    },
    paymentMethods: {
      list: operations.listPaymentMethods,
    },
    customers: {
      create: operations.createCustomer,
      retrieve: operations.retrieveCustomer,
    },
  }));
}