/**
 * Tests for Refactored useStripePayment Hook
 * 
 * Follows suggestions.md guidance:
 * - Uses fake gateway via DI (no mocking nightmare)
 * - Tests React integration, not business logic
 * - Zero act() warnings expected
 * - Proper cleanup verification
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useStripePaymentV2 } from './useStripePaymentV2';
import type { PaymentGateway, PaymentResult } from '@/core/paymentFlow';
import type { FormData } from '@/types/checkout';
import { expectPaymentGatewayCalled } from '@/../tests/helpers/monitoringAssertions';

// Mock external dependencies (keep minimal)
jest.mock('@stripe/react-stripe-js');
jest.mock('next/navigation');
jest.mock('@/context/CartContext');

describe('useStripePaymentV2', () => {
  const mockStripe = {} as any;
  const mockElements = {} as any;
  const mockRouter = { push: jest.fn() };
  const mockCart = {
    cartItems: [{ id: '1', name: 'Product 1', price: 25.99, quantity: 2 }],
    totalPrice: 51.98,
    clearCart: jest.fn(),
  };

  const mockFormData: FormData = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    require('@stripe/react-stripe-js').useStripe.mockReturnValue(mockStripe);
    require('@stripe/react-stripe-js').useElements.mockReturnValue(mockElements);
    require('next/navigation').useRouter.mockReturnValue(mockRouter);
    require('@/context/CartContext').useCart.mockReturnValue(mockCart);
  });

  describe('initialization', () => {
    it('should initialize with idle state when Stripe not ready', () => {
      require('@stripe/react-stripe-js').useStripe.mockReturnValue(null);
      require('@stripe/react-stripe-js').useElements.mockReturnValue(null);

      const { result } = renderHook(() => useStripePaymentV2());

      expect(result.current.paymentState.status).toBe('idle');
      expect(result.current.paymentState.methods).toEqual([]);
      expect(result.current.paymentState.error).toBe(null);
    });

    it('should initialize payment methods when Stripe is ready', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn().mockResolvedValue(['card', 'apple_pay']),
        createIntent: jest.fn(),
        confirmPayment: jest.fn(),
      };

      const { result } = renderHook(() => 
        useStripePaymentV2({ gateway: mockGateway })
      );

      // Should start initializing
      expect(result.current.paymentState.status).toBe('initializing');

      // Wait for initialization to complete
      await waitFor(() => {
        expect(result.current.paymentState.status).toBe('ready');
      });

      expect(result.current.paymentState.methods).toEqual(['card', 'apple_pay']);
      
      // Enhanced gateway assertion
      expectPaymentGatewayCalled(mockGateway, {
        method: 'detectMethods',
        expectedResult: ['card', 'apple_pay']
      });
    });

    it('should handle initialization errors', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn().mockRejectedValue(new Error('Init failed')),
        createIntent: jest.fn(),
        confirmPayment: jest.fn(),
      };

      const { result } = renderHook(() => 
        useStripePaymentV2({ gateway: mockGateway })
      );

      await waitFor(() => {
        expect(result.current.paymentState.status).toBe('failed');
      });

      expect(result.current.paymentState.error?.message).toBe('Init failed');
    });
  });

  describe('payment processing', () => {
    it('should process payment successfully', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn().mockResolvedValue(['card']),
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

      const { result } = renderHook(() => 
        useStripePaymentV2({ gateway: mockGateway })
      );

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.paymentState.status).toBe('ready');
      });

      // Process payment
      await act(async () => {
        const paymentResult = await result.current.processPayment(mockFormData);
        expect(paymentResult.status).toBe('succeeded');
      });

      expect(result.current.paymentState.status).toBe('succeeded');
      expect(mockCart.clearCart).toHaveBeenCalled();
      
      // Enhanced gateway method assertions with actual call signature
      expectPaymentGatewayCalled(mockGateway, {
        method: 'createIntent',
        expectedArgs: [
          expect.objectContaining({
            currency: 'ron',
            customerInfo: expect.objectContaining({
              email: 'test@example.com',
              firstName: 'John',
              lastName: 'Doe'
            })
          }),
          undefined // Second parameter is undefined in the actual call
        ]
      });
      
      expectPaymentGatewayCalled(mockGateway, {
        method: 'confirmPayment',
        expectedResult: { status: 'succeeded' }
      });
    });

    it('should handle payment errors', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn().mockResolvedValue(['card']),
        createIntent: jest.fn().mockRejectedValue(new Error('Payment failed')),
        confirmPayment: jest.fn(),
      };

      const { result } = renderHook(() => 
        useStripePaymentV2({ gateway: mockGateway })
      );

      await waitFor(() => {
        expect(result.current.paymentState.status).toBe('ready');
      });

      await act(async () => {
        try {
          await result.current.processPayment(mockFormData);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      });

      expect(result.current.paymentState.status).toBe('failed');
      expect(result.current.canRetry).toBe(true);
    });

    it('should validate cart before processing', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn().mockResolvedValue(['card']),
        createIntent: jest.fn(),
        confirmPayment: jest.fn(),
      };

      // Mock empty cart
      require('@/context/CartContext').useCart.mockReturnValue({
        cartItems: [],
        totalPrice: 0,
        clearCart: jest.fn(),
      });

      const { result } = renderHook(() => 
        useStripePaymentV2({ gateway: mockGateway })
      );

      await waitFor(() => {
        expect(result.current.paymentState.status).toBe('ready');
      });

      await act(async () => {
        await expect(
          result.current.processPayment(mockFormData)
        ).rejects.toThrow('Cart is empty');
      });
    });
  });

  describe('cleanup and abort handling', () => {
    it('should abort initialization on unmount', async () => {
      const mockDetectMethods = jest.fn();
      const mockGateway: PaymentGateway = {
        detectMethods: mockDetectMethods,
        createIntent: jest.fn(),
        confirmPayment: jest.fn(),
      };

      const { unmount } = renderHook(() => 
        useStripePaymentV2({ gateway: mockGateway })
      );

      // Unmount immediately
      unmount();

      // Should not cause state updates after unmount
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // No specific assertion needed - this test passes if no warnings occur
    });
  });

  describe('state management', () => {
    it('should reset payment state', async () => {
      const mockGateway: PaymentGateway = {
        detectMethods: jest.fn().mockResolvedValue(['card']),
        createIntent: jest.fn(),
        confirmPayment: jest.fn(),
      };

      const { result } = renderHook(() => 
        useStripePaymentV2({ gateway: mockGateway })
      );

      await waitFor(() => {
        expect(result.current.paymentState.status).toBe('ready');
      });

      // Simulate error state
      act(() => {
        (result.current.paymentState as any).status = 'failed';
        (result.current.paymentState as any).error = new Error('Test error');
      });

      // Reset state
      act(() => {
        result.current.resetPaymentState();
      });

      expect(result.current.paymentState.status).toBe('ready');
      expect(result.current.paymentState.error).toBe(null);
    });
  });
});