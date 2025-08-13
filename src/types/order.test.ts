/**
 * Tests for Order Types and Type Guards
 */

import {
  OrderStatus,
  PaymentStatus,
  OrderPriority,
  OrderSource,
  isTerminalStatus,
  isPaymentStatus,
  canCancelOrder,
  canRefundOrder,
  type Order,
} from './order';

describe('Order Enums', () => {
  describe('OrderStatus', () => {
    it('should have all required status values', () => {
      expect(OrderStatus.PENDING).toBe('pending');
      expect(OrderStatus.PROCESSING).toBe('processing');
      expect(OrderStatus.PAID).toBe('paid');
      expect(OrderStatus.FAILED).toBe('failed');
      expect(OrderStatus.CONFIRMED).toBe('confirmed');
      expect(OrderStatus.PREPARING).toBe('preparing');
      expect(OrderStatus.SHIPPED).toBe('shipped');
      expect(OrderStatus.DELIVERED).toBe('delivered');
      expect(OrderStatus.CANCELLED).toBe('cancelled');
      expect(OrderStatus.REFUNDED).toBe('refunded');
      expect(OrderStatus.RETURNED).toBe('returned');
    });
  });

  describe('PaymentStatus', () => {
    it('should have all required payment status values', () => {
      expect(PaymentStatus.PENDING).toBe('pending');
      expect(PaymentStatus.PROCESSING).toBe('processing');
      expect(PaymentStatus.REQUIRES_ACTION).toBe('requires_action');
      expect(PaymentStatus.SUCCEEDED).toBe('succeeded');
      expect(PaymentStatus.FAILED).toBe('failed');
      expect(PaymentStatus.CANCELLED).toBe('cancelled');
      expect(PaymentStatus.REFUNDED).toBe('refunded');
    });
  });

  describe('OrderPriority', () => {
    it('should have all priority levels', () => {
      expect(OrderPriority.LOW).toBe('low');
      expect(OrderPriority.NORMAL).toBe('normal');
      expect(OrderPriority.HIGH).toBe('high');
      expect(OrderPriority.URGENT).toBe('urgent');
    });
  });

  describe('OrderSource', () => {
    it('should have all source types', () => {
      expect(OrderSource.WEB).toBe('web');
      expect(OrderSource.MOBILE).toBe('mobile');
      expect(OrderSource.ADMIN).toBe('admin');
      expect(OrderSource.API).toBe('api');
    });
  });
});

describe('Type Guards', () => {
  describe('isTerminalStatus', () => {
    it('should return true for terminal statuses', () => {
      expect(isTerminalStatus(OrderStatus.DELIVERED)).toBe(true);
      expect(isTerminalStatus(OrderStatus.CANCELLED)).toBe(true);
      expect(isTerminalStatus(OrderStatus.REFUNDED)).toBe(true);
      expect(isTerminalStatus(OrderStatus.RETURNED)).toBe(true);
    });

    it('should return false for non-terminal statuses', () => {
      expect(isTerminalStatus(OrderStatus.PENDING)).toBe(false);
      expect(isTerminalStatus(OrderStatus.PROCESSING)).toBe(false);
      expect(isTerminalStatus(OrderStatus.PAID)).toBe(false);
      expect(isTerminalStatus(OrderStatus.CONFIRMED)).toBe(false);
      expect(isTerminalStatus(OrderStatus.PREPARING)).toBe(false);
      expect(isTerminalStatus(OrderStatus.SHIPPED)).toBe(false);
      expect(isTerminalStatus(OrderStatus.FAILED)).toBe(false);
    });
  });

  describe('isPaymentStatus', () => {
    it('should return true for payment-related statuses', () => {
      expect(isPaymentStatus(OrderStatus.PENDING)).toBe(true);
      expect(isPaymentStatus(OrderStatus.PROCESSING)).toBe(true);
      expect(isPaymentStatus(OrderStatus.PAID)).toBe(true);
      expect(isPaymentStatus(OrderStatus.FAILED)).toBe(true);
    });

    it('should return false for non-payment statuses', () => {
      expect(isPaymentStatus(OrderStatus.CONFIRMED)).toBe(false);
      expect(isPaymentStatus(OrderStatus.PREPARING)).toBe(false);
      expect(isPaymentStatus(OrderStatus.SHIPPED)).toBe(false);
      expect(isPaymentStatus(OrderStatus.DELIVERED)).toBe(false);
      expect(isPaymentStatus(OrderStatus.CANCELLED)).toBe(false);
      expect(isPaymentStatus(OrderStatus.REFUNDED)).toBe(false);
      expect(isPaymentStatus(OrderStatus.RETURNED)).toBe(false);
    });
  });

  describe('canCancelOrder', () => {
    const createMockOrder = (status: OrderStatus): Order => ({
      id: 'test-order',
      orderNumber: 'ORD-2024-001234',
      status,
      paymentStatus: PaymentStatus.PENDING,
      priority: OrderPriority.NORMAL,
      source: OrderSource.WEB,
      currency: 'ron',
      items: [],
      totals: {
        subtotal: 0,
        discount: 0,
        shipping: 0,
        tax: 0,
        total: 0,
        currency: 'ron',
      },
      customerInfo: {
        email: 'test@example.com',
        isGuest: true,
      },
      shippingAddress: {
        fullName: 'Test User',
        streetAddress: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'Romania',
      },
      billingAddress: {
        fullName: 'Test User',
        streetAddress: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'Romania',
      },
      payment: {
        method: { type: 'card' },
        amount: 0,
        currency: 'ron',
        metadata: {},
      },
      timestamps: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      metadata: {
        isTest: true,
      },
      statusHistory: [],
    });

    it('should allow cancellation for early-stage orders', () => {
      expect(canCancelOrder(createMockOrder(OrderStatus.PENDING))).toBe(true);
      expect(canCancelOrder(createMockOrder(OrderStatus.PROCESSING))).toBe(true);
      expect(canCancelOrder(createMockOrder(OrderStatus.PAID))).toBe(true);
      expect(canCancelOrder(createMockOrder(OrderStatus.CONFIRMED))).toBe(true);
      expect(canCancelOrder(createMockOrder(OrderStatus.PREPARING))).toBe(true);
      expect(canCancelOrder(createMockOrder(OrderStatus.FAILED))).toBe(true);
    });

    it('should not allow cancellation for shipped or terminal orders', () => {
      expect(canCancelOrder(createMockOrder(OrderStatus.SHIPPED))).toBe(false);
      expect(canCancelOrder(createMockOrder(OrderStatus.DELIVERED))).toBe(false);
      expect(canCancelOrder(createMockOrder(OrderStatus.CANCELLED))).toBe(false);
      expect(canCancelOrder(createMockOrder(OrderStatus.REFUNDED))).toBe(false);
      expect(canCancelOrder(createMockOrder(OrderStatus.RETURNED))).toBe(false);
    });
  });

  describe('canRefundOrder', () => {
    const createMockOrder = (status: OrderStatus): Order => ({
      id: 'test-order',
      orderNumber: 'ORD-2024-001234',
      status,
      paymentStatus: PaymentStatus.SUCCEEDED,
      priority: OrderPriority.NORMAL,
      source: OrderSource.WEB,
      currency: 'ron',
      items: [],
      totals: {
        subtotal: 0,
        discount: 0,
        shipping: 0,
        tax: 0,
        total: 0,
        currency: 'ron',
      },
      customerInfo: {
        email: 'test@example.com',
        isGuest: true,
      },
      shippingAddress: {
        fullName: 'Test User',
        streetAddress: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'Romania',
      },
      billingAddress: {
        fullName: 'Test User',
        streetAddress: '123 Test St',
        city: 'Test City',
        postalCode: '12345',
        country: 'Romania',
      },
      payment: {
        method: { type: 'card' },
        amount: 0,
        currency: 'ron',
        metadata: {},
      },
      timestamps: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      metadata: {
        isTest: true,
      },
      statusHistory: [],
    });

    it('should allow refunds for paid and fulfilled orders', () => {
      expect(canRefundOrder(createMockOrder(OrderStatus.PAID))).toBe(true);
      expect(canRefundOrder(createMockOrder(OrderStatus.CONFIRMED))).toBe(true);
      expect(canRefundOrder(createMockOrder(OrderStatus.PREPARING))).toBe(true);
      expect(canRefundOrder(createMockOrder(OrderStatus.SHIPPED))).toBe(true);
      expect(canRefundOrder(createMockOrder(OrderStatus.DELIVERED))).toBe(true);
    });

    it('should not allow refunds for unpaid or terminal orders', () => {
      expect(canRefundOrder(createMockOrder(OrderStatus.PENDING))).toBe(false);
      expect(canRefundOrder(createMockOrder(OrderStatus.PROCESSING))).toBe(false);
      expect(canRefundOrder(createMockOrder(OrderStatus.FAILED))).toBe(false);
      expect(canRefundOrder(createMockOrder(OrderStatus.CANCELLED))).toBe(false);
      expect(canRefundOrder(createMockOrder(OrderStatus.REFUNDED))).toBe(false);
      expect(canRefundOrder(createMockOrder(OrderStatus.RETURNED))).toBe(false);
    });
  });
});

describe('Order Interface Structure', () => {
  it('should have all required order properties defined', () => {
    // This test ensures the Order interface compiles correctly
    const mockOrder: Partial<Order> = {
      id: 'test-id',
      orderNumber: 'ORD-2024-001234',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      priority: OrderPriority.NORMAL,
      source: OrderSource.WEB,
      currency: 'ron',
    };

    expect(mockOrder.id).toBe('test-id');
    expect(mockOrder.orderNumber).toBe('ORD-2024-001234');
    expect(mockOrder.status).toBe(OrderStatus.PENDING);
    expect(mockOrder.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(mockOrder.priority).toBe(OrderPriority.NORMAL);
    expect(mockOrder.source).toBe(OrderSource.WEB);
    expect(mockOrder.currency).toBe('ron');
  });
});