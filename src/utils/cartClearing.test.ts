/**
 * Tests for Cart Clearing Utilities
 */

import { 
  clearCartAfterPayment, 
  checkCartClearingInstructions, 
  getCartClearingStats,
  manualCartClearing,
  CartClearingResult
} from './cartClearing';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';
import { monitoring } from '@/utils/monitoring';

// Mock the monitoring utility
jest.mock('@/utils/monitoring', () => ({
  monitoring: {
    recordEvent: jest.fn(),
  },
}));

const mockMonitoring = monitoring as jest.Mocked<typeof monitoring>;

describe('cartClearing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear global state
    if (typeof globalThis !== 'undefined') {
      globalThis.__cartClearingInstructions = undefined;
      globalThis.__orderClearingInstructions = undefined;
    }
  });

  const mockOrder: Order = {
    id: 'order_123',
    orderNumber: 'ORD-2024-001',
    status: OrderStatus.PAID,
    paymentStatus: PaymentStatus.SUCCEEDED,
    currency: 'usd',
    items: [],
    totals: {
      subtotal: 50.00,
      tax: 5.00,
      shipping: 0,
      discount: 0,
      total: 55.00,
    },
    customer: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
    },
    shipping: {
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
      },
      method: 'standard',
    },
    billing: {
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'US',
      },
    },
    payment: {
      paymentIntentId: 'pi_test123',
      status: PaymentStatus.SUCCEEDED,
      method: 'card',
      amount: 55.00,
      currency: 'usd',
      provider: 'stripe',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:05:00Z',
    metadata: {
      sessionId: 'session_test123',
      source: 'web',
    },
  };

  describe('clearCartAfterPayment', () => {
    it('should successfully clear cart with session ID', async () => {
      const result = await clearCartAfterPayment(mockOrder, 'Test payment success');

      expect(result.success).toBe(true);
      expect(result.method).toBe('session_based');
      expect(result.sessionId).toBe('session_test123');
      expect(result.orderId).toBe('order_123');
      expect(typeof result.timestamp).toBe('string');

      // Verify monitoring calls
      expect(mockMonitoring.recordEvent).toHaveBeenCalledWith('cart_clearing_attempted', {
        orderId: 'order_123',
        sessionId: 'session_test123',
        hasSessionId: true,
        reason: 'Test payment success',
      });

      expect(mockMonitoring.recordEvent).toHaveBeenCalledWith('cart_clearing_success', {
        orderId: 'order_123',
        sessionId: 'session_test123',
        method: 'session_based',
        reason: 'Test payment success',
      });
    });

    it('should fallback to order-based clearing when no session ID', async () => {
      const orderWithoutSession = {
        ...mockOrder,
        metadata: {
          source: 'web',
        },
      };

      const result = await clearCartAfterPayment(orderWithoutSession, 'Test payment success');

      expect(result.success).toBe(true);
      expect(result.method).toBe('order_context');
      expect(result.sessionId).toBeUndefined();
      expect(result.orderId).toBe('order_123');

      // Verify monitoring calls
      expect(mockMonitoring.recordEvent).toHaveBeenCalledWith('cart_clearing_attempted', {
        orderId: 'order_123',
        sessionId: 'unknown',
        hasSessionId: false,
        reason: 'Test payment success',
      });

      expect(mockMonitoring.recordEvent).toHaveBeenCalledWith('cart_clearing_success', {
        orderId: 'order_123',
        sessionId: 'none',
        method: 'order_context',
        reason: 'Test payment success',
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock console methods to suppress output during testing
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Simulate an error by making sessionId invalid
      const orderWithInvalidData = {
        ...mockOrder,
        id: '', // Invalid order ID
      };

      const result = await clearCartAfterPayment(orderWithInvalidData, 'Test payment success');

      expect(result.success).toBe(true); // Should still succeed with fallback
      expect(result.method).toBe('session_based'); // First method should work

      consoleSpy.mockRestore();
    });
  });

  describe('checkCartClearingInstructions', () => {
    it('should return clearing instruction for valid session', () => {
      // Set up a clearing instruction
      if (typeof globalThis !== 'undefined') {
        globalThis.__cartClearingInstructions = new Map();
        globalThis.__cartClearingInstructions.set('session_test123', {
          sessionId: 'session_test123',
          orderId: 'order_123',
          reason: 'Payment successful',
          action: 'clear_cart',
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour from now
        });
      }

      const result = checkCartClearingInstructions('session_test123');

      expect(result.shouldClear).toBe(true);
      expect(result.reason).toBe('Payment successful');
      expect(result.instruction).toBeDefined();
      expect(result.instruction.action).toBe('clear_cart');
    });

    it('should return clearing instruction for valid order ID', () => {
      // Set up an order-based clearing instruction
      if (typeof globalThis !== 'undefined') {
        globalThis.__orderClearingInstructions = new Map();
        globalThis.__orderClearingInstructions.set('order_123', {
          orderId: 'order_123',
          reason: 'Payment confirmed',
          action: 'clear_cart',
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour from now
        });
      }

      const result = checkCartClearingInstructions(undefined, 'order_123');

      expect(result.shouldClear).toBe(true);
      expect(result.reason).toBe('Payment confirmed');
      expect(result.instruction).toBeDefined();
      expect(result.instruction.action).toBe('clear_cart');
    });

    it('should not return clearing instruction for expired session', () => {
      // Set up an expired clearing instruction
      if (typeof globalThis !== 'undefined') {
        globalThis.__cartClearingInstructions = new Map();
        globalThis.__cartClearingInstructions.set('session_expired', {
          sessionId: 'session_expired',
          orderId: 'order_456',
          reason: 'Payment successful',
          action: 'clear_cart',
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago (expired)
        });
      }

      const result = checkCartClearingInstructions('session_expired');

      expect(result.shouldClear).toBe(false);
      expect(result.reason).toBeUndefined();
      expect(result.instruction).toBeUndefined();
    });

    it('should return false when no identifiers provided', () => {
      const result = checkCartClearingInstructions();

      expect(result.shouldClear).toBe(false);
      expect(result.reason).toBeUndefined();
      expect(result.instruction).toBeUndefined();
    });

    it('should prioritize session-based over order-based instructions', () => {
      // Set up both types of instructions
      if (typeof globalThis !== 'undefined') {
        globalThis.__cartClearingInstructions = new Map();
        globalThis.__cartClearingInstructions.set('session_priority', {
          sessionId: 'session_priority',
          orderId: 'order_789',
          reason: 'Session-based clearing',
          action: 'clear_cart',
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        });

        globalThis.__orderClearingInstructions = new Map();
        globalThis.__orderClearingInstructions.set('order_789', {
          orderId: 'order_789',
          reason: 'Order-based clearing',
          action: 'clear_cart',
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        });
      }

      const result = checkCartClearingInstructions('session_priority', 'order_789');

      expect(result.shouldClear).toBe(true);
      expect(result.reason).toBe('Session-based clearing'); // Should use session-based
    });
  });

  describe('getCartClearingStats', () => {
    it('should return correct stats when instructions exist', () => {
      const now = new Date().toISOString();
      
      // Set up some test instructions
      if (typeof globalThis !== 'undefined') {
        globalThis.__cartClearingInstructions = new Map();
        globalThis.__cartClearingInstructions.set('session1', {
          timestamp: now,
        });
        globalThis.__cartClearingInstructions.set('session2', {
          timestamp: now,
        });

        globalThis.__orderClearingInstructions = new Map();
        globalThis.__orderClearingInstructions.set('order1', {
          timestamp: now,
        });
      }

      const stats = getCartClearingStats();

      expect(stats.sessionInstructions).toBe(2);
      expect(stats.orderInstructions).toBe(1);
      expect(stats.oldestSessionInstruction).toBe(now);
      expect(stats.oldestOrderInstruction).toBe(now);
    });

    it('should return zero stats when no instructions exist', () => {
      const stats = getCartClearingStats();

      expect(stats.sessionInstructions).toBe(0);
      expect(stats.orderInstructions).toBe(0);
      expect(stats.oldestSessionInstruction).toBeUndefined();
      expect(stats.oldestOrderInstruction).toBeUndefined();
    });
  });

  describe('manualCartClearing', () => {
    it('should successfully perform manual cart clearing with session ID', async () => {
      const request = {
        orderId: 'order_manual',
        sessionId: 'session_manual',
        reason: 'Admin requested clearing',
        source: 'manual' as const,
      };

      const result = await manualCartClearing(request);

      expect(result.success).toBe(true);
      expect(result.method).toBe('session_based');
      expect(result.sessionId).toBe('session_manual');
      expect(result.orderId).toBe('order_manual');

      // Verify monitoring call
      expect(mockMonitoring.recordEvent).toHaveBeenCalledWith('manual_cart_clearing_attempted', {
        orderId: 'order_manual',
        sessionId: 'session_manual',
        reason: 'Admin requested clearing',
        source: 'manual',
      });
    });

    it('should fallback to order-based clearing when no session ID', async () => {
      const request = {
        orderId: 'order_manual',
        reason: 'Admin requested clearing',
        source: 'manual' as const,
      };

      const result = await manualCartClearing(request);

      expect(result.success).toBe(true);
      expect(result.method).toBe('order_context');
      expect(result.sessionId).toBeUndefined();
      expect(result.orderId).toBe('order_manual');
    });
  });

  describe('error handling', () => {
    it('should handle console.error gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // This should not throw even if console methods are mocked
      const result = checkCartClearingInstructions('test');
      
      expect(result.shouldClear).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle missing globalThis gracefully', () => {
      // Temporarily remove globalThis properties
      const originalCartInstructions = globalThis.__cartClearingInstructions;
      const originalOrderInstructions = globalThis.__orderClearingInstructions;
      
      delete (globalThis as any).__cartClearingInstructions;
      delete (globalThis as any).__orderClearingInstructions;

      const result = checkCartClearingInstructions('session_test');
      expect(result.shouldClear).toBe(false);

      const stats = getCartClearingStats();
      expect(stats.sessionInstructions).toBe(0);
      expect(stats.orderInstructions).toBe(0);

      // Restore original state
      globalThis.__cartClearingInstructions = originalCartInstructions;
      globalThis.__orderClearingInstructions = originalOrderInstructions;
    });
  });
});