/**
 * Mock Stripe SDK for Jest testing
 * Prevents real API calls and provides controlled test responses
 */

class MockStripeError extends Error {
  constructor(message, type = 'card_error', code = 'generic_decline') {
    super(message);
    this.name = 'StripeError';
    this.type = type;
    this.code = code;
    this.rawType = type;
  }
}

class MockPaymentMethod {
  constructor(data = {}) {
    this.id = data.id || `pm_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.object = 'payment_method';
    this.type = 'card';
    this.card = data.card || {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2025
    };
    this.billing_details = data.billing_details || null;
    this.created = Math.floor(Date.now() / 1000);
  }
}

class MockPaymentIntent {
  constructor(data = {}) {
    this.id = data.id || `pi_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.object = 'payment_intent';
    this.amount = data.amount || 2999;
    this.currency = data.currency || 'ron';
    this.status = data.status || 'requires_payment_method';
    this.client_secret = `${this.id}_secret_${Math.random().toString(36).slice(2)}`;
    this.metadata = data.metadata || {};
    this.created = Math.floor(Date.now() / 1000);
    this.description = data.description || null;
  }
}

class MockStripe {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = options;
    
    // Mock payment intents API
    this.paymentIntents = {
      create: jest.fn((params) => {
        // Simulate different test scenarios based on metadata
        if (params.metadata?.test_scenario === 'declined') {
          throw new MockStripeError('Your card was declined.', 'card_error', 'card_declined');
        }
        
        if (params.metadata?.test_scenario === 'insufficient_funds') {
          throw new MockStripeError('Your card has insufficient funds.', 'card_error', 'insufficient_funds');
        }
        
        // Return successful mock payment intent
        return Promise.resolve(new MockPaymentIntent({
          amount: params.amount,
          currency: params.currency,
          metadata: params.metadata,
          description: params.description
        }));
      }),
      
      retrieve: jest.fn((id) => {
        if (id === 'pi_nonexistent') {
          throw new MockStripeError('No such payment_intent', 'invalid_request_error');
        }
        
        return Promise.resolve(new MockPaymentIntent({
          id,
          status: 'succeeded'
        }));
      }),
      
      confirm: jest.fn((id, params) => {
        return Promise.resolve(new MockPaymentIntent({
          id,
          status: 'succeeded',
          payment_method: params.payment_method
        }));
      }),
      
      cancel: jest.fn((id) => {
        return Promise.resolve(new MockPaymentIntent({
          id,
          status: 'canceled'
        }));
      }),
      
      list: jest.fn((params = {}) => {
        return Promise.resolve({
          object: 'list',
          data: [],
          has_more: false,
          total_count: 0
        });
      })
    };
    
    // Mock payment methods API
    this.paymentMethods = {
      create: jest.fn((params) => {
        return Promise.resolve(new MockPaymentMethod(params));
      }),
      
      list: jest.fn((params = {}) => {
        return Promise.resolve({
          object: 'list',
          data: [new MockPaymentMethod()],
          has_more: false
        });
      }),
      
      retrieve: jest.fn((id) => {
        return Promise.resolve(new MockPaymentMethod({ id }));
      })
    };
    
    // Mock webhooks API
    this.webhooks = {
      constructEvent: jest.fn((payload, sig, secret) => {
        // Simple validation - just check that required params are present
        if (!payload || !sig || !secret) {
          throw new MockStripeError('Invalid signature', 'invalid_request_error');
        }
        
        try {
          const event = JSON.parse(payload);
          return {
            id: event.id || `evt_test_${Date.now()}`,
            object: 'event',
            type: event.type || 'payment_intent.succeeded',
            data: event.data || { object: {} },
            created: event.created || Math.floor(Date.now() / 1000)
          };
        } catch (e) {
          throw new MockStripeError('Invalid JSON in webhook payload', 'invalid_request_error');
        }
      })
    };
  }
}

// Mock Stripe constructor
const mockStripeConstructor = jest.fn((apiKey, options) => {
  return new MockStripe(apiKey, options);
});

// Export Stripe errors for tests
mockStripeConstructor.errors = {
  StripeError: MockStripeError,
  StripeCardError: MockStripeError,
  StripeInvalidRequestError: MockStripeError,
  StripeAPIError: MockStripeError,
  StripeConnectionError: MockStripeError,
  StripeAuthenticationError: MockStripeError,
  StripePermissionError: MockStripeError,
  StripeRateLimitError: MockStripeError,
  StripeIdempotencyError: MockStripeError
};

module.exports = mockStripeConstructor;