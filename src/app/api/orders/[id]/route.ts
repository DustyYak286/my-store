/**
 * Order Retrieval API Route
 * 
 * GET /api/orders/[id] - Retrieves order by ID or order number
 * 
 * Production-grade endpoint for fetching order data from server-side storage.
 * Used by success page and other components that need order information.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, getOrderByNumber } from '@/lib/orderStore';
import { validateRequestHeaders } from '@/lib/security/validation';
import { checkMultiTierRateLimit, getRateLimitHeaders } from '@/lib/security/rateLimit';
import { monitoring } from '@/utils/monitoring';

// ====== RESPONSE INTERFACES ======

interface OrderRetrievalSuccessResponse {
  success: true;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    totals: {
      subtotal: number;
      tax: number;
      total: number;
    };
    currency: string;
    items: Array<{
      id: number;
      name: string;
      quantity: number;
      price: number;
      image?: string;
    }>;
    customerInfo?: {
      email: string;
      firstName: string;
      lastName: string;
    };
    payment?: {
      paymentIntentId?: string;
      amount: number;
      capturedAt?: string;
    };
    createdAt: string;
    updatedAt: string;
  };
  metadata: {
    environment: string;
    requestId: string;
  };
}

interface OrderRetrievalErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    type: string;
  };
  requestId: string;
}

type OrderRetrievalAPIResponse = OrderRetrievalSuccessResponse | OrderRetrievalErrorResponse;

// ====== UTILITY FUNCTIONS ======

function generateRequestId(): string {
  return `ord_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// ====== MAIN API HANDLER ======

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<OrderRetrievalAPIResponse>> {
  
  const requestId = generateRequestId();
  // Temporarily disable monitoring to avoid histogram issues
  // const stopApiTimer = monitoring.startTimer('api.initialize_payment_intent');
  
  try {
    // Await params as required by Next.js 15
    const { id } = await params;
    console.log(`🔍 Order retrieval started - Order ID: ${id}, Request ID: ${requestId}`);
    
    // Basic security validation
    const rateLimitResult = checkMultiTierRateLimit(request);
    if (!rateLimitResult.allowed) {
      console.warn(`⚠️ Rate limit exceeded - Request ID: ${requestId}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          type: 'rate_limit_error',
        },
        requestId,
      }, {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      });
    }
    
    // Header validation
    const headerValidation = validateRequestHeaders(request);
    if (!headerValidation.isValid) {
      console.error('❌ Header validation failed:', headerValidation.threats);
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_HEADERS',
          message: 'Invalid request headers detected',
          type: 'validation_error',
        },
        requestId,
      }, { status: 400 });
    }
    
    // Validate order ID parameter
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      console.error(`❌ Invalid order ID parameter - Request ID: ${requestId}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_ORDER_ID',
          message: 'Order ID parameter is required and must be a valid string',
          type: 'validation_error',
        },
        requestId,
      }, { status: 400 });
    }
    
    const orderId = id.trim();
    console.log(`🔍 Looking for order: ${orderId}`);
    
    // Try to find order by ID first, then by order number
    let order = getOrderById(orderId);
    
    if (!order) {
      console.log(`🔍 Order not found by ID, trying order number: ${orderId}`);
      order = getOrderByNumber(orderId);
    }
    
    if (!order) {
      console.log(`❌ Order not found - Order ID: ${orderId}, Request ID: ${requestId}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: `Order not found: ${orderId}`,
          type: 'not_found_error',
        },
        requestId,
      }, { status: 404 });
    }
    
    console.log(`✅ Order found - Order ID: ${order.id} (${order.orderNumber}), Status: ${order.status}, Request ID: ${requestId}`);
    
    // Transform order to API response format
    const response: OrderRetrievalSuccessResponse = {
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totals: {
          subtotal: order.totals.subtotal,
          tax: order.totals.tax,
          total: order.totals.total,
        },
        currency: order.currency,
        items: order.items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
        customerInfo: order.customerInfo ? {
          email: order.customerInfo.email,
          firstName: order.customerInfo.firstName,
          lastName: order.customerInfo.lastName,
        } : undefined,
        payment: order.payment ? {
          paymentIntentId: order.payment.paymentIntentId,
          amount: order.payment.amount,
          capturedAt: order.payment.capturedAt,
        } : undefined,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        requestId,
      },
    };
    
    console.log(`✅ Order retrieval completed - Order ID: ${order.id}, Request ID: ${requestId}`);
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Request-ID': requestId,
        ...getRateLimitHeaders(rateLimitResult),
      },
    });
    
  } catch (error) {
    console.error(`❌ Order retrieval failed - Request ID: ${requestId}:`, error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while retrieving the order',
        type: 'server_error',
      },
      requestId,
    }, { status: 500 });
    
  } finally {
    // stopApiTimer(); // Disabled temporarily
  }
}
