/**
 * Order Management Types
 * 
 * Comprehensive TypeScript interfaces and enums for order management
 * including status tracking, payment integration, and audit trails.
 */

import type { CartItem } from './cart';
import type { Address } from './checkout';

// ====== ORDER STATUS ENUMS ======

/**
 * Order status enum with clear progression states
 * Aligned with Stripe payment gateway requirements
 */
export enum OrderStatus {
  // Initial states
  PENDING = 'pending',           // Order created, payment not processed
  PROCESSING = 'processing',     // Payment being processed
  
  // Payment states (primary for Stripe integration)
  PAID = 'paid',                 // Payment confirmed via webhook
  FAILED = 'failed',             // Payment failed
  
  // Fulfillment states
  CONFIRMED = 'confirmed',       // Order confirmed after payment
  PREPARING = 'preparing',       // Order being prepared
  SHIPPED = 'shipped',           // Order shipped
  DELIVERED = 'delivered',       // Order delivered
  
  // Terminal states
  CANCELLED = 'cancelled',       // Order cancelled
  REFUNDED = 'refunded',         // Order refunded
  RETURNED = 'returned',         // Order returned
}

/**
 * Payment status enum for tracking payment state separately
 */
export enum PaymentStatus {
  PENDING = 'pending',           // Payment intent created
  PROCESSING = 'processing',     // Payment being processed
  REQUIRES_ACTION = 'requires_action', // 3D Secure or other action needed
  SUCCEEDED = 'succeeded',       // Payment successful
  FAILED = 'failed',             // Payment failed
  CANCELLED = 'cancelled',       // Payment cancelled
  REFUNDED = 'refunded',         // Payment refunded
}

/**
 * Order source tracking
 */
export enum OrderSource {
  WEB = 'web',                   // Website order
  MOBILE = 'mobile',             // Mobile app order
  ADMIN = 'admin',               // Admin created order
  API = 'api',                   // API created order
}

/**
 * Order priority levels
 */
export enum OrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// ====== CORE ORDER INTERFACES ======

/**
 * Core order interface with all essential information
 */
export interface Order {
  // Core identification
  id: string;
  orderNumber: string;              // Human-readable order number (e.g., "ORD-2024-001234")
  customerId?: string;              // Optional customer ID
  
  // Status tracking
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  priority: OrderPriority;
  
  // Order metadata
  source: OrderSource;
  currency: string;                 // ISO currency code (RON)
  
  // Order items and pricing
  items: OrderItem[];
  totals: OrderTotals;
  
  // Customer information
  customerInfo: CustomerInfo;
  shippingAddress: Address;
  billingAddress: Address;
  
  // Payment information
  payment: OrderPayment;
  
  // Shipping information
  shipping?: ShippingInfo;
  
  // Order timeline
  timestamps: OrderTimestamps;
  
  // Additional metadata
  metadata: OrderMetadata;
  
  // Notes and comments
  notes?: OrderNote[];
  
  // Audit trail
  statusHistory: OrderStatusHistory[];
}

/**
 * Order item with detailed product information
 */
export interface OrderItem {
  id: string;                       // Unique item ID
  productId: string;                // Product reference
  variantId?: string;               // Product variant if applicable
  
  // Product details (snapshot at time of order)
  name: string;
  description?: string;
  sku?: string;
  image?: string;
  
  // Pricing
  unitPrice: number;                // Price in smallest currency unit (bani)
  quantity: number;
  totalPrice: number;               // unitPrice * quantity
  
  // Discounts
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
    code?: string;
    description?: string;
  };
  
  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Order totals breakdown
 */
export interface OrderTotals {
  // Base amounts (in smallest currency unit)
  subtotal: number;                 // Sum of all item prices
  discount: number;                 // Total discount amount
  shipping: number;                 // Shipping cost
  tax: number;                      // Tax amount
  total: number;                    // Final total amount
  
  // Currency
  currency: string;                 // ISO currency code
  
  // Tax details
  taxDetails?: TaxDetails;
  
  // Shipping details
  shippingDetails?: ShippingCalculation;
}

/**
 * Customer information for the order
 */
export interface CustomerInfo {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  
  // Customer metadata
  isGuest: boolean;
  previousOrderCount?: number;
  customerSince?: string;
}

/**
 * Payment information for the order
 */
export interface OrderPayment {
  // Stripe integration
  paymentIntentId?: string;         // Stripe Payment Intent ID
  clientSecret?: string;            // Stripe client secret
  
  // Payment method information
  method: PaymentMethod;
  
  // Payment amounts
  amount: number;                   // Amount in smallest currency unit
  currency: string;                 // ISO currency code
  
  // Payment timeline
  authorizedAt?: string;            // ISO timestamp
  capturedAt?: string;              // ISO timestamp
  failedAt?: string;                // ISO timestamp
  refundedAt?: string;              // ISO timestamp
  
  // Transaction details
  transactionId?: string;           // External transaction ID
  gatewayResponse?: Record<string, unknown>; // Gateway response data
  
  // Failure information
  failureReason?: string;
  failureCode?: string;
  
  // Refund information
  refunds?: PaymentRefund[];
  
  // Risk assessment
  riskScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  
  // Payment metadata
  metadata?: Record<string, unknown>;
}

/**
 * Payment method details
 */
export interface PaymentMethod {
  type: 'card' | 'apple_pay' | 'google_pay' | 'bank_transfer';
  
  // Card details (if applicable)
  card?: {
    brand: string;                  // visa, mastercard, etc.
    last4: string;                  // Last 4 digits
    expiryMonth: number;
    expiryYear: number;
    country?: string;
    fingerprint?: string;
  };
  
  // Digital wallet details
  wallet?: {
    type: 'apple_pay' | 'google_pay';
    email?: string;
  };
  
  // Bank transfer details
  bankTransfer?: {
    accountNumber: string;
    sortCode: string;
    bankName: string;
  };
}

/**
 * Payment refund information
 */
export interface PaymentRefund {
  id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: string;
  processedAt?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Shipping information
 */
export interface ShippingInfo {
  method: string;                   // Shipping method name
  carrier?: string;                 // Shipping carrier
  trackingNumber?: string;          // Tracking number
  trackingUrl?: string;             // Tracking URL
  
  // Shipping timeline
  estimatedDelivery?: string;       // ISO date
  shippedAt?: string;               // ISO timestamp
  deliveredAt?: string;             // ISO timestamp
  
  // Shipping costs
  cost: number;                     // Shipping cost in smallest currency unit
  
  // Shipping metadata
  metadata?: Record<string, unknown>;
}

/**
 * Order timestamps for audit trail
 */
export interface OrderTimestamps {
  createdAt: string;                // ISO timestamp
  updatedAt: string;                // ISO timestamp
  
  // Payment timestamps
  paymentCreatedAt?: string;        // Payment intent created
  paymentConfirmedAt?: string;      // Payment confirmed via webhook
  
  // Fulfillment timestamps
  confirmedAt?: string;             // Order confirmed
  preparingAt?: string;             // Started preparing
  shippedAt?: string;               // Order shipped
  deliveredAt?: string;             // Order delivered
  
  // Terminal state timestamps
  cancelledAt?: string;             // Order cancelled
  refundedAt?: string;              // Order refunded
  returnedAt?: string;              // Order returned
}

/**
 * Order metadata for additional information
 */
export interface OrderMetadata {
  // User agent and session info
  userAgent?: string;
  sessionId?: string;
  ipAddress?: string;
  
  // Marketing attribution
  source?: string;                  // Marketing source
  campaign?: string;                // Campaign ID
  referrer?: string;                // Referrer URL
  
  // Order preferences
  giftMessage?: string;
  specialInstructions?: string;
  
  // Internal flags
  isTest?: boolean;                 // Test order flag
  isReturning?: boolean;            // Returning customer
  
  // Custom metadata
  custom?: Record<string, unknown>;
}

/**
 * Order notes and comments
 */
export interface OrderNote {
  id: string;
  content: string;
  type: 'customer' | 'internal' | 'system';
  author: string;                   // User ID or system
  createdAt: string;                // ISO timestamp
  isVisible: boolean;               // Visible to customer
}

/**
 * Order status history for audit trail
 */
export interface OrderStatusHistory {
  id: string;
  fromStatus: OrderStatus | null;   // Previous status (null for initial)
  toStatus: OrderStatus;            // New status
  reason?: string;                  // Reason for status change
  triggeredBy: string;              // User ID or 'system'
  timestamp: string;                // ISO timestamp
  metadata?: Record<string, unknown>;
}

/**
 * Tax calculation details
 */
export interface TaxDetails {
  rate: number;                     // Tax rate (e.g., 0.19 for 19%)
  amount: number;                   // Tax amount in smallest currency unit
  jurisdiction: string;             // Tax jurisdiction
  type: string;                     // Tax type (VAT, sales tax, etc.)
  inclusive: boolean;               // Whether tax is included in prices
}

/**
 * Shipping calculation details
 */
export interface ShippingCalculation {
  method: string;                   // Shipping method
  cost: number;                     // Cost in smallest currency unit
  weight?: number;                  // Package weight
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  estimatedDays?: number;           // Estimated delivery days
}

// ====== ORDER CREATION INTERFACES ======

/**
 * Interface for creating a new order
 */
export interface CreateOrderRequest {
  // Customer information
  customerInfo: CustomerInfo;
  shippingAddress: Address;
  billingAddress: Address;
  
  // Order items from cart
  items: CartItem[];
  
  // Order preferences
  currency?: string;                // Defaults to RON
  priority?: OrderPriority;         // Defaults to NORMAL
  source?: OrderSource;             // Defaults to WEB
  
  // Additional information
  giftMessage?: string;
  specialInstructions?: string;
  
  // Marketing attribution
  marketingData?: {
    source?: string;
    campaign?: string;
    referrer?: string;
  };
  
  // Session data
  sessionData?: {
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
  };
  
  // Custom metadata
  metadata?: Record<string, unknown>;
}

/**
 * Response when creating an order
 */
export interface CreateOrderResponse {
  order: Order;
  warnings?: string[];
  validationErrors?: Record<string, string>;
}

// ====== ORDER UPDATE INTERFACES ======

/**
 * Interface for updating order status
 */
export interface UpdateOrderStatusRequest {
  orderId: string;
  newStatus: OrderStatus;
  reason?: string;
  triggeredBy: string;              // User ID or 'system'
  metadata?: Record<string, unknown>;
}

/**
 * Interface for updating payment information
 */
export interface UpdateOrderPaymentRequest {
  orderId: string;
  paymentData: Partial<OrderPayment>;
  triggeredBy: string;
}

// ====== ORDER QUERY INTERFACES ======

/**
 * Order search and filter criteria
 */
export interface OrderSearchCriteria {
  // Basic filters
  status?: OrderStatus[];
  paymentStatus?: PaymentStatus[];
  source?: OrderSource[];
  priority?: OrderPriority[];
  
  // Date ranges
  createdAfter?: string;            // ISO date
  createdBefore?: string;           // ISO date
  updatedAfter?: string;            // ISO date
  updatedBefore?: string;           // ISO date
  
  // Customer filters
  customerId?: string;
  customerEmail?: string;
  
  // Amount filters
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  
  // Text search
  searchTerm?: string;              // Search in order number, customer name, email
  
  // Pagination
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'total' | 'orderNumber';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Order search results
 */
export interface OrderSearchResults {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters: OrderSearchCriteria;
}

// ====== ORDER STATISTICS INTERFACES ======

/**
 * Order statistics and metrics
 */
export interface OrderStatistics {
  // Count statistics
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByPaymentStatus: Record<PaymentStatus, number>;
  
  // Revenue statistics
  totalRevenue: number;
  averageOrderValue: number;
  currency: string;
  
  // Time-based statistics
  ordersToday: number;
  ordersThisWeek: number;
  ordersThisMonth: number;
  
  // Performance metrics
  averageProcessingTime: number;    // Minutes
  paymentSuccessRate: number;       // Percentage
  
  // Period comparison
  periodStart: string;              // ISO date
  periodEnd: string;                // ISO date
  previousPeriodComparison?: {
    ordersChange: number;           // Percentage change
    revenueChange: number;          // Percentage change
  };
}

// ====== UTILITY TYPES ======

/**
 * Order status transition rules
 */
export type OrderStatusTransition = {
  from: OrderStatus;
  to: OrderStatus[];
  requiredPermissions?: string[];
  autoTransition?: boolean;
};

/**
 * Order validation result
 */
export interface OrderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Order export format
 */
export interface OrderExport {
  format: 'csv' | 'json' | 'xlsx';
  criteria: OrderSearchCriteria;
  fields: string[];
  filename?: string;
}

// ====== TYPE GUARDS ======

/**
 * Type guard to check if a status is a terminal status
 */
export const isTerminalStatus = (status: OrderStatus): boolean => {
  return [
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
    OrderStatus.RETURNED,
  ].includes(status);
};

/**
 * Type guard to check if a status is a payment-related status
 */
export const isPaymentStatus = (status: OrderStatus): boolean => {
  return [
    OrderStatus.PENDING,
    OrderStatus.PROCESSING,
    OrderStatus.PAID,
    OrderStatus.FAILED,
  ].includes(status);
};

/**
 * Type guard to check if an order can be cancelled
 */
export const canCancelOrder = (order: Order): boolean => {
  return ![
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
    OrderStatus.RETURNED,
  ].includes(order.status);
};

/**
 * Type guard to check if an order can be refunded
 */
export const canRefundOrder = (order: Order): boolean => {
  return order.status === OrderStatus.PAID || 
         order.status === OrderStatus.CONFIRMED ||
         order.status === OrderStatus.PREPARING ||
         order.status === OrderStatus.SHIPPED ||
         order.status === OrderStatus.DELIVERED;
};

// Note: All types are already exported above with their interface/enum declarations