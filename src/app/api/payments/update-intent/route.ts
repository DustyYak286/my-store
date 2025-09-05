/**
 * Payment Intent Update API Route
 * 
 * Updates existing Stripe Payment Intent with finalized customer and shipping information.
 * This endpoint is called during form submission to finalize the order draft.
 * 
 * POST /api/payments/update-intent
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripeOperations } from '@/lib/stripeClient';
import { handleStripeError } from '@/lib/stripe';
import { toStripeAmount, validatePaymentAmount } from '@/constants/payments';
import { validateRequestHeaders, validateClientIP } from '@/lib/security/validation';
import { checkMultiTierRateLimit, getRateLimitHeaders } from '@/lib/security/rateLimit';
import { getOrderById, updateStoredOrderStatus, updateStoredOrderPayment } from '@/lib/orderStore';
import { monitoring } from '@/utils/monitoring';

// ====== REQUEST INTERFACES ======

interface UpdatePaymentIntentRequest {
  paymentIntentId: string;
  orderDraftId: string;
  
  // Customer information
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
  };
  
  // Addresses
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    postalCode: string;
    country: string;
  };
  
  billingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    postalCode: string;
    country: string;
  };
  
  // Optional client tracking
  clientRequestId?: string;
}

interface UpdatePaymentIntentResponse {
  success: true;
  paymentIntent: {
    id: string;
    amount: number;
    currency: string;
    status: string;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
  };
}

interface UpdatePaymentIntentErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    type: 'validation_error' | 'payment_error' | 'server_error';
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

type UpdatePaymentIntentAPIResponse = UpdatePaymentIntentResponse | UpdatePaymentIntentErrorResponse;

// ====== UTILITY FUNCTIONS ======

function validateUpdateRequest(data: UpdatePaymentIntentRequest): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!data.paymentIntentId || !data.paymentIntentId.startsWith('pi_')) {
    errors.push('Valid PaymentIntent ID is required');
  }
  
  if (!data.orderDraftId) {
    errors.push('Order draft ID is required');
  }
  
  if (!data.customerInfo?.email) {
    errors.push('Customer email is required');
  }
  
  if (!data.shippingAddress?.fullName || !data.shippingAddress?.streetAddress) {
    errors.push('Complete shipping address is required');
  }
  
  if (!data.billingAddress?.fullName || !data.billingAddress?.streetAddress) {
    errors.push('Complete billing address is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

function getClientIpAddress(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const connectingIp = request.headers.get('x-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0]?.trim();
  }
  
  return realIp || connectingIp || undefined;
}

// ====== MAIN API HANDLER ======

export async function POST(request: NextRequest): Promise<NextResponse<UpdatePaymentIntentAPIResponse>> {
  const requestId = `update_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const stopApiTimer = monitoring.startTimer('api.initialize_intent'); // Reuse existing histogram
  
  try {
    console.log(`🔄 Payment intent update started - Request ID: ${requestId}`);
    
    // Basic security validation
    const rateLimitResult = checkMultiTierRateLimit(request);
    if (!rateLimitResult.allowed) {
      console.warn(`⚠️ Rate limit exceeded - Request ID: ${requestId}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          type: 'validation_error',
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
    
    // IP validation
    const clientIp = getClientIpAddress(request);
    if (clientIp) {
      const ipValidation = validateClientIP(clientIp);
      if (!ipValidation.isValid) {
        console.warn('⚠️ Invalid IP format:', clientIp);
      }
    }
    
    // Parse request body
    let requestData: UpdatePaymentIntentRequest;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error(`❌ JSON parsing failed - Request ID: ${requestId}:`, parseError);
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
          type: 'validation_error',
        },
        requestId,
      }, { status: 400 });
    }
    
    // Validate request data
    const validation = validateUpdateRequest(requestData);
    if (!validation.isValid) {
      console.warn(`⚠️ Validation failed - Request ID: ${requestId}:`, validation.errors);
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          type: 'validation_error',
          details: { errors: validation.errors },
        },
        requestId,
      }, { status: 400 });
    }
    
    // Retrieve the order draft
    const orderDraft = getOrderById(requestData.orderDraftId);
    if (!orderDraft) {
      console.error(`❌ Order draft not found - Request ID: ${requestId}, Order ID: ${requestData.orderDraftId}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order draft not found',
          type: 'validation_error',
        },
        requestId,
      }, { status: 404 });
    }
    
    // Calculate total amount (recompute to ensure server-side accuracy)
    const totalInRON = orderDraft.totals.subtotal;
    const amountValidation = validatePaymentAmount(totalInRON);
    if (!amountValidation.isValid) {
      console.warn(`⚠️ Amount validation failed - Request ID: ${requestId}:`, amountValidation.error);
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: amountValidation.error || 'Invalid payment amount',
          type: 'validation_error',
        },
        requestId,
      }, { status: 400 });
    }
    
    // Calculate amount with tax (19% VAT for Romania) - server-side validation
    const subtotalInBani = toStripeAmount(totalInRON);
    const taxRate = 0.19; // 19% Romanian VAT
    const taxInBani = Math.round(subtotalInBani * taxRate);
    const totalWithTaxInBani = subtotalInBani + taxInBani;
    
    console.log(`✅ Amount validated - Request ID: ${requestId}: ${totalInRON} RON (${totalWithTaxInBani} bani with tax)`);
    
    // Update the PaymentIntent with finalized information
    console.log(`🔄 Updating Stripe PaymentIntent - PI ID: ${requestData.paymentIntentId}, Request ID: ${requestId}`);
    
    const updateParams = {
      amount: totalWithTaxInBani,
      metadata: {
        // Update payment stage
        paymentStage: 'finalized',
        isDraft: 'false',
        
        // Add customer information
        customerEmail: requestData.customerInfo.email,
        customerName: `${requestData.customerInfo.firstName} ${requestData.customerInfo.lastName}`.trim(),
        
        // Add finalized order information
        shippingCountry: requestData.shippingAddress.country,
        billingCountry: requestData.billingAddress.country,
        
        // Update processing flags
        requiresFulfillment: 'true',
        finalizedAt: new Date().toISOString(),
        
        // Session tracking
        ...(requestData.clientRequestId && { finalClientRequestId: requestData.clientRequestId }),
        ...(clientIp && { finalClientIp: clientIp }),
      },
    };
    
    const stopStripeTimer = monitoring.startTimer('stripe.initialize_payment_intent'); // Reuse existing histogram
    const updatedPaymentIntent = await stripeOperations.updatePaymentIntent(requestData.paymentIntentId, updateParams);
    stopStripeTimer();
    
    console.log(`✅ PaymentIntent updated - PI ID: ${updatedPaymentIntent.id}, Amount: ${updatedPaymentIntent.amount}, Request ID: ${requestId}`);
    
    // Update order status to reflect finalization
    const statusUpdateResult = await updateStoredOrderStatus(
      orderDraft.id,
      'processing',
      'Order finalized with customer and shipping information',
      'api_update_intent',
      {
        customerEmail: requestData.customerInfo.email,
        paymentIntentId: requestData.paymentIntentId,
        requestId,
      }
    );
    
    // Update payment information
    const paymentUpdateResult = updateStoredOrderPayment(
      orderDraft.id,
      {
        paymentIntentId: requestData.paymentIntentId,
        paymentIntentStatus: updatedPaymentIntent.status,
        amount: updatedPaymentIntent.amount,
        currency: updatedPaymentIntent.currency,
        // Set capturedAt to mark payment as succeeded
        capturedAt: new Date().toISOString(),
        metadata: {
          customerEmail: requestData.customerInfo.email,
          finalizedAt: new Date().toISOString(),
        },
      },
      'api_update_intent'
    );
    
    if (!statusUpdateResult.success) {
      console.warn(`⚠️ Failed to update order status - Order ID: ${orderDraft.id}, Error: ${statusUpdateResult.error}`);
    }
    
    if (!paymentUpdateResult.success) {
      console.warn(`⚠️ Failed to update order payment - Order ID: ${orderDraft.id}, Error: ${paymentUpdateResult.error}`);
    }
    
    if (statusUpdateResult.success && paymentUpdateResult.success) {
      console.log(`✅ Order draft updated - Order ID: ${orderDraft.id}, Status: processing`);
    }
    
    // Return successful response
    const response: UpdatePaymentIntentResponse = {
      success: true,
      paymentIntent: {
        id: updatedPaymentIntent.id,
        amount: updatedPaymentIntent.amount,
        currency: updatedPaymentIntent.currency,
        status: updatedPaymentIntent.status,
      },
      order: {
        id: orderDraft.id,
        orderNumber: orderDraft.orderNumber,
        status: statusUpdateResult.success ? 'processing' : orderDraft.status,
      },
    };
    
    console.log(`✅ Payment intent update completed - Request ID: ${requestId}`);
    
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
    console.error(`❌ Payment intent update failed - Request ID: ${requestId}:`, error);
    
    // Handle Stripe-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as any;
      const stripeErrorInfo = handleStripeError(stripeError);
      
      return NextResponse.json({
        success: false,
        error: {
          code: stripeError.code || 'STRIPE_ERROR',
          message: stripeErrorInfo.userMessage,
          type: 'payment_error',
          details: {
            category: stripeErrorInfo.category,
            isRetryable: stripeErrorInfo.isRetryable,
          },
        },
        requestId,
      }, { status: stripeErrorInfo.category === 'card' ? 402 : 500 });
    }
    
    // Handle general errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error occurred',
        type: 'server_error',
        ...(process.env.NODE_ENV === 'development' && { details: { originalError: errorMessage } }),
      },
      requestId,
    }, { status: 500 });
  } finally {
    stopApiTimer();
  }
}

// ====== HTTP METHOD HANDLERS ======

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'GET method not allowed. Use POST to update payment intents.',
      type: 'validation_error',
    },
  }, { status: 405 });
}