/**
 * Mock Order Store for Tests
 * 
 * Provides predictable order storage behavior for unit and integration tests.
 */

import type { Order, CreateOrderRequest } from '@/types/order'

// In-memory storage for tests
const mockOrders = new Map<string, Order>()

export const createOrder = jest.fn((orderData: CreateOrderRequest): Order => {
  const order: Order = {
    id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 11)}`,
    orderNumber: `ORD-2025-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    status: 'pending',
    paymentIntentId: null,
    paymentStatus: 'pending',
    customerInfo: orderData.customerInfo,
    shippingAddress: orderData.shippingAddress,
    billingAddress: orderData.billingAddress || orderData.shippingAddress,
    items: orderData.items,
    currency: orderData.currency || 'ron',
    totalAmount: orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      clientRequestId: orderData.clientRequestId,
      source: 'web_checkout'
    }
  }

  mockOrders.set(order.id, order)
  return order
})

export const getOrderById = jest.fn((orderId: string): Order | null => {
  return mockOrders.get(orderId) || null
})

export const updateStoredOrderPayment = jest.fn((
  orderId: string,
  paymentData: any,
  triggeredBy: string = 'system'
): { success: boolean; order?: Order; error?: string } => {
  const order = mockOrders.get(orderId)
  if (!order) {
    return {
      success: false,
      error: `Order not found: ${orderId}`
    }
  }

  // Update order with payment data
  if (paymentData.paymentIntentId) {
    order.paymentIntentId = paymentData.paymentIntentId
  }
  if (paymentData.paymentIntentStatus) {
    order.paymentStatus = paymentData.paymentIntentStatus
  }
  order.updatedAt = new Date().toISOString()

  mockOrders.set(orderId, order)
  
  return {
    success: true,
    order
  }
})

export const updateOrderStatus = jest.fn((orderId: string, status: string, paymentStatus?: string): boolean => {
  const order = mockOrders.get(orderId)
  if (!order) return false

  order.status = status
  if (paymentStatus) {
    order.paymentStatus = paymentStatus
  }
  order.updatedAt = new Date().toISOString()

  mockOrders.set(orderId, order)
  return true
})

export const getAllOrders = jest.fn((): Order[] => {
  return Array.from(mockOrders.values())
})

export const deleteOrder = jest.fn((orderId: string): boolean => {
  return mockOrders.delete(orderId)
})

// Test utilities
export const clearMockOrders = jest.fn((): void => {
  mockOrders.clear()
})

export const getMockOrdersCount = jest.fn((): number => {
  return mockOrders.size
})

// Mock error simulation
export const simulateOrderStorageError = jest.fn((shouldError: boolean = true): void => {
  if (shouldError) {
    createOrder.mockImplementation(() => {
      throw new Error('Database connection failed')
    })
    updateStoredOrderPayment.mockImplementation(() => {
      return {
        success: false,
        error: 'Database connection failed'
      }
    })
  } else {
    // Reset to normal behavior
    createOrder.mockRestore()
    updateStoredOrderPayment.mockRestore()
  }
})

// Reset function for test cleanup
export const resetOrderStoreMocks = jest.fn((): void => {
  mockOrders.clear()
  jest.clearAllMocks()
})