/**
 * In-Memory Order Store
 * 
 * Temporary in-memory storage for orders during development.
 * In production, this should be replaced with a proper database.
 */

import { Order, OrderStatus, PaymentStatus, OrderStatusHistory } from '@/types/order';
import { updateOrderStatus, updateOrderPayment } from '@/lib/orderHelpers';
import { recordOrderStatusChange, recordPaymentStatusChange, recordOrderCreation } from '@/utils/auditTrail';

// In-memory order storage (replace with database in production)
const orders = new Map<string, Order>();

/**
 * Store a new order
 */
export const storeOrder = (order: Order): void => {
  orders.set(order.id, order);
  
  // Record order creation in audit trail
  recordOrderCreation(
    order.id,
    order.orderNumber,
    order.totals.total,
    order.currency,
    order.customerInfo?.email || 'unknown@test.com',
    'api',
    {
      itemCount: order.items.length,
      source: order.source || 'unknown',
      priority: order.priority || 'standard',
    }
  );
};

/**
 * Get an order by ID
 */
export const getOrderById = (orderId: string): Order | null => {
  return orders.get(orderId) || null;
};

/**
 * Get an order by order number
 */
export const getOrderByNumber = (orderNumber: string): Order | null => {
  for (const order of orders.values()) {
    if (order.orderNumber === orderNumber) {
      return order;
    }
  }
  return null;
};

/**
 * Update order status with validation and audit trail
 */
export const updateStoredOrderStatus = (
  orderId: string,
  newStatus: OrderStatus,
  reason?: string,
  triggeredBy: string = 'system',
  metadata?: Record<string, unknown>
): { success: boolean; order?: Order; error?: string } => {
  const order = getOrderById(orderId);
  if (!order) {
    return {
      success: false,
      error: `Order not found: ${orderId}`,
    };
  }

  const result = updateOrderStatus(order, {
    orderId,
    newStatus,
    reason,
    triggeredBy,
    metadata,
  });

  if (result.success && result.order) {
    // Record status change in audit trail
    recordOrderStatusChange(
      orderId,
      order.status,
      newStatus,
      triggeredBy,
      reason,
      metadata,
      triggeredBy === 'stripe_webhook' ? 'webhook' : 'system'
    );
    
    orders.set(orderId, result.order); // Update directly to avoid duplicate audit entries
  }

  return result;
};

/**
 * Update order payment information
 */
export const updateStoredOrderPayment = (
  orderId: string,
  paymentData: any,
  triggeredBy: string = 'system'
): { success: boolean; order?: Order; error?: string } => {
  const order = getOrderById(orderId);
  if (!order) {
    return {
      success: false,
      error: `Order not found: ${orderId}`,
    };
  }

  const result = updateOrderPayment(order, {
    orderId,
    paymentData,
    triggeredBy,
  });

  if (result.success && result.order) {
    // Record payment status change in audit trail if payment status changed
    if (order.paymentStatus !== result.order.paymentStatus) {
      recordPaymentStatusChange(
        orderId,
        order.paymentStatus,
        result.order.paymentStatus,
        paymentData.paymentIntentId || '',
        paymentData.amount || order.payment.amount,
        order.currency,
        triggeredBy,
        paymentData.failureReason || 'Payment status updated',
        paymentData.metadata,
        triggeredBy === 'stripe_webhook' ? 'webhook' : 'system'
      );
    }
    
    orders.set(orderId, result.order); // Update directly to avoid duplicate audit entries
  }

  return result;
};

/**
 * Get all orders (for testing/admin purposes)
 */
export const getAllOrders = (): Order[] => {
  return Array.from(orders.values());
};

/**
 * Get orders by status
 */
export const getOrdersByStatus = (status: OrderStatus): Order[] => {
  return Array.from(orders.values()).filter(order => order.status === status);
};

/**
 * Get orders by payment status
 */
export const getOrdersByPaymentStatus = (paymentStatus: PaymentStatus): Order[] => {
  return Array.from(orders.values()).filter(order => order.paymentStatus === paymentStatus);
};

/**
 * Clear all orders (for testing purposes)
 */
export const clearAllOrders = (): void => {
  orders.clear();
};

/**
 * Get order statistics
 */
export const getOrderStats = () => {
  const allOrders = getAllOrders();
  const stats = {
    total: allOrders.length,
    byStatus: {} as Record<OrderStatus, number>,
    byPaymentStatus: {} as Record<PaymentStatus, number>,
  };

  allOrders.forEach(order => {
    stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
    stats.byPaymentStatus[order.paymentStatus] = (stats.byPaymentStatus[order.paymentStatus] || 0) + 1;
  });

  return stats;
};

// Export for testing
export const _getOrdersMap = () => orders;