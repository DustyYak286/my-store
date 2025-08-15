/**
 * Cart Clearing Hook
 * 
 * Provides client-side cart clearing functionality that integrates with
 * server-side webhook clearing instructions.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useCart } from '@/context/CartContext';
import { ORDER_COMPLETION_KEY } from '@/constants/storage';

interface CartClearingState {
  isChecking: boolean;
  lastCheck?: Date;
  error?: string;
  fallbackAttempts?: number;
  clearingMethod?: string;
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

interface CartClearingCheckResponse {
  success: boolean;
  shouldClear: boolean;
  reason?: string;
  instruction?: {
    action: string;
    timestamp: string;
  };
  error?: string;
}

/**
 * Hook for handling cart clearing based on server instructions with resilient fallbacks
 */
export function useCartClearing() {
  const { clearCart, cartItems } = useCart();
  const [state, setState] = useState<CartClearingState>({
    isChecking: false,
    fallbackAttempts: 0,
  });
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check for completed orders in localStorage as fallback
   */
  const checkOrderCompletionRecords = useCallback((): { shouldClear: boolean; record?: OrderCompletionRecord; reason?: string } => {
    if (typeof window === 'undefined') return { shouldClear: false };

    try {
      const completionRecords = localStorage.getItem(ORDER_COMPLETION_KEY);
      if (!completionRecords) return { shouldClear: false };

      const records: OrderCompletionRecord[] = JSON.parse(completionRecords);
      const currentSessionId = typeof window !== 'undefined' ? sessionStorage.getItem('checkout_session_id') : null;
      
      // Look for recent completions (within last 5 minutes for fallback)
      const recentCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      for (const record of records) {
        if (record.completedAt > recentCutoff) {
          // Check if this record matches current session or is very recent
          const matchesSession = currentSessionId && record.sessionId === currentSessionId;
          const isVeryRecent = record.completedAt > new Date(Date.now() - 2 * 60 * 1000).toISOString();
          
          if (matchesSession || isVeryRecent) {
            // Mark this record as processed
            const updatedRecords = records.filter(r => r.orderId !== record.orderId);
            localStorage.setItem(ORDER_COMPLETION_KEY, JSON.stringify(updatedRecords));
            
            return {
              shouldClear: true,
              record,
              reason: `Fallback: Order ${record.orderNumber} completed`,
            };
          }
        }
      }

      return { shouldClear: false };
    } catch (error) {
      console.error('Error checking order completion records:', error);
      return { shouldClear: false };
    }
  }, []);

  /**
   * Check payment completion context as secondary fallback
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
          reason: 'Fallback: Navigated from payment success page',
        };
      }

      // Check for success page parameters in current URL
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success' || urlParams.get('order') === 'completed') {
        return {
          shouldClear: true,
          reason: 'Fallback: Payment completion detected from URL',
        };
      }

      return { shouldClear: false };
    } catch (error) {
      console.error('Error checking payment completion context:', error);
      return { shouldClear: false };
    }
  }, []);

  /**
   * Try fallback clearing methods when server instructions are not available
   */
  const tryFallbackClearingMethods = useCallback(async (
    sessionId?: string,
    orderId?: string
  ): Promise<boolean> => {
    // Only try fallbacks if we have cart items to clear
    if (!cartItems?.length) return false;

    setState(prev => ({ 
      ...prev, 
      fallbackAttempts: (prev.fallbackAttempts || 0) + 1 
    }));

    // Method 1: Check order completion records
    const orderCheck = checkOrderCompletionRecords();
    if (orderCheck.shouldClear) {
      console.log(`🧹 ${orderCheck.reason}`);
      clearCart();
      
      setState(prev => ({
        ...prev,
        isChecking: false,
        lastCheck: new Date(),
        clearingMethod: 'order_completion_fallback',
      }));
      
      return true;
    }

    // Method 2: Check payment completion context
    const paymentCheck = checkPaymentCompletionContext();
    if (paymentCheck.shouldClear) {
      console.log(`🧹 ${paymentCheck.reason}`);
      clearCart();
      
      setState(prev => ({
        ...prev,
        isChecking: false,
        lastCheck: new Date(),
        clearingMethod: 'context_fallback',
      }));
      
      return true;
    }

    return false;
  }, [cartItems, clearCart, checkOrderCompletionRecords, checkPaymentCompletionContext]);

  /**
   * Check for cart clearing instructions from the server
   */
  const checkClearingInstructions = useCallback(async (
    sessionId?: string,
    orderId?: string
  ): Promise<boolean> => {
    // Don't check if no identifiers provided
    if (!sessionId && !orderId) {
      return false;
    }

    setState(prev => ({ ...prev, isChecking: true, error: undefined }));

    try {
      const params = new URLSearchParams();
      if (sessionId) params.set('sessionId', sessionId);
      if (orderId) params.set('orderId', orderId);

      const response = await fetch(`/api/cart/check-clearing?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CartClearingCheckResponse = await response.json();

      if (data.success && data.shouldClear) {
        console.log(`🧹 Clearing cart based on server instruction: ${data.reason}`);
        clearCart();
        
        setState(prev => ({
          ...prev,
          isChecking: false,
          lastCheck: new Date(),
          clearingMethod: 'server_instruction',
        }));
        
        return true;
      }

      // If server doesn't have instructions, try fallback methods
      const fallbackResult = await tryFallbackClearingMethods(sessionId, orderId);
      if (fallbackResult) {
        return true;
      }

      setState(prev => ({
        ...prev,
        isChecking: false,
        lastCheck: new Date(),
      }));

      return false;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking cart clearing instructions:', error);
      
      setState(prev => ({
        ...prev,
        isChecking: false,
        error: errorMessage,
        lastCheck: new Date(),
      }));

      return false;
    }
  }, [clearCart]);

  /**
   * Auto-check cart clearing on mount and when session/order info is available
   */
  const autoCheckClearing = useCallback(() => {
    // Get session ID from sessionStorage if available
    const sessionId = typeof window !== 'undefined' 
      ? sessionStorage.getItem('checkout_session_id') 
      : null;

    // Get order ID from URL or other sources
    const urlParams = typeof window !== 'undefined' 
      ? new URLSearchParams(window.location.search) 
      : null;
    const orderId = urlParams?.get('order_id');

    if (sessionId || orderId) {
      checkClearingInstructions(sessionId || undefined, orderId || undefined);
    }
  }, [checkClearingInstructions]);

  /**
   * Check clearing instructions on component mount
   */
  useEffect(() => {
    autoCheckClearing();
  }, [autoCheckClearing]);

  /**
   * Record order completion for future cart clearing (fallback mechanism)
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
      const currentSessionId = sessionStorage.getItem('checkout_session_id');
      const completionRecord: OrderCompletionRecord = {
        ...orderDetails,
        completedAt: new Date().toISOString(),
        sessionId: currentSessionId || undefined,
      };

      const existingRecords = localStorage.getItem(ORDER_COMPLETION_KEY);
      const records: OrderCompletionRecord[] = existingRecords ? JSON.parse(existingRecords) : [];
      
      // Add new record and keep only last 5 records
      records.unshift(completionRecord);
      const trimmedRecords = records.slice(0, 5);
      
      localStorage.setItem(ORDER_COMPLETION_KEY, JSON.stringify(trimmedRecords));
      
      console.log('📦 Order completion recorded for cart clearing resilience:', orderDetails.orderNumber);
    } catch (error) {
      console.error('Error recording order completion:', error);
    }
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    checkClearingInstructions,
    autoCheckClearing,
    recordOrderCompletion,
    isChecking: state.isChecking,
    lastCheck: state.lastCheck,
    error: state.error,
    fallbackAttempts: state.fallbackAttempts || 0,
    clearingMethod: state.clearingMethod,
  };
}

/**
 * Hook for manual cart clearing checks (e.g., on success page)
 */
export function useCartClearingCheck() {
  const { clearCart } = useCart();
  
  const checkAndClearIfNeeded = useCallback(async (
    sessionId?: string,
    orderId?: string
  ): Promise<{ cleared: boolean; reason?: string; error?: string }> => {
    if (!sessionId && !orderId) {
      return { cleared: false, error: 'No session or order ID provided' };
    }

    try {
      const params = new URLSearchParams();
      if (sessionId) params.set('sessionId', sessionId);
      if (orderId) params.set('orderId', orderId);

      const response = await fetch(`/api/cart/check-clearing?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CartClearingCheckResponse = await response.json();

      if (data.success && data.shouldClear) {
        clearCart();
        return { cleared: true, reason: data.reason };
      }

      return { cleared: false };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { cleared: false, error: errorMessage };
    }
  }, [clearCart]);

  return {
    checkAndClearIfNeeded,
  };
}