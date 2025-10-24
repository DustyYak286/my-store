/**
 * Payment Intent Creation API Route
 * 
 * Creates Stripe Payment Intents with order creation, validation,
 * idempotency handling, and comprehensive error management.
 * 
 * POST /api/payments/create-intent
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripeOperations } from '@/lib/stripeClient';
import { handleStripeError } from '@/lib/stripe';
import { createOrder, validateCreateOrderRequest } from '@/lib/orderHelpers';
import { storeOrder, updateStoredOrderPayment } from '@/lib/orderStore';
import { getPaymentIntentParams, stripeConfig } from '@/config/stripe';
import { PAYMENT_LIMITS, toStripeAmount, validatePaymentAmount, validateCurrency } from '@/constants/payments';
import { 
  validateRequestHeaders, 
  validateRequestStructure, 
  detectAttackPatterns, 
  validateClientIP 
} from '@/lib/security/validation';
import { 
  checkMultiTierRateLimit, 
  detectThreats, 
  getRateLimitHeaders, 
  markSuspiciousActivity 
} from '@/lib/security/rateLimit';
import type { CreateOrderRequest, Order } from '@/types/order';
import type { CartItem } from '@/types/cart';
import { monitoring } from '@/utils/monitoring';

// ====== REQUEST INTERFACES ======

/**
 * Request body for payment intent creation
 */
interface CreatePaymentIntentRequest {
  // Order information
  customerInfo: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
  };
  
  // Addresses
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    postalCode: string;
    country: string;
    state?: string;
    company?: string;
    phone?: string;
  };
  
  billingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    postalCode: string;
    country: string;
    state?: string;
    company?: string;
    phone?: string;
  };
  
  // Order items from cart
  items: CartItem[];
  
  // Optional order preferences
  currency?: string;
  giftMessage?: string;
  specialInstructions?: string;
  
  // Client information for idempotency and tracking
  clientRequestId?: string;    // Client-generated unique ID
  sessionId?: string;          // Session tracking
  
  // Payment options
  paymentOptions?: {
    captureMethod?: 'automatic' | 'manual';
    setupFutureUsage?: 'on_session' | 'off_session';
  };
}

/**
 * Response for successful payment intent creation
 */
interface CreatePaymentIntentResponse {
  success: true;
  paymentIntent: {
    id: string;
    clientSecret: string;
    amount: number;
    currency: string;
    status: string;
  };
  order: {
    id: string;
    orderNumber: string;
    total: number;
    currency: string;
    status: string;
  };
  metadata: {
    orderId: string;
    environment: string;
    isTestMode: boolean;
  };
}

/**
 * Response for failed payment intent creation
 */
interface CreatePaymentIntentErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    type: 'validation_error' | 'payment_error' | 'server_error';
    details?: Record<string, unknown>;
  };
  requestId?: string;
}

type CreatePaymentIntentAPIResponse = CreatePaymentIntentResponse | CreatePaymentIntentErrorResponse;

// ====== UTILITY FUNCTIONS ======

/**
 * Generate idempotency key for Stripe API calls
 */
function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function generateIdempotencyKey(request: CreatePaymentIntentRequest, _orderId: string): string {
  if (request.clientRequestId) {
    return `payment_intent_${request.clientRequestId}`.substring(0, 255);
  }
  const keyPayload = {
    email: request.customerInfo?.email || '',
    items: (request.items || []).map(i => ({
      id: i.id,
      q: i.quantity,
      p: typeof i.price === 'number'
        ? i.price
        : (i.price.discount !== undefined ? i.price.original - i.price.discount : i.price.original),
    })),
    currency: (request.currency || 'ron').toLowerCase(),
    gift: !!request.giftMessage,
    special: !!request.specialInstructions,
    session: request.sessionId || '',
  };
  const digest = stableHash(JSON.stringify(keyPayload));
  return `payment_intent_${digest}`.substring(0, 255);
}

/**
 * Extract client IP address from request
 */
function getClientIpAddress(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const connectingIp = request.headers.get('x-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0]?.trim();
  }
  
  return realIp || connectingIp || undefined;
}

function getAllowedOrigins(): string[] {
  const envVar = process.env.ALLOWED_ORIGINS;
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (!envVar) return defaults;
  return envVar.split(',').map(o => o.trim()).filter(Boolean).concat(defaults);
}

function getRequestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const referer = request.headers.get('referer');
  try {
    return referer ? new URL(referer).origin : null;
  } catch {
    return null;
  }
}

/**
 * Comprehensive security validation with multi-layer protection
 */
async function validateRequestSecurity(request: NextRequest): Promise<{
  isValid: boolean;
  error?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  shouldBlock?: boolean;
  rateLimitExceeded?: boolean;
  headers?: Record<string, string>;
  warnings?: string[];
}> {
  const warnings: string[] = [];
  
  // 1. Rate limiting check (first line of defense)
  console.log('[LOCK] Checking rate limits...');
  const rateLimitResult = checkMultiTierRateLimit(request);
  
  if (!rateLimitResult.allowed) {
    console.warn(`[WARN] Rate limit exceeded - Tier: ${rateLimitResult.tier}, Retry after: ${rateLimitResult.retryAfter}s`);
    return {
      isValid: false,
      error: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`,
      rateLimitExceeded: true,
      headers: getRateLimitHeaders(rateLimitResult),
      warnings: rateLimitResult.warnings,
    };
  }
  
  // 2. Header security validation
  console.log('[LOCK] Validating request headers...');
  const headerValidation = validateRequestHeaders(request);
  
  if (!headerValidation.isValid) {
    console.error('[ERROR] Header validation failed:', headerValidation.threats);
    markSuspiciousActivity(request, 'Header validation failed: ' + headerValidation.threats.join(', '));
    
    return {
      isValid: false,
      error: 'Invalid request headers detected',
      riskLevel: 'high',
      shouldBlock: true,
      headers: getRateLimitHeaders(rateLimitResult),
      warnings: headerValidation.warnings,
    };
  }
  
  if (headerValidation.warnings.length > 0) {
    warnings.push(...headerValidation.warnings);
    console.warn('[WARN] Header warnings:', headerValidation.warnings);
  }
  
  // 3. IP address validation
  console.log('[LOCK] Validating client IP...');
  const clientIp = getClientIpAddress(request);
  
  if (clientIp) {
    const ipValidation = validateClientIP(clientIp);
    
    if (!ipValidation.isValid) {
      console.warn('[WARN] Invalid IP format:', clientIp);
      warnings.push('Invalid IP address format');
    }
    
    if (ipValidation.isSuspicious) {
      console.warn('[ALERT] Suspicious IP detected:', clientIp, ipValidation.warnings);
      warnings.push(...ipValidation.warnings);
      markSuspiciousActivity(request, 'Suspicious IP: ' + ipValidation.warnings.join(', '));
    }
  }
  
  // 4. Advanced threat detection
  console.log('[LOCK] Running threat detection...');
  const threatDetection = detectThreats(request);
  
  if (threatDetection.shouldBlock) {
    const normalizedRiskLevel = threatDetection.threatLevel === 'none' ? 'low' : threatDetection.threatLevel;
    console.error('[ALERT] Critical threats detected:', threatDetection.threats);
    return {
      isValid: false,
      error: 'Suspicious activity detected. Request blocked for security.',
      riskLevel: normalizedRiskLevel,
      shouldBlock: true,
      headers: getRateLimitHeaders(rateLimitResult),
      warnings: threatDetection.threats,
    };
  }
  
  if (threatDetection.threats.length > 0) {
    console.warn('[WARN] Security warnings:', threatDetection.threats);
    warnings.push(...threatDetection.threats);
  }
  
  // Log security assessment
  console.log(`[SUCCESS] Security validation passed - Risk level: ${threatDetection.threatLevel}, IP: ${clientIp}`);
  
  const normalizedRiskLevel = threatDetection.threatLevel === 'none' ? 'low' : threatDetection.threatLevel;
  return {
    isValid: true,
    riskLevel: normalizedRiskLevel,
    headers: getRateLimitHeaders(rateLimitResult),
    warnings,
  };
}

/**
 * Enhanced security-aware payment request validation with input sanitization
 */
function validatePaymentRequest(data: CreatePaymentIntentRequest): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: CreatePaymentIntentRequest;
  securityThreats?: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Security threat detection on raw input
  console.log('[LOCK] Scanning request data for security threats...');
  const threatAnalysis = detectAttackPatterns(data);
  
  if (threatAnalysis.riskLevel === 'critical' || threatAnalysis.riskLevel === 'high') {
    console.error('[ALERT] Security threats detected in request data:', threatAnalysis.threats);
    errors.push('Security validation failed: suspicious patterns detected in request data');
    
    return {
      isValid: false,
      errors,
      warnings,
      securityThreats: threatAnalysis.threats,
    };
  }
  
  if (threatAnalysis.threats.length > 0) {
    console.warn('[WARN] Security warnings in request data:', threatAnalysis.threats);
    warnings.push(...threatAnalysis.threats.map(t => `Security warning: ${t}`));
  }
  
  // 2. Input sanitization and structure validation
  console.log('[LOCK] Sanitizing and validating request structure...');
  const structureValidation = validateRequestStructure(data);
  
  if (!structureValidation.isValid) {
    console.error('[ERROR] Request structure validation failed:', structureValidation.errors);
    errors.push(...structureValidation.errors);
    
    return {
      isValid: false,
      errors,
      warnings,
      securityThreats: threatAnalysis.threats,
    };
  }
  
  const sanitizedData = structureValidation.sanitizedData!;
  console.log('[SUCCESS] Request data sanitized successfully');
  
  // 3. Business logic validation on sanitized data
  console.log('[LOCK] Performing business logic validation...');
  
  // Validate required fields after sanitization
  if (!sanitizedData.customerInfo?.email) {
    errors.push('Valid customer email is required');
  }
  
  if (!sanitizedData.shippingAddress?.fullName) {
    errors.push('Valid shipping address with full name is required');
  }
  
  if (!sanitizedData.billingAddress?.fullName) {
    errors.push('Valid billing address with full name is required');
  }
  
  if (!sanitizedData.items || sanitizedData.items.length === 0) {
    errors.push('At least one valid item is required');
  }
  
  // Validate items after sanitization
  if (sanitizedData.items && sanitizedData.items.length > 0) {
    sanitizedData.items.forEach((item: any, index: number) => {
      if (!item.id || item.id <= 0) {
        errors.push(`Item ${index + 1}: Valid product ID is required`);
      }
      if (!item.name) {
        errors.push(`Item ${index + 1}: Product name is required after sanitization`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Valid quantity greater than 0 is required`);
      }
      
      // Handle price validation for both number and Price object types
      const itemPrice = typeof item.price === 'number' ? item.price : 
                       (item.price.discount !== undefined ? item.price.original - item.price.discount : item.price.original);
      if (!itemPrice || itemPrice <= 0) {
        errors.push(`Item ${index + 1}: Valid price greater than 0 is required`);
      }
    });
    
    // Additional security check: validate item count limits
    if (sanitizedData.items.length > 50) {
      errors.push('Too many items in cart (maximum 50 items allowed)');
    }
  }
  
  // Validate currency using enhanced validation
  if (sanitizedData.currency) {
    const currencyValidation = validateCurrency(sanitizedData.currency);
    if (!currencyValidation.isValid) {
      errors.push(currencyValidation.error || 'Invalid currency');
    } else if (currencyValidation.warning) {
      warnings.push(currencyValidation.warning);
    }
  }
  
  // Additional security validations
  
  // Check for reasonable string lengths after sanitization
  if (sanitizedData.giftMessage && sanitizedData.giftMessage.length > 500) {
    warnings.push('Gift message truncated to 500 characters');
  }
  
  if (sanitizedData.specialInstructions && sanitizedData.specialInstructions.length > 1000) {
    warnings.push('Special instructions truncated to 1000 characters');
  }
  
  console.log(`[SUCCESS] Business logic validation completed - ${errors.length} errors, ${warnings.length} warnings`);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined,
    securityThreats: threatAnalysis.threats,
  };
}

/**
 * Calculate and validate payment amount with comprehensive checks
 */
function calculateAndValidateAmount(items: CartItem[]): {
  isValid: boolean;
  amount: number;
  totalInRON: number;
  error?: string;
  details?: {
    itemBreakdown: Array<{
      name: string;
      unitPrice: number;
      quantity: number;
      total: number;
    }>;
    grandTotal: number;
  };
} {
  try {
    const itemBreakdown: Array<{
      name: string;
      unitPrice: number;
      quantity: number;
      total: number;
    }> = [];
    
    // Calculate total amount with detailed breakdown
    const totalAmount = items.reduce((sum, item) => {
      const itemPrice = typeof item.price === 'number' ? item.price : 
                       (item.price.discount !== undefined ? item.price.original - item.price.discount : item.price.original);
      
      // Validate individual item amounts
      if (typeof itemPrice !== 'number' || isNaN(itemPrice) || itemPrice <= 0) {
        throw new Error(`Invalid price for item "${item.name}": ${itemPrice}`);
      }
      
      if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
        throw new Error(`Invalid quantity for item "${item.name}": ${item.quantity}`);
      }
      
      const itemTotal = itemPrice * item.quantity;
      
      // Add to breakdown for debugging
      itemBreakdown.push({
        name: item.name,
        unitPrice: itemPrice,
        quantity: item.quantity,
        total: itemTotal,
      });
      
      return sum + itemTotal;
    }, 0);
    
    // Validate the calculated total amount
    const validation = validatePaymentAmount(totalAmount);
    if (!validation.isValid) {
      return {
        isValid: false,
        amount: 0,
        totalInRON: totalAmount,
        error: validation.error || 'Invalid payment amount',
        details: {
          itemBreakdown,
          grandTotal: totalAmount,
        },
      };
    }
    
    // Calculate tax (19% VAT for Romania) 
    const subtotalInBani = toStripeAmount(totalAmount);
    const taxRate = 0.19; // 19% Romanian VAT
    const taxInBani = Math.round(subtotalInBani * taxRate);
    const totalWithTaxInBani = subtotalInBani + taxInBani;
    const totalWithTaxInRON = totalAmount * (1 + taxRate);
    
    return {
      isValid: true,
      amount: totalWithTaxInBani,
      totalInRON: totalWithTaxInRON,
      details: {
        itemBreakdown,
        grandTotal: totalWithTaxInRON,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to calculate payment amount';
    return {
      isValid: false,
      amount: 0,
      totalInRON: 0,
      error: errorMessage,
    };
  }
}

// ====== MAIN API HANDLER ======

/**
 * POST handler for payment intent creation
 */
export async function POST(request: NextRequest): Promise<NextResponse<CreatePaymentIntentAPIResponse>> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const stopApiTimer = monitoring.startTimer('api.create_intent');
  
  try {
    console.log(`[REDIRECT] Payment intent creation started - Request ID: ${requestId}`);
    monitoring.recordPaymentAttempt();
    
    // Comprehensive security validation with multi-layer protection
    const securityValidation = await validateRequestSecurity(request);
    if (!securityValidation.isValid) {
      const statusCode = securityValidation.rateLimitExceeded ? 429 : 
                        securityValidation.shouldBlock ? 403 : 400;
      
      const errorCode = securityValidation.rateLimitExceeded ? 'RATE_LIMIT_EXCEEDED' :
                       securityValidation.shouldBlock ? 'REQUEST_BLOCKED' : 'SECURITY_VALIDATION_FAILED';
      
      console.error(`[ERROR] Security validation failed - Request ID: ${requestId}, Risk: ${securityValidation.riskLevel}`);
      
      return NextResponse.json({
        success: false,
        error: {
          code: errorCode,
          message: securityValidation.error || 'Security validation failed',
          type: 'validation_error',
          ...(process.env.NODE_ENV === 'development' && {
            details: {
              riskLevel: securityValidation.riskLevel,
              warnings: securityValidation.warnings,
            }
          }),
        },
        requestId,
      }, { 
        status: statusCode,
        headers: securityValidation.headers || {},
      });
    }
    
    // Log security warnings if any
    if (securityValidation.warnings && securityValidation.warnings.length > 0) {
      console.warn(`[WARN] Security warnings - Request ID: ${requestId}:`, securityValidation.warnings);
    }
    
    // Strict origin allowlist enforcement
    const origin = getRequestOrigin(request);
    const allowedOrigins = getAllowedOrigins();
    const originNormalized = origin ? origin.toLowerCase() : null;
    const allowedNormalized = allowedOrigins.map(o => o.toLowerCase());

    if (originNormalized && !allowedNormalized.includes(originNormalized)) {
      monitoring.recordOriginBlocked();
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORIGIN_NOT_ALLOWED',
          message: 'Origin not allowed',
          type: 'validation_error',
        },
        requestId,
      }, {
        status: 403,
        headers: {
          Vary: 'Origin',
          'X-Allowed-Origins': allowedOrigins.join(','),
          ...(securityValidation.headers || {}),
        },
      });
    }

    // Parse request body with size and safety checks
    let requestData: CreatePaymentIntentRequest;
    try {
      // Check Content-Length header for extremely large requests
      const contentLengthHeader = request.headers.get('content-length');
      const MAX_REQUEST_SIZE = 5 * 1024 * 1024; // 5MB limit
      
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > MAX_REQUEST_SIZE) {
          console.warn(`[WARN] Request too large - Request ID: ${requestId}: ${contentLength} bytes`);
          monitoring.recordValidationError('payload_too_large');
          return NextResponse.json({
            success: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: `Request payload too large. Maximum size is ${(MAX_REQUEST_SIZE / (1024 * 1024)).toFixed(1)}MB.`,
              type: 'validation_error',
            },
            requestId,
          }, { status: 413 });
        }
      }

      requestData = await request.json();
      
      // Additional check for object depth and complexity
      const jsonString = JSON.stringify(requestData);
      if (jsonString.length > MAX_REQUEST_SIZE) {
        console.warn(`[WARN] Request payload too complex - Request ID: ${requestId}: ${jsonString.length} chars`);
        monitoring.recordValidationError('payload_too_complex');
        return NextResponse.json({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_COMPLEX',
            message: 'Request payload too complex or too large.',
            type: 'validation_error',
          },
          requestId,
        }, { status: 413 });
      }
      
    } catch (parseError) {
      console.error(`[ERROR] JSON parsing failed - Request ID: ${requestId}:`, parseError);
      
      // Check if it's a size/memory related error
      const errorMessage = parseError instanceof Error ? parseError.message.toLowerCase() : '';
      if (errorMessage.includes('heap') || errorMessage.includes('memory') || errorMessage.includes('size')) {
        monitoring.recordValidationError('payload_too_large');
        return NextResponse.json({
          success: false,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request payload is too large to process.',
            type: 'validation_error',
          },
          requestId,
        }, { status: 413 });
      }
      
      monitoring.recordValidationError('invalid_json');
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
    
    // Enhanced security-aware payment request validation with input sanitization
    const dataValidation = validatePaymentRequest(requestData);
    if (!dataValidation.isValid) {
      console.warn(`[WARN] Enhanced validation failed - Request ID: ${requestId}:`, {
        errors: dataValidation.errors,
        securityThreats: dataValidation.securityThreats,
      });
      
      // If security threats were detected, mark as suspicious activity
      if (dataValidation.securityThreats && dataValidation.securityThreats.length > 0) {
        markSuspiciousActivity(request, 'Security threats in request data: ' + dataValidation.securityThreats.join(', '));
      }
      
      monitoring.recordValidationError('sanitization');
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          type: 'validation_error',
          details: { 
            errors: dataValidation.errors, 
            warnings: dataValidation.warnings,
            ...(process.env.NODE_ENV === 'development' && {
              securityThreats: dataValidation.securityThreats,
            }),
          },
        },
        requestId,
      }, { 
        status: 400,
        headers: securityValidation.headers || {},
      });
    }
    
    // Use sanitized data for all subsequent processing
    const sanitizedRequestData = dataValidation.sanitizedData!;
    console.log(`[SUCCESS] Enhanced validation passed - Request ID: ${requestId}, using sanitized data`);
    
    // Log security and validation warnings
    if (dataValidation.warnings.length > 0) {
      console.warn(`[WARN] Validation warnings - Request ID: ${requestId}:`, dataValidation.warnings);
    }
    if (dataValidation.securityThreats && dataValidation.securityThreats.length > 0) {
      console.warn(`[WARN] Security threats detected but allowed - Request ID: ${requestId}:`, dataValidation.securityThreats);
    }
    
    // Calculate and validate payment amount with comprehensive checks (using sanitized data)
    const amountValidation = calculateAndValidateAmount(sanitizedRequestData.items);
    if (!amountValidation.isValid) {
      console.warn(`[WARN] Amount validation failed - Request ID: ${requestId}:`, {
        error: amountValidation.error,
        totalInRON: amountValidation.totalInRON,
        details: amountValidation.details,
      });
      
      monitoring.recordValidationError('amount');
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: amountValidation.error || 'Invalid payment amount',
          type: 'validation_error',
          details: {
            totalAmount: amountValidation.totalInRON,
            currency: 'RON',
            limits: {
              minimum: '2.50 RON',
              maximum: '4,999,999 RON',
            },
            ...(process.env.NODE_ENV === 'development' && { 
              itemBreakdown: amountValidation.details?.itemBreakdown 
            }),
          },
        },
        requestId,
      }, { status: 400 });
    }
    
    console.log(`[SUCCESS] Amount validation passed - Request ID: ${requestId}: ${amountValidation.totalInRON} RON (${amountValidation.amount} bani)`);
    
    // Get client information for tracking
    const userAgent = request.headers.get('user-agent');
    const clientIp = getClientIpAddress(request);
    
    // Validate and normalize currency (using sanitized data)
    const currencyValidation = validateCurrency(sanitizedRequestData.currency);
    const normalizedCurrency = currencyValidation.normalizedCurrency;
    
    // Create order first (before payment intent) with normalized currency and sanitized data
    const orderRequest: CreateOrderRequest = {
      customerInfo: {
        ...sanitizedRequestData.customerInfo,
        isGuest: true, // For now, all customers are guests
      },
      shippingAddress: sanitizedRequestData.shippingAddress,
      billingAddress: sanitizedRequestData.billingAddress,
      items: sanitizedRequestData.items,
      currency: normalizedCurrency, // Always use normalized currency (ron)
      ...(sanitizedRequestData.giftMessage && { giftMessage: sanitizedRequestData.giftMessage }),
      ...(sanitizedRequestData.specialInstructions && { specialInstructions: sanitizedRequestData.specialInstructions }),
      sessionData: {
        ...(sanitizedRequestData.sessionId && { sessionId: sanitizedRequestData.sessionId }),
        ...(userAgent && { userAgent }),
        ...(clientIp && { ipAddress: clientIp }),
        // requestId and risk level are not part of typed sessionData; capture in metadata instead
      },
      metadata: { requestId, securityRiskLevel: securityValidation.riskLevel },
    };
    
    console.log(`[REDIRECT] Creating order - Request ID: ${requestId}`);
    const orderResult = createOrder(orderRequest);
    
    if (orderResult.validationErrors) {
      console.error(`[ERROR] Order creation validation failed - Request ID: ${requestId}:`, orderResult.validationErrors);
      return NextResponse.json({
        success: false,
        error: {
          code: 'ORDER_VALIDATION_ERROR',
          message: 'Order validation failed',
          type: 'validation_error',
          details: { validationErrors: orderResult.validationErrors },
        },
        requestId,
      }, { status: 400 });
    }
    
    const order = orderResult.order;
    console.log(`[SUCCESS] Order created - Order ID: ${order.id}, Request ID: ${requestId}`);
    
    // Store the order in our order store for webhook processing
    storeOrder(order);
    console.log(`[SUCCESS] Order stored in order store - Order ID: ${order.id}`);
    
    // Generate idempotency key for Stripe request (using sanitized data)
    const idempotencyKey = generateIdempotencyKey(sanitizedRequestData, order.id);
    
    // Create payment intent parameters
    const paymentIntentParams = getPaymentIntentParams(amountValidation.amount, order.id);
    
    // Override capture method if specified (using sanitized data)
    if (sanitizedRequestData.paymentOptions?.captureMethod) {
      (paymentIntentParams as any).capture_method = sanitizedRequestData.paymentOptions.captureMethod;
    }
    
    // Add setup future usage if specified (using sanitized data)
    if (sanitizedRequestData.paymentOptions?.setupFutureUsage) {
      (paymentIntentParams as any).setup_future_usage = sanitizedRequestData.paymentOptions.setupFutureUsage;
    }
    
    // Add comprehensive metadata for webhook processing
    // This metadata will be available in Stripe webhook events to enable:
    // - Direct order lookup by orderId and orderNumber
    // - Customer identification and communication 
    // - Order fulfillment processing based on flags
    // - Audit trail and debugging capabilities
    // - Version compatibility for webhook handlers
    (paymentIntentParams as any).metadata = {
      ...paymentIntentParams.metadata,
      // Core webhook processing identifiers
      requestId,
      orderNumber: order.orderNumber,
      
      // Customer information for webhook processing (using sanitized data)
      customerEmail: sanitizedRequestData.customerInfo.email,
      customerName: [sanitizedRequestData.customerInfo.firstName, sanitizedRequestData.customerInfo.lastName]
        .filter(Boolean)
        .join(' ') || 'Guest Customer',
      
      // Order details for webhook processing
      itemCount: sanitizedRequestData.items.length.toString(),
      orderTotal: order.totals.total.toString(), // Original amount in bani
      currency: order.currency.toUpperCase(),
      
      // Session tracking for webhook processing (using sanitized data)
      clientRequestId: sanitizedRequestData.clientRequestId || '',
      sessionId: sanitizedRequestData.sessionId || '',
      
      // Webhook processing flags and routing
      webhookVersion: '1.0', // For webhook version compatibility
      requiresFulfillment: 'true', // Flag to indicate if order needs fulfillment
      orderSource: order.source,
      
      // Additional context for webhook processing
      ...(userAgent && { userAgent: userAgent.substring(0, 500) }), // Truncate long user agents
      ...(clientIp && { clientIp }),
      
      // Order preferences that webhook might need (using sanitized data)
      ...(sanitizedRequestData.giftMessage && { hasGiftMessage: 'true' }),
      ...(sanitizedRequestData.specialInstructions && { hasSpecialInstructions: 'true' }),
      
      // Security context for webhook processing
      securityRiskLevel: securityValidation.riskLevel || 'low',
    };
    
    console.log(`[REDIRECT] Creating Stripe payment intent - Order ID: ${order.id}, Order Number: ${order.orderNumber}, Request ID: ${requestId}`);
    
    // Log metadata for webhook processing verification (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] Payment Intent metadata:`, JSON.stringify((paymentIntentParams as any).metadata, null, 2));
    }
    
    // Create payment intent with idempotency key
    const stopStripeTimer = monitoring.startTimer('stripe.create_payment_intent');
    const paymentIntent = await stripeOperations.createPaymentIntent(paymentIntentParams);
    stopStripeTimer();
    
    console.log(`[SUCCESS] Payment intent created - PI ID: ${paymentIntent.id}, Order ID: ${order.id}, Request ID: ${requestId}`);
    
    // Update order with payment intent information
    const orderUpdateResult = updateStoredOrderPayment(order.id, {
      paymentIntentId: paymentIntent.id,
      paymentIntentStatus: paymentIntent.status,
      paymentIntentAmount: paymentIntent.amount,
      paymentIntentCurrency: paymentIntent.currency,
    }, 'payment_intent_creation');
    
    if (!orderUpdateResult.success) {
      console.warn(`[WARN] Failed to update order with payment intent - Order ID: ${order.id}, Error: ${orderUpdateResult.error}`);
    } else {
      console.log(`[SUCCESS] Order updated with payment intent - Order ID: ${order.id}, PI ID: ${paymentIntent.id}`);
    }
    
    // Log all warnings and security information
    const allWarnings = [
      ...(securityValidation.warnings || []),
      ...(dataValidation.warnings || []),
    ];
    
    if (allWarnings.length > 0) {
      console.warn(`[WARN] Security and validation warnings - Request ID: ${requestId}:`, allWarnings);
    }
    
    // Return successful response
    const response: CreatePaymentIntentResponse = {
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      },
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.totals.total,
        currency: order.currency,
        status: order.status,
      },
      metadata: {
        orderId: order.id,
        environment: stripeConfig.environmentLabel,
        isTestMode: stripeConfig.isTestMode,
      },
    };
    
    console.log(`[SUCCESS] Payment intent creation completed - Request ID: ${requestId}`);
    
    monitoring.recordPaymentSuccess();
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Request-ID': requestId,
        'X-Security-Risk-Level': securityValidation.riskLevel || 'low',
        ...(securityValidation.headers || {}),
      },
    });
    
  } catch (error) {
    console.error(`[ERROR] Payment intent creation failed - Request ID: ${requestId}:`, error);
    
    // Handle Stripe-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as any;
      const stripeErrorInfo = handleStripeError(stripeError);
      monitoring.recordPaymentFailure(stripeErrorInfo.category);
      
      return NextResponse.json({
        success: false,
        error: {
          code: stripeError.code || 'STRIPE_ERROR',
          message: stripeErrorInfo.userMessage,
          type: 'payment_error',
          details: {
            category: stripeErrorInfo.category,
            isRetryable: stripeErrorInfo.isRetryable,
            logData: stripeErrorInfo.logData,
          },
        },
        requestId,
      }, { status: stripeErrorInfo.category === 'card' ? 402 : 500 });
    }
    
    // Handle general errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    monitoring.recordPaymentFailure('server');
    
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

/**
 * GET handler - returns method not allowed
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'GET method not allowed. Use POST to create payment intents.',
      type: 'validation_error',
    },
  }, { status: 405 });
}

/**
 * PUT handler - returns method not allowed
 */
export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'PUT method not allowed. Use POST to create payment intents.',
      type: 'validation_error',
    },
  }, { status: 405 });
}

/**
 * DELETE handler - returns method not allowed
 */
export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'DELETE method not allowed. Use POST to create payment intents.',
      type: 'validation_error',
    },
  }, { status: 405 });
}