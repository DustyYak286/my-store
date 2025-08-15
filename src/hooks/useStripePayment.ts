/**
 * useStripePayment Hook
 * 
 * Custom hook for handling Stripe payment processing with comprehensive
 * retry logic, error handling, timeout management, and state tracking.
 * 
 * Features:
 * - Exponential backoff retry mechanism (max 3 attempts)
 * - Comprehensive error categorization and handling
 * - Payment timeout management (30-60s)
 * - 3D Secure authentication support
 * - Double-submission prevention
 * - Real-time payment state tracking
 * - Integration with toast notifications
 * - Payment monitoring and metrics
 */

"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { usePaymentToast } from '@/hooks/useToast';
import { confirmPayment, handleNextAction, categorizeClientStripeError, logClientError } from '@/lib/stripe-client';
import { createSecureAuthenticationManager, type AuthenticationResult, type AuthenticationError } from '@/lib/secure-authentication';
import { monitoring } from '@/utils/monitoring';
import { 
  RETRY_CONFIG, 
  TIMEOUT_CONFIG, 
  PAYMENT_ERROR_MESSAGES,
  PAYMENT_SUCCESS_MESSAGES,
  calculateRetryDelay,
  toStripeAmount,
  validatePaymentAmount
} from '@/constants/payments';
import type { Stripe, StripeElements, PaymentIntent } from '@stripe/stripe-js';
import type { FormData } from '@/types/checkout';

// ====== TYPES AND INTERFACES ======

export interface PaymentState {
  isProcessing: boolean;
  isSubmitting: boolean;
  currentAttempt: number;
  hasStarted: boolean;
  timeoutWarningShown: boolean;
  startTime: number | null;
  lastError: PaymentError | null;
}

export interface PaymentError {
  type: string;
  code?: string;
  message: string;
  category: 'card' | 'authentication' | 'network' | 'validation' | 'unknown';
  isRetryable: boolean;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  attempt: number;
}

export interface PaymentResult {
  success: boolean;
  paymentIntent?: PaymentIntent;
  error?: PaymentError;
  metadata?: {
    totalAttempts: number;
    processingTime: number;
    retryable: boolean;
  };
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  paymentIntent?: {
    id: string;
    clientSecret: string;
    amount: number;
    currency: string;
    status: string;
  };
  order?: {
    id: string;
    orderNumber: string;
    total: number;
    currency: string;
    status: string;
  };
  error?: {
    code: string;
    message: string;
    type: string;
    details?: any;
  };
}

export interface UseStripePaymentOptions {
  enableRetry?: boolean;
  maxAttempts?: number;
  timeoutMs?: number;
  warningTimeoutMs?: number;
  enableDoubleSubmissionPrevention?: boolean;
  onPaymentStart?: () => void;
  onPaymentSuccess?: (result: PaymentResult) => void;
  onPaymentError?: (error: PaymentError) => void;
  onTimeout?: () => void;
  onRetryAttempt?: (attempt: number, maxAttempts: number) => void;
}

export interface UseStripePaymentReturn {
  // State
  paymentState: PaymentState;
  
  // Actions
  processPayment: (formData: FormData) => Promise<PaymentResult>;
  retryPayment: () => Promise<PaymentResult>;
  cancelPayment: () => void;
  resetPaymentState: () => void;
  
  // Utilities
  canRetry: boolean;
  timeElapsed: number;
  isTimeout: boolean;
}

// ====== HOOK IMPLEMENTATION ======

export const useStripePayment = (options: UseStripePaymentOptions = {}): UseStripePaymentReturn => {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { cartItems, totalPrice, clearCart } = useCart();
  const {
    showPaymentProcessing,
    showPaymentRetry,
    showPaymentSuccess,
    showPaymentError,
    showAuthenticationRequired,
    showAuthenticationProgress,
    showAuthenticationGuidance,
    showSecureAuthenticationStart,
    showSecureAuthenticationComplete,
    showPaymentTimeout,
    updatePaymentProgress,
    hideToast,
  } = usePaymentToast();
  
  // Destructure options with defaults
  const {
    enableRetry = true,
    maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS,
    timeoutMs = TIMEOUT_CONFIG.PAYMENT_TIMEOUT,
    warningTimeoutMs = TIMEOUT_CONFIG.WARNING_TIMEOUT,
    enableDoubleSubmissionPrevention = true,
    onPaymentStart,
    onPaymentSuccess,
    onPaymentError,
    onTimeout,
    onRetryAttempt,
  } = options;

  // Payment state management
  const [paymentState, setPaymentState] = useState<PaymentState>({
    isProcessing: false,
    isSubmitting: false,
    currentAttempt: 0,
    hasStarted: false,
    timeoutWarningShown: false,
    startTime: null,
    lastError: null,
  });

  // Refs for cleanup and timeout management
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSubmissionRef = useRef<number>(0);
  const paymentStateRef = useRef<PaymentState>(paymentState);
  const currentPaymentIntentRef = useRef<string>('');
  const currentOrderIdRef = useRef<string>('');
  const currentOrderNumberRef = useRef<string>('');

  // Keep paymentStateRef updated
  useEffect(() => {
    paymentStateRef.current = paymentState;
  }, [paymentState]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Calculate derived state
  const timeElapsed = paymentState.startTime ? Date.now() - paymentState.startTime : 0;
  const isTimeout = timeElapsed > timeoutMs;
  const canRetry = enableRetry && 
                   paymentState.currentAttempt < maxAttempts && 
                   paymentState.lastError?.isRetryable === true &&
                   !paymentState.isProcessing;

  // ====== CORE PAYMENT LOGIC ======

  /**
   * Create payment intent with order creation
   */
  const createPaymentIntent = useCallback(async (
    formData: FormData,
    signal?: AbortSignal
  ): Promise<{ clientSecret: string; orderId: string; orderNumber: string }> => {
    // Validate cart state
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cart is empty. Please add items before proceeding.');
    }

    if (!totalPrice || typeof totalPrice !== 'number') {
      throw new Error('Invalid cart total. Please refresh and try again.');
    }

    // Validate payment amount
    const amountValidation = validatePaymentAmount(totalPrice);
    if (!amountValidation.isValid) {
      throw new Error(amountValidation.error || 'Invalid payment amount');
    }

    // Prepare request payload
    const requestPayload = {
      customerInfo: {
        email: formData.email,
        firstName: formData.shippingFullName.split(' ')[0] || '',
        lastName: formData.shippingFullName.split(' ').slice(1).join(' ') || '',
      },
      shippingAddress: {
        fullName: formData.shippingFullName,
        streetAddress: formData.shippingStreetAddress,
        city: formData.shippingCity,
        postalCode: formData.shippingPostalCode,
        country: formData.shippingCountry,
      },
      billingAddress: formData.sameAsShipping ? {
        fullName: formData.shippingFullName,
        streetAddress: formData.shippingStreetAddress,
        city: formData.shippingCity,
        postalCode: formData.shippingPostalCode,
        country: formData.shippingCountry,
      } : {
        fullName: formData.billingFullName,
        streetAddress: formData.billingStreetAddress,
        city: formData.billingCity,
        postalCode: formData.billingPostalCode,
        country: formData.billingCountry,
      },
      items: cartItems,
      currency: 'ron',
      clientRequestId: `client_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      sessionId: typeof window !== 'undefined' ? 
        (sessionStorage.getItem('checkout_session_id') || 
         (() => {
           const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
           sessionStorage.setItem('checkout_session_id', sessionId);
           return sessionId;
         })()) 
        : undefined,
    };

    // Make API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_CONFIG.API_REQUEST_TIMEOUT);
    
    // Combine external signal with internal timeout
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData: CreatePaymentIntentResponse = await response.json();
        const errorMessage = errorData.error?.message || `Server error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data: CreatePaymentIntentResponse = await response.json();
      
      if (!data.success || !data.paymentIntent?.clientSecret || !data.order?.id) {
        throw new Error(data.error?.message || 'Failed to create payment intent');
      }

      return {
        clientSecret: data.paymentIntent.clientSecret,
        orderId: data.order.id,
        orderNumber: data.order.orderNumber,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      
      throw error;
    }
  }, [cartItems, totalPrice]);

  /**
   * Confirm payment with Stripe
   */
  const confirmStripePayment = useCallback(async (
    stripe: Stripe,
    elements: StripeElements,
    clientSecret: string,
    formData: FormData,
    signal?: AbortSignal
  ): Promise<PaymentIntent> => {
    const confirmationData = {
      return_url: `${window.location.origin}/checkout/success`,
      payment_method_data: {
        billing_details: {
          name: formData.sameAsShipping ? formData.shippingFullName : formData.billingFullName,
          email: formData.email,
          address: {
            line1: formData.sameAsShipping ? formData.shippingStreetAddress : formData.billingStreetAddress,
            city: formData.sameAsShipping ? formData.shippingCity : formData.billingCity,
            postal_code: formData.sameAsShipping ? formData.shippingPostalCode : formData.billingPostalCode,
            country: formData.sameAsShipping ? formData.shippingCountry : formData.billingCountry,
          },
        },
      },
    };

    const result = await confirmPayment(stripe, elements, clientSecret, confirmationData);
    
    if (signal?.aborted) {
      throw new Error('Payment confirmation was cancelled');
    }

    if (!result.success || !result.paymentIntent) {
      const error = result.error || { 
        type: 'unknown', 
        message: 'Payment confirmation failed', 
        category: 'unknown' as const,
        isRetryable: false 
      };
      throw error;
    }

    // Handle 3D Secure if required with enhanced authentication manager
    if (result.paymentIntent.status === 'requires_action') {
      console.log('🔐 3D Secure authentication required - using enhanced authentication manager');
      
      // Create enhanced authentication manager
      const authManager = createSecureAuthenticationManager(stripe, {
        timeoutMs: 180000, // 3 minutes for 3D Secure
        warningTimeoutMs: 120000, // 2 minute warning
        enableUserGuidance: true,
        maxRetries: 2,
        onAuthenticationStart: (method: string) => {
          console.log(`🔐 3D Secure authentication started: ${method}`);
          showSecureAuthenticationStart(method);
        },
        onAuthenticationProgress: (progress: number, message: string) => {
          console.log(`🔄 Authentication progress: ${progress}% - ${message}`);
          showAuthenticationProgress(progress, message);
        },
        onAuthenticationSuccess: (authResult: AuthenticationResult) => {
          console.log('✅ 3D Secure authentication completed successfully');
          const duration = authResult.metadata?.authenticationTime || 0;
          const method = authResult.metadata?.authenticationMethod || '3D Secure';
          showSecureAuthenticationComplete(method, duration);
        },
        onAuthenticationError: (authError: AuthenticationError) => {
          console.error('❌ 3D Secure authentication failed:', authError);
          showPaymentError({
            message: authError.message,
            category: authError.category,
            isRetryable: authError.isRetryable,
            severity: authError.severity,
            code: authError.code,
          });
        },
        onTimeout: (timeElapsed: number) => {
          console.warn(`⏰ 3D Secure authentication timed out after ${timeElapsed}ms`);
          showPaymentTimeout(timeElapsed, true);
        },
        onUserGuidance: (guidance: string, type: 'info' | 'warning' | 'error') => {
          console.log(`💡 User guidance (${type}): ${guidance}`);
          showAuthenticationGuidance(guidance, type);
        },
      });

      // Perform enhanced 3D Secure authentication
      const authResult = await authManager.authenticate(clientSecret);
      
      if (signal?.aborted) {
        authManager.cancel();
        throw new Error('3D Secure authentication was cancelled');
      }

      if (!authResult.success || !authResult.paymentIntent) {
        const error = authResult.error || {
          type: 'authentication_error',
          message: 'Authentication failed',
          category: 'authentication' as const,
          isRetryable: true
        };
        throw error;
      }

      console.log(`✅ 3D Secure completed in ${authResult.metadata?.authenticationTime}ms using ${authResult.metadata?.authenticationMethod}`);
      
      return authResult.paymentIntent;
    }

    return result.paymentIntent;
  }, [showSecureAuthenticationStart, showAuthenticationProgress, showSecureAuthenticationComplete, showPaymentError, showPaymentTimeout, showAuthenticationGuidance]);

  /**
   * Reset payment state to initial values
   */
  const resetPaymentState = useCallback(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setPaymentState({
      isProcessing: false,
      isSubmitting: false,
      currentAttempt: 0,
      hasStarted: false,
      timeoutWarningShown: false,
      startTime: null,
      lastError: null,
    });

    // Reset context refs
    currentPaymentIntentRef.current = '';
    currentOrderIdRef.current = '';
    currentOrderNumberRef.current = '';
  }, []);

  /**
   * Cancel ongoing payment processing
   */
  const cancelPayment = useCallback(() => {
    console.log('🚫 Payment cancelled by user');
    
    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    resetPaymentState();
    showPaymentError({
      message: 'Payment cancelled',
      category: 'user_action',
      isRetryable: true,
      severity: 'low',
    });
  }, [resetPaymentState, showPaymentError]);

  /**
   * Setup timeout management for payment processing
   */
  const setupTimeouts = useCallback(() => {
    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    // Set warning timeout
    warningTimeoutRef.current = setTimeout(() => {
      const currentState = paymentStateRef.current;
      if (currentState.isProcessing && !currentState.timeoutWarningShown) {
        setPaymentState(prev => ({ ...prev, timeoutWarningShown: true }));
        showPaymentProcessing('Payment is taking longer than expected...');
      }
    }, warningTimeoutMs);

    // Set main timeout
    timeoutRef.current = setTimeout(() => {
      const currentState = paymentStateRef.current;
      if (currentState.isProcessing) {
        console.warn('⏰ Payment timeout reached');
        
        // Abort ongoing request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        const currentTimeElapsed = currentState.startTime ? Date.now() - currentState.startTime : 0;
        const timeoutError: PaymentError = {
          type: 'timeout_error',
          code: 'payment_timeout',
          message: PAYMENT_ERROR_MESSAGES.TIMEOUT_ERROR,
          category: 'network',
          isRetryable: true,
          severity: 'medium',
          timestamp: Date.now(),
          attempt: currentState.currentAttempt,
        };

        // Record timeout error in monitoring
        monitoring.recordPaymentError('timeout', {
          timeElapsed: currentTimeElapsed,
          paymentAttempt: currentState.currentAttempt,
          isRetryable: true,
        });

        setPaymentState(prev => ({
          ...prev,
          isProcessing: false,
          isSubmitting: false,
          lastError: timeoutError,
        }));

        onTimeout?.();
        showPaymentTimeout(currentTimeElapsed, enableRetry && currentState.currentAttempt < maxAttempts);
      }
    }, timeoutMs);
  }, [warningTimeoutMs, timeoutMs, onTimeout, showPaymentProcessing, showPaymentTimeout, enableRetry, maxAttempts]);

  /**
   * Core payment processing logic with retry mechanism
   */
  const processPaymentWithRetry = useCallback(async (
    formData: FormData,
    attemptNumber: number = 1
  ): Promise<PaymentResult> => {
    // Validate Stripe availability
    if (!stripe || !elements) {
      monitoring.recordValidationError('stripe_not_ready');
      const error: PaymentError = {
        type: 'stripe_not_ready',
        code: 'stripe_initialization_error',
        message: 'Payment system not ready. Please wait and try again.',
        category: 'validation',
        isRetryable: true,
        severity: 'medium',
        timestamp: Date.now(),
        attempt: attemptNumber,
      };
      return { success: false, error };
    }

    // Double-submission prevention
    if (enableDoubleSubmissionPrevention) {
      const now = Date.now();
      if (now - lastSubmissionRef.current < 1000) {
        monitoring.recordValidationError('double_submission');
        const error: PaymentError = {
          type: 'double_submission',
          code: 'double_submission_prevention',
          message: 'Please wait before trying again.',
          category: 'validation',
          isRetryable: true,
          severity: 'low',
          timestamp: now,
          attempt: attemptNumber,
        };
        return { success: false, error };
      }
      lastSubmissionRef.current = now;
    }

    // Update state for current attempt
    const startTime = Date.now();
    setPaymentState(prev => ({
      ...prev,
      isProcessing: true,
      isSubmitting: true,
      currentAttempt: attemptNumber,
      hasStarted: true,
      startTime: prev.startTime || startTime,
      lastError: null,
    }));

    // Start client-side payment processing timer
    const stopClientTimer = monitoring.startTimer('client.payment_processing');

    // Create abort controller for this attempt
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Setup timeouts for this attempt
    setupTimeouts();

    try {
      console.log(`🔄 Payment attempt ${attemptNumber}/${maxAttempts} started`);
      
      // Record payment attempt in monitoring
      monitoring.recordPaymentAttempt();
      if (attemptNumber > 1) {
        monitoring.recordPaymentRetry(attemptNumber, calculateRetryDelay(attemptNumber - 1));
      }
      
      // Notify callback
      onPaymentStart?.();
      if (attemptNumber > 1) {
        onRetryAttempt?.(attemptNumber, maxAttempts);
      }

      // Step 1: Create payment intent and order
      console.log('🔄 Creating payment intent and order...');
      const { clientSecret, orderId, orderNumber } = await createPaymentIntent(formData, signal);
      
      if (signal.aborted) {
        throw new Error('Payment was cancelled');
      }

      console.log(`✅ Payment intent created - Order: ${orderNumber}`);
      
      // Store context for error reporting
      currentPaymentIntentRef.current = clientSecret.split('_secret')[0]; // Extract PI ID from client secret
      currentOrderIdRef.current = orderId;
      currentOrderNumberRef.current = orderNumber;

      // Step 2: Confirm payment with Stripe
      console.log('🔄 Confirming payment with Stripe...');
      const paymentIntent = await confirmStripePayment(stripe, elements, clientSecret, formData, signal);
      
      if (signal.aborted) {
        throw new Error('Payment was cancelled');
      }

      console.log(`✅ Payment confirmed - PI: ${paymentIntent.id}, Status: ${paymentIntent.status}`);

      // Step 3: Verify payment success
      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment not completed. Status: ${paymentIntent.status}`);
      }

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Clear cart on successful payment
      clearCart();

      // Update state to success
      setPaymentState(prev => ({
        ...prev,
        isProcessing: false,
        isSubmitting: false,
      }));

      // Record payment success in monitoring
      monitoring.recordPaymentSuccess();

      // Success result
      const result: PaymentResult = {
        success: true,
        paymentIntent,
        metadata: {
          totalAttempts: attemptNumber,
          processingTime,
          retryable: false,
        },
      };

      // Notify callbacks
      onPaymentSuccess?.(result);
      showPaymentSuccess(PAYMENT_SUCCESS_MESSAGES.PAYMENT_SUCCEEDED);

      // Redirect to success page
      setTimeout(() => {
        showPaymentSuccess(PAYMENT_SUCCESS_MESSAGES.REDIRECT_MESSAGE);
        router.push('/checkout/success');
      }, 2000);

      console.log(`✅ Payment completed successfully in ${processingTime}ms`);
      return result;

    } catch (error) {
      console.error(`❌ Payment attempt ${attemptNumber} failed:`, error);

      // Calculate processing time for failed attempt
      const processingTime = Date.now() - startTime;

      // Categorize error
      let paymentError: PaymentError;
      
      if (error && typeof error === 'object' && 'category' in error) {
        // Already categorized Stripe error
        paymentError = {
          ...(error as PaymentError),
          attempt: attemptNumber,
          timestamp: Date.now(),
        };
      } else {
        // Categorize raw error
        const errorMessage = error instanceof Error ? error.message : 'Unknown payment error';
        const categorized = categorizeClientStripeError({
          type: 'unknown',
          message: errorMessage,
        } as any);

        paymentError = {
          type: 'unknown',
          message: errorMessage,
          category: categorized.category,
          isRetryable: categorized.isRetryable,
          severity: categorized.severity,
          timestamp: Date.now(),
          attempt: attemptNumber,
        };
      }

      // Record detailed payment failure tracking based on error type
      const failureDetails = {
        attemptNumber,
        processingTime,
        category: paymentError.category,
        isRetryable: paymentError.isRetryable,
        severity: paymentError.severity,
        code: paymentError.code,
        message: paymentError.message,
        formDataEmail: formData.email,
        timeElapsed: Date.now() - (paymentState.startTime || Date.now()),
        clientSide: true,
      };

      // Use enhanced failure tracking methods
      if (paymentError.code?.includes('card_declined') || paymentError.category === 'card') {
        monitoring.recordCardDecline(paymentError.code || 'generic_decline', failureDetails);
      } else if (paymentError.code?.includes('authentication') || paymentError.category === 'authentication') {
        monitoring.recordAuthenticationFailure(paymentError.code || 'authentication_failed', failureDetails);
      } else if (paymentError.code?.includes('timeout') || paymentError.category === 'network') {
        monitoring.recordNetworkTimeout('payment_processing', failureDetails);
      } else {
        // General payment failure tracking
        monitoring.recordPaymentFailure(paymentError.code || paymentError.type, failureDetails);
      }

      // Also record in legacy error tracking for backwards compatibility
      monitoring.recordPaymentError(paymentError.type, failureDetails);

      // Log error for monitoring (legacy logging)
      logClientError(error, {
        attemptNumber,
        processingTime,
        paymentState: paymentState,
        formDataEmail: formData.email,
      });

      // Update state with error
      setPaymentState(prev => ({
        ...prev,
        isProcessing: false,
        isSubmitting: false,
        lastError: paymentError,
      }));

      // Determine if we should retry
      const shouldRetry = enableRetry && 
                         attemptNumber < maxAttempts && 
                         paymentError.isRetryable &&
                         !signal.aborted;

      if (shouldRetry) {
        // Calculate retry delay
        const retryDelay = calculateRetryDelay(attemptNumber);
        console.log(`⏳ Retrying in ${retryDelay}ms (attempt ${attemptNumber + 1}/${maxAttempts})`);
        
        showPaymentRetry(attemptNumber + 1, maxAttempts, retryDelay);

        // Wait for retry delay
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Check if payment was cancelled during delay
        if (signal.aborted) {
          return {
            success: false,
            error: {
              type: 'cancelled',
              message: 'Payment was cancelled',
              category: 'validation',
              isRetryable: false,
              severity: 'low',
              timestamp: Date.now(),
              attempt: attemptNumber,
            },
          };
        }

        // Recursive retry
        return processPaymentWithRetry(formData, attemptNumber + 1);
      } else {
        // No more retries or not retryable
        const finalError = attemptNumber >= maxAttempts ? 
          {
            ...paymentError,
            message: PAYMENT_ERROR_MESSAGES.RETRY_EXHAUSTED,
          } : paymentError;

        // Notify callbacks
        onPaymentError?.(finalError);
        showPaymentError({
          message: finalError.message,
          category: finalError.category,
          isRetryable: finalError.isRetryable,
          severity: finalError.severity,
          code: finalError.code,
        });

        // Redirect to error page with specific error information after a short delay
        setTimeout(() => {
          const errorParams = new URLSearchParams({
            error: finalError.message,
            ...(finalError.code && { error_code: finalError.code }),
            ...(currentPaymentIntentRef.current && { payment_intent: currentPaymentIntentRef.current }),
            ...(currentOrderIdRef.current && { order_id: currentOrderIdRef.current }),
            ...(currentOrderNumberRef.current && { order_number: currentOrderNumberRef.current }),
          });

          router.push(`/checkout/error?${errorParams.toString()}`);
        }, 3000); // Show error message for 3 seconds before redirecting

        const result: PaymentResult = {
          success: false,
          error: finalError,
          metadata: {
            totalAttempts: attemptNumber,
            processingTime,
            retryable: shouldRetry,
          },
        };

        return result;
      }
    } finally {
      // Stop client timer (handles both success and error cases)
      stopClientTimer();
      
      // Clear timeouts for this attempt
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
    }
  }, [
    stripe, 
    elements, 
    enableDoubleSubmissionPrevention, 
    enableRetry, 
    maxAttempts, 
    createPaymentIntent, 
    confirmStripePayment, 
    setupTimeouts, 
    clearCart, 
    onPaymentStart, 
    onRetryAttempt, 
    onPaymentSuccess, 
    onPaymentError, 
    showPaymentProcessing,
    showPaymentRetry,
    showPaymentSuccess,
    showPaymentError,
    showAuthenticationRequired,
    showAuthenticationProgress,
    showAuthenticationGuidance,
    showSecureAuthenticationStart,
    showSecureAuthenticationComplete,
    showPaymentTimeout,
    updatePaymentProgress,
    hideToast,
    router
  ]);

  /**
   * Main process payment function
   */
  const processPayment = useCallback(async (formData: FormData): Promise<PaymentResult> => {
    // Reset state before starting new payment
    resetPaymentState();
    
    // Start payment processing
    return processPaymentWithRetry(formData, 1);
  }, [resetPaymentState, processPaymentWithRetry]);

  /**
   * Retry payment function
   */
  const retryPayment = useCallback(async (): Promise<PaymentResult> => {
    if (!canRetry) {
      const error: PaymentError = {
        type: 'retry_not_allowed',
        code: 'retry_limit_exceeded',
        message: 'Retry not available for this payment',
        category: 'validation',
        isRetryable: false,
        severity: 'low',
        timestamp: Date.now(),
        attempt: paymentState.currentAttempt,
      };
      return { success: false, error };
    }

    // Get the last form data from session storage or require new form submission
    // For now, we'll require the user to resubmit the form
    const error: PaymentError = {
      type: 'retry_requires_resubmission',
      code: 'form_resubmission_required',
      message: 'Please resubmit the payment form to retry',
      category: 'validation',
      subCategory: 'card_validation',
      isRetryable: true,
      severity: 'low',
      timestamp: Date.now(),
      attempt: paymentState.currentAttempt,
    };
    
    showPaymentError({
      message: 'Please resubmit the form to retry payment',
      category: 'validation',
      isRetryable: true,
      severity: 'low',
    });
    return { success: false, error };
  }, [canRetry, paymentState.currentAttempt, showPaymentError]);

  return {
    // State
    paymentState,
    
    // Actions
    processPayment,
    retryPayment,
    cancelPayment,
    resetPaymentState,
    
    // Utilities
    canRetry,
    timeElapsed,
    isTimeout,
  };
};

export default useStripePayment;