/**
 * Cart Clearing Resilience Hook
 * 
 * Implements robust cart clearing with multiple fallback strategies:
 * 1. Server-side clearing instructions (primary)
 * 2. Local storage timestamps with order completion detection
 * 3. Payment completion tracking with session validation
 * 4. Manual user-initiated clearing with confirmation
 * 
 * This ensures carts are reliably cleared even if webhook processing fails.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { CART_STORAGE_KEY, ORDER_COMPLETION_KEY } from '@/constants/storage';

interface CartClearingState {
  isChecking: boolean;
  hasChecked: boolean;
  shouldClear: boolean;
  clearingMethod?: 'server_instruction' | 'order_completion' | 'payment_verification' | 'manual_fallback';
  lastCheckTimestamp?: string;
  pendingOrderId?: string;
  clearingReason?: string;
}

interface OrderCompletionRecord {
  orderId: string;
  orderNumber: string;
  completedAt: string;
  paymentIntentId?: string;
  sessionId?: string;
  amount: number;
  currency: string;
}

export interface CartClearingOptions {
  enableAutoCheck?: boolean;
  checkInterval?: number;
  maxRetryAttempts?: number;
  enableManualFallback?: boolean;
  onClearingDetected?: (method: string, reason: string) => void;
  onClearingCompleted?: (success: boolean, method: string) => void;
  onClearingFailed?: (error: string, method: string) => void;
}

export const useCartClearingResilience = (options: CartClearingOptions = {}) => {
  const router = useRouter();
  const { clearCart, cartItems } = useCart();
  const {
    enableAutoCheck = true,
    checkInterval = 5000, // 5 seconds
    maxRetryAttempts = 3,
    enableManualFallback = true,
    onClearingDetected,
    onClearingCompleted,
    onClearingFailed,
  } = options;

  const [clearingState, setClearingState] = useState<CartClearingState>({
    isChecking: false,
    hasChecked: false,
    shouldClear: false,
  });

  const retryCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastOrderCheckRef = useRef<string>('');

  /**
   * Get current session ID from sessionStorage
   */
  const getCurrentSessionId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('checkout_session_id');
  }, []);

  /**
   * Check for server-side clearing instructions
   */
  const checkServerClearingInstructions = useCallback(async (
    sessionId?: string,
    orderId?: string
  ): Promise<{ shouldClear: boolean; instruction?: any; reason?: string }> => {
    try {
      const params = new URLSearchParams();
      if (sessionId) params.set('session_id', sessionId);
      if (orderId) params.set('order_id', orderId);

      const response = await fetch(`/api/cart/check-clearing?${params.toString()}`);
      
      if (response.ok) {
        const result = await response.json();
        return {
          shouldClear: result.shouldClear || false,
          instruction: result.instruction,
          reason: result.reason,
        };
      }
      
      return { shouldClear: false };
    } catch (error) {
      console.warn('Failed to check server clearing instructions:', error);
      return { shouldClear: false };
    }
  }, []);

  /**
   * Check for completed orders in localStorage
   */
  const checkOrderCompletionRecords = useCallback((): { shouldClear: boolean; record?: OrderCompletionRecord; reason?: string } => {
    if (typeof window === 'undefined') return { shouldClear: false };

    try {
      const completionRecords = localStorage.getItem(ORDER_COMPLETION_KEY);
      if (!completionRecords) return { shouldClear: false };

      const records: OrderCompletionRecord[] = JSON.parse(completionRecords);
      const currentSessionId = getCurrentSessionId();
      
      // Look for recent completions (within last 10 minutes)
      const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      for (const record of records) {
        if (record.completedAt > recentCutoff) {
          // Check if this record matches current session or is recent enough
          const matchesSession = currentSessionId && record.sessionId === currentSessionId;
          const isVeryRecent = record.completedAt > new Date(Date.now() - 2 * 60 * 1000).toISOString();
          
          if (matchesSession || isVeryRecent) {
            // Mark this record as processed
            const updatedRecords = records.filter(r => r.orderId !== record.orderId);
            localStorage.setItem(ORDER_COMPLETION_KEY, JSON.stringify(updatedRecords));
            
            return {
              shouldClear: true,
              record,
              reason: `Order ${record.orderNumber} completed successfully`,
            };
          }
        }
      }

      // Clean up old records (older than 1 hour)
      const oldCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const freshRecords = records.filter(r => r.completedAt > oldCutoff);
      if (freshRecords.length !== records.length) {
        localStorage.setItem(ORDER_COMPLETION_KEY, JSON.stringify(freshRecords));
      }

      return { shouldClear: false };
    } catch (error) {
      console.error('Error checking order completion records:', error);
      return { shouldClear: false };
    }
  }, [getCurrentSessionId]);

  /**
   * Verify payment completion by checking recent navigation
   */
  const checkPaymentCompletionContext = useCallback((): { shouldClear: boolean; reason?: string } => {
    if (typeof window === 'undefined') return { shouldClear: false };

    try {
      // Check if we recently came from success page
      const referrer = document.referrer;
      const currentPath = window.location.pathname;
      
      // If we're on the home page and came from success page, clear cart
      if (currentPath === '/' && referrer.includes('/checkout/success')) {
        return {
          shouldClear: true,
          reason: 'Navigated from payment success page',
        };
      }

      // Check for success page parameters in current URL
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success' || urlParams.get('order') === 'completed') {
        return {
          shouldClear: true,
          reason: 'Payment completion detected from URL parameters',
        };
      }

      return { shouldClear: false };
    } catch (error) {
      console.error('Error checking payment completion context:', error);
      return { shouldClear: false };
    }
  }, []);

  /**
   * Record order completion for future cart clearing
   */
  const recordOrderCompletion = useCallback((orderDetails: {
    orderId: string;
    orderNumber: string;
    paymentIntentId?: string;
    amount: number;
    currency: string;
  }) => {
    if (typeof window === 'undefined') return;

    try {
      const currentSessionId = getCurrentSessionId();
      const completionRecord: OrderCompletionRecord = {
        ...orderDetails,
        completedAt: new Date().toISOString(),
        ...(currentSessionId ? { sessionId: currentSessionId } : {}),
      };

      const existingRecords = localStorage.getItem(ORDER_COMPLETION_KEY);
      const records: OrderCompletionRecord[] = existingRecords ? JSON.parse(existingRecords) : [];
      
      // Add new record and keep only last 10 records
      records.unshift(completionRecord);
      const trimmedRecords = records.slice(0, 10);
      
      localStorage.setItem(ORDER_COMPLETION_KEY, JSON.stringify(trimmedRecords));
      
      console.log('[TARGET] Order completion recorded for cart clearing:', orderDetails.orderNumber);
    } catch (error) {
      console.error('Error recording order completion:', error);
    }
  }, [getCurrentSessionId]);

  /**
   * Perform comprehensive cart clearing check
   */
  const performCartClearingCheck = useCallback(async (): Promise<void> => {
    if (clearingState.isChecking || !cartItems?.length) return;

    setClearingState(prev => ({ ...prev, isChecking: true }));

    try {
      const sessionId = getCurrentSessionId();
      
      // Method 1: Check server-side clearing instructions
      const serverCheck = await checkServerClearingInstructions(sessionId || undefined, clearingState.pendingOrderId);
      
      if (serverCheck.shouldClear) {
        setClearingState(prev => ({
          ...prev,
          isChecking: false,
          hasChecked: true,
          shouldClear: true,
          clearingMethod: 'server_instruction',
          ...(serverCheck.reason ? { clearingReason: serverCheck.reason } : {}),
          lastCheckTimestamp: new Date().toISOString(),
        }));
        
        onClearingDetected?.('server_instruction', serverCheck.reason || 'Server clearing instruction');
        return;
      }

      // Method 2: Check order completion records
      const orderCheck = checkOrderCompletionRecords();
      
      if (orderCheck.shouldClear) {
        setClearingState(prev => ({
          ...prev,
          isChecking: false,
          hasChecked: true,
          shouldClear: true,
          clearingMethod: 'order_completion',
          ...(orderCheck.reason ? { clearingReason: orderCheck.reason } : {}),
          lastCheckTimestamp: new Date().toISOString(),
        }));
        
        onClearingDetected?.('order_completion', orderCheck.reason || 'Order completion detected');
        return;
      }

      // Method 3: Check payment completion context
      const paymentCheck = checkPaymentCompletionContext();
      
      if (paymentCheck.shouldClear) {
        setClearingState(prev => ({
          ...prev,
          isChecking: false,
          hasChecked: true,
          shouldClear: true,
          clearingMethod: 'payment_verification',
          ...(paymentCheck.reason ? { clearingReason: paymentCheck.reason } : {}),
          lastCheckTimestamp: new Date().toISOString(),
        }));
        
        onClearingDetected?.('payment_verification', paymentCheck.reason || 'Payment completion verified');
        return;
      }

      // No clearing needed
      setClearingState(prev => ({
        ...prev,
        isChecking: false,
        hasChecked: true,
        lastCheckTimestamp: new Date().toISOString(),
      }));

      retryCountRef.current = 0; // Reset retry count on successful check

    } catch (error) {
      console.error('Cart clearing check failed:', error);
      
      retryCountRef.current += 1;
      
      if (retryCountRef.current >= maxRetryAttempts) {
        onClearingFailed?.(
          error instanceof Error ? error.message : 'Unknown error',
          'check_failure'
        );
      }
      
      setClearingState(prev => ({
        ...prev,
        isChecking: false,
        lastCheckTimestamp: new Date().toISOString(),
      }));
    }
  }, [
    clearingState.isChecking,
    clearingState.pendingOrderId,
    cartItems,
    getCurrentSessionId,
    checkServerClearingInstructions,
    checkOrderCompletionRecords,
    checkPaymentCompletionContext,
    maxRetryAttempts,
    onClearingDetected,
    onClearingFailed,
  ]);

  /**
   * Execute cart clearing
   */
  const executeClearCart = useCallback(async (): Promise<boolean> => {
    try {
      clearCart();
      
      // Clear any pending clearing flags
      setClearingState(prev => {
        const { clearingMethod, clearingReason, ...rest } = prev;
        return { ...rest, shouldClear: false };
      });

      onClearingCompleted?.(true, clearingState.clearingMethod || 'unknown');
      
      console.log(`[TARGET] Cart cleared successfully via ${clearingState.clearingMethod}`);
      return true;
      
    } catch (error) {
      console.error('Cart clearing execution failed:', error);
      onClearingFailed?.(
        error instanceof Error ? error.message : 'Unknown error',
        clearingState.clearingMethod || 'execution'
      );
      onClearingCompleted?.(false, clearingState.clearingMethod || 'unknown');
      return false;
    }
  }, [clearCart, clearingState.clearingMethod, onClearingCompleted, onClearingFailed]);

  /**
   * Manual fallback clearing (user-initiated)
   */
  const manualClearCart = useCallback(async (reason: string = 'Manual user action'): Promise<boolean> => {
    setClearingState(prev => ({
      ...prev,
      shouldClear: true,
      clearingMethod: 'manual_fallback',
      clearingReason: reason,
    }));

    return executeClearCart();
  }, [executeClearCart]);

  /**
   * Set pending order for targeted clearing checks
   */
  const setPendingOrder = useCallback((orderId: string) => {
    setClearingState(prev => ({ ...prev, pendingOrderId: orderId }));
  }, []);

  // Automatic clearing check effect
  useEffect(() => {
    if (!enableAutoCheck || !cartItems?.length) return;

    // Initial check
    performCartClearingCheck();

    // Set up interval for continuous checking
    if (checkInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (retryCountRef.current < maxRetryAttempts) {
          performCartClearingCheck();
        }
      }, checkInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enableAutoCheck, cartItems?.length, checkInterval, maxRetryAttempts, performCartClearingCheck]);

  // Auto-execute clearing when detected
  useEffect(() => {
    if (clearingState.shouldClear && cartItems?.length) {
      executeClearCart();
    }
  }, [clearingState.shouldClear, cartItems?.length, executeClearCart]);

  return {
    // State
    clearingState,
    
    // Actions
    performCartClearingCheck,
    executeClearCart,
    manualClearCart,
    recordOrderCompletion,
    setPendingOrder,
    
    // Utilities
    isCartEmpty: !cartItems?.length,
    canManualClear: enableManualFallback && cartItems?.length > 0,
    retryCount: retryCountRef.current,
    maxRetries: maxRetryAttempts,
  };
};

export default useCartClearingResilience;