/**
 * Unit Tests for Pure Payment Flow Functions
 * 
 * Tests the functional core with no React, no mocks, no side effects.
 * This is where 90% of the business logic coverage comes from.
 */

import {
  initializePayment,
  submitPayment,
  calculateRetryDelay,
  shouldRetryPayment,
  type PaymentGateway,
  type PaymentData,
  type PaymentError,
} from './paymentFlow';

describe('Payment Flow - Pure Functions', () => {
  const mockPaymentData: PaymentData = {
    customerInfo: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
    shippingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Main St',
      city: 'Test City',
      postalCode: '12345',
      country: 'RO',
    },
    billingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Main St',
      city: 'Test City',
      postalCode: '12345',
      country: 'RO',
    },
    items: [
      { id: '1', name: 'Product 1', price: 25.99, quantity: 2 },
    ],
    currency: 'ron',
  };

  describe('initializePayment', () => {
    it('should return payment methods from gateway', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn().mockResolvedValue(['card', 'apple_pay']),
        createIntent: jest.fn(),
        confirmPayment: jest.fn(),
      };

      const result = await initializePayment(mockGateway);

      expect(result).toEqual(['card', 'apple_pay']);
      expect(mockGateway.detectMethods).toHaveBeenCalledWith(undefined);
    });

    it('should pass abort signal to gateway', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn().mockResolvedValue([]),
        createIntent: jest.fn(),
        confirmPayment: jest.fn(),
      };
      const signal = new AbortController().signal;

      await initializePayment(mockGateway, signal);

      expect(mockGateway.detectMethods).toHaveBeenCalledWith(signal);
    });
  });

  describe('submitPayment', () => {
    it('should orchestrate payment flow successfully', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn(),
        createIntent: jest.fn().mockResolvedValue({
          clientSecret: 'pi_test_secret',
          orderId: 'ord_123',
          orderNumber: 'ORD-001',
        }),
        confirmPayment: jest.fn().mockResolvedValue({
          status: 'succeeded',
          paymentIntent: { id: 'pi_test', status: 'succeeded' },
        }),
      };

      const result = await submitPayment(mockGateway, mockPaymentData);

      expect(result.status).toBe('succeeded');
      expect(mockGateway.createIntent).toHaveBeenCalledWith(mockPaymentData, undefined);
      // confirmPayment now receives: clientSecret, orderInfo (PaymentIntent), signal
      expect(mockGateway.confirmPayment).toHaveBeenCalledWith('pi_test_secret', expect.objectContaining({
        clientSecret: 'pi_test_secret',
        orderId: 'ord_123',
        orderNumber: 'ORD-001'
      }), undefined);
    });

    it('should handle gateway errors gracefully', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn(),
        createIntent: jest.fn().mockRejectedValue(new Error('Network error')),
        confirmPayment: jest.fn(),
      };

      const result = await submitPayment(mockGateway, mockPaymentData);

      expect(result.status).toBe('failed');
      expect(result.error?.message).toBe('Network error');
      expect(result.error?.category).toBe('unknown');
      expect(result.error?.isRetryable).toBe(true);
    });

    it('should pass abort signal through the flow', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn(),
        createIntent: jest.fn().mockResolvedValue({
          clientSecret: 'pi_test_secret',
          orderId: 'ord_123',
          orderNumber: 'ORD-001',
        }),
        confirmPayment: jest.fn().mockResolvedValue({
          status: 'succeeded',
        }),
      };
      const signal = new AbortController().signal;

      await submitPayment(mockGateway, mockPaymentData, signal);

      expect(mockGateway.createIntent).toHaveBeenCalledWith(mockPaymentData, signal);
      // confirmPayment now receives: clientSecret, orderInfo (PaymentIntent), signal
      expect(mockGateway.confirmPayment).toHaveBeenCalledWith('pi_test_secret', expect.objectContaining({
        clientSecret: 'pi_test_secret',
        orderId: 'ord_123',
        orderNumber: 'ORD-001'
      }), signal);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateRetryDelay(0)).toBe(1000);
      expect(calculateRetryDelay(1)).toBe(2000);
      expect(calculateRetryDelay(2)).toBe(4000);
      expect(calculateRetryDelay(3)).toBe(8000);
    });

    it('should cap delay at maximum', () => {
      expect(calculateRetryDelay(10)).toBe(10000); // Capped at 10s
    });

    it('should accept custom base delay', () => {
      expect(calculateRetryDelay(1, 500)).toBe(1000);
      expect(calculateRetryDelay(2, 500)).toBe(2000);
    });
  });

  describe('shouldRetryPayment', () => {
    it('should allow retry for retryable errors under max attempts', () => {
      const error: PaymentError = {
        type: 'network_error',
        message: 'Network failed',
        category: 'network',
        isRetryable: true,
        severity: 'medium',
      };

      expect(shouldRetryPayment(error, 1, 3)).toBe(true);
    });

    it('should not retry non-retryable errors', () => {
      const error: PaymentError = {
        type: 'card_declined',
        message: 'Card declined',
        category: 'card',
        isRetryable: false,
        severity: 'high',
      };

      expect(shouldRetryPayment(error, 1, 3)).toBe(false);
    });

    it('should not retry when max attempts reached', () => {
      const error: PaymentError = {
        type: 'network_error',
        message: 'Network failed',
        category: 'network',
        isRetryable: true,
        severity: 'medium',
      };

      expect(shouldRetryPayment(error, 3, 3)).toBe(false);
    });
  });
});