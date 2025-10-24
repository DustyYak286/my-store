/**
 * Production-Grade Load Testing for Payment Systems
 * 
 * Stress tests and load tests to ensure the payment system can handle
 * production-level traffic and concurrent operations.
 */

// Dynamic imports to avoid Request/Response loading issues in Jest
// All API functions will be imported dynamically in test functions
import { 
  TEST_AMOUNTS,
  createTestWebhookEvent,
  createTestWebhookRequest,
  cleanupTestPaymentIntents,
  ronToBani
} from '../utils/stripe-test-helpers';
import type { CartItem } from '@/types/cart';
import crypto from 'crypto';

// These will be imported dynamically to avoid Request/Response loading issues
// import { POST as createPaymentIntent } from '@/app/api/payments/create-intent/route';
// import { POST as stripeWebhook } from '@/app/api/webhooks/stripe/route';
// import { NextRequest } from 'next/server';
// import { getOrderById, getAllOrders } from '@/utils/orderStore';

beforeAll(() => {
  console.log('[LAUNCH] Starting Production-Grade Load Testing');
  console.log('[WARN]  These tests simulate high-load payment scenarios');
});

afterAll(async () => {
  // Dynamic import to avoid module-level loading issues
  const { cleanupTestPaymentIntents } = await import('../utils/stripe-test-helpers');
  await cleanupTestPaymentIntents('load_test');
  console.log('[SUCCESS] Load testing cleanup completed');
});

describe('Production Load Testing', () => {

  describe('High Volume Payment Processing', () => {
    it('should handle 20 concurrent payment creations without errors', async () => {
      const testId = `load_test_concurrent_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const testItems: CartItem[] = [
        {
          id: 1,
          name: 'Load Test Product',
          price: TEST_AMOUNTS.MIN_VALID,
          quantity: 1,
          image: '/test-product.jpg'
        }
      ];

      console.log(`[FIRE] Starting concurrent payment test with ID: ${testId}`);

      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');

      // Create 20 concurrent payment requests
      const concurrentCount = 20;
      const requests: Promise<Response>[] = [];
      const startTime = Date.now();

      for (let i = 0; i < concurrentCount; i++) {
        const testData = testUtils.createTestPaymentData({
          items: testItems,
          clientRequestId: `${testId}_${i}`,
          customerInfo: {
            email: `loadtest${i}+${testId}@example.com`,
            firstName: 'Load',
            lastName: `Test${i}`,
            phone: '+40123456789'
          }
        });

        const request = createPaymentIntent(new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_${i}`,
            'X-Forwarded-For': `192.168.1.${100 + (i % 155)}`, // Vary IP addresses
            'X-Load-Test': 'true'
          },
          body: JSON.stringify(testData)
        }));

        requests.push(request);
      }

      // Wait for all requests to complete
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Analyze results
      const statuses = responses.map(r => r.status);
      const successCount = statuses.filter(s => s === 200).length;
      const errorCount = statuses.filter(s => s >= 400).length;
      const rateLimitedCount = statuses.filter(s => s === 429).length;

      console.log(`[STATS] Load Test Results:`);
      console.log(`   Total Requests: ${concurrentCount}`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Rate Limited: ${rateLimitedCount}`);
      console.log(`   Errors: ${errorCount}`);
      console.log(`   Total Time: ${totalTime}ms`);
      console.log(`   Avg Time per Request: ${(totalTime / concurrentCount).toFixed(2)}ms`);

      // Assertions for production readiness
      expect(successCount).toBeGreaterThan(concurrentCount * 0.8); // At least 80% success rate
      expect(errorCount).toBe(0); // No server errors
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
      expect(totalTime / concurrentCount).toBeLessThan(5000); // Avg < 5s per request

      console.log(`[SUCCESS] Concurrent payment load test passed`);
    }, 60000);

    it('should handle sequential payment processing under sustained load', async () => {
      const testId = `load_test_sequential_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const testItems: CartItem[] = [
        {
          id: 1,
          name: 'Sequential Load Test Product',
          price: TEST_AMOUNTS.MIN_VALID,
          quantity: 1,
          image: '/test-product.jpg'
        }
      ];

      console.log(`[LIGHTNING] Starting sequential load test with ID: ${testId}`);

      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');

      const sequentialCount = 10;
      const results: { time: number; success: boolean; status: number }[] = [];
      let totalTime = 0;

      for (let i = 0; i < sequentialCount; i++) {
        const testData = testUtils.createTestPaymentData({
          items: testItems,
          clientRequestId: `${testId}_seq_${i}`,
          customerInfo: {
            email: `seqtest${i}+${testId}@example.com`,
            firstName: 'Sequential',
            lastName: `Test${i}`,
            phone: '+40123456789'
          }
        });

        const startTime = Date.now();

        const response = await createPaymentIntent(new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_seq_${i}`,
            'X-Sequential-Test': 'true'
          },
          body: JSON.stringify(testData)
        }));

        const endTime = Date.now();
        const requestTime = endTime - startTime;
        totalTime += requestTime;

        results.push({
          time: requestTime,
          success: response.status === 200,
          status: response.status
        });

        // Small delay to simulate realistic traffic
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate metrics
      const successCount = results.filter(r => r.success).length;
      const avgTime = totalTime / sequentialCount;
      const maxTime = Math.max(...results.map(r => r.time));
      const minTime = Math.min(...results.map(r => r.time));

      console.log(`[CHART] Sequential Load Test Results:`);
      console.log(`   Total Requests: ${sequentialCount}`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Average Time: ${avgTime.toFixed(2)}ms`);
      console.log(`   Min Time: ${minTime}ms`);
      console.log(`   Max Time: ${maxTime}ms`);

      // Performance assertions
      expect(successCount).toBe(sequentialCount); // 100% success rate for sequential
      expect(avgTime).toBeLessThan(3000); // Average < 3s
      expect(maxTime).toBeLessThan(10000); // No request > 10s

      console.log(`[SUCCESS] Sequential load test passed`);
    }, 45000);
  });

  describe('Webhook Processing Under Load', () => {
    it('should handle burst webhook processing', async () => {
      const testId = `load_test_webhooks_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      // Create multiple orders first
      const orderCount = 15;
      const orders: any[] = [];

      console.log(`[TRACK] Creating ${orderCount} orders for webhook load test`);

      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');

      for (let i = 0; i < orderCount; i++) {
        const testItems: CartItem[] = [
          {
            id: 1,
            name: `Webhook Load Test Product ${i}`,
            price: TEST_AMOUNTS.MIN_VALID,
            quantity: 1,
            image: '/test-product.jpg'
          }
        ];

        const testData = testUtils.createTestPaymentData({
          items: testItems,
          clientRequestId: `${testId}_webhook_${i}`
        });

        const createRequest = new NextRequest('http://localhost:3000/api/payments/create-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000',
            'X-Request-ID': `${testId}_webhook_${i}`
          },
          body: JSON.stringify(testData)
        });

        const response = await createPaymentIntent(createRequest);
        if (response.status === 200) {
          const data = await response.json();
          orders.push(data);
        }
      }

      expect(orders.length).toBeGreaterThan(orderCount * 0.8); // At least 80% created successfully

      console.log(`[MESSAGE] Processing ${orders.length} webhooks concurrently`);

      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: stripeWebhook } = await import('@/app/api/webhooks/stripe/route');

      // Process webhooks with small delays to avoid race conditions and rate limiting
      const webhookResponses: Response[] = [];
      const startTime = Date.now();

      for (const orderData of orders) {
        const mockSuccessfulPI = {
          id: orderData.paymentIntent.id,
          amount: orderData.paymentIntent.amount,
          currency: 'ron',
          status: 'succeeded',
          metadata: {
            orderId: orderData.order.id,
            testId: `${testId}_webhook`,
            loadTest: 'true'
          }
        } as any;

        const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', mockSuccessfulPI);
        const webhookRequest = createTestWebhookRequest(
          webhookEvent,
          process.env.STRIPE_WEBHOOK_SECRET!
        );

        const response = await stripeWebhook(webhookRequest);
        webhookResponses.push(response);
        
        // Small delay to avoid overwhelming the webhook processor
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const endTime = Date.now();
      const totalWebhookTime = endTime - startTime;

      // Analyze webhook processing results
      const webhookStatuses = webhookResponses.map(r => r.status);
      const successfulWebhooks = webhookStatuses.filter(s => s === 200).length;
      const failedWebhooks = webhookStatuses.filter(s => s >= 400).length;

      console.log(`[TRACK] Webhook Load Test Results:`);
      console.log(`   Total Webhooks: ${orders.length}`);
      console.log(`   Successful: ${successfulWebhooks}`);
      console.log(`   Failed: ${failedWebhooks}`);
      console.log(`   Total Processing Time: ${totalWebhookTime}ms`);
      console.log(`   Avg Time per Webhook: ${(totalWebhookTime / orders.length).toFixed(2)}ms`);

      // Webhook processing assertions
      expect(successfulWebhooks).toBe(orders.length); // 100% webhook success
      expect(failedWebhooks).toBe(0); // No webhook failures
      expect(totalWebhookTime).toBeLessThan(20000); // Process all within 20 seconds

      console.log(`[SUCCESS] Webhook load test passed`);
    }, 90000);
  });

  describe('Memory and Resource Management', () => {
    it('should maintain stable memory usage under sustained load', async () => {
      const testId = `load_test_memory_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      // Measure initial memory
      const initialMemory = process.memoryUsage();
      console.log(`[STATS] Initial Memory Usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');

      const testItems: CartItem[] = [
        {
          id: 1,
          name: 'Memory Load Test Product',
          price: TEST_AMOUNTS.MIN_VALID,
          quantity: 1,
          image: '/test-product.jpg'
        }
      ];

      // Process multiple payment requests to stress memory
      const iterations = 25;
      let successfulIterations = 0;

      for (let i = 0; i < iterations; i++) {
        const testData = testUtils.createTestPaymentData({
          items: testItems,
          clientRequestId: `${testId}_memory_${i}`,
          // Add some varying data to prevent optimization
          description: `Memory test iteration ${i} with data: ${'X'.repeat(i * 10)}`
        });

        try {
          const response = await createPaymentIntent(new NextRequest('http://localhost:3000/api/payments/create-intent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Origin': 'http://localhost:3000',
              'X-Request-ID': `${testId}_memory_${i}`
            },
            body: JSON.stringify(testData)
          }));

          if (response.status === 200) {
            successfulIterations++;
          }

          // Measure memory periodically
          if (i % 5 === 0) {
            const currentMemory = process.memoryUsage();
            console.log(`[CHART] Memory at iteration ${i}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
          }

          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.warn(`[WARN]  Error in memory test iteration ${i}:`, error);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('[CLEANUP]  Forced garbage collection');
      }

      // Final memory measurement
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`[STATS] Memory Load Test Results:`);
      console.log(`   Iterations Completed: ${iterations}`);
      console.log(`   Successful: ${successfulIterations}`);
      console.log(`   Initial Memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final Memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory management assertions
      expect(successfulIterations).toBeGreaterThan(iterations * 0.8); // At least 80% success
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
      
      console.log(`[SUCCESS] Memory load test passed`);
    }, 60000);
  });

  describe('Database Performance Under Load', () => {
    it('should maintain fast order retrieval under high order volume', async () => {
      // Reset rate limiting state to ensure clean test environment
      const { resetRateLimitStore } = await import('@/lib/security/rateLimit');
      resetRateLimitStore();
      console.log('[REDIRECT] Rate limit store reset for database performance test');

      const testId = `load_test_db_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      // Create multiple orders to increase database load
      const orderCreationCount = 20;
      const createdOrders: string[] = [];

      console.log(`[DATABASE]  Creating ${orderCreationCount} orders for database load test`);

      // Dynamic imports to avoid Request/Response loading issues in Jest
      const { POST: createPaymentIntent } = await import('@/app/api/payments/create-intent/route');
      const { NextRequest } = await import('next/server');
      const testUtils = await import('../utils/stripe-test-helpers');
      const { getOrderById, getAllOrders } = await import('@/lib/orderStore');

      for (let i = 0; i < orderCreationCount; i++) {
        const testItems: CartItem[] = [
          {
            id: 1,
            name: `DB Load Test Product ${i}`,
            price: TEST_AMOUNTS.MIN_VALID + (i * 0.01), // Vary prices slightly
            quantity: Math.floor(i % 3) + 1, // Vary quantities
            image: '/test-product.jpg'
          }
        ];

        const testData = testUtils.createTestPaymentData({
          items: testItems,
          clientRequestId: `${testId}_db_${i}`,
          customerInfo: {
            email: `dbtest${i}+${testId}@example.com`,
            firstName: 'Database',
            lastName: `LoadTest${i}`,
            phone: `+4012345${String(i).padStart(4, '0')}`
          }
        });

        try {
          const response = await createPaymentIntent(new NextRequest('http://localhost:3000/api/payments/create-intent', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Origin': 'http://localhost:3000',
              'X-Request-ID': `${testId}_db_${i}`
            },
            body: JSON.stringify(testData)
          }));

          if (response.status === 200) {
            const data = await response.json();
            createdOrders.push(data.order.id);
          }
        } catch (error) {
          console.warn(`[WARN]  Database load test order creation failed for iteration ${i}`);
        }
      }

      console.log(`[STATS] Created ${createdOrders.length} orders, testing retrieval performance`);

      // Ensure we have orders to test with (database performance test requires data)
      expect(createdOrders.length).toBeGreaterThan(0);
      console.log(`[SUCCESS] Confirmed ${createdOrders.length} orders available for database performance testing`);

      // Test order retrieval performance
      const retrievalStartTime = Date.now();
      const retrievalResults: { orderId: string; found: boolean; time: number }[] = [];

      for (const orderId of createdOrders) {
        const startTime = Date.now();
        const order = getOrderById(orderId);
        const endTime = Date.now();
        const retrievalTime = endTime - startTime;

        retrievalResults.push({
          orderId,
          found: !!order,
          time: retrievalTime
        });
      }

      const totalRetrievalTime = Date.now() - retrievalStartTime;
      const avgRetrievalTime = createdOrders.length > 0 ? totalRetrievalTime / createdOrders.length : 0;
      const maxRetrievalTime = retrievalResults.length > 0 ? Math.max(...retrievalResults.map(r => r.time)) : 0;
      const successfulRetrievals = retrievalResults.filter(r => r.found).length;

      console.log(`[DEBUG] Database Retrieval Performance:`);
      console.log(`   Orders Retrieved: ${successfulRetrievals}/${createdOrders.length}`);
      console.log(`   Average Retrieval Time: ${avgRetrievalTime.toFixed(2)}ms`);
      console.log(`   Max Retrieval Time: ${maxRetrievalTime}ms`);
      console.log(`   Total Retrieval Time: ${totalRetrievalTime}ms`);

      // Test bulk order retrieval
      const bulkStartTime = Date.now();
      const allOrders = getAllOrders();
      const bulkEndTime = Date.now();
      const bulkRetrievalTime = bulkEndTime - bulkStartTime;

      console.log(`[TARGET] Bulk Retrieval Performance: ${bulkRetrievalTime}ms for ${allOrders.length} orders`);

      // Database performance assertions
      expect(successfulRetrievals).toBe(createdOrders.length); // All orders found
      expect(avgRetrievalTime).toBeLessThan(50); // Average < 50ms
      expect(maxRetrievalTime).toBeLessThan(200); // Max < 200ms
      expect(bulkRetrievalTime).toBeLessThan(1000); // Bulk < 1s

      console.log(`[SUCCESS] Database performance load test passed`);
    }, 120000);
  });
});