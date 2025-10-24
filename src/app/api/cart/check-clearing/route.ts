/**
 * Cart Clearing Check API
 * 
 * GET /api/cart/check-clearing
 * 
 * Allows clients to check if their cart should be cleared based on session or order context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkCartClearingInstructions, getCartClearingStats } from '@/utils/cartClearing';
import { monitoring } from '@/utils/monitoring';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = `cart_check_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const orderId = searchParams.get('orderId');
    
    // Validate that at least one identifier is provided
    if (!sessionId && !orderId) {
      return NextResponse.json({
        success: false,
        error: 'Either sessionId or orderId must be provided',
        shouldClear: false,
      }, { status: 400 });
    }

    // Record the check attempt
    monitoring.recordEvent('cart_clearing_check_attempted', {
      requestId,
      sessionId: sessionId || 'none',
      orderId: orderId || 'none',
      hasSessionId: !!sessionId,
      hasOrderId: !!orderId,
    });

    // Check for clearing instructions
    const clearingCheck = checkCartClearingInstructions(
      sessionId || undefined,
      orderId || undefined
    );

    // Record the result
    monitoring.recordEvent('cart_clearing_check_completed', {
      requestId,
      sessionId: sessionId || 'none',
      orderId: orderId || 'none',
      shouldClear: clearingCheck.shouldClear,
      reason: clearingCheck.reason || 'none',
    });

    if (clearingCheck.shouldClear) {
      console.log(`[CLEAR] Cart clearing check: CLEAR cart for session=${sessionId}, order=${orderId}, reason=${clearingCheck.reason}`);
    }

    return NextResponse.json({
      success: true,
      shouldClear: clearingCheck.shouldClear,
      reason: clearingCheck.reason,
      instruction: clearingCheck.instruction ? {
        action: clearingCheck.instruction.action,
        timestamp: clearingCheck.instruction.timestamp,
        // Don't expose internal details
      } : undefined,
    }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    monitoring.recordEvent('cart_clearing_check_error', {
      requestId,
      error: errorMessage,
    });

    console.error('Error checking cart clearing instructions:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      shouldClear: false,
    }, { status: 500 });
  }
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ 
    success: false, 
    error: 'Method not allowed' 
  }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ 
    success: false, 
    error: 'Method not allowed' 
  }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ 
    success: false, 
    error: 'Method not allowed' 
  }, { status: 405 });
}