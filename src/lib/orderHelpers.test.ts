/**
 * Tests for Order Helper Functions
 */

import {
  generateOrderNumber,
  generateOrderId,
  calculateOrderTotals,
  createOrder,
  validateCreateOrderRequest,
  isValidStatusTransition,
  getPossibleNextStatuses,
  updateOrderStatus,
  updateOrderPayment,
  addOrderNote,
  formatOrderTotal,
  getOrderSummary,
  isOrderEditable,
  isOrderFulfillable,
  getOrderAgeHours,
  getOrderProcessingTime,
  calculateOrderStatistics,
  ORDER_STATUS_TRANSITIONS,
} from './orderHelpers';

import {
  OrderStatus,
  PaymentStatus,
  OrderPriority,
  OrderSource,
  type CreateOrderRequest,
  type Order,
  type CartItem,
} from '@/types/order';

describe('Order ID and Number Generation', () => {
  describe('generateOrderNumber', () => {
    it('should generate unique order numbers', () => {
      const orderNumber1 = generateOrderNumber();
      // Add small delay to ensure different timestamp
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Small delay
      }
      const orderNumber2 = generateOrderNumber();
      
      expect(orderNumber1).not.toBe(orderNumber2);
      expect(orderNumber1).toMatch(/^ORD-\d{4}-\d+$/);
      expect(orderNumber2).toMatch(/^ORD-\d{4}-\d+$/);
    });

    it('should include current year', () => {
      const orderNumber = generateOrderNumber();
      const currentYear = new Date().getFullYear();
      
      expect(orderNumber).toContain(currentYear.toString());
    });

    it('should have consistent format', () => {
      const orderNumber = generateOrderNumber();
      
      expect(orderNumber).toMatch(/^ORD-\d{4}-\d{9}$/);
      expect(orderNumber.length).toBe(18); // ORD-YYYY-NNNNNNNNN = 18 chars
    });
  });

  describe('generateOrderId', () => {
    it('should generate unique order IDs', () => {
      const orderId1 = generateOrderId();
      const orderId2 = generateOrderId();
      
      expect(orderId1).not.toBe(orderId2);
      expect(orderId1).toMatch(/^order_\d+_[a-z0-9]+$/);
      expect(orderId2).toMatch(/^order_\d+_[a-z0-9]+$/);
    });

    it('should start with order_ prefix', () => {
      const orderId = generateOrderId();
      
      expect(orderId).toMatch(/^order_/);
    });
  });
});

describe('Order Totals Calculation', () => {
  const mockCartItems: CartItem[] = [
    {
      id: 1,
      name: 'Test Product 1',
      price: {
        original: 10.50,
        currency: 'ron',
      },
      quantity: 2,
      image: 'test1.jpg',
    },
    {
      id: 2,
      name: 'Test Product 2',
      price: {
        original: 25.00,
        currency: 'ron',
      },
      quantity: 1,
      image: 'test2.jpg',
    },
  ];

  describe('calculateOrderTotals', () => {
    it('should calculate subtotal correctly', () => {
      const totals = calculateOrderTotals(mockCartItems);
      
      // Expected: (10.50 * 2) + (25.00 * 1) = 46.00 RON = 4600 bani
      expect(totals.subtotal).toBe(4600);
      expect(totals.currency).toBe('ron');
    });

    it('should calculate tax correctly', () => {
      const totals = calculateOrderTotals(mockCartItems, {
        taxRate: 0.19, // 19% VAT
      });
      
      // Tax on 4600 bani = 874 bani (rounded)
      expect(totals.tax).toBe(874);
    });

    it('should include shipping costs', () => {
      const totals = calculateOrderTotals(mockCartItems, {
        shippingCost: 5.00, // 5.00 RON = 500 bani
      });
      
      expect(totals.shipping).toBe(500);
    });

    it('should apply discounts correctly', () => {
      const totals = calculateOrderTotals(mockCartItems, {
        discountAmount: 5.00, // 5.00 RON = 500 bani
      });
      
      expect(totals.discount).toBe(500);
      // Total should be reduced by discount
      expect(totals.total).toBeLessThan(totals.subtotal + totals.tax);
    });

    it('should calculate final total correctly', () => {
      const totals = calculateOrderTotals(mockCartItems, {
        shippingCost: 5.00,
        taxRate: 0.19,
        discountAmount: 2.00,
      });
      
      // Subtotal: 4600 bani
      // Shipping: 500 bani
      // Discount: 200 bani
      // Taxable: 4600 + 500 - 200 = 4900 bani
      // Tax: 4900 * 0.19 = 931 bani
      // Total: 4600 + 500 + 931 - 200 = 5831 bani
      expect(totals.total).toBe(5831);
    });

    it('should never return negative total', () => {
      const totals = calculateOrderTotals(mockCartItems, {
        discountAmount: 100.00, // Huge discount
      });
      
      expect(totals.total).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Order Creation', () => {
  const mockCreateOrderRequest: CreateOrderRequest = {
    customerInfo: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      isGuest: true,
    },
    shippingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Test Street',
      city: 'Bucharest',
      postalCode: '010101',
      country: 'Romania',
    },
    billingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Test Street',
      city: 'Bucharest',
      postalCode: '010101',
      country: 'Romania',
    },
    items: [
      {
        id: 1,
        name: 'Test Product',
        price: {
          original: 10.00,
          currency: 'ron',
        },
        quantity: 1,
        image: 'test.jpg',
      },
    ],
  };

  describe('createOrder', () => {
    it('should create order successfully with valid request', () => {
      const response = createOrder(mockCreateOrderRequest);
      
      expect(response.order).toBeDefined();
      expect(response.order.id).toBeDefined();
      expect(response.order.orderNumber).toBeDefined();
      expect(response.order.status).toBe(OrderStatus.PENDING);
      expect(response.order.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(response.order.customerInfo.email).toBe('test@example.com');
      expect(response.validationErrors).toBeUndefined();
    });

    it('should set default values correctly', () => {
      const response = createOrder(mockCreateOrderRequest);
      
      expect(response.order.currency).toBe('ron');
      expect(response.order.priority).toBe(OrderPriority.NORMAL);
      expect(response.order.source).toBe(OrderSource.WEB);
    });

    it('should create status history entry', () => {
      const response = createOrder(mockCreateOrderRequest);
      
      expect(response.order.statusHistory).toHaveLength(1);
      expect(response.order.statusHistory[0].toStatus).toBe(OrderStatus.PENDING);
      expect(response.order.statusHistory[0].fromStatus).toBeNull();
      expect(response.order.statusHistory[0].triggeredBy).toBe('system');
    });

    it('should convert cart items to order items', () => {
      const response = createOrder(mockCreateOrderRequest);
      
      expect(response.order.items).toHaveLength(1);
      expect(response.order.items[0].name).toBe('Test Product');
      expect(response.order.items[0].unitPrice).toBe(1000); // 10.00 RON in bani
      expect(response.order.items[0].quantity).toBe(1);
      expect(response.order.items[0].totalPrice).toBe(1000);
    });
  });

  describe('validateCreateOrderRequest', () => {
    it('should validate valid request', () => {
      const result = validateCreateOrderRequest(mockCreateOrderRequest);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require customer email', () => {
      const invalidRequest = {
        ...mockCreateOrderRequest,
        customerInfo: {
          ...mockCreateOrderRequest.customerInfo,
          email: '',
        },
      };
      
      const result = validateCreateOrderRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer email is required');
    });

    it('should validate email format', () => {
      const invalidRequest = {
        ...mockCreateOrderRequest,
        customerInfo: {
          ...mockCreateOrderRequest.customerInfo,
          email: 'invalid-email',
        },
      };
      
      const result = validateCreateOrderRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Customer email format is invalid');
    });

    it('should require valid shipping address', () => {
      const invalidRequest = {
        ...mockCreateOrderRequest,
        shippingAddress: {
          ...mockCreateOrderRequest.shippingAddress,
          streetAddress: '',
        },
      };
      
      const result = validateCreateOrderRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid shipping address is required');
    });

    it('should require at least one item', () => {
      const invalidRequest = {
        ...mockCreateOrderRequest,
        items: [],
      };
      
      const result = validateCreateOrderRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Order must contain at least one item');
    });

    it('should validate item prices', () => {
      const invalidRequest = {
        ...mockCreateOrderRequest,
        items: [{
          id: 1,
          name: 'Test Product',
          price: {
            original: 0,
            currency: 'ron',
          },
          quantity: 1,
          image: 'test.jpg',
        }],
      };
      
      const result = validateCreateOrderRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Price must be greater than 0'))).toBe(true);
    });

    it('should warn about non-RON currency', () => {
      const requestWithUSD = {
        ...mockCreateOrderRequest,
        currency: 'usd',
      };
      
      const result = validateCreateOrderRequest(requestWithUSD);
      
      expect(result.warnings).toContain('Only RON currency is currently supported');
    });
  });
});

describe('Order Status Management', () => {
  describe('Status Transitions', () => {
    it('should define all required transitions', () => {
      expect(ORDER_STATUS_TRANSITIONS).toBeDefined();
      expect(ORDER_STATUS_TRANSITIONS.length).toBeGreaterThan(0);
      
      // Check that all statuses have transitions defined
      const definedStatuses = ORDER_STATUS_TRANSITIONS.map(t => t.from);
      expect(definedStatuses).toContain(OrderStatus.PENDING);
      expect(definedStatuses).toContain(OrderStatus.PROCESSING);
      expect(definedStatuses).toContain(OrderStatus.PAID);
    });

    it('should allow valid transitions', () => {
      expect(isValidStatusTransition(OrderStatus.PENDING, OrderStatus.PROCESSING)).toBe(true);
      expect(isValidStatusTransition(OrderStatus.PROCESSING, OrderStatus.PAID)).toBe(true);
      expect(isValidStatusTransition(OrderStatus.PAID, OrderStatus.CONFIRMED)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(isValidStatusTransition(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);
      expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
      expect(isValidStatusTransition(OrderStatus.DELIVERED, OrderStatus.PENDING)).toBe(false);
    });

    it('should reject same status transitions', () => {
      expect(isValidStatusTransition(OrderStatus.PENDING, OrderStatus.PENDING)).toBe(false);
      expect(isValidStatusTransition(OrderStatus.PAID, OrderStatus.PAID)).toBe(false);
    });

    it('should return possible next statuses', () => {
      const pendingNext = getPossibleNextStatuses(OrderStatus.PENDING);
      expect(pendingNext).toContain(OrderStatus.PROCESSING);
      expect(pendingNext).toContain(OrderStatus.FAILED);
      expect(pendingNext).toContain(OrderStatus.CANCELLED);
      
      const terminalNext = getPossibleNextStatuses(OrderStatus.CANCELLED);
      expect(terminalNext).toHaveLength(0);
    });
  });

  describe('updateOrderStatus', () => {
    const mockOrder: Order = {
      id: 'test-order',
      orderNumber: 'ORD-2024-001234',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      priority: OrderPriority.NORMAL,
      source: OrderSource.WEB,
      currency: 'ron',
      items: [],
      totals: {
        subtotal: 1000,
        discount: 0,
        shipping: 0,
        tax: 190,
        total: 1190,
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
        amount: 1190,
        currency: 'ron',
        metadata: {},
      },
      timestamps: {
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      metadata: {
        isTest: true,
      },
      statusHistory: [{
        id: 'status_1',
        fromStatus: null,
        toStatus: OrderStatus.PENDING,
        reason: 'Order created',
        triggeredBy: 'system',
        timestamp: '2024-01-01T00:00:00.000Z',
      }],
    };

    it('should update status successfully for valid transitions', () => {
      const result = updateOrderStatus(mockOrder, {
        orderId: 'test-order',
        newStatus: OrderStatus.PROCESSING,
        reason: 'Payment initiated',
        triggeredBy: 'user',
      });
      
      expect(result.success).toBe(true);
      expect(result.order?.status).toBe(OrderStatus.PROCESSING);
      expect(result.order?.statusHistory).toHaveLength(2);
      expect(result.order?.statusHistory[1].fromStatus).toBe(OrderStatus.PENDING);
      expect(result.order?.statusHistory[1].toStatus).toBe(OrderStatus.PROCESSING);
    });

    it('should reject invalid status transitions', () => {
      const result = updateOrderStatus(mockOrder, {
        orderId: 'test-order',
        newStatus: OrderStatus.DELIVERED,
        reason: 'Invalid jump',
        triggeredBy: 'user',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });

    it('should update relevant timestamps', () => {
      // First move to PAID status (which is required before CONFIRMED)
      const paidOrder = {
        ...mockOrder,
        status: OrderStatus.PAID,
      };
      
      const result = updateOrderStatus(paidOrder, {
        orderId: 'test-order',
        newStatus: OrderStatus.CONFIRMED,
        triggeredBy: 'system',
      });
      
      expect(result.success).toBe(true);
      expect(result.order?.timestamps.confirmedAt).toBeDefined();
      expect(result.order?.timestamps.updatedAt).not.toBe(mockOrder.timestamps.updatedAt);
    });
  });
});

describe('Order Utilities', () => {
  const mockOrder: Order = {
    id: 'test-order',
    orderNumber: 'ORD-2024-001234',
    status: OrderStatus.PAID,
    paymentStatus: PaymentStatus.SUCCEEDED,
    priority: OrderPriority.NORMAL,
    source: OrderSource.WEB,
    currency: 'ron',
    items: [
      {
        id: 'item_1',
        productId: '1',
        name: 'Test Product',
        unitPrice: 1000,
        quantity: 2,
        totalPrice: 2000,
      },
    ],
    totals: {
      subtotal: 2000,
      discount: 0,
      shipping: 500,
      tax: 475,
      total: 2975,
      currency: 'ron',
    },
    customerInfo: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      isGuest: true,
    },
    shippingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Test St',
      city: 'Test City',
      postalCode: '12345',
      country: 'Romania',
    },
    billingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Test St',
      city: 'Test City',
      postalCode: '12345',
      country: 'Romania',
    },
    payment: {
      method: { type: 'card' },
      amount: 2975,
      currency: 'ron',
      capturedAt: '2024-01-01T00:30:00.000Z',
      metadata: {},
    },
    timestamps: {
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:30:00.000Z',
      paymentConfirmedAt: '2024-01-01T00:30:00.000Z',
    },
    metadata: {
      isTest: true,
    },
    statusHistory: [],
  };

  describe('addOrderNote', () => {
    it('should add note to order', () => {
      const updatedOrder = addOrderNote(mockOrder, 'Test note', 'internal', 'user_123');
      
      expect(updatedOrder.notes).toHaveLength(1);
      expect(updatedOrder.notes![0].content).toBe('Test note');
      expect(updatedOrder.notes![0].type).toBe('internal');
      expect(updatedOrder.notes![0].author).toBe('user_123');
      expect(updatedOrder.notes![0].isVisible).toBe(false);
    });

    it('should update timestamps when adding note', () => {
      const updatedOrder = addOrderNote(mockOrder, 'Test note');
      
      expect(updatedOrder.timestamps.updatedAt).not.toBe(mockOrder.timestamps.updatedAt);
    });
  });

  describe('formatOrderTotal', () => {
    it('should format total as currency', () => {
      const formatted = formatOrderTotal(mockOrder);
      
      expect(formatted).toContain('29,75'); // 2975 bani = 29.75 RON
      expect(formatted).toContain('RON');
    });
  });

  describe('getOrderSummary', () => {
    it('should return order summary', () => {
      const summary = getOrderSummary(mockOrder);
      
      expect(summary.orderNumber).toBe('ORD-2024-001234');
      expect(summary.status).toBe(OrderStatus.PAID);
      expect(summary.paymentStatus).toBe(PaymentStatus.SUCCEEDED);
      expect(summary.itemCount).toBe(2); // quantity from items
      expect(summary.customerEmail).toBe('test@example.com');
      expect(summary.total).toContain('29,75');
    });
  });

  describe('Order State Checks', () => {
    it('should check if order is editable', () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      const shippedOrder = { ...mockOrder, status: OrderStatus.SHIPPED };
      
      expect(isOrderEditable(pendingOrder)).toBe(true);
      expect(isOrderEditable(shippedOrder)).toBe(false);
    });

    it('should check if order is fulfillable', () => {
      const paidOrder = { ...mockOrder, status: OrderStatus.PAID };
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      
      expect(isOrderFulfillable(paidOrder)).toBe(true);
      expect(isOrderFulfillable(pendingOrder)).toBe(false);
    });
  });

  describe('Order Timing', () => {
    it('should calculate order age in hours', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const orderWithAge = {
        ...mockOrder,
        timestamps: {
          ...mockOrder.timestamps,
          createdAt: twoHoursAgo.toISOString(),
        },
      };
      
      const ageHours = getOrderAgeHours(orderWithAge);
      expect(ageHours).toBeGreaterThanOrEqual(2);
      expect(ageHours).toBeLessThan(3);
    });

    it('should calculate processing time', () => {
      const processingTime = getOrderProcessingTime(mockOrder);
      
      expect(processingTime).toBe(30); // 30 minutes between creation and payment confirmation
    });

    it('should return null for processing time if payment not confirmed', () => {
      const pendingOrder = {
        ...mockOrder,
        timestamps: {
          ...mockOrder.timestamps,
          paymentConfirmedAt: undefined,
        },
      };
      
      const processingTime = getOrderProcessingTime(pendingOrder);
      expect(processingTime).toBeNull();
    });
  });
});

describe('Order Statistics', () => {
  const mockOrders: Order[] = [
    {
      id: 'order_1',
      orderNumber: 'ORD-2024-001',
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCEEDED,
      priority: OrderPriority.NORMAL,
      source: OrderSource.WEB,
      currency: 'ron',
      items: [],
      totals: { subtotal: 1000, discount: 0, shipping: 0, tax: 190, total: 1190, currency: 'ron' },
      customerInfo: { email: 'test1@example.com', isGuest: true },
      shippingAddress: { fullName: 'User 1', streetAddress: '123 St', city: 'City', postalCode: '12345', country: 'Romania' },
      billingAddress: { fullName: 'User 1', streetAddress: '123 St', city: 'City', postalCode: '12345', country: 'Romania' },
      payment: { method: { type: 'card' }, amount: 1190, currency: 'ron', metadata: {} },
      timestamps: { createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
      metadata: { isTest: true },
      statusHistory: [],
    },
    {
      id: 'order_2',
      orderNumber: 'ORD-2024-002',
      status: OrderStatus.FAILED,
      paymentStatus: PaymentStatus.FAILED,
      priority: OrderPriority.NORMAL,
      source: OrderSource.WEB,
      currency: 'ron',
      items: [],
      totals: { subtotal: 2000, discount: 0, shipping: 0, tax: 380, total: 2380, currency: 'ron' },
      customerInfo: { email: 'test2@example.com', isGuest: true },
      shippingAddress: { fullName: 'User 2', streetAddress: '456 St', city: 'City', postalCode: '12345', country: 'Romania' },
      billingAddress: { fullName: 'User 2', streetAddress: '456 St', city: 'City', postalCode: '12345', country: 'Romania' },
      payment: { method: { type: 'card' }, amount: 2380, currency: 'ron', metadata: {} },
      timestamps: { createdAt: '2024-01-01T01:00:00.000Z', updatedAt: '2024-01-01T01:00:00.000Z' },
      metadata: { isTest: true },
      statusHistory: [],
    },
  ];

  describe('calculateOrderStatistics', () => {
    it('should calculate basic statistics correctly', () => {
      const stats = calculateOrderStatistics(mockOrders);
      
      expect(stats.totalOrders).toBe(2);
      expect(stats.totalRevenue).toBe(1190); // Only from paid order
      expect(stats.averageOrderValue).toBe(1190); // 1190 / 1 paid order
      expect(stats.currency).toBe('ron');
    });

    it('should calculate payment success rate', () => {
      const stats = calculateOrderStatistics(mockOrders);
      
      expect(stats.paymentSuccessRate).toBe(50); // 1 success out of 2 attempts
    });

    it('should handle empty order list', () => {
      const stats = calculateOrderStatistics([]);
      
      expect(stats.totalOrders).toBe(0);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.averageOrderValue).toBe(0);
      expect(stats.paymentSuccessRate).toBe(0);
    });

    it('should count orders by status', () => {
      const stats = calculateOrderStatistics(mockOrders);
      
      expect(stats.ordersByStatus).toEqual({
        [OrderStatus.PAID]: 1,
        [OrderStatus.FAILED]: 1,
      });
    });

    it('should count orders by payment status', () => {
      const stats = calculateOrderStatistics(mockOrders);
      
      expect(stats.ordersByPaymentStatus).toEqual({
        [PaymentStatus.SUCCEEDED]: 1,
        [PaymentStatus.FAILED]: 1,
      });
    });
  });
});