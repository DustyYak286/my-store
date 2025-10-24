/**
 * Order Store Mock Factory
 * 
 * Creates fresh, isolated mock instances for each test.
 * Eliminates singleton state and cross-test pollution.
 */

import type { Order } from '@/types/order'
import type { CartItem } from '@/types/cart'

export interface OrderStoreInterface {
  createOrder(orderData: any): Order;
  getOrderById(orderId: string): Order | null;
  storeOrder(order: Order): void;
  updateStoredOrderPayment(orderId: string, paymentData: any, triggeredBy?: string): { success: boolean; order?: Order; error?: string };
  updateOrderStatus(orderId: string, status: string, paymentStatus?: string): boolean;
  getAllOrders(): Order[];
  deleteOrder(orderId: string): boolean;
  clearMockOrders(): void;
  getMockOrdersCount(): number;
}

export function createMockOrderStore(): OrderStoreInterface {
  // Fresh Map instance for each mock store
  const orders = new Map<string, Order>();
  
  const generateMockOrder = (orderData: any, overrides: Partial<Order> = {}): Order => ({
    id: 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 11),
    orderNumber: 'ORD-2025-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000).toString().padStart(3, '0'),
    status: 'pending',
    paymentIntentId: null,
    paymentStatus: 'pending',
    customerInfo: orderData.customerInfo,
    shippingAddress: orderData.shippingAddress,
    billingAddress: orderData.billingAddress || orderData.shippingAddress,
    items: orderData.items,
    currency: orderData.currency || 'ron',
    totalAmount: orderData.items.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      clientRequestId: orderData.clientRequestId,
      source: 'web_checkout'
    },
    ...overrides
  });

  return {
    createOrder: jest.fn((orderData: any): Order => {
      const order = generateMockOrder(orderData);
      orders.set(order.id, order);
      return order;
    }),

    getOrderById: jest.fn((orderId: string): Order | null => {
      return orders.get(orderId) || null;
    }),

    storeOrder: jest.fn((order: Order): void => {
      orders.set(order.id, order);
    }),

    updateStoredOrderPayment: jest.fn((
      orderId: string, 
      paymentData: any, 
      triggeredBy: string = 'system'
    ): { success: boolean; order?: Order; error?: string } => {
      const order = orders.get(orderId);
      if (!order) {
        return {
          success: false,
          error: `Order not found: ${orderId}`
        };
      }
      
      if (paymentData.paymentIntentId) {
        order.paymentIntentId = paymentData.paymentIntentId;
      }
      if (paymentData.paymentIntentStatus) {
        order.paymentStatus = paymentData.paymentIntentStatus;
      }
      order.updatedAt = new Date().toISOString();
      
      orders.set(orderId, order);
      return { success: true, order };
    }),

    updateOrderStatus: jest.fn((orderId: string, status: string, paymentStatus?: string): boolean => {
      const order = orders.get(orderId);
      if (!order) return false;
      
      order.status = status;
      if (paymentStatus) order.paymentStatus = paymentStatus;
      order.updatedAt = new Date().toISOString();
      
      orders.set(orderId, order);
      return true;
    }),

    getAllOrders: jest.fn((): Order[] => Array.from(orders.values())),

    deleteOrder: jest.fn((orderId: string): boolean => orders.delete(orderId)),

    clearMockOrders: jest.fn((): void => {
      orders.clear();
    }),

    getMockOrdersCount: jest.fn((): number => orders.size),
  };
}