/**
 * Cart Clearing Utilities
 * 
 * Handles server-side cart clearing functionality for webhooks and post-payment processing.
 * Since cart data is stored in localStorage client-side, we use session-based clearing approaches.
 */

import { Order } from '@/types/order';
import { monitoring } from '@/utils/monitoring';
import { CART_STORAGE_KEY } from '@/constants/storage';

/**
 * Cart clearing result interface
 */
export interface CartClearingResult {
  success: boolean;
  method: 'session_based' | 'order_context' | 'failed';
  error?: string;
  sessionId?: string;
  orderId?: string;
  timestamp: string;
}

/**
 * Cart clearing request interface
 */
export interface CartClearingRequest {
  orderId: string;
  sessionId?: string;
  reason: string;
  source: 'webhook' | 'api' | 'manual';
}

/**
 * Clear cart after successful payment via webhook
 * 
 * Since cart data is stored client-side in localStorage, we use a session-based approach
 * where we store cart clearing flags that can be checked by the client.
 */
export async function clearCartAfterPayment(
  order: Order,
  reason: string = 'Payment successful'
): Promise<CartClearingResult> {
  const timestamp = new Date().toISOString();
  const sessionId = order.metadata?.sessionId;
  
  try {
    // Record cart clearing attempt
    monitoring.recordEvent('cart_clearing_attempted', {
      orderId: order.id,
      sessionId: sessionId || 'unknown',
      hasSessionId: !!sessionId,
      reason,
    });

    // If we have a sessionId, use session-based clearing
    if (sessionId) {
      const sessionResult = await clearCartBySession(sessionId, order.id, reason);
      
      if (sessionResult.success) {
        monitoring.recordEvent('cart_clearing_success', {
          orderId: order.id,
          sessionId,
          method: 'session_based',
          reason,
        });
        
        return {
          success: true,
          method: 'session_based',
          sessionId,
          orderId: order.id,
          timestamp,
        };
      }
    }

    // Fallback: Store order-based clearing flag (for client to check)
    const orderResult = await clearCartByOrder(order.id, reason);
    
    if (orderResult.success) {
      monitoring.recordEvent('cart_clearing_success', {
        orderId: order.id,
        sessionId: sessionId || 'none',
        method: 'order_context',
        reason,
      });
      
      return {
        success: true,
        method: 'order_context',
        sessionId,
        orderId: order.id,
        timestamp,
      };
    }

    // If all methods fail
    const error = 'All cart clearing methods failed';
    monitoring.recordEvent('cart_clearing_failed', {
      orderId: order.id,
      sessionId: sessionId || 'none',
      error,
      reason,
    });

    return {
      success: false,
      method: 'failed',
      error,
      sessionId,
      orderId: order.id,
      timestamp,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    monitoring.recordEvent('cart_clearing_error', {
      orderId: order.id,
      sessionId: sessionId || 'none',
      error: errorMessage,
      reason,
    });

    return {
      success: false,
      method: 'failed',
      error: `Cart clearing failed: ${errorMessage}`,
      sessionId,
      orderId: order.id,
      timestamp,
    };
  }
}

/**
 * Clear cart using session-based approach
 * 
 * Stores a clearing flag that can be checked by the client on next load.
 * This works by storing session-specific clearing instructions.
 */
async function clearCartBySession(
  sessionId: string,
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, this would use Redis, database, or similar storage
    // For now, we'll use a memory-based approach that could be extended
    
    // Store the clearing instruction with expiration (24 hours)
    const clearingInstruction = {
      sessionId,
      orderId,
      reason,
      action: 'clear_cart',
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    // In memory storage for this implementation
    // This should be replaced with Redis or similar in production
    if (typeof globalThis !== 'undefined') {
      if (!globalThis.__cartClearingInstructions) {
        globalThis.__cartClearingInstructions = new Map();
      }
      
      globalThis.__cartClearingInstructions.set(sessionId, clearingInstruction);
      
      // Clean up expired entries
      cleanupExpiredClearingInstructions();
    }

    console.log(`[TARGET] Cart clearing instruction stored for session: ${sessionId}, order: ${orderId}`);
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      error: `Session-based clearing failed: ${errorMessage}` 
    };
  }
}

/**
 * Clear cart using order-based approach
 * 
 * Stores clearing instructions that can be checked by order ID.
 * This is a fallback when session ID is not available.
 */
async function clearCartByOrder(
  orderId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Store order-based clearing instruction
    const clearingInstruction = {
      orderId,
      reason,
      action: 'clear_cart',
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    // In memory storage for this implementation
    if (typeof globalThis !== 'undefined') {
      if (!globalThis.__orderClearingInstructions) {
        globalThis.__orderClearingInstructions = new Map();
      }
      
      globalThis.__orderClearingInstructions.set(orderId, clearingInstruction);
      
      // Clean up expired entries
      cleanupExpiredClearingInstructions();
    }

    console.log(`[TARGET] Cart clearing instruction stored for order: ${orderId}`);
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { 
      success: false, 
      error: `Order-based clearing failed: ${errorMessage}` 
    };
  }
}

/**
 * Check if cart should be cleared for a given session or order
 * 
 * This function can be called by the client to check if the cart should be cleared.
 */
export function checkCartClearingInstructions(
  sessionId?: string,
  orderId?: string
): { shouldClear: boolean; instruction?: any; reason?: string } {
  try {
    // Check session-based instructions first
    if (sessionId && typeof globalThis !== 'undefined' && globalThis.__cartClearingInstructions) {
      const instruction = globalThis.__cartClearingInstructions.get(sessionId);
      if (instruction && new Date(instruction.expiresAt) > new Date()) {
        // Remove the instruction after checking (one-time use)
        globalThis.__cartClearingInstructions.delete(sessionId);
        
        return {
          shouldClear: true,
          instruction,
          reason: instruction.reason,
        };
      }
    }

    // Check order-based instructions as fallback
    if (orderId && typeof globalThis !== 'undefined' && globalThis.__orderClearingInstructions) {
      const instruction = globalThis.__orderClearingInstructions.get(orderId);
      if (instruction && new Date(instruction.expiresAt) > new Date()) {
        // Remove the instruction after checking (one-time use)
        globalThis.__orderClearingInstructions.delete(orderId);
        
        return {
          shouldClear: true,
          instruction,
          reason: instruction.reason,
        };
      }
    }

    return { shouldClear: false };
    
  } catch (error) {
    console.error('Error checking cart clearing instructions:', error);
    return { shouldClear: false };
  }
}

/**
 * Clean up expired clearing instructions to prevent memory leaks
 */
function cleanupExpiredClearingInstructions(): void {
  try {
    const now = new Date();
    
    // Clean up session-based instructions
    if (typeof globalThis !== 'undefined' && globalThis.__cartClearingInstructions) {
      for (const [sessionId, instruction] of globalThis.__cartClearingInstructions.entries()) {
        if (new Date(instruction.expiresAt) <= now) {
          globalThis.__cartClearingInstructions.delete(sessionId);
        }
      }
    }
    
    // Clean up order-based instructions
    if (typeof globalThis !== 'undefined' && globalThis.__orderClearingInstructions) {
      for (const [orderId, instruction] of globalThis.__orderClearingInstructions.entries()) {
        if (new Date(instruction.expiresAt) <= now) {
          globalThis.__orderClearingInstructions.delete(orderId);
        }
      }
    }
    
  } catch (error) {
    console.error('Error cleaning up cart clearing instructions:', error);
  }
}

/**
 * Get cart clearing statistics for monitoring
 */
export function getCartClearingStats(): {
  sessionInstructions: number;
  orderInstructions: number;
  oldestSessionInstruction?: string;
  oldestOrderInstruction?: string;
} {
  const stats = {
    sessionInstructions: 0,
    orderInstructions: 0,
    oldestSessionInstruction: undefined as string | undefined,
    oldestOrderInstruction: undefined as string | undefined,
  };

  try {
    // Count session instructions
    if (typeof globalThis !== 'undefined' && globalThis.__cartClearingInstructions) {
      stats.sessionInstructions = globalThis.__cartClearingInstructions.size;
      
      let oldestTimestamp = '';
      for (const instruction of globalThis.__cartClearingInstructions.values()) {
        if (!oldestTimestamp || instruction.timestamp < oldestTimestamp) {
          oldestTimestamp = instruction.timestamp;
        }
      }
      stats.oldestSessionInstruction = oldestTimestamp || undefined;
    }

    // Count order instructions
    if (typeof globalThis !== 'undefined' && globalThis.__orderClearingInstructions) {
      stats.orderInstructions = globalThis.__orderClearingInstructions.size;
      
      let oldestTimestamp = '';
      for (const instruction of globalThis.__orderClearingInstructions.values()) {
        if (!oldestTimestamp || instruction.timestamp < oldestTimestamp) {
          oldestTimestamp = instruction.timestamp;
        }
      }
      stats.oldestOrderInstruction = oldestTimestamp || undefined;
    }
    
  } catch (error) {
    console.error('Error getting cart clearing stats:', error);
  }

  return stats;
}

/**
 * Manual cart clearing for administrative purposes
 */
export async function manualCartClearing(request: CartClearingRequest): Promise<CartClearingResult> {
  const timestamp = new Date().toISOString();
  
  try {
    monitoring.recordEvent('manual_cart_clearing_attempted', {
      orderId: request.orderId,
      sessionId: request.sessionId || 'none',
      reason: request.reason,
      source: request.source,
    });

    // If session ID provided, use session-based clearing
    if (request.sessionId) {
      const result = await clearCartBySession(request.sessionId, request.orderId, request.reason);
      
      if (result.success) {
        return {
          success: true,
          method: 'session_based',
          sessionId: request.sessionId,
          orderId: request.orderId,
          timestamp,
        };
      }
    }

    // Fallback to order-based clearing
    const result = await clearCartByOrder(request.orderId, request.reason);
    
    if (result.success) {
      return {
        success: true,
        method: 'order_context',
        sessionId: request.sessionId,
        orderId: request.orderId,
        timestamp,
      };
    }

    return {
      success: false,
      method: 'failed',
      error: 'Manual cart clearing failed',
      sessionId: request.sessionId,
      orderId: request.orderId,
      timestamp,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      method: 'failed',
      error: `Manual cart clearing failed: ${errorMessage}`,
      sessionId: request.sessionId,
      orderId: request.orderId,
      timestamp,
    };
  }
}

// Type augmentation for global cart clearing storage
declare global {
  var __cartClearingInstructions: Map<string, any> | undefined;
  var __orderClearingInstructions: Map<string, any> | undefined;
}