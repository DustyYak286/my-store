/**
 * Unit Tests for Stripe Configuration
 * 
 * Tests the Stripe configuration utilities and validation functions.
 */

import {
  validateStripeKey,
  createStripeConfigError,
  getServerStripeOptions,
  getClientStripeOptions,
  getPaymentIntentParams,
  getElementsOptions,
} from './stripe';

describe('Stripe Configuration Utils', () => {
  describe('validateStripeKey', () => {
    it('should validate secret keys correctly', () => {
      const validSecretKey = 'sk_test_51abcdefghijklmnopqrstuvwxyz';
      const result = validateStripeKey(validSecretKey, 'sk_');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate publishable keys correctly', () => {
      const validPublishableKey = 'pk_test_51abcdefghijklmnopqrstuvwxyz';
      const result = validateStripeKey(validPublishableKey, 'pk_');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate webhook secrets correctly', () => {
      const validWebhookSecret = 'whsec_abcdefghijklmnopqrstuvwxyz1234567890';
      const result = validateStripeKey(validWebhookSecret, 'whsec_');
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty keys', () => {
      const result = validateStripeKey('', 'sk_');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Key is required');
    });

    it('should reject keys with wrong prefix', () => {
      const wrongPrefix = 'pk_test_51abcdefghijklmnopqrstuvwxyz';
      const result = validateStripeKey(wrongPrefix, 'sk_');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Key must start with sk_');
    });

    it('should reject keys that are too short', () => {
      const shortKey = 'sk_test_short';
      const result = validateStripeKey(shortKey, 'sk_test_');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Key appears to be too short');
    });
  });

  describe('createStripeConfigError', () => {
    it('should create properly formatted error', () => {
      const message = 'Test error message';
      const code = 'TEST_ERROR';
      const context = { test: 'context' };
      
      const error = createStripeConfigError(message, code, context);
      
      expect(error.message).toBe(message);
      expect(error.name).toBe('StripeConfigError');
      expect(error.code).toBe(code);
      expect(error.type).toBe('configuration_error');
      expect(error.context).toEqual(context);
      expect(error instanceof Error).toBe(true);
    });

    it('should work with minimal parameters', () => {
      const error = createStripeConfigError('Simple error');
      
      expect(error.message).toBe('Simple error');
      expect(error.name).toBe('StripeConfigError');
      expect(error.type).toBe('configuration_error');
    });
  });

  describe('getServerStripeOptions', () => {
    it('should return valid server-side Stripe options', () => {
      const options = getServerStripeOptions();
      
      expect(options).toHaveProperty('timeout');
      expect(options).toHaveProperty('maxNetworkRetries');
      expect(options).toHaveProperty('telemetry', false);
      expect(options).toHaveProperty('appInfo');
      
      expect(typeof options.timeout).toBe('number');
      expect(typeof options.maxNetworkRetries).toBe('number');
      expect(options.appInfo).toHaveProperty('name');
      expect(options.appInfo).toHaveProperty('version');
    });

    it('should set telemetry to false for server-side usage', () => {
      const options = getServerStripeOptions();
      expect(options.telemetry).toBe(false);
    });
  });

  describe('getClientStripeOptions', () => {
    it('should return valid client-side Stripe options', () => {
      const options = getClientStripeOptions();
      
      expect(options).toHaveProperty('stripeAccount', undefined);
      expect(options).toHaveProperty('locale', 'ro');
    });

    it('should set Romanian locale for RON currency', () => {
      const options = getClientStripeOptions();
      expect(options.locale).toBe('ro');
    });
  });

  describe('getPaymentIntentParams', () => {
    it('should generate valid payment intent parameters', () => {
      const amount = 2500; // 25.00 RON in bani
      const orderId = 'test_order_123';
      
      const params = getPaymentIntentParams(amount, orderId);
      
      expect(params.amount).toBe(amount);
      expect(params.currency).toBe('ron');
      expect(params.metadata.orderId).toBe(orderId);
      expect(params.metadata).toHaveProperty('environment');
      expect(params.metadata).toHaveProperty('timestamp');
      expect(params.metadata.orderId).toBe(orderId);
      expect(params).toHaveProperty('capture_method');
      // Should have automatic_payment_methods OR confirmation_method, not both (production-grade fix)
      expect(params.automatic_payment_methods || params.confirmation_method).toBeTruthy();
    });

    it('should work without idempotency key', () => {
      const amount = 1000;
      const orderId = 'test_order_456';
      
      const params = getPaymentIntentParams(amount, orderId);
      
      expect(params.amount).toBe(amount);
      expect(params.metadata.orderId).toBe(orderId);
      expect(params.metadata.orderId).toBe(orderId);
    });

    it('should include timestamp in metadata', () => {
      const params = getPaymentIntentParams(1000, 'test');
      const timestamp = params.metadata.timestamp;
      
      expect(timestamp).toBeDefined();
      expect(() => new Date(timestamp)).not.toThrow();
    });
  });

  describe('getElementsOptions', () => {
    it('should generate valid Elements options', () => {
      const clientSecret = 'pi_test_client_secret';
      const options = getElementsOptions(clientSecret);
      
      expect(options.clientSecret).toBe(clientSecret);
      expect(options).toHaveProperty('appearance');
      expect(options).toHaveProperty('loader', 'auto');
      expect(options.appearance).toHaveProperty('theme');
      expect(options.appearance).toHaveProperty('variables');
    });

    it('should include brand colors in appearance', () => {
      const options = getElementsOptions('test_secret');
      
      expect(options.appearance.variables).toHaveProperty('colorPrimary');
      expect(options.appearance.variables.colorPrimary).toBe('#7C4D59');
    });
  });

  describe('Configuration validation', () => {
    it('should use default API version (no explicit version set)', () => {
      const options = getServerStripeOptions();
      expect(options).not.toHaveProperty('apiVersion');
    });

    it('should have reasonable timeout values', () => {
      const options = getServerStripeOptions();
      expect(options.timeout).toBeGreaterThan(0);
      expect(options.timeout).toBeLessThan(120000); // Less than 2 minutes
    });
  });
});