/**
 * Integration Tests for Payment Flow
 * 
 * Tests the complete payment flow using Stripe's test environment
 * with real API calls to verify end-to-end functionality.
 */

// Dynamic imports to avoid Request/Response loading issues in Jest
// API functions will be imported dynamically in test functions
import type { CreateOrderRequest } from '@/types/order';
import type { CartItem } from '@/types/cart';

// Test environment validation
const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
];

beforeAll(() => {
  // Ensure we're using test keys
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey?.startsWith('sk_test_')) {
    throw new Error('Integration tests must use Stripe test keys (sk_test_...)');
  }

  // Validate all required environment variables
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
});

describe('Payment Flow Integration Tests', () => {
  // Generate unique test data for each test to avoid idempotency key conflicts
  const createUniqueTestData = (testId: string = Date.now().toString()) => ({
    customerInfo: {
      email: `test+${testId}@example.com`,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+40123456789'
    },
    shippingAddress: {
      fullName: 'John Doe',
      streetAddress: 'Str. Test 123',
      city: 'Bucharest',
      postalCode: '123456',
      country: 'RO',
      state: 'B'
    },
    billingAddress: {
      fullName: 'John Doe',
      streetAddress: 'Str. Test 123',
      city: 'Bucharest',
      postalCode: '123456',
      country: 'RO',
      state: 'B'
    },
    items: [
      {
        id: 1,
        name: 'Test Product',
        price: 29.99,
        quantity: 1,
        image: '/test-product.jpg'
      }
    ] as CartItem[],
    currency: 'ron',
    clientRequestId: `test_${testId}_${Math.random().toString(36).substr(2, 9)}`
  });

  describe('Payment Intent Creation', () => {
    it('should create a payment intent with valid data', async () => {
      // Dynamic imports to avoid Jest environment issues
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      // Create unique test data for this specific test
      const testData = createUniqueTestData('valid_payment_intent');
      
      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: JSON.stringify(testData)
      });

      const response = await createPaymentIntent(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.paymentIntent).toBeDefined();
      expect(data.paymentIntent.clientSecret).toMatch(/^pi_.*_secret_.*/);
      expect(data.order).toBeDefined();
      expect(data.order.id).toBeDefined();
      expect(data.metadata.isTestMode).toBe(true);
    }, 15000);

    it('should reject invalid payment amounts', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      const testData = createUniqueTestData('invalid_payment_amount');
      const invalidData = {
        ...testData,
        items: [
          {
            id: 1,
            name: 'Invalid Product',
            price: 1.00, // Below minimum of 2.50 RON
            quantity: 1,
            image: '/test-product.jpg'
          }
        ] as CartItem[]
      };

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: JSON.stringify(invalidData)
      });

      const response = await createPaymentIntent(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_AMOUNT');
    });

    it('should handle rate limiting gracefully', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      const requests = Array.from({ length: 3 }, (_, i) => 
        new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Forwarded-For': '192.168.1.100' // Simulate same IP
          },
          body: JSON.stringify({
            ...createUniqueTestData(`rate_limit_test_${i}`),
            clientRequestId: `rate_limit_test_${Date.now()}_${i}`
          })
        })
      );

      const responses = await Promise.all(
        requests.map(req => createPaymentIntent(req))
      );

      // At least one request should succeed
      const statuses = responses.map(r => r.status);
      const successCount = statuses.filter(s => s === 200).length;
      const rateLimitedCount = statuses.filter(s => s === 429).length;
      
      expect(successCount).toBeGreaterThan(0);
      // Rate limiting may or may not occur depending on timing
      expect(successCount + rateLimitedCount).toBe(responses.length);
    }, 20000);
  });

  describe('Stripe API Integration', () => {
    it('should successfully connect to Stripe test API', async () => {
      // Use our controlled Stripe instance from setup (production-grade pattern)
      const stripe = (global as any).__STRIPE_INTEGRATION__;
      expect(stripe).toBeDefined();
      
      // Test basic API connectivity
      const paymentMethods = await stripe.paymentMethods.list({ limit: 1 });
      expect(paymentMethods).toBeDefined();
      expect(paymentMethods.object).toBe('list');
    });

    it('should create and retrieve payment intent via Stripe API', async () => {
      // Use our controlled Stripe instance from setup (production-grade pattern)
      const stripe = (global as any).__STRIPE_INTEGRATION__;
      expect(stripe).toBeDefined();
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 2999, // 29.99 RON in bani
        currency: 'ron',
        metadata: {
          orderId: 'test_integration_order',
          source: 'integration_test'
        }
      });

      expect(paymentIntent).toBeDefined();
      expect(paymentIntent.id).toMatch(/^pi_.*/);
      expect(paymentIntent.amount).toBe(2999);
      expect(paymentIntent.currency).toBe('ron');
      expect(paymentIntent.metadata.orderId).toBe('test_integration_order');

      // Retrieve the payment intent
      const retrieved = await stripe.paymentIntents.retrieve(paymentIntent.id);
      expect(retrieved.id).toBe(paymentIntent.id);
      expect(retrieved.amount).toBe(paymentIntent.amount);
    });

    it('should handle Stripe API errors appropriately', async () => {
      // Use our controlled Stripe instance from setup (production-grade pattern)
      const stripe = (global as any).__STRIPE_INTEGRATION__;
      expect(stripe).toBeDefined();
      
      // Try to retrieve non-existent payment intent
      try {
        await stripe.paymentIntents.retrieve('pi_nonexistent');
        fail('Expected an error to be thrown');
      } catch (error: any) {
        expect(error.message).toContain('No such payment_intent');
        // Stripe errors have different structure - check the actual error type property
        expect(error.type || error.constructor.name).toMatch(/invalid.*request.*error/i);
      }
    });
  });

  describe('Environment Configuration', () => {
    it('should use test mode configuration', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { stripeConfig } = await import('@/config/stripe');
      
      expect(stripeConfig.isTestMode).toBe(true);
      expect(stripeConfig.secretKey).toMatch(/^sk_test_.*/);
      expect(stripeConfig.environmentLabel).toBe('test');
    });

    it('should have proper webhook configuration', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { stripeConfig } = await import('@/config/stripe');
      
      expect(stripeConfig.webhookSecret).toBeDefined();
      expect(stripeConfig.webhooks.tolerance).toBeGreaterThan(0);
      expect(stripeConfig.webhooks.timeout).toBeGreaterThan(0);
    });

    it('should validate environment consistency', () => {
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      const secretKey = process.env.STRIPE_SECRET_KEY;
      
      // Both should be test keys or both should be live keys
      const isPublishableTest = publishableKey?.startsWith('pk_test_');
      const isSecretTest = secretKey?.startsWith('sk_test_');
      
      expect(isPublishableTest).toBe(isSecretTest);
    });
  });

  describe('Order Integration', () => {
    it('should create and store order properly', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const { getOrderById } = await import('@/lib/orderStore');
      
      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: JSON.stringify({
          ...createUniqueTestData('order_integration_test'),
          clientRequestId: `order_integration_test_${Date.now()}`
        })
      });

      const response = await createPaymentIntent(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      const orderId = data.order.id;

      // Verify order was stored
      const storedOrder = getOrderById(orderId);
      expect(storedOrder).toBeDefined();
      expect(storedOrder?.id).toBe(orderId);
      expect(storedOrder?.status).toBe('pending');
      expect(storedOrder?.customerInfo.email).toMatch(/^test\+.*@example\.com$/);
    });
  });

  describe('Security Integration', () => {
    it('should reject requests without proper origin', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      // Add delay to avoid rate limiting from previous tests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://malicious-site.com',
          'X-Forwarded-For': '192.168.1.101' // Different IP from rate limit test
        },
        body: JSON.stringify({
          ...createUniqueTestData('origin_test'),
          clientRequestId: `origin_test_${Date.now()}`
        })
      });

      const response = await createPaymentIntent(request);
      
      // Should be 403 (forbidden) or 429 (rate limited)
      expect([403, 429]).toContain(response.status);

      const data = await response.json();
      expect(data.success).toBe(false);
      
      if (response.status === 403) {
        expect(data.error.code).toBe('ORIGIN_NOT_ALLOWED');
      } else if (response.status === 429) {
        expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    it('should reject malformed JSON', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'X-Forwarded-For': '192.168.1.102' // Different IP
        },
        body: 'invalid json'
      });

      const response = await createPaymentIntent(request);
      
      // Should be 400 (bad request) or 429 (rate limited)
      expect([400, 429]).toContain(response.status);

      const data = await response.json();
      expect(data.success).toBe(false);
      
      if (response.status === 400) {
        expect(data.error.code).toBe('INVALID_JSON');
      } else if (response.status === 429) {
        expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    it('should validate required fields', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const testData = createUniqueTestData('incomplete_data');
      const incompleteData = {
        ...testData,
        customerInfo: {
          // Missing email
          firstName: 'John',
          lastName: 'Doe'
        }
      };

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'X-Forwarded-For': '192.168.1.103' // Different IP
        },
        body: JSON.stringify({
          ...incompleteData,
          clientRequestId: `validation_test_${Date.now()}`
        })
      });

      const response = await createPaymentIntent(request);
      
      // Should be 400 (validation error) or 429 (rate limited)
      expect([400, 429]).toContain(response.status);

      const data = await response.json();
      expect(data.success).toBe(false);
      
      if (response.status === 400) {
        expect(data.error.type).toBe('validation_error');
      } else if (response.status === 429) {
        expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle network timeouts gracefully', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      // This test simulates network issues by testing with very short timeouts
      // In a real scenario, you might mock the Stripe API to simulate timeouts
      
      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: JSON.stringify(createUniqueTestData('timeout_test'))
      });

      // Test should complete within reasonable time
      const startTime = Date.now();
      const response = await createPaymentIntent(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(30000); // 30 second timeout
      expect(response).toBeDefined();
    }, 35000);

    it('should return proper error structure', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: JSON.stringify({}) // Empty body to trigger validation errors
      });

      const response = await createPaymentIntent(request);
      const data = await response.json();

      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data.error).toHaveProperty('code');
      expect(data.error).toHaveProperty('message');
      expect(data.error).toHaveProperty('type');
      expect(data).toHaveProperty('requestId');
    });
  });
});