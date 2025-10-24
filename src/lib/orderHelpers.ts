/**
 * Order Management Utilities
 * 
 * Comprehensive utilities for order creation, status management,
 * validation, and business logic operations.
 */

import { 
  Order, 
  OrderStatus, 
  PaymentStatus,
  OrderPriority,
  OrderSource,
  CreateOrderRequest,
  CreateOrderResponse,
  UpdateOrderStatusRequest,
  UpdateOrderPaymentRequest,
  OrderValidationResult,
  OrderStatusHistory,
  OrderNote,
  OrderStatistics,
  OrderStatusTransition,
  isTerminalStatus,
  isPaymentStatus,
  canCancelOrder,
  canRefundOrder,
} from '@/types/order';
import type { CartItem } from '@/types/cart';
import type { Address } from '@/types/checkout';
import { formatCurrency, fromStripeAmount, toStripeAmount } from '@/constants/payments';

// ====== ORDER CREATION UTILITIES ======

/**
 * Generate a unique order number
 * Format: ORD-YYYY-NNNNNNNNN (e.g., ORD-2024-001234567)
 */
export const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const sequence = (timestamp % 1000000).toString().padStart(6, '0');
  const randomPart = random.toString().padStart(3, '0');
  const orderNumber = `ORD-${year}-${sequence}${randomPart}`;
  
  return orderNumber;
};

/**
 * Generate a unique order ID
 */
export const generateOrderId = (): string => {
  return `order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Calculate order totals from cart items
 */
export const calculateOrderTotals = (
  items: CartItem[],
  options: {
    shippingCost?: number;
    taxRate?: number;
    discountAmount?: number;
    currency?: string;
  } = {}
): {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
} => {
  const {
    shippingCost = 0,
    taxRate = 0.19, // 19% VAT for Romania
    discountAmount = 0,
    currency = 'ron',
  } = options;

  // Calculate subtotal from cart items
  const subtotal = items.reduce((sum, item) => {
    // Handle both number and Price object types
    const itemPrice = typeof item.price === 'number' ? item.price : 
                     (item.price.discount !== undefined ? item.price.original - item.price.discount : item.price.original);
    return sum + (itemPrice * item.quantity);
  }, 0);

  // Convert to smallest currency unit (bani)
  const subtotalBani = toStripeAmount(subtotal);
  const shippingBani = toStripeAmount(shippingCost);
  const discountBani = toStripeAmount(discountAmount);

  // Calculate tax on (subtotal + shipping - discount)
  const taxableAmount = subtotalBani + shippingBani - discountBani;
  const taxBani = Math.round(taxableAmount * taxRate);

  // Calculate final total
  const totalBani = subtotalBani + shippingBani + taxBani - discountBani;

  return {
    subtotal: subtotalBani,
    shipping: shippingBani,
    tax: taxBani,
    discount: discountBani,
    total: Math.max(0, totalBani), // Ensure total is never negative
    currency: currency.toLowerCase(),
  };
};

/**
 * Create a new order from cart and customer information
 */
export const createOrder = (request: CreateOrderRequest): CreateOrderResponse => {
  const orderId = generateOrderId();
  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();

  // Validate request
  const validation = validateCreateOrderRequest(request);
  if (!validation.isValid) {
    return {
      order: {} as Order, // This will be handled by the validation errors
      validationErrors: validation.errors.reduce((acc, error) => {
        acc[error] = error;
        return acc;
      }, {} as Record<string, string>),
    };
  }

  // Calculate totals
  const totals = calculateOrderTotals(request.items);

  // Convert cart items to order items
  const orderItems = request.items.map((cartItem, index) => {
    const itemPrice = typeof cartItem.price === 'number' ? cartItem.price : 
                     (cartItem.price.discount !== undefined ? cartItem.price.original - cartItem.price.discount : cartItem.price.original);
    
    return {
      id: `item_${orderId}_${index}`,
      productId: cartItem.id.toString(),
      name: cartItem.name,
      image: cartItem.image,
      unitPrice: toStripeAmount(itemPrice),
      quantity: cartItem.quantity,
      totalPrice: toStripeAmount(itemPrice * cartItem.quantity),
      metadata: {
        cartItemId: cartItem.id,
      },
    };
  });

  // Create initial status history entry
  const initialStatusHistory: OrderStatusHistory = {
    id: `status_${orderId}_0`,
    fromStatus: null,
    toStatus: OrderStatus.PENDING,
    reason: 'Order created',
    triggeredBy: 'system',
    timestamp: now,
    metadata: {
      source: request.source || OrderSource.WEB,
    },
  };

  // Create the order
  const order: Order = {
    id: orderId,
    orderNumber,
    
    // Status
    status: OrderStatus.PENDING,
    paymentStatus: PaymentStatus.PENDING,
    priority: request.priority || OrderPriority.NORMAL,
    source: request.source || OrderSource.WEB,
    currency: request.currency || 'ron',
    
    // Items and totals
    items: orderItems,
    totals: {
      subtotal: totals.subtotal,
      discount: totals.discount,
      shipping: totals.shipping,
      tax: totals.tax,
      total: totals.total,
      currency: totals.currency,
    },
    
    // Customer information
    customerInfo: request.customerInfo,
    shippingAddress: request.shippingAddress,
    billingAddress: request.billingAddress,
    
    // Payment (initial state)
    payment: {
      method: { type: 'card' }, // Default to card, will be updated
      amount: totals.total,
      currency: totals.currency,
      metadata: {},
    },
    
    // Timestamps
    timestamps: {
      createdAt: now,
      updatedAt: now,
    },
    
    // Metadata
    metadata: {
      isTest: process.env.NODE_ENV === 'development',
      ...(request.giftMessage && { giftMessage: request.giftMessage }),
      ...(request.specialInstructions && { specialInstructions: request.specialInstructions }),
      ...(request.marketingData?.source && { source: request.marketingData.source }),
      ...(request.marketingData?.campaign && { campaign: request.marketingData.campaign }),
      ...(request.marketingData?.referrer && { referrer: request.marketingData.referrer }),
      ...(request.sessionData?.sessionId && { sessionId: request.sessionData.sessionId }),
      ...(request.sessionData?.userAgent && { userAgent: request.sessionData.userAgent }),
      ...(request.sessionData?.ipAddress && { ipAddress: request.sessionData.ipAddress }),
      ...(request.metadata && { custom: request.metadata }),
    },
    
    // Status history
    statusHistory: [initialStatusHistory],
  };

  return {
    order,
    warnings: validation.warnings,
  };
};

// ====== ORDER VALIDATION ======

/**
 * Validate order creation request
 */
export const validateCreateOrderRequest = (request: CreateOrderRequest): OrderValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate customer info
  if (!request.customerInfo.email) {
    errors.push('Customer email is required');
  } else if (!isValidEmail(request.customerInfo.email)) {
    errors.push('Customer email format is invalid');
  }

  // Validate addresses
  if (!validateAddress(request.shippingAddress)) {
    errors.push('Valid shipping address is required');
  }

  if (!validateAddress(request.billingAddress)) {
    errors.push('Valid billing address is required');
  }

  // Validate items
  if (!request.items || request.items.length === 0) {
    errors.push('Order must contain at least one item');
  } else {
    request.items.forEach((item, index) => {
      if (!item.id) {
        errors.push(`Item ${index + 1}: Product ID is required`);
      }
      if (!item.name) {
        errors.push(`Item ${index + 1}: Product name is required`);
      }
      const itemPrice = typeof item.price === 'number' ? item.price : 
                       (item.price.discount !== undefined ? item.price.original - item.price.discount : item.price.original);
      if (itemPrice <= 0) {
        errors.push(`Item ${index + 1}: Price must be greater than 0`);
      }
      if (item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      }
    });
  }

  // Validate currency
  if (request.currency && request.currency.toLowerCase() !== 'ron') {
    warnings.push('Only RON currency is currently supported');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate an address
 */
const validateAddress = (address: Address): boolean => {
  return !!(
    address.fullName &&
    address.streetAddress &&
    address.city &&
    address.postalCode &&
    address.country
  );
};

/**
 * Validate email format
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ====== ORDER STATUS MANAGEMENT ======

/**
 * Define valid status transitions
 */
export const ORDER_STATUS_TRANSITIONS: OrderStatusTransition[] = [
  // From PENDING
  { from: OrderStatus.PENDING, to: [OrderStatus.PROCESSING, OrderStatus.FAILED, OrderStatus.CANCELLED] },
  
  // From PROCESSING
  { from: OrderStatus.PROCESSING, to: [OrderStatus.PAID, OrderStatus.FAILED, OrderStatus.CANCELLED] },
  
  // From PAID
  { from: OrderStatus.PAID, to: [OrderStatus.CONFIRMED, OrderStatus.REFUNDED, OrderStatus.CANCELLED] },
  
  // From FAILED
  { from: OrderStatus.FAILED, to: [OrderStatus.PENDING, OrderStatus.CANCELLED] },
  
  // From CONFIRMED
  { from: OrderStatus.CONFIRMED, to: [OrderStatus.PREPARING, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
  
  // From PREPARING
  { from: OrderStatus.PREPARING, to: [OrderStatus.SHIPPED, OrderStatus.CANCELLED, OrderStatus.REFUNDED] },
  
  // From SHIPPED
  { from: OrderStatus.SHIPPED, to: [OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.REFUNDED] },
  
  // From DELIVERED (terminal states only)
  { from: OrderStatus.DELIVERED, to: [OrderStatus.RETURNED, OrderStatus.REFUNDED] },
  
  // Terminal states (no further transitions)
  { from: OrderStatus.CANCELLED, to: [] },
  { from: OrderStatus.REFUNDED, to: [] },
  { from: OrderStatus.RETURNED, to: [] },
];

/**
 * Check if a status transition is valid
 */
export const isValidStatusTransition = (
  currentStatus: OrderStatus, 
  newStatus: OrderStatus
): boolean => {
  if (currentStatus === newStatus) {
    return false; // No change
  }

  const transition = ORDER_STATUS_TRANSITIONS.find(t => t.from === currentStatus);
  return transition ? transition.to.includes(newStatus) : false;
};

/**
 * Get possible next statuses for an order
 */
export const getPossibleNextStatuses = (currentStatus: OrderStatus): OrderStatus[] => {
  const transition = ORDER_STATUS_TRANSITIONS.find(t => t.from === currentStatus);
  return transition ? transition.to : [];
};

/**
 * Update order status with validation and history tracking
 */
export const updateOrderStatus = (
  order: Order,
  request: UpdateOrderStatusRequest
): { success: boolean; order?: Order; error?: string } => {
  // Validate transition
  if (!isValidStatusTransition(order.status, request.newStatus)) {
    return {
      success: false,
      error: `Invalid status transition from ${order.status} to ${request.newStatus}`,
    };
  }

  const now = new Date().toISOString();

  // Create status history entry
  const statusHistoryEntry: OrderStatusHistory = {
    id: `status_${order.id}_${order.statusHistory.length}`,
    fromStatus: order.status,
    toStatus: request.newStatus,
    reason: request.reason || `Status changed to ${request.newStatus}`,
    triggeredBy: request.triggeredBy,
    timestamp: now,
    ...(request.metadata && { metadata: request.metadata }),
  };

  // Update order
  const updatedOrder: Order = {
    ...order,
    status: request.newStatus,
    timestamps: {
      ...order.timestamps,
      updatedAt: now,
      // Update specific timestamp based on status
      ...(request.newStatus === OrderStatus.CONFIRMED && { confirmedAt: now }),
      ...(request.newStatus === OrderStatus.PREPARING && { preparingAt: now }),
      ...(request.newStatus === OrderStatus.SHIPPED && { shippedAt: now }),
      ...(request.newStatus === OrderStatus.DELIVERED && { deliveredAt: now }),
      ...(request.newStatus === OrderStatus.CANCELLED && { cancelledAt: now }),
      ...(request.newStatus === OrderStatus.REFUNDED && { refundedAt: now }),
      ...(request.newStatus === OrderStatus.RETURNED && { returnedAt: now }),
    },
    statusHistory: [...order.statusHistory, statusHistoryEntry],
  };

  return {
    success: true,
    order: updatedOrder,
  };
};

/**
 * Update order payment information
 */
export const updateOrderPayment = (
  order: Order,
  request: UpdateOrderPaymentRequest
): { success: boolean; order?: Order; error?: string } => {
  const now = new Date().toISOString();

  const updatedOrder: Order = {
    ...order,
    payment: {
      ...order.payment,
      ...request.paymentData,
    },
    timestamps: {
      ...order.timestamps,
      updatedAt: now,
      // Update payment-specific timestamps
      ...(request.paymentData.authorizedAt && { paymentCreatedAt: request.paymentData.authorizedAt }),
      ...(request.paymentData.capturedAt && { paymentConfirmedAt: request.paymentData.capturedAt }),
    },
  };

  // Update payment status if provided
  if (request.paymentData.capturedAt) {
    updatedOrder.paymentStatus = PaymentStatus.SUCCEEDED;
  } else if (request.paymentData.failedAt) {
    updatedOrder.paymentStatus = PaymentStatus.FAILED;
  }

  return {
    success: true,
    order: updatedOrder,
  };
};

// ====== ORDER UTILITIES ======

/**
 * Add a note to an order
 */
export const addOrderNote = (
  order: Order,
  content: string,
  type: 'customer' | 'internal' | 'system' = 'internal',
  author: string = 'system',
  isVisible: boolean = false
): Order => {
  const note: OrderNote = {
    id: `note_${order.id}_${Date.now()}`,
    content,
    type,
    author,
    createdAt: new Date().toISOString(),
    isVisible,
  };

  return {
    ...order,
    notes: [...(order.notes || []), note],
    timestamps: {
      ...order.timestamps,
      updatedAt: new Date().toISOString(),
    },
  };
};

/**
 * Format order total for display
 */
export const formatOrderTotal = (order: Order): string => {
  const amount = fromStripeAmount(order.totals.total);
  return formatCurrency(amount);
};

/**
 * Get order summary for display
 */
export const getOrderSummary = (order: Order) => ({
  orderNumber: order.orderNumber,
  status: order.status,
  paymentStatus: order.paymentStatus,
  total: formatOrderTotal(order),
  itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  customerEmail: order.customerInfo.email,
  createdAt: order.timestamps.createdAt,
  estimatedDelivery: order.shipping?.estimatedDelivery,
});

/**
 * Check if order is editable
 */
export const isOrderEditable = (order: Order): boolean => {
  return [
    OrderStatus.PENDING,
    OrderStatus.PROCESSING,
  ].includes(order.status);
};

/**
 * Check if order is fulfillable
 */
export const isOrderFulfillable = (order: Order): boolean => {
  return [
    OrderStatus.PAID,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
  ].includes(order.status);
};

/**
 * Get order age in hours
 */
export const getOrderAgeHours = (order: Order): number => {
  const created = new Date(order.timestamps.createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
};

/**
 * Get order processing time in minutes
 */
export const getOrderProcessingTime = (order: Order): number | null => {
  if (!order.timestamps.paymentConfirmedAt) {
    return null;
  }

  const created = new Date(order.timestamps.createdAt);
  const confirmed = new Date(order.timestamps.paymentConfirmedAt);
  return Math.floor((confirmed.getTime() - created.getTime()) / (1000 * 60));
};

// ====== ORDER SEARCH AND FILTERING ======

/**
 * Generate order search query for database
 */
export const buildOrderSearchQuery = (criteria: any) => {
  const query: any = {};

  // Status filters
  if (criteria.status && criteria.status.length > 0) {
    query.status = { $in: criteria.status };
  }

  if (criteria.paymentStatus && criteria.paymentStatus.length > 0) {
    query.paymentStatus = { $in: criteria.paymentStatus };
  }

  // Date filters
  if (criteria.createdAfter || criteria.createdBefore) {
    query['timestamps.createdAt'] = {};
    if (criteria.createdAfter) {
      query['timestamps.createdAt'].$gte = criteria.createdAfter;
    }
    if (criteria.createdBefore) {
      query['timestamps.createdAt'].$lte = criteria.createdBefore;
    }
  }

  // Customer filters
  if (criteria.customerId) {
    query.customerId = criteria.customerId;
  }

  if (criteria.customerEmail) {
    query['customerInfo.email'] = { $regex: criteria.customerEmail, $options: 'i' };
  }

  // Amount filters
  if (criteria.minAmount || criteria.maxAmount) {
    query['totals.total'] = {};
    if (criteria.minAmount) {
      query['totals.total'].$gte = toStripeAmount(criteria.minAmount);
    }
    if (criteria.maxAmount) {
      query['totals.total'].$lte = toStripeAmount(criteria.maxAmount);
    }
  }

  // Text search
  if (criteria.searchTerm) {
    query.$or = [
      { orderNumber: { $regex: criteria.searchTerm, $options: 'i' } },
      { 'customerInfo.email': { $regex: criteria.searchTerm, $options: 'i' } },
      { 'customerInfo.firstName': { $regex: criteria.searchTerm, $options: 'i' } },
      { 'customerInfo.lastName': { $regex: criteria.searchTerm, $options: 'i' } },
    ];
  }

  return query;
};

// ====== ORDER STATISTICS ======

/**
 * Calculate basic order statistics
 */
export const calculateOrderStatistics = (orders: Order[]): Partial<OrderStatistics> => {
  if (orders.length === 0) {
    return {
      totalOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      paymentSuccessRate: 0,
    };
  }

  // Count by status
  const ordersByStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<OrderStatus, number>);

  // Count by payment status
  const ordersByPaymentStatus = orders.reduce((acc, order) => {
    acc[order.paymentStatus] = (acc[order.paymentStatus] || 0) + 1;
    return acc;
  }, {} as Record<PaymentStatus, number>);

  // Calculate revenue (only from paid orders)
  const paidOrders = orders.filter(order => 
    order.status === OrderStatus.PAID || 
    order.status === OrderStatus.CONFIRMED ||
    order.status === OrderStatus.PREPARING ||
    order.status === OrderStatus.SHIPPED ||
    order.status === OrderStatus.DELIVERED
  );

  const totalRevenue = paidOrders.reduce((sum, order) => sum + order.totals.total, 0);
  const averageOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  // Calculate payment success rate
  const totalPaymentAttempts = orders.filter(order => 
    order.paymentStatus !== PaymentStatus.PENDING
  ).length;
  const successfulPayments = orders.filter(order => 
    order.paymentStatus === PaymentStatus.SUCCEEDED
  ).length;
  const paymentSuccessRate = totalPaymentAttempts > 0 ? 
    (successfulPayments / totalPaymentAttempts) * 100 : 0;

  return {
    totalOrders: orders.length,
    ordersByStatus,
    ordersByPaymentStatus,
    totalRevenue,
    averageOrderValue,
    paymentSuccessRate,
    currency: 'ron',
  };
};

// Export utility functions
export {
  isTerminalStatus,
  isPaymentStatus,
  canCancelOrder,
  canRefundOrder,
};