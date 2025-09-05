/**
 * Compatibility Shim Tests
 * 
 * Simple tests to verify the v1 API surface maps correctly from v2 states.
 * These tests focus on the interface compatibility, not the business logic
 * (which is covered in the v2 tests).
 */

import { renderHook } from '@testing-library/react';
import { useStripePayment } from './useStripePayment.compat';
import type { PaymentGateway } from '@/core/paymentFlow';

// Mock dependencies
jest.mock('@stripe/react-stripe-js');
jest.mock('next/navigation');
jest.mock('@/context/CartContext');
jest.mock('./useStripePaymentV2');

describe('useStripePayment Compatibility Shim', () => {
  const mockV2Hook = {
    paymentState: {
      status: 'idle' as const,
      methods: [],
      error: null,
    },
    processPayment: jest.fn(),
    canRetry: false,
    resetPaymentState: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    require('./useStripePaymentV2').useStripePaymentV2.mockReturnValue(mockV2Hook);
  });

  describe('API Surface Compatibility', () => {
    it('should expose v1 API structure', () => {
      const { result } = renderHook(() => useStripePayment());

      // Verify v1 API is present
      expect(result.current).toHaveProperty('paymentState');
      expect(result.current).toHaveProperty('processPayment');
      expect(result.current).toHaveProperty('retryPayment');
      expect(result.current).toHaveProperty('cancelPayment');
      expect(result.current).toHaveProperty('resetPaymentState');
      expect(result.current).toHaveProperty('canRetry');
      expect(result.current).toHaveProperty('timeElapsed');
      expect(result.current).toHaveProperty('isTimeout');
    });

    it('should map v2 idle state to v1 format', () => {
      mockV2Hook.paymentState.status = 'idle';
      mockV2Hook.paymentState.error = null;

      const { result } = renderHook(() => useStripePayment());

      expect(result.current.paymentState).toMatchObject({
        isProcessing: false,
        isSubmitting: false,
        currentAttempt: 0,
        hasStarted: false,
        timeoutWarningShown: false,
        startTime: null,
        lastError: null,
      });
    });

    it('should map v2 processing state to v1 format', () => {
      mockV2Hook.paymentState.status = 'processing';
      mockV2Hook.paymentState.error = null;

      const { result } = renderHook(() => useStripePayment());

      expect(result.current.paymentState).toMatchObject({
        isProcessing: true,
        isSubmitting: true,
        currentAttempt: 1,
        hasStarted: true,
        lastError: null,
      });
    });

    it('should map v2 error state to v1 format', () => {
      mockV2Hook.paymentState.status = 'failed';
      mockV2Hook.paymentState.error = new Error('Payment failed');

      const { result } = renderHook(() => useStripePayment());

      expect(result.current.paymentState.lastError).toMatchObject({
        type: 'payment_error',
        message: 'Payment failed',
        category: 'unknown',
        isRetryable: true,
        severity: 'medium',
      });
    });

    it('should delegate resetPaymentState to v2', () => {
      const { result } = renderHook(() => useStripePayment());

      result.current.resetPaymentState();

      expect(mockV2Hook.resetPaymentState).toHaveBeenCalled();
    });

    it('should map canRetry from v2', () => {
      mockV2Hook.canRetry = true;

      const { result } = renderHook(() => useStripePayment());

      expect(result.current.canRetry).toBe(true);
    });
  });

  describe('processPayment Compatibility', () => {
    const mockFormData = {
      email: 'test@example.com',
      shippingFullName: 'John Doe',
      shippingStreetAddress: '123 Main St',
      shippingCity: 'Test City',
      shippingPostalCode: '12345',
      shippingCountry: 'RO',
      sameAsShipping: true,
      billingFullName: 'John Doe',
      billingStreetAddress: '123 Main St',
      billingCity: 'Test City',
      billingPostalCode: '12345',
      billingCountry: 'RO',
    };

    it('should return v1 success format', async () => {
      mockV2Hook.processPayment.mockResolvedValue({
        status: 'succeeded',
        paymentIntent: { id: 'pi_test' },
      });

      const { result } = renderHook(() => useStripePayment());

      const paymentResult = await result.current.processPayment(mockFormData);

      expect(paymentResult).toMatchObject({
        success: true,
        paymentIntent: { id: 'pi_test' },
        metadata: expect.any(Object),
      });
    });

    it('should return v1 error format', async () => {
      mockV2Hook.processPayment.mockResolvedValue({
        status: 'failed',
        error: {
          type: 'card_declined',
          message: 'Card declined',
          category: 'card',
          isRetryable: false,
          severity: 'high',
        },
      });

      const { result } = renderHook(() => useStripePayment());

      const paymentResult = await result.current.processPayment(mockFormData);

      expect(paymentResult).toMatchObject({
        success: false,
        error: expect.objectContaining({
          type: 'card_declined',
          message: 'Card declined',
          category: 'card',
        }),
      });
    });
  });
});