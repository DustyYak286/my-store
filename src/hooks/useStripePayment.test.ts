/**
 * Comprehensive Unit Tests for useStripePayment Hook
 * 
 * Tests cover:
 * - Payment flow success scenarios
 * - Error handling and categorization
 * - Retry logic and backoff
 * - Timeout management
 * - 3D Secure authentication
 * - Double submission prevention
 * - State management
 * - Monitoring integration
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { usePaymentToast } from '@/hooks/useToast';
import { useStripePayment } from './useStripePayment';
import { confirmPayment, categorizeClientStripeError, logClientError } from '@/lib/stripe-client';
import { createSecureAuthenticationManager } from '@/lib/secure-authentication';
import { monitoring } from '@/utils/monitoring';
import { RETRY_CONFIG, TIMEOUT_CONFIG } from '@/constants/payments';
import type { FormData } from '@/types/checkout';

// Mock all dependencies
jest.mock('@stripe/react-stripe-js');
jest.mock('next/navigation');
jest.mock('@/context/CartContext');
jest.mock('@/hooks/useToast');
jest.mock('@/lib/stripe-client');
jest.mock('@/lib/secure-authentication');
jest.mock('@/utils/monitoring');

// Mock fetch globally
global.fetch = jest.fn();

// Mock timers
jest.useFakeTimers();

describe('useStripePayment', () => {
  // Mocked functions
  const mockUseStripe = useStripe as jest.MockedFunction<typeof useStripe>;
  const mockUseElements = useElements as jest.MockedFunction<typeof useElements>;
  const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
  const mockUseCart = useCart as jest.MockedFunction<typeof useCart>;
  const mockUsePaymentToast = usePaymentToast as jest.MockedFunction<typeof usePaymentToast>;
  const mockConfirmPayment = confirmPayment as jest.MockedFunction<typeof confirmPayment>;
  const mockCategorizeError = categorizeClientStripeError as jest.MockedFunction<typeof categorizeClientStripeError>;
  const mockLogClientError = logClientError as jest.MockedFunction<typeof logClientError>;
  const mockCreateAuthManager = createSecureAuthenticationManager as jest.MockedFunction<typeof createSecureAuthenticationManager>;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  // Mock objects
  const mockStripe = {
    confirmPayment: jest.fn(),
  };

  const mockElements = {
    getElement: jest.fn(),
    submit: jest.fn(),
  };

  const mockRouter = {
    push: jest.fn(),
  };

  const mockCart = {
    cartItems: [
      { id: '1', name: 'Product 1', price: 25.99, quantity: 2 },
      { id: '2', name: 'Product 2', price: 15.50, quantity: 1 },
    ],
    totalPrice: 67.48,
    clearCart: jest.fn(),
  };

  const mockToast = {
    showPaymentProcessing: jest.fn(),
    showPaymentRetry: jest.fn(),
    showPaymentSuccess: jest.fn(),
    showPaymentError: jest.fn(),
    showAuthenticationRequired: jest.fn(),
    showAuthenticationProgress: jest.fn(),
    showAuthenticationGuidance: jest.fn(),
    showSecureAuthenticationStart: jest.fn(),
    showSecureAuthenticationComplete: jest.fn(),
    showPaymentTimeout: jest.fn(),
    updatePaymentProgress: jest.fn(),
    hideToast: jest.fn(),
  };

  const mockMonitoring = {
    recordPaymentAttempt: jest.fn(),
    recordPaymentSuccess: jest.fn(),
    recordPaymentError: jest.fn(),
    recordPaymentRetry: jest.fn(),
    recordValidationError: jest.fn(),
    startTimer: jest.fn(() => jest.fn()), // Returns a stop function
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
    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Setup mock return values
    mockUseStripe.mockReturnValue(mockStripe as any);
    mockUseElements.mockReturnValue(mockElements as any);
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockUseCart.mockReturnValue(mockCart as any);
    mockUsePaymentToast.mockReturnValue(mockToast as any);
    (monitoring as any).recordPaymentAttempt = mockMonitoring.recordPaymentAttempt;
    (monitoring as any).recordPaymentSuccess = mockMonitoring.recordPaymentSuccess;
    (monitoring as any).recordPaymentError = mockMonitoring.recordPaymentError;
    (monitoring as any).recordPaymentRetry = mockMonitoring.recordPaymentRetry;
    (monitoring as any).recordValidationError = mockMonitoring.recordValidationError;
    (monitoring as any).startTimer = mockMonitoring.startTimer;

    // Setup default categorizeError mock
    mockCategorizeError.mockReturnValue({
      category: 'unknown',
      isRetryable: false,
      severity: 'medium',
    } as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Initial State', () => {
    test('should initialize with correct default state', () => {
      const { result } = renderHook(() => useStripePayment());

      expect(result.current.paymentState).toEqual({
        isProcessing: false,
        isSubmitting: false,
        currentAttempt: 0,
        hasStarted: false,
        timeoutWarningShown: false,
        startTime: null,
        lastError: null,
      });

      expect(result.current.canRetry).toBe(false);
      expect(result.current.timeElapsed).toBe(0);
      expect(result.current.isTimeout).toBe(false);
    });
  });

  describe('Validation Errors', () => {
    test('should handle Stripe not ready error', async () => {
      mockUseStripe.mockReturnValue(null);

      const { result } = renderHook(() => useStripePayment());

      await act(async () => {
        const paymentResult = await result.current.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(false);
        expect(paymentResult.error?.type).toBe('stripe_not_ready');
        expect(mockMonitoring.recordValidationError).toHaveBeenCalledWith('stripe_not_ready');
      });
    });

    test('should handle Elements not ready error', async () => {
      mockUseElements.mockReturnValue(null);

      const { result } = renderHook(() => useStripePayment());

      await act(async () => {
        const paymentResult = await result.current.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(false);
        expect(paymentResult.error?.type).toBe('stripe_not_ready');
        expect(mockMonitoring.recordValidationError).toHaveBeenCalledWith('stripe_not_ready');
      });
    });

    test('should prevent double submission', async () => {
      const { result } = renderHook(() => useStripePayment({
        enableDoubleSubmissionPrevention: true,
      }));

      // First call
      act(() => {
        result.current.processPayment(mockFormData);
      });

      // Second call immediately
      await act(async () => {
        const paymentResult = await result.current.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(false);
        expect(paymentResult.error?.type).toBe('double_submission');
        expect(mockMonitoring.recordValidationError).toHaveBeenCalledWith('double_submission');
      });
    });
  });

  describe('Payment Flow Success', () => {
    beforeEach(() => {
      // Mock successful API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          paymentIntent: {
            id: 'pi_test123',
            clientSecret: 'pi_test123_secret_test',
            amount: 6748,
            currency: 'ron',
            status: 'requires_payment_method',
          },
          order: {
            id: 'ord_test123',
            orderNumber: 'ORD-2024-001',
            total: 67.48,
            currency: 'ron',
            status: 'pending',
          },
        }),
      } as Response);

      // Mock successful payment confirmation
      mockConfirmPayment.mockResolvedValue({
        success: true,
        paymentIntent: {
          id: 'pi_test123',
          status: 'succeeded',
        },
      } as any);
    });

    test('should process successful payment', async () => {
      const { result } = renderHook(() => useStripePayment());

      await act(async () => {
        const paymentResult = await result.current.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(true);
        expect(paymentResult.paymentIntent?.status).toBe('succeeded');
        expect(mockMonitoring.recordPaymentAttempt).toHaveBeenCalled();
        expect(mockMonitoring.recordPaymentSuccess).toHaveBeenCalled();
        expect(mockCart.clearCart).toHaveBeenCalled();
        expect(mockToast.showPaymentSuccess).toHaveBeenCalled();
      });

      // Verify redirect timer
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/checkout/success');
    });

    test('should track payment processing time', async () => {
      const mockStopTimer = jest.fn();
      mockMonitoring.startTimer.mockReturnValue(mockStopTimer);

      const { result } = renderHook(() => useStripePayment());

      await act(async () => {
        await result.current.processPayment(mockFormData);
      });

      expect(mockMonitoring.startTimer).toHaveBeenCalledWith('client.payment_processing');
      expect(mockStopTimer).toHaveBeenCalled();
    });
  });

  describe('3D Secure Authentication', () => {
    beforeEach(() => {
      // Mock payment intent requiring action
      mockConfirmPayment.mockResolvedValue({
        success: true,
        paymentIntent: {
          id: 'pi_test123',
          status: 'requires_action',
        },
      } as any);

      // Mock authentication manager that calls the callbacks
      mockCreateAuthManager.mockImplementation((stripe, options) => {
        return {
          authenticate: jest.fn().mockImplementation(async (clientSecret) => {
            // Call the callbacks that were passed to the manager
            if (options?.onAuthenticationStart) {
              options.onAuthenticationStart('3D Secure');
            }
            
            if (options?.onAuthenticationSuccess) {
              options.onAuthenticationSuccess({
                success: true,
                paymentIntent: { id: 'pi_test123', status: 'succeeded' },
                metadata: { authenticationTime: 5000, authenticationMethod: '3D Secure' }
              });
            }
            
            return {
              success: true,
              paymentIntent: {
                id: 'pi_test123',
                status: 'succeeded',
              },
              metadata: {
                authenticationTime: 5000,
                authenticationMethod: '3D Secure',
              },
            };
          }),
          cancel: jest.fn(),
        };
      });
    });

    test('should handle 3D Secure authentication', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          paymentIntent: {
            id: 'pi_test123',
            clientSecret: 'pi_test123_secret_test',
          },
          order: { id: 'ord_test123', orderNumber: 'ORD-2024-001' },
        }),
      } as Response);

      const { result } = renderHook(() => useStripePayment());

      await act(async () => {
        const paymentResult = await result.current.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(true);
        expect(mockCreateAuthManager).toHaveBeenCalled();
        expect(mockToast.showSecureAuthenticationStart).toHaveBeenCalled();
        expect(mockToast.showSecureAuthenticationComplete).toHaveBeenCalledWith('3D Secure', 5000);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle payment intent creation error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          success: false,
          error: {
            message: 'Invalid payment amount',
            code: 'amount_invalid',
          },
        }),
      } as Response);

      mockCategorizeError.mockReturnValue({
        category: 'validation',
        isRetryable: false,
        severity: 'medium',
      } as any);

      const { result } = renderHook(() => useStripePayment());

      await act(async () => {
        const paymentResult = await result.current.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(false);
        expect(mockMonitoring.recordPaymentError).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            attemptNumber: 1,
            category: 'validation',
            isRetryable: false,
          })
        );
        expect(mockLogClientError).toHaveBeenCalled();
      });
    });

    test('should handle network timeout', async () => {
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const { result } = renderHook(() => useStripePayment());

      await act(async () => {
        const paymentResult = await result.current.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(false);
        expect(paymentResult.error?.message).toContain('timed out');
      });
    });
  });

  describe('Retry Logic', () => {
    test('should retry failed payments with exponential backoff', async () => {
      let callCount = 0;
      
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            paymentIntent: { id: 'pi_test123', clientSecret: 'secret' },
            order: { id: 'ord_test123', orderNumber: 'ORD-2024-001' },
          }),
        } as Response);
      });

      mockConfirmPayment.mockResolvedValue({
        success: true,
        paymentIntent: { id: 'pi_test123', status: 'succeeded' },
      } as any);

      mockCategorizeError.mockReturnValue({
        category: 'network',
        isRetryable: true,
        severity: 'medium',
      } as any);

      const { result } = renderHook(() => useStripePayment({
        enableRetry: true,
        maxAttempts: 3,
        enableDoubleSubmissionPrevention: false, // Disable to avoid interference
      }));

      expect(result.current).toBeTruthy();

      // Mock setTimeout to resolve immediately for testing
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await act(async () => {
        const paymentResult = await result.current!.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(true);
        expect(callCount).toBe(3);
        expect(mockMonitoring.recordPaymentAttempt).toHaveBeenCalledTimes(3);
        expect(mockMonitoring.recordPaymentRetry).toHaveBeenCalledTimes(2);
      });
    });

    test('should not retry non-retryable errors', async () => {
      mockFetch.mockRejectedValue(new Error('Card declined'));

      mockCategorizeError.mockReturnValue({
        category: 'card',
        isRetryable: false,
        severity: 'high',
      } as any);

      const { result } = renderHook(() => useStripePayment({
        enableRetry: true,
        maxAttempts: 3,
      }));

      expect(result.current).toBeTruthy();

      await act(async () => {
        const paymentResult = await result.current!.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(false);
        expect(mockMonitoring.recordPaymentAttempt).toHaveBeenCalledTimes(1);
        expect(mockMonitoring.recordPaymentRetry).not.toHaveBeenCalled();
      });
    });

    test('should exhaust retry attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      mockCategorizeError.mockReturnValue({
        category: 'network',
        isRetryable: true,
        severity: 'medium',
      } as any);

      const { result } = renderHook(() => useStripePayment({
        enableRetry: true,
        maxAttempts: 2,
        enableDoubleSubmissionPrevention: false, // Disable to avoid interference
      }));

      expect(result.current).toBeTruthy();

      // Mock setTimeout to resolve immediately for testing
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await act(async () => {
        const paymentResult = await result.current!.processPayment(mockFormData);
        
        expect(paymentResult.success).toBe(false);
        expect(paymentResult.error?.message).toContain('Maximum attempts reached');
        expect(mockMonitoring.recordPaymentAttempt).toHaveBeenCalledTimes(2);
        expect(mockMonitoring.recordPaymentRetry).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Timeout Management', () => {
    test('should show timeout warning', async () => {
      const { result } = renderHook(() => useStripePayment({
        warningTimeoutMs: 100,
        timeoutMs: 200,
        enableDoubleSubmissionPrevention: false,
      }));

      expect(result.current).toBeTruthy();

      // Mock fetch to hang indefinitely to simulate slow network
      const fetchPromise = new Promise<Response>(() => {}); // Never resolves
      mockFetch.mockReturnValue(fetchPromise);

      // Start payment - don't await, let it hang
      act(() => {
        result.current!.processPayment(mockFormData);
      });

      // Verify payment started processing
      expect(result.current.paymentState.isProcessing).toBe(true);
      expect(result.current.paymentState.timeoutWarningShown).toBe(false);

      // Advance to warning timeout
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Should show warning and update state
      expect(result.current.paymentState.timeoutWarningShown).toBe(true);
      expect(mockToast.showPaymentProcessing).toHaveBeenCalledWith(
        'Payment is taking longer than expected...'
      );
    });

    test('should handle payment timeout', async () => {
      const { result } = renderHook(() => useStripePayment({
        timeoutMs: 100,
        enableDoubleSubmissionPrevention: false,
      }));

      expect(result.current).toBeTruthy();

      // Mock fetch to hang indefinitely
      const fetchPromise = new Promise<Response>(() => {}); // Never resolves
      mockFetch.mockReturnValue(fetchPromise);

      // Start payment - don't await, let it hang
      act(() => {
        result.current!.processPayment(mockFormData);
      });

      // Verify payment started processing
      expect(result.current.paymentState.isProcessing).toBe(true);

      // Advance to full timeout
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Should have timed out and updated state
      expect(result.current.paymentState.isProcessing).toBe(false);
      expect(result.current.paymentState.lastError?.type).toBe('timeout_error');
      expect(mockMonitoring.recordPaymentError).toHaveBeenCalledWith(
        'timeout',
        expect.objectContaining({
          isRetryable: true,
        })
      );
      expect(mockToast.showPaymentTimeout).toHaveBeenCalled();
    });
  });

  describe('Payment Cancellation', () => {
    test('should cancel payment', () => {
      const { result } = renderHook(() => useStripePayment());

      expect(result.current).toBeTruthy();

      act(() => {
        result.current!.cancelPayment();
      });

      expect(result.current.paymentState.isProcessing).toBe(false);
      expect(mockToast.showPaymentError).toHaveBeenCalledWith({
        message: 'Payment cancelled',
        category: 'user_action',
        isRetryable: true,
        severity: 'low',
      });
    });
  });

  describe('State Reset', () => {
    test('should reset payment state', () => {
      const { result } = renderHook(() => useStripePayment());

      expect(result.current).toBeTruthy();

      // Simulate some state changes
      act(() => {
        result.current!.processPayment(mockFormData);
        result.current!.resetPaymentState();
      });

      expect(result.current.paymentState).toEqual({
        isProcessing: false,
        isSubmitting: false,
        currentAttempt: 0,
        hasStarted: false,
        timeoutWarningShown: false,
        startTime: null,
        lastError: null,
      });
    });
  });

  describe('Options Configuration', () => {
    test('should respect custom options', () => {
      const onPaymentStart = jest.fn();
      const onPaymentSuccess = jest.fn();
      const onPaymentError = jest.fn();

      const { result } = renderHook(() => useStripePayment({
        enableRetry: false,
        maxAttempts: 1,
        timeoutMs: 5000,
        enableDoubleSubmissionPrevention: false,
        onPaymentStart,
        onPaymentSuccess,
        onPaymentError,
      }));

      expect(result.current).toBeTruthy();
      expect(result.current.canRetry).toBe(false);
    });
  });

  describe('Callback Integration', () => {
    test('should call payment lifecycle callbacks', async () => {
      const onPaymentStart = jest.fn();
      const onPaymentSuccess = jest.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          paymentIntent: { id: 'pi_test123', clientSecret: 'secret' },
          order: { id: 'ord_test123', orderNumber: 'ORD-2024-001' },
        }),
      } as Response);

      mockConfirmPayment.mockResolvedValue({
        success: true,
        paymentIntent: { id: 'pi_test123', status: 'succeeded' },
      } as any);

      const { result } = renderHook(() => useStripePayment({
        onPaymentStart,
        onPaymentSuccess,
      }));

      expect(result.current).toBeTruthy();

      await act(async () => {
        await result.current!.processPayment(mockFormData);
      });

      expect(onPaymentStart).toHaveBeenCalled();
      expect(onPaymentSuccess).toHaveBeenCalled();
    });
  });
});