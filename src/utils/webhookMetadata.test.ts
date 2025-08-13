/**
 * Tests for Webhook Metadata Utilities
 */

import {
  extractWebhookMetadata,
  isWebhookVersionCompatible,
  requiresFulfillment,
  getOrderPreferences,
  getOrderTotalInRON,
  logWebhookProcessing,
  type WebhookMetadata,
} from './webhookMetadata';

describe('Webhook Metadata Utilities', () => {
  const validMetadata: WebhookMetadata = {
    orderId: 'order_test_123',
    orderNumber: 'ORD-2024-001234',
    requestId: 'req_test_456',
    customerEmail: 'test@example.com',
    customerName: 'John Doe',
    itemCount: '2',
    orderTotal: '2500', // 25.00 RON in bani
    currency: 'RON',
    webhookVersion: '1.0',
    requiresFulfillment: 'true',
    orderSource: 'web',
    environment: 'test',
    timestamp: '2024-01-01T00:00:00.000Z',
  };

  const validPaymentIntent = {
    id: 'pi_test_123',
    metadata: validMetadata,
  };

  describe('extractWebhookMetadata', () => {
    it('should extract valid metadata from payment intent', () => {
      const result = extractWebhookMetadata(validPaymentIntent);
      
      expect(result).toEqual(validMetadata);
    });

    it('should return null for missing metadata', () => {
      const paymentIntent = { id: 'pi_test_123' };
      const result = extractWebhookMetadata(paymentIntent);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid metadata type', () => {
      const paymentIntent = { 
        id: 'pi_test_123',
        metadata: 'invalid'
      };
      const result = extractWebhookMetadata(paymentIntent);
      
      expect(result).toBeNull();
    });

    it('should return null for missing required fields', () => {
      const paymentIntent = {
        id: 'pi_test_123',
        metadata: {
          orderId: 'order_123',
          // Missing other required fields
        },
      };
      const result = extractWebhookMetadata(paymentIntent);
      
      expect(result).toBeNull();
    });

    it('should handle extraction errors gracefully', () => {
      const result = extractWebhookMetadata(null);
      expect(result).toBeNull();
    });
  });

  describe('isWebhookVersionCompatible', () => {
    it('should return true for compatible version', () => {
      const result = isWebhookVersionCompatible(validMetadata);
      expect(result).toBe(true);
    });

    it('should return false for incompatible version', () => {
      const incompatibleMetadata = {
        ...validMetadata,
        webhookVersion: '2.0',
      };
      const result = isWebhookVersionCompatible(incompatibleMetadata);
      expect(result).toBe(false);
    });
  });

  describe('requiresFulfillment', () => {
    it('should return true when fulfillment is required', () => {
      const result = requiresFulfillment(validMetadata);
      expect(result).toBe(true);
    });

    it('should return false when fulfillment is not required', () => {
    const metadata = {
      ...validMetadata,
      requiresFulfillment: 'false',
    };
      const result = requiresFulfillment(metadata);
      expect(result).toBe(false);
    });

    it('should return false for undefined fulfillment flag', () => {
    const metadata = {
      ...validMetadata,
      requiresFulfillment: undefined,
    } as any;
      const result = requiresFulfillment(metadata);
      expect(result).toBe(false);
    });
  });

  describe('getOrderPreferences', () => {
    it('should return preferences when flags are present', () => {
      const metadata = {
        ...validMetadata,
        hasGiftMessage: 'true',
        hasSpecialInstructions: 'true',
      };
      
      const result = getOrderPreferences(metadata);
      
      expect(result).toEqual({
        hasGiftMessage: true,
        hasSpecialInstructions: true,
      });
    });

    it('should return false when flags are not present', () => {
      const result = getOrderPreferences(validMetadata);
      
      expect(result).toEqual({
        hasGiftMessage: false,
        hasSpecialInstructions: false,
      });
    });

    it('should handle mixed preferences', () => {
      const metadata = {
        ...validMetadata,
        hasGiftMessage: 'true',
        // hasSpecialInstructions not set
      };
      
      const result = getOrderPreferences(metadata);
      
      expect(result).toEqual({
        hasGiftMessage: true,
        hasSpecialInstructions: false,
      });
    });
  });

  describe('getOrderTotalInRON', () => {
    it('should convert bani to RON correctly', () => {
      const result = getOrderTotalInRON(validMetadata);
      expect(result).toBe(25.00); // 2500 bani = 25.00 RON
    });

    it('should handle zero amount', () => {
      const metadata = {
        ...validMetadata,
        orderTotal: '0',
      };
      const result = getOrderTotalInRON(metadata);
      expect(result).toBe(0);
    });

    it('should handle large amounts', () => {
      const metadata = {
        ...validMetadata,
        orderTotal: '999999900', // 9,999,999.00 RON
      };
      const result = getOrderTotalInRON(metadata);
      expect(result).toBe(9999999);
    });
  });

  describe('logWebhookProcessing', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log webhook processing information', () => {
      logWebhookProcessing(validMetadata, 'payment_intent.succeeded', 'evt_test_123');
      
      expect(consoleSpy).toHaveBeenCalledWith('🪝 Processing webhook: payment_intent.succeeded');
      expect(consoleSpy).toHaveBeenCalledWith('   Event ID: evt_test_123');
      expect(consoleSpy).toHaveBeenCalledWith('   Order ID: order_test_123');
      expect(consoleSpy).toHaveBeenCalledWith('   Order Number: ORD-2024-001234');
      expect(consoleSpy).toHaveBeenCalledWith('   Customer: test@example.com');
      expect(consoleSpy).toHaveBeenCalledWith('   Amount: 25 RON');
      expect(consoleSpy).toHaveBeenCalledWith('   Requires Fulfillment: true');
    });

    it('should include full metadata in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      logWebhookProcessing(validMetadata, 'payment_intent.succeeded', 'evt_test_123');
      
      expect(consoleSpy).toHaveBeenCalledWith('   Full Metadata:', expect.any(String));
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});