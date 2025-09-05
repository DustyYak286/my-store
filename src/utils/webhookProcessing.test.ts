/**
 * Webhook Processing Tests
 * 
 * Tests for webhook event processing including order status updates,
 * payment confirmation, and audit trail management.
 */

import { processWebhookEvent, validateWebhookProcessingRequirements } from './webhookProcessing';
import { storeOrder, getOrderById, clearAllOrders } from '@/lib/orderStore';
import { createOrder } from '@/lib/orderHelpers';
import { OrderStatus, PaymentStatus } from '@/types/order';
import { monitoring } from '@/utils/monitoring';
import { clearCartAfterPayment } from '@/utils/cartClearing';
import type Stripe from 'stripe';

// Mock monitoring
jest.mock('@/utils/monitoring', () => ({
  monitoring: {
    recordWebhookError: jest.fn(),
    recordWebhookOrderUpdated: jest.fn(),
    recordCardDecline: jest.fn(),
    recordAuthenticationFailure: jest.fn(),
    recordNetworkTimeout: jest.fn(),
    recordPaymentFailure: jest.fn(),
    recordPaymentError: jest.fn(),
  },
}));

// Mock cart clearing
jest.mock('@/utils/cartClearing', () => ({
  clearCartAfterPayment: jest.fn(),
}));

const mockClearCartAfterPayment = clearCartAfterPayment as jest.MockedFunction<typeof clearCartAfterPayment>;

describe('Webhook Processing', () => {
  beforeEach(() => {
    clearAllOrders();
    jest.clearAllMocks();
    
    // Setup default cart clearing mock
    mockClearCartAfterPayment.mockResolvedValue({
      success: true,
      method: 'session_based',
      sessionId: 'session_test',
      orderId: 'test_order',
      timestamp: new Date().toISOString(),
    });
  });

  describe('processWebhookEvent', () => {
    it('should process payment_intent.succeeded and update order to PAID', async () => {
      // Create and store a test order
      const orderRequest = {
        customerInfo: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isGuest: true,
        },
        shippingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        billingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        items: [{
          id: 1,
          name: 'Test Product',
          price: 10.00,
          quantity: 1,
          image: 'test.jpg',
        }],
      };

      const orderResult = createOrder(orderRequest);
      const order = orderResult.order;
      storeOrder(order);

      // Create a mock Stripe event with amount matching the order total (including tax)
      // Order totals are already in bani (smallest currency unit)
      const orderAmountInBani = order.totals?.total || order.total;
      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test123',
            amount: orderAmountInBani, // Amount in bani (RON cents)
            currency: 'ron',
            status: 'succeeded',
            charges: {
              data: [{
                id: 'ch_test123',
              }]
            },
          } as Stripe.PaymentIntent,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.succeeded',
      };

      const metadata = {
        orderId: order.id,
        version: '1.0',
        source: 'stripe',
      };

      // Process the webhook event
      const result = await processWebhookEvent(mockEvent, metadata);


      // Verify the result  
      expect(result.success).toBe(true);
      expect(result.orderId).toBe(order.id);
      expect(result.action).toBe('payment_confirmed');
      expect(result.cartClearing).toBeDefined();
      expect(result.cartClearing?.success).toBe(true);
      expect(result.cartClearing?.method).toBe('session_based');

      // Verify the order was updated
      const updatedOrder = getOrderById(order.id);
      expect(updatedOrder).toBeTruthy();
      expect(updatedOrder!.status).toBe(OrderStatus.PAID);
      expect(updatedOrder!.paymentStatus).toBe(PaymentStatus.SUCCEEDED);
      expect(updatedOrder!.payment.paymentIntentId).toBe('pi_test123');
      expect(updatedOrder!.payment.capturedAt).toBeTruthy();

      // Verify cart clearing was called
      expect(mockClearCartAfterPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: order.id,
          status: OrderStatus.PAID,
        }),
        'Payment successful via Stripe webhook'
      );

      // Verify monitoring was called
      expect(monitoring.recordWebhookOrderUpdated).toHaveBeenCalledWith(
        order.id,
        OrderStatus.PAID,
        order.totals?.total || order.total
      );
    });

    it('should process payment_intent.payment_failed and update order to FAILED', async () => {
      // Create and store a test order
      const orderRequest = {
        customerInfo: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isGuest: true,
        },
        shippingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        billingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        items: [{
          id: 1,
          name: 'Test Product',
          price: 10.00,
          quantity: 1,
          image: 'test.jpg',
        }],
      };

      const orderResult = createOrder(orderRequest);
      const order = orderResult.order;
      storeOrder(order);

      // Create a mock Stripe event for payment failure  
      // Order totals are already in bani (smallest currency unit)
      const orderAmountInBani = order.totals?.total || order.total;
      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test123',
            amount: orderAmountInBani,
            currency: 'ron',
            status: 'payment_failed',
            last_payment_error: {
              code: 'card_declined',
              decline_code: 'generic_decline',
              message: 'Your card was declined.',
              type: 'card_error',
              payment_method: {
                type: 'card',
                card: {
                  brand: 'visa',
                  country: 'US',
                },
              },
            },
          } as Stripe.PaymentIntent,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.payment_failed',
      };

      const metadata = {
        orderId: order.id,
        version: '1.0',
        source: 'stripe',
      };

      // Process the webhook event
      const result = await processWebhookEvent(mockEvent, metadata);


      // Verify the result
      expect(result.success).toBe(true);
      expect(result.orderId).toBe(order.id);
      expect(result.action).toBe('payment_failed');

      // Verify the order was updated
      const updatedOrder = getOrderById(order.id);
      expect(updatedOrder).toBeTruthy();
      expect(updatedOrder!.status).toBe(OrderStatus.FAILED);
      expect(updatedOrder!.paymentStatus).toBe(PaymentStatus.FAILED);
      expect(updatedOrder!.payment.paymentIntentId).toBe('pi_test123');
      expect(updatedOrder!.payment.failedAt).toBeTruthy();
      expect(updatedOrder!.payment.failureReason).toBe('Your card was declined.');
      expect(updatedOrder!.payment.failureCode).toBe('card_declined');

      // Verify monitoring was called
      expect(monitoring.recordWebhookOrderUpdated).toHaveBeenCalledWith(
        order.id,
        OrderStatus.FAILED,
        orderAmountInBani
      );
    });

    it('should return error when order is not found', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test123',
            amount: 1000, // 10.00 RON in bani (this test doesn't use a real order)
            currency: 'ron',
            status: 'succeeded',
          } as Stripe.PaymentIntent,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.succeeded',
      };

      const metadata = {
        orderId: 'nonexistent_order',
        version: '1.0',
        source: 'stripe',
      };

      const result = await processWebhookEvent(mockEvent, metadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order not found');
      expect(monitoring.recordWebhookError).toHaveBeenCalledWith(
        'order_not_found',
        expect.objectContaining({
          orderId: 'nonexistent_order',
          eventType: 'payment_intent.succeeded',
        })
      );
    });

    it('should handle unhandled event types gracefully', async () => {
      // Create and store a test order
      const orderRequest = {
        customerInfo: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isGuest: true,
        },
        shippingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        billingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        items: [{
          id: 1,
          name: 'Test Product',
          price: 10.00,
          quantity: 1,
          image: 'test.jpg',
        }],
      };

      const orderResult = createOrder(orderRequest);
      const order = orderResult.order;
      storeOrder(order);

      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {} as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.created' as any, // Unhandled event type
      };

      const metadata = {
        orderId: order.id,
        version: '1.0',
        source: 'stripe',
      };

      const result = await processWebhookEvent(mockEvent, metadata);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(order.id);
      expect(result.action).toBe('ignored_unhandled_event');
    });

    it('should handle cart clearing failure gracefully', async () => {
      // Mock cart clearing failure
      mockClearCartAfterPayment.mockResolvedValue({
        success: false,
        method: 'failed',
        error: 'Cart service unavailable',
        orderId: 'test_order',
        timestamp: new Date().toISOString(),
      });

      // Create and store a test order
      const orderRequest = {
        customerInfo: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isGuest: true,
        },
        shippingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        billingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        items: [{
          id: 1,
          name: 'Test Product',
          price: {
            original: 10.00,
            discount: null,
          },
          quantity: 1,
          image: 'test.jpg',
        }],
        sessionData: {
          sessionId: 'session_test',
          guestId: 'guest_123',
        },
      };

      const orderResult = createOrder(orderRequest);
      const order = orderResult.order;
      storeOrder(order);

      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test123',
            object: 'payment_intent',
            amount: order.totals?.total || order.total, // Amount already in bani
            currency: 'ron',
            status: 'succeeded',
            payment_method: 'pm_test123',
            charges: {
              data: [{
                id: 'ch_test123',
              }],
            },
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.succeeded',
      };

      const metadata = {
        orderId: order.id,
        version: '1.0',
        source: 'stripe',
      };

      // Process the webhook event
      const result = await processWebhookEvent(mockEvent, metadata);

      // Payment should still succeed even if cart clearing fails
      expect(result.success).toBe(true);
      expect(result.orderId).toBe(order.id);
      expect(result.action).toBe('payment_confirmed');
      expect(result.cartClearing).toBeDefined();
      expect(result.cartClearing?.success).toBe(false);
      expect(result.cartClearing?.error).toBe('Cart service unavailable');

      // Order should still be updated to PAID
      const updatedOrder = getOrderById(order.id);
      expect(updatedOrder!.status).toBe(OrderStatus.PAID);
    });

    it('should handle cart clearing exception gracefully', async () => {
      // Mock cart clearing exception
      mockClearCartAfterPayment.mockRejectedValue(new Error('Network timeout'));

      const orderRequest = {
        customerInfo: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isGuest: true,
        },
        shippingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        billingAddress: {
          fullName: 'Test User',
          streetAddress: '123 Test St',
          city: 'Test City',
          postalCode: '12345',
          country: 'RO',
        },
        items: [{
          id: 1,
          name: 'Test Product',
          price: {
            original: 10.00,
            discount: null,
          },
          quantity: 1,
          image: 'test.jpg',
        }],
        sessionData: {
          sessionId: 'session_test',
          guestId: 'guest_123',
        },
      };

      const orderResult = createOrder(orderRequest);
      const order = orderResult.order;
      storeOrder(order);

      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test123',
            object: 'payment_intent',
            amount: order.totals?.total || order.total, // Amount already in bani
            currency: 'ron',
            status: 'succeeded',
            payment_method: 'pm_test123',
            charges: {
              data: [{
                id: 'ch_test123',
              }],
            },
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.succeeded',
      };

      const metadata = {
        orderId: order.id,
        version: '1.0',
        source: 'stripe',
      };

      // Process the webhook event
      const result = await processWebhookEvent(mockEvent, metadata);

      // Payment should still succeed even if cart clearing throws
      expect(result.success).toBe(true);
      expect(result.cartClearing?.success).toBe(false);
      expect(result.cartClearing?.error).toBe('Network timeout');
    });
  });

  describe('validateWebhookProcessingRequirements', () => {
    it('should validate supported event types', () => {
      const validEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test123',
            amount: 1000, // 10.00 RON in bani (this test is just for event type validation)
            currency: 'ron',
          } as Stripe.PaymentIntent,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.succeeded',
      };

      const metadata = {
        orderId: 'order_123',
        version: '1.0',
        source: 'stripe',
      };

      const result = validateWebhookProcessingRequirements(validEvent, metadata);
      expect(result.isValid).toBe(true);
    });

    it('should reject unsupported event types', () => {
      const invalidEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {} as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'customer.created' as any,
      };

      const metadata = {
        orderId: 'order_123',
        version: '1.0',
        source: 'stripe',
      };

      const result = validateWebhookProcessingRequirements(invalidEvent, metadata);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported event type');
    });

    it('should require orderId in metadata', () => {
      const validEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            id: 'pi_test123',
            amount: 1000, // 10.00 RON in bani (this test is just for metadata validation)
            currency: 'ron',
          } as Stripe.PaymentIntent,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.succeeded',
      };

      const metadata = {
        orderId: '',
        version: '1.0',
        source: 'stripe',
      };

      const result = validateWebhookProcessingRequirements(validEvent, metadata);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing orderId');
    });

    it('should validate payment intent data structure', () => {
      const invalidEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: Date.now(),
        data: {
          object: {
            // Missing required fields
          } as any,
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test123',
          idempotency_key: null,
        },
        type: 'payment_intent.succeeded',
      };

      const metadata = {
        orderId: 'order_123',
        version: '1.0',
        source: 'stripe',
      };

      const result = validateWebhookProcessingRequirements(invalidEvent, metadata);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Missing payment intent ID');
    });
  });
});