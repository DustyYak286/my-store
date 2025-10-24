/**
 * Audit Trail Tests
 * 
 * Tests for comprehensive audit trail functionality including
 * order status changes, payment updates, and webhook processing.
 */

import {
  recordOrderStatusChange,
  recordPaymentStatusChange,
  recordWebhookProcessing,
  recordOrderCreation,
  getOrderAuditTrail,
  getRecentAuditTrail,
  getAuditTrailStats,
  searchAuditTrail,
  clearAuditTrail,
  exportAuditTrail,
} from './auditTrail';
import { OrderStatus, PaymentStatus } from '@/types/order';

// Mock monitoring
jest.mock('@/utils/monitoring', () => ({
  monitoring: {
    recordWebhookOrderUpdated: jest.fn(),
  },
}));

describe('Audit Trail', () => {
  beforeEach(() => {
    clearAuditTrail();
    jest.clearAllMocks();
  });

  describe('recordOrderStatusChange', () => {
    it('should record order status changes with full details', () => {
      const orderId = 'order_123';
      const metadata = { 
        webhookEventId: 'evt_123',
        paymentIntentId: 'pi_123' 
      };

      recordOrderStatusChange(
        orderId,
        OrderStatus.PENDING,
        OrderStatus.PAID,
        'stripe_webhook',
        'Payment confirmed via webhook',
        metadata,
        'webhook'
      );

      const auditTrail = getOrderAuditTrail(orderId);
      expect(auditTrail).toHaveLength(1);

      const entry = auditTrail[0];
      expect(entry.orderId).toBe(orderId);
      expect(entry.action).toBe('status_change');
      expect(entry.details.fromStatus).toBe(OrderStatus.PENDING);
      expect(entry.details.toStatus).toBe(OrderStatus.PAID);
      expect(entry.details.triggeredBy).toBe('stripe_webhook');
      expect(entry.details.reason).toBe('Payment confirmed via webhook');
      expect(entry.details.metadata).toEqual(metadata);
      expect(entry.source).toBe('webhook');
      expect(entry.timestamp).toBeDefined();
      expect(entry.id).toMatch(/^audit_\d+_/);
    });

    it('should use default reason when none provided', () => {
      const orderId = 'order_123';

      recordOrderStatusChange(
        orderId,
        OrderStatus.PENDING,
        OrderStatus.PROCESSING,
        'system'
      );

      const auditTrail = getOrderAuditTrail(orderId);
      expect(auditTrail[0].details.reason).toBe('Status changed from pending to processing');
    });
  });

  describe('recordPaymentStatusChange', () => {
    it('should record payment status changes with payment details', () => {
      const orderId = 'order_123';
      const paymentIntentId = 'pi_123';
      const amount = 2500;
      const currency = 'ron';
      const metadata = { transactionId: 'txn_123' };

      recordPaymentStatusChange(
        orderId,
        PaymentStatus.PENDING,
        PaymentStatus.SUCCEEDED,
        paymentIntentId,
        amount,
        currency,
        'stripe_webhook',
        'Payment captured successfully',
        metadata,
        'webhook'
      );

      const auditTrail = getOrderAuditTrail(orderId);
      expect(auditTrail).toHaveLength(1);

      const entry = auditTrail[0];
      expect(entry.action).toBe('payment_update');
      expect(entry.details.fromPaymentStatus).toBe(PaymentStatus.PENDING);
      expect(entry.details.toPaymentStatus).toBe(PaymentStatus.SUCCEEDED);
      expect(entry.details.paymentIntentId).toBe(paymentIntentId);
      expect(entry.details.amount).toBe(amount);
      expect(entry.details.currency).toBe(currency);
      expect(entry.details.reason).toBe('Payment captured successfully');
      expect(entry.details.metadata).toEqual(metadata);
      expect(entry.source).toBe('webhook');
    });
  });

  describe('recordWebhookProcessing', () => {
    it('should record successful webhook processing', () => {
      const orderId = 'order_123';
      const webhookEventId = 'evt_123';
      const webhookEventType = 'payment_intent.succeeded';
      const metadata = { amount: 2500, currency: 'ron' };

      recordWebhookProcessing(
        orderId,
        webhookEventId,
        webhookEventType,
        'payment_confirmed',
        true,
        undefined,
        metadata
      );

      const auditTrail = getOrderAuditTrail(orderId);
      expect(auditTrail).toHaveLength(1);

      const entry = auditTrail[0];
      expect(entry.action).toBe('webhook_processed');
      expect(entry.details.webhookEventId).toBe(webhookEventId);
      expect(entry.details.webhookEventType).toBe(webhookEventType);
      expect(entry.details.reason).toBe('Webhook processed successfully: payment_confirmed');
      expect(entry.details.metadata).toEqual({
        ...metadata,
        success: true,
        action: 'payment_confirmed',
      });
      expect(entry.source).toBe('webhook');
    });

    it('should record failed webhook processing with error details', () => {
      const orderId = 'order_123';
      const error = 'Order not found';

      recordWebhookProcessing(
        orderId,
        'evt_123',
        'payment_intent.succeeded',
        'processing_failed',
        false,
        error
      );

      const auditTrail = getOrderAuditTrail(orderId);
      const entry = auditTrail[0];
      expect(entry.details.reason).toBe('Webhook processing failed: Order not found');
      expect(entry.details.metadata).toEqual({
        success: false,
        action: 'processing_failed',
        error,
      });
    });
  });

  describe('recordOrderCreation', () => {
    it('should record order creation with order details', () => {
      const orderId = 'order_123';
      const orderNumber = 'ORD-2024-001';
      const amount = 2500;
      const currency = 'ron';
      const customerEmail = 'test@example.com';
      const metadata = { itemCount: 2, source: 'web' };

      recordOrderCreation(
        orderId,
        orderNumber,
        amount,
        currency,
        customerEmail,
        'api',
        metadata
      );

      const auditTrail = getOrderAuditTrail(orderId);
      expect(auditTrail).toHaveLength(1);

      const entry = auditTrail[0];
      expect(entry.action).toBe('order_created');
      expect(entry.details.amount).toBe(amount);
      expect(entry.details.currency).toBe(currency);
      expect(entry.details.reason).toBe('Order created: ORD-2024-001 for test@example.com');
      expect(entry.details.metadata).toEqual(metadata);
      expect(entry.source).toBe('api');
    });
  });

  describe('getRecentAuditTrail', () => {
    it('should return recent entries across all orders sorted by timestamp', () => {
      // Create entries for multiple orders
      recordOrderCreation('order_1', 'ORD-001', 1000, 'ron', 'user1@example.com');
      recordOrderCreation('order_2', 'ORD-002', 2000, 'ron', 'user2@example.com');
      recordOrderStatusChange('order_1', OrderStatus.PENDING, OrderStatus.PAID, 'system');

      const recentEntries = getRecentAuditTrail(10);
      expect(recentEntries).toHaveLength(3);
      
      // Should be sorted by timestamp descending (most recent first)
      expect(new Date(recentEntries[0].timestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(recentEntries[1].timestamp).getTime());
    });

    it('should limit results to specified count', () => {
      // Create more entries than limit
      for (let i = 0; i < 5; i++) {
        recordOrderCreation(`order_${i}`, `ORD-00${i}`, 1000, 'ron', `user${i}@example.com`);
      }

      const recentEntries = getRecentAuditTrail(3);
      expect(recentEntries).toHaveLength(3);
    });
  });

  describe('getAuditTrailStats', () => {
    it('should calculate comprehensive statistics', () => {
      // Create various types of entries
      recordOrderCreation('order_1', 'ORD-001', 1000, 'ron', 'user1@example.com', 'api');
      recordOrderStatusChange('order_1', OrderStatus.PENDING, OrderStatus.PAID, 'webhook', undefined, undefined, 'webhook');
      recordPaymentStatusChange('order_1', PaymentStatus.PENDING, PaymentStatus.SUCCEEDED, 'pi_123', 1000, 'ron', 'webhook');
      recordWebhookProcessing('order_1', 'evt_123', 'payment_intent.succeeded', 'confirmed', true);

      const stats = getAuditTrailStats();
      
      expect(stats.totalEntries).toBe(4);
      expect(stats.orderCount).toBe(1);
      expect(stats.actionCounts).toEqual({
        order_created: 1,
        status_change: 1,
        payment_update: 1,
        webhook_processed: 1,
      });
      expect(stats.sourceCounts).toEqual({
        api: 1,
        webhook: 3,
      });
      expect(stats.recentActivity.last24Hours).toBe(4);
      expect(stats.recentActivity.lastHour).toBe(4);
    });
  });

  describe('searchAuditTrail', () => {
    beforeEach(() => {
      // Set up test data
      recordOrderCreation('order_1', 'ORD-001', 1000, 'ron', 'user1@example.com', 'api');
      recordOrderStatusChange('order_1', OrderStatus.PENDING, OrderStatus.PAID, 'stripe_webhook', undefined, undefined, 'webhook');
      recordOrderCreation('order_2', 'ORD-002', 2000, 'ron', 'user2@example.com', 'api');
      recordPaymentStatusChange('order_2', PaymentStatus.PENDING, PaymentStatus.FAILED, 'pi_456', 2000, 'ron', 'stripe_webhook');
    });

    it('should search by order ID', () => {
      const results = searchAuditTrail({ orderId: 'order_1' });
      expect(results).toHaveLength(2);
      expect(results.every(entry => entry.orderId === 'order_1')).toBe(true);
    });

    it('should search by action type', () => {
      const results = searchAuditTrail({ action: 'order_created' });
      expect(results).toHaveLength(2);
      expect(results.every(entry => entry.action === 'order_created')).toBe(true);
    });

    it('should search by source', () => {
      const results = searchAuditTrail({ source: 'webhook' });
      expect(results).toHaveLength(2);
      expect(results.every(entry => entry.source === 'webhook')).toBe(true);
    });

    it('should search by triggeredBy', () => {
      const results = searchAuditTrail({ triggeredBy: 'stripe_webhook' });
      expect(results).toHaveLength(2);
      expect(results.every(entry => entry.details.triggeredBy === 'stripe_webhook')).toBe(true);
    });

    it('should apply limit', () => {
      const results = searchAuditTrail({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should combine multiple criteria', () => {
      const results = searchAuditTrail({ 
        orderId: 'order_1', 
        action: 'status_change' 
      });
      expect(results).toHaveLength(1);
      expect(results[0].orderId).toBe('order_1');
      expect(results[0].action).toBe('status_change');
    });
  });

  describe('exportAuditTrail', () => {
    it('should export all audit trail data', () => {
      recordOrderCreation('order_1', 'ORD-001', 1000, 'ron', 'user1@example.com');
      recordOrderCreation('order_2', 'ORD-002', 2000, 'ron', 'user2@example.com');

      const exported = exportAuditTrail();
      
      expect(Object.keys(exported)).toEqual(['order_1', 'order_2']);
      expect(exported.order_1).toHaveLength(1);
      expect(exported.order_2).toHaveLength(1);
      expect(exported.order_1[0].action).toBe('order_created');
      expect(exported.order_2[0].action).toBe('order_created');
    });
  });

  describe('memory management', () => {
    it('should limit entries per order to prevent memory issues', () => {
      const orderId = 'order_test';
      
      // Create more than 100 entries
      for (let i = 0; i < 105; i++) {
        recordOrderStatusChange(
          orderId,
          OrderStatus.PENDING,
          OrderStatus.PROCESSING,
          'system',
          `Change ${i}`
        );
      }

      const auditTrail = getOrderAuditTrail(orderId);
      expect(auditTrail).toHaveLength(100); // Should be capped at 100
      
      // Should keep the most recent entries
      expect(auditTrail[auditTrail.length - 1].details.reason).toBe('Change 104');
    });
  });
});