/**
 * Audit Trail Utilities
 * 
 * Enhanced audit trail functionality for order status changes
 * and payment processing with detailed logging and tracking.
 */

import { Order, OrderStatus, PaymentStatus, OrderStatusHistory } from '@/types/order';
import { monitoring } from '@/utils/monitoring';

export interface AuditTrailEntry {
  id: string;
  orderId: string;
  timestamp: string;
  action: 'status_change' | 'payment_update' | 'webhook_processed' | 'order_created';
  details: {
    // For status changes
    fromStatus?: OrderStatus;
    toStatus?: OrderStatus;
    fromPaymentStatus?: PaymentStatus;
    toPaymentStatus?: PaymentStatus;
    
    // For payment updates
    paymentIntentId?: string;
    amount?: number;
    currency?: string;
    
    // For webhook processing
    webhookEventId?: string;
    webhookEventType?: string;
    
    // Common fields
    triggeredBy: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
  source: 'webhook' | 'api' | 'admin' | 'system';
  ipAddress?: string;
  userAgent?: string;
}

// In-memory audit trail storage (replace with database in production)
const auditTrail = new Map<string, AuditTrailEntry[]>();

/**
 * Generate a unique audit trail entry ID
 */
function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Add an audit trail entry for order status change
 */
export function recordOrderStatusChange(
  orderId: string,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  triggeredBy: string,
  reason?: string,
  metadata?: Record<string, unknown>,
  source: AuditTrailEntry['source'] = 'system'
): void {
  const entry: AuditTrailEntry = {
    id: generateAuditId(),
    orderId,
    timestamp: new Date().toISOString(),
    action: 'status_change',
    details: {
      fromStatus,
      toStatus,
      triggeredBy,
      reason: reason || `Status changed from ${fromStatus} to ${toStatus}`,
      ...(metadata && { metadata }),
    },
    source,
  };

  addAuditEntry(orderId, entry);
  
  // Record metrics
  monitoring.recordWebhookOrderUpdated(orderId, toStatus, 0);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] Audit: Order ${orderId} status changed ${fromStatus} -> ${toStatus} by ${triggeredBy}`);
  }
}

/**
 * Add an audit trail entry for payment status change
 */
export function recordPaymentStatusChange(
  orderId: string,
  fromPaymentStatus: PaymentStatus,
  toPaymentStatus: PaymentStatus,
  paymentIntentId: string,
  amount: number,
  currency: string,
  triggeredBy: string,
  reason?: string,
  metadata?: Record<string, unknown>,
  source: AuditTrailEntry['source'] = 'webhook'
): void {
  const entry: AuditTrailEntry = {
    id: generateAuditId(),
    orderId,
    timestamp: new Date().toISOString(),
    action: 'payment_update',
    details: {
      fromPaymentStatus,
      toPaymentStatus,
      paymentIntentId,
      amount,
      currency,
      triggeredBy,
      reason: reason || `Payment status changed from ${fromPaymentStatus} to ${toPaymentStatus}`,
      ...(metadata && { metadata }),
    },
    source,
  };

  addAuditEntry(orderId, entry);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] Audit: Order ${orderId} payment ${fromPaymentStatus} -> ${toPaymentStatus} (${amount} ${currency})`);
  }
}

/**
 * Add an audit trail entry for webhook processing
 */
export function recordWebhookProcessing(
  orderId: string,
  webhookEventId: string,
  webhookEventType: string,
  action: string,
  success: boolean,
  error?: string,
  metadata?: Record<string, unknown>
): void {
  const entry: AuditTrailEntry = {
    id: generateAuditId(),
    orderId,
    timestamp: new Date().toISOString(),
    action: 'webhook_processed',
    details: {
      webhookEventId,
      webhookEventType,
      triggeredBy: 'stripe_webhook',
      reason: success ? `Webhook processed successfully: ${action}` : `Webhook processing failed: ${error}`,
      metadata: { ...(metadata || {}), success, action, ...(error && { error }) },
    },
    source: 'webhook',
  };

  addAuditEntry(orderId, entry);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] Audit: Webhook ${webhookEventType} for order ${orderId} - ${success ? 'SUCCESS' : 'FAILED'}`);
  }
}

/**
 * Add an audit trail entry for order creation
 */
export function recordOrderCreation(
  orderId: string,
  orderNumber: string,
  amount: number,
  currency: string,
  customerEmail: string,
  source: AuditTrailEntry['source'] = 'api',
  metadata?: Record<string, unknown>
): void {
  const entry: AuditTrailEntry = {
    id: generateAuditId(),
    orderId,
    timestamp: new Date().toISOString(),
    action: 'order_created',
    details: {
      amount,
      currency,
      triggeredBy: 'system',
      reason: `Order created: ${orderNumber} for ${customerEmail}`,
      ...(metadata && { metadata }),
    },
    source,
  };

  addAuditEntry(orderId, entry);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[INFO] Audit: Order created ${orderNumber} (${orderId}) - ${amount} ${currency}`);
  }
}

/**
 * Add an audit entry to the trail
 */
function addAuditEntry(orderId: string, entry: AuditTrailEntry): void {
  const existingEntries = auditTrail.get(orderId) || [];
  existingEntries.push(entry);
  auditTrail.set(orderId, existingEntries);
  
  // Keep only the last 100 entries per order to prevent memory issues
  if (existingEntries.length > 100) {
    existingEntries.splice(0, existingEntries.length - 100);
  }
}

/**
 * Get audit trail for a specific order
 */
export function getOrderAuditTrail(orderId: string): AuditTrailEntry[] {
  return auditTrail.get(orderId) || [];
}

/**
 * Get recent audit trail entries across all orders
 */
export function getRecentAuditTrail(limit: number = 50): AuditTrailEntry[] {
  const allEntries: AuditTrailEntry[] = [];
  
  for (const entries of auditTrail.values()) {
    allEntries.push(...entries);
  }
  
  // Sort by timestamp descending and limit
  return allEntries
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Get audit trail statistics
 */
export function getAuditTrailStats(): {
  totalEntries: number;
  orderCount: number;
  actionCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  recentActivity: {
    last24Hours: number;
    lastHour: number;
  };
} {
  const allEntries: AuditTrailEntry[] = [];
  for (const entries of auditTrail.values()) {
    allEntries.push(...entries);
  }
  
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const actionCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  let last24Hours = 0;
  let lastHour = 0;
  
  allEntries.forEach(entry => {
    // Count actions
    actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    
    // Count sources
    sourceCounts[entry.source] = (sourceCounts[entry.source] || 0) + 1;
    
    // Count recent activity
    const entryTime = new Date(entry.timestamp);
    if (entryTime > oneDayAgo) last24Hours++;
    if (entryTime > oneHourAgo) lastHour++;
  });
  
  return {
    totalEntries: allEntries.length,
    orderCount: auditTrail.size,
    actionCounts,
    sourceCounts,
    recentActivity: {
      last24Hours,
      lastHour,
    },
  };
}

/**
 * Clear audit trail for testing
 */
export function clearAuditTrail(): void {
  auditTrail.clear();
}

/**
 * Export audit trail as JSON for backup/analysis
 */
export function exportAuditTrail(): Record<string, AuditTrailEntry[]> {
  const exported: Record<string, AuditTrailEntry[]> = {};
  for (const [orderId, entries] of auditTrail.entries()) {
    exported[orderId] = entries;
  }
  return exported;
}

/**
 * Search audit trail entries
 */
export function searchAuditTrail(criteria: {
  orderId?: string;
  action?: AuditTrailEntry['action'];
  source?: AuditTrailEntry['source'];
  triggeredBy?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): AuditTrailEntry[] {
  const allEntries: AuditTrailEntry[] = [];
  
  if (criteria.orderId) {
    // Search specific order
    const orderEntries = auditTrail.get(criteria.orderId) || [];
    allEntries.push(...orderEntries);
  } else {
    // Search all orders
    for (const entries of auditTrail.values()) {
      allEntries.push(...entries);
    }
  }
  
  let filteredEntries = allEntries;
  
  // Apply filters
  if (criteria.action) {
    filteredEntries = filteredEntries.filter(entry => entry.action === criteria.action);
  }
  
  if (criteria.source) {
    filteredEntries = filteredEntries.filter(entry => entry.source === criteria.source);
  }
  
  if (criteria.triggeredBy) {
    filteredEntries = filteredEntries.filter(entry => 
      entry.details.triggeredBy === criteria.triggeredBy
    );
  }
  
  if (criteria.fromDate) {
    const fromDate = new Date(criteria.fromDate);
    filteredEntries = filteredEntries.filter(entry => 
      new Date(entry.timestamp) >= fromDate
    );
  }
  
  if (criteria.toDate) {
    const toDate = new Date(criteria.toDate);
    filteredEntries = filteredEntries.filter(entry => 
      new Date(entry.timestamp) <= toDate
    );
  }
  
  // Sort by timestamp descending
  filteredEntries.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Apply limit
  if (criteria.limit) {
    filteredEntries = filteredEntries.slice(0, criteria.limit);
  }
  
  return filteredEntries;
}