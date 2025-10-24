/**
 * Payment Intent Initialization API Route
 * 
 * Creates initial Stripe Payment Intent with cart data for Elements initialization.
 * This endpoint is called when the checkout page loads to enable payment mode Elements.
 * 
 * POST /api/payments/initialize-intent
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripeOperations } from '@/lib/stripeClient';
import { handleStripeError } from '@/lib/stripe';
import { getPaymentIntentParams } from '@/config/stripe';
import { toStripeAmount, validatePaymentAmount } from '@/constants/payments';
import { createOrder, validateCreateOrderRequest } from '@/lib/orderHelpers';
import { storeOrder } from '@/lib/orderStore';
import type { CreateOrderRequest } from '@/types/order';
import { validateRequestHeaders, validateClientIP } from '@/lib/security/validation';
import { checkMultiTierRateLimit, getRateLimitHeaders } from '@/lib/security/rateLimit';
import type { CartItem } from '@/types/cart';
import { monitoring } from '@/utils/monitoring';

// ====== REQUEST INTERFACES ======

interface InitializePaymentIntentRequest {
  items: CartItem[];
  currency?: string;
  clientRequestId?: string;
  // Optional draft customer info for better intent initialization
  customerInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

interface InitializePaymentIntentResponse {
  success: true;
  paymentIntent: {
    id: string;
    clientSecret: string;
    amount: number;
    currency: string;
    status: string;
  };
  orderDraft: {
    id: string;
    amount: number;
    currency: string;
    itemCount: number;
  };
  metadata: {
    environment: string;
    isTestMode: boolean;
  };
}

interface InitializePaymentIntentErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    type: 'validation_error' | 'payment_error' | 'server_error';
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

type InitializePaymentIntentAPIResponse = InitializePaymentIntentResponse | InitializePaymentIntentErrorResponse;

// ====== UTILITY FUNCTIONS ======

function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const itemPrice = typeof item.price === 'number' ? item.price : 
                     (item.price.discount !== undefined ? item.price.original - item.price.discount : item.price.original);
    return sum + (itemPrice * item.quantity);
  }, 0);
}

function validateInitializeRequest(data: InitializePaymentIntentRequest): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!data.items || data.items.length === 0) {
    errors.push('Cart cannot be empty');
  }
  
  if (data.items && data.items.length > 50) {
    errors.push('Too many items in cart (maximum 50 items allowed)');
  }
  
  // Validate each item
  data.items?.forEach((item, index) => {
    if (!item.id || (typeof item.id === 'number' && item.id <= 0)) {
      errors.push(`Item ${index + 1}: Valid product ID is required`);
    }
    if (!item.name) {
      errors.push(`Item ${index + 1}: Product name is required`);
    }
    if (!item.quantity || item.quantity <= 0) {
      errors.push(`Item ${index + 1}: Valid quantity greater than 0 is required`);
    }
    
    const itemPrice = typeof item.price === 'number' ? item.price : 
                     (item.price.discount !== undefined ? item.price.original - item.price.discount : item.price.original);
    if (!itemPrice || itemPrice <= 0) {
      errors.push(`Item ${index + 1}: Valid price greater than 0 is required`);
    }
  });
  
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

function generateIdempotencyKey(request: InitializePaymentIntentRequest): string {
  if (request.clientRequestId) {
    return `init_${request.clientRequestId}`.substring(0, 255);
  }
  
  // Generate stable key from cart contents
  const keyData = {
    items: request.items.map(i => ({
      id: i.id,
      qty: i.quantity,
      price: typeof i.price === 'number' ? i.price : 
             (i.price.discount !== undefined ? i.price.original - i.price.discount : i.price.original),
    })),
    currency: (request.currency || 'ron').toLowerCase(),
    email: request.customerInfo?.email || '',
  };
  
  const digest = stableHash(JSON.stringify(keyData));
  return `init_${digest}`.substring(0, 255);
}

function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ====== MAIN API HANDLER ======

export async function POST(request: NextRequest): Promise<NextResponse<InitializePaymentIntentAPIResponse>> {
  const requestId = `init_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const stopApiTimer = monitoring.startTimer('api.initialize_intent');
  
  try {
    console.log(`[REDIRECT] Payment intent initialization started - Request ID: ${requestId}`);
    
    // Basic security validation
    const rateLimitResult = checkMultiTierRateLimit(request);
    if (!rateLimitResult.allowed) {
      console.warn(`[WARN] Rate limit exceeded - Request ID: ${requestId}`);
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
      console.error('[ERROR] Header validation failed:', headerValidation.threats);
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
        console.warn('[WARN] Invalid IP format:', clientIp);
      }
    }
    
    // Parse request body
    let requestData: InitializePaymentIntentRequest;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error(`[ERROR] JSON parsing failed - Request ID: ${requestId}:`, parseError);
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
    const validation = validateInitializeRequest(requestData);
    if (!validation.isValid) {
      console.warn(`[WARN] Validation failed - Request ID: ${requestId}:`, validation.errors);
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
    
    // Calculate total amount
    const totalInRON = calculateCartTotal(requestData.items);
    const amountValidation = validatePaymentAmount(totalInRON);
    if (!amountValidation.isValid) {
      console.warn(`[WARN] Amount validation failed - Request ID: ${requestId}:`, amountValidation.error);
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: amountValidation.error || 'Invalid payment amount',
          type: 'validation_error',
          details: {
            totalAmount: totalInRON,
            currency: 'RON',
            limits: {
              minimum: '2.50 RON',
              maximum: '4,999,999 RON',
            },
          },
        },
        requestId,
      }, { status: 400 });
    }
    
    // Calculate amount with tax (19% VAT for Romania)
    const subtotalInBani = toStripeAmount(totalInRON);
    const taxRate = 0.19; // 19% Romanian VAT
    const taxInBani = Math.round(subtotalInBani * taxRate);
    const totalWithTaxInBani = subtotalInBani + taxInBani;
    const totalWithTaxInRON = totalInRON * (1 + taxRate);
    
    console.log(`[SUCCESS] Amount validation passed - Request ID: ${requestId}: ${totalInRON} RON (${totalWithTaxInBani} bani with tax)`);
    
    // Create order draft with minimum required information
    const orderRequest: CreateOrderRequest = {
      customerInfo: {
        email: requestData.customerInfo?.email || 'draft@checkout.local',
        firstName: requestData.customerInfo?.firstName || 'Draft',
        lastName: requestData.customerInfo?.lastName || 'Customer',
        isGuest: true,
      },
      // Use placeholder addresses that will be updated later
      shippingAddress: {
        fullName: 'Draft Customer',
        streetAddress: 'TBD',
        city: 'TBD',
        postalCode: 'TBD',
        country: 'RO', // Default to Romania
      },
      billingAddress: {
        fullName: 'Draft Customer',
        streetAddress: 'TBD',
        city: 'TBD',
        postalCode: 'TBD',
        country: 'RO',
      },
      items: requestData.items,
      currency: 'ron',
      sessionData: {
        ...(clientIp && { ipAddress: clientIp }),
      },
      metadata: { 
        requestId, 
        isDraft: 'true',
        initializationType: 'checkout_page_load'
      },
    };
    
    console.log(`[REDIRECT] Creating order draft - Request ID: ${requestId}`);
    const orderResult = createOrder(orderRequest);
    
    if (orderResult.validationErrors) {
      console.error(`[ERROR] Order draft creation failed - Request ID: ${requestId}:`, orderResult.validationErrors);
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORDER_DRAFT_ERROR',
          message: 'Failed to create order draft',
          type: 'validation_error',
          details: { validationErrors: orderResult.validationErrors },
        },
        requestId,
      }, { status: 400 });
    }
    
    const orderDraft = orderResult.order;
    console.log(`[SUCCESS] Order draft created - Order ID: ${orderDraft.id}, Request ID: ${requestId}`);
    
    // Store the order draft
    storeOrder(orderDraft);
    console.log(`[SUCCESS] Order draft stored - Order ID: ${orderDraft.id}`);
    
    // Generate idempotency key for Stripe
    const idempotencyKey = generateIdempotencyKey(requestData);
    
    // Create payment intent parameters with order draft information
    const paymentIntentParams = getPaymentIntentParams(totalWithTaxInBani, orderDraft.id);
    
    // Add comprehensive metadata for single PaymentIntent lifecycle
    (paymentIntentParams as any).metadata = {
      ...paymentIntentParams.metadata,
      // Core identifiers (required for later updates)
      requestId,
      orderId: orderDraft.id,
      orderNumber: orderDraft.orderNumber,
      orderDraftId: orderDraft.id, // Explicit draft tracking
      
      // Payment lifecycle tracking
      initializationType: 'checkout_page_load',
      paymentStage: 'draft', // Will be updated to 'finalized' later
      
      // Order details
      itemCount: requestData.items.length.toString(),
      totalAmount: totalInRON.toString(),
      currency: 'RON',
      
      // Customer information (if available)
      customerEmail: requestData.customerInfo?.email || '',
      
      // Session tracking
      ...(requestData.clientRequestId && { clientRequestId: requestData.clientRequestId }),
      ...(clientIp && { clientIp }),
      
      // Webhook processing flags
      isDraft: 'true',
      webhookVersion: '1.0',
    };
    
    console.log(`[REDIRECT] Creating Stripe payment intent for initialization - Request ID: ${requestId}`);
    
    // Create payment intent
    const stopStripeTimer = monitoring.startTimer('stripe.initialize_payment_intent');
    const paymentIntent = await stripeOperations.createPaymentIntent(paymentIntentParams);
    stopStripeTimer();
    
    console.log(`[SUCCESS] Payment intent initialized - PI ID: ${paymentIntent.id}, Request ID: ${requestId}`);
    
    // Return successful response with order draft information
    const response: InitializePaymentIntentResponse = {
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      },
      orderDraft: {
        id: orderDraft.id,
        amount: totalWithTaxInRON,
        currency: 'RON',
        itemCount: requestData.items.length,
      },
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        isTestMode: !process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_'),
      },
    };
    
    console.log(`[SUCCESS] Payment intent initialization completed - Request ID: ${requestId}`);
    
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
    console.error(`[ERROR] Payment intent initialization failed - Request ID: ${requestId}:`, error);
    
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
      message: 'GET method not allowed. Use POST to initialize payment intents.',
      type: 'validation_error',
    },
  }, { status: 405 });
}