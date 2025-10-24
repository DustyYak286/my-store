/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, processPaymentIntentWebhook } from '@/lib/stripe';
import { WEBHOOK_CONFIG } from '@/constants/payments';
import { extractWebhookMetadata, isWebhookVersionCompatible } from '@/utils/webhookMetadata';
import { isEventFresh, isDuplicateEvent, markEventProcessed } from '@/utils/webhookHelpers';
import { monitoring } from '@/utils/monitoring';
import { processWebhookEvent } from '@/utils/webhookProcessing';
import { 
  validateWebhookSecurity, 
  generateIdempotencyKey, 
  handleIdempotency,
  markEventProcessed as markEventProcessedSecure,
  DEFAULT_SECURITY_CONFIG 
} from '@/utils/webhookSecurity';
import { stripeConfig } from '@/config/stripe';
import { 
  webhookLogger, 
  LogLevel, 
  createTimedLogger 
} from '@/utils/webhookLogger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stopWebhookTimer = monitoring.startTimer('api.webhook');
  const signature = request.headers.get('stripe-signature') || '';
  const requestId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const sourceIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Start comprehensive logging
  webhookLogger.log(LogLevel.INFO, 'Webhook request received', {
    processingId: requestId,
    source: sourceIp,
    metadata: {
      userAgent,
      hasSignature: !!signature,
      contentLength: request.headers.get('content-length'),
    },
    tags: ['webhook', 'request', 'received'],
  });

  const securityTimer = createTimedLogger(requestId, 'security-validation');
  const processingTimer = createTimedLogger(requestId, 'total-processing');

  try {
    processingTimer.start();
    
    const rawBody = await request.text();
    
    webhookLogger.log(LogLevel.DEBUG, 'Request body parsed', {
      processingId: requestId,
      metadata: {
        payloadSize: rawBody.length,
        contentType: request.headers.get('content-type'),
      },
      tags: ['webhook', 'parsing'],
    });

    // Enhanced security validation first (before expensive operations)
    securityTimer.start();
    
    // Extract timestamp from signature header for proper validation
    let extractedTimestamp = 0;
    try {
      const signatureParts = signature.split(',');
      for (const part of signatureParts) {
        const [key, value = ''] = part.split('=');
        if (key === 't' && value) {
          extractedTimestamp = parseInt(value, 10);
          break;
        }
      }
    } catch (error) {
      // If timestamp extraction fails, continue with 0 (will be caught by signature validation)
      extractedTimestamp = 0;
    }
    
    const securityValidation = await validateWebhookSecurity(
      rawBody,
      signature,
      stripeConfig.webhookSecret,
      '', // eventId - will be extracted from constructed event  
      extractedTimestamp, // timestamp - extracted from signature
      sourceIp,
      DEFAULT_SECURITY_CONFIG
    );
    securityTimer.end(securityValidation.isValid, {
      violations: securityValidation.violations.map(v => v.check),
    });

    // Return early if security validation fails
    if (!securityValidation.isValid) {
      const violations = securityValidation.violations;
      
      webhookLogger.log(LogLevel.WARN, 'Security validation failed', {
        processingId: requestId,
        metadata: {
          violationCount: violations.length,
          violations: violations.map(v => ({ check: v.check, reason: v.reason })),
          sourceIp,
        },
        tags: ['webhook', 'security', 'validation-failed'],
      });
      
      monitoring.recordWebhookError('security_validation_failed', {
        violationCount: violations.length,
        violations: violations.map(v => ({ check: v.check, reason: v.reason })),
        sourceIp,
      });

      // Return appropriate status based on violation type
      const hasSignatureError = violations.some(v => v.check === 'signature');
      const hasRateLimit = violations.some(v => v.check === 'rate_limit');
      
      processingTimer.end(false, { reason: 'security_validation_failed' });
      
      if (hasSignatureError) {
        webhookLogger.log(LogLevel.ERROR, 'Signature verification failed', {
          processingId: requestId,
          metadata: { sourceIp, hasSignature: !!signature },
          tags: ['webhook', 'security', 'signature-failed'],
        });
        
        return NextResponse.json({ 
          error: 'invalid_signature', 
          message: 'Webhook signature verification failed' 
        }, { status: 400 });
      }
      
      if (hasRateLimit) {
        webhookLogger.log(LogLevel.WARN, 'Rate limit exceeded', {
          processingId: requestId,
          metadata: { sourceIp },
          tags: ['webhook', 'security', 'rate-limit'],
        });
        
        return NextResponse.json({ 
          error: 'rate_limit_exceeded', 
          message: 'Too many webhook requests' 
        }, { status: 429 });
      }

      return NextResponse.json({ 
        received: true, 
        ignored: true,
        reason: 'security_validation_failed'
      }, { status: 200 });
    }

    // Construct and verify event (after initial security checks pass)
    const eventConstructionTimer = createTimedLogger(requestId, 'event-construction');
    eventConstructionTimer.start();
    
    let event: any;
    try {
      event = constructWebhookEvent(rawBody, signature);
      eventConstructionTimer.end(true, { eventType: event.type, eventId: event.id });
    } catch (constructError) {
      eventConstructionTimer.end(false, { error: constructError instanceof Error ? constructError.message : 'Unknown construction error' });
      
      // Check if this is a data validation/format error
      const errorMessage = constructError instanceof Error ? constructError.message.toLowerCase() : '';
      
      if (errorMessage.includes('json') || errorMessage.includes('parse') || 
          errorMessage.includes('malformed') || errorMessage.includes('invalid') ||
          errorMessage.includes('corrupt') || errorMessage.includes('format')) {
        
        monitoring.recordWebhookError('invalid_event_format', {
          error: constructError instanceof Error ? constructError.message : 'Unknown construction error',
          sourceIp,
          timestamp: new Date().toISOString(),
        });
        
        webhookLogger.log(LogLevel.WARN, 'Invalid webhook event format', {
          processingId: requestId,
          metadata: {
            error: constructError instanceof Error ? constructError.message : 'Unknown construction error',
            sourceIp,
            payloadSize: rawBody.length,
          },
          tags: ['webhook', 'validation', 'construction-failed'],
        });
        
        processingTimer.end(false, { reason: 'invalid_event_format' });
        
        return NextResponse.json({ 
          received: true,
          ignored: true,
          error: 'invalid_event_format',
          message: 'Webhook event format is invalid or corrupted'
        }, { status: 422 });
      } else {
        // Re-throw for general error handling
        throw constructError;
      }
    }
    
    monitoring.recordWebhookReceived(event.type);
    
    // Start processing metrics tracking
    webhookLogger.startProcessingMetrics(requestId, event.id, event.type);
    
    webhookLogger.log(LogLevel.INFO, 'Webhook event constructed successfully', {
      eventId: event.id,
      processingId: requestId,
      metadata: {
        eventType: event.type,
        created: event.created,
        livemode: event.livemode,
      },
      tags: ['webhook', 'event', 'constructed'],
    });

    // Re-run security validation with actual event data
    const enhancedSecurityTimer = createTimedLogger(requestId, 'enhanced-security-validation');
    enhancedSecurityTimer.start();
    
    const enhancedSecurityValidation = await validateWebhookSecurity(
      rawBody,
      signature,
      stripeConfig.webhookSecret,
      event.id,
      event.created,
      sourceIp,
      DEFAULT_SECURITY_CONFIG
    );
    enhancedSecurityTimer.end(enhancedSecurityValidation.isValid);

    if (!enhancedSecurityValidation.isValid) {
      const violations = enhancedSecurityValidation.violations;
      
      // Handle deduplication specifically
      const dupViolation = violations.find(v => v.check === 'deduplication');
      if (dupViolation && dupViolation.reason === 'duplicate_event') {
        webhookLogger.log(LogLevel.INFO, 'Duplicate event detected', {
          eventId: event.id,
          processingId: requestId,
          metadata: {
            originalProcessingId: dupViolation.metadata?.originalProcessingId,
            reason: dupViolation.reason,
          },
          tags: ['webhook', 'duplicate', 'ignored'],
        });
        
        monitoring.recordWebhookIgnored('duplicate_event');
        processingTimer.end(true, { reason: 'duplicate_event' });
        
        return NextResponse.json({ 
          received: true, 
          ignored: true,
          reason: 'duplicate_event',
          originalProcessingId: dupViolation.metadata?.originalProcessingId
        }, { status: 200 });
      }

      // Handle other violations
      webhookLogger.log(LogLevel.WARN, 'Enhanced security validation failed', {
        eventId: event.id,
        processingId: requestId,
        metadata: {
          violations: violations.map(v => ({ check: v.check, reason: v.reason })),
        },
        tags: ['webhook', 'security', 'enhanced-validation-failed'],
      });
      
      monitoring.recordWebhookError('enhanced_security_validation_failed', {
        eventId: event.id,
        violations: violations.map(v => ({ check: v.check, reason: v.reason })),
      });

      processingTimer.end(false, { reason: 'enhanced_security_validation_failed' });

      return NextResponse.json({ 
        received: true, 
        ignored: true,
        reason: 'security_validation_failed'
      }, { status: 200 });
    }

    // Only handle specific event types
    if (!WEBHOOK_CONFIG.HANDLED_EVENTS.includes(event.type as any)) {
      webhookLogger.log(LogLevel.INFO, 'Unhandled event type', {
        eventId: event.id,
        processingId: requestId,
        metadata: { eventType: event.type },
        tags: ['webhook', 'ignored', 'unhandled-type'],
      });
      
      monitoring.recordWebhookIgnored('unhandled_type');
      processingTimer.end(true, { reason: 'unhandled_type' });
      
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    // Process payment intent event to extract core info
    const businessLogicTimer = createTimedLogger(requestId, 'business-logic-processing');
    businessLogicTimer.start();
    
    let info: any;
    try {
      info = processPaymentIntentWebhook(event);
      businessLogicTimer.end(true, { 
        paymentIntentId: info.paymentIntentId, 
        status: info.status 
      });
    } catch (processingError) {
      businessLogicTimer.end(false, { 
        error: processingError instanceof Error ? processingError.message : 'Unknown processing error' 
      });
      
      // Check if this is a data validation error
      const errorMessage = processingError instanceof Error ? processingError.message.toLowerCase() : '';
      
      if (errorMessage.includes('invalid') || errorMessage.includes('missing') || 
          errorMessage.includes('corrupt') || errorMessage.includes('malformed') ||
          errorMessage.includes('data')) {
        
        monitoring.recordWebhookError('invalid_webhook_data', {
          error: processingError instanceof Error ? processingError.message : 'Unknown processing error',
          eventId: event.id,
          sourceIp,
          timestamp: new Date().toISOString(),
        });
        
        webhookLogger.log(LogLevel.WARN, 'Invalid webhook data structure', {
          eventId: event.id,
          processingId: requestId,
          metadata: {
            error: processingError instanceof Error ? processingError.message : 'Unknown processing error',
            eventType: event.type,
          },
          tags: ['webhook', 'validation', 'invalid-data'],
        });
        
        processingTimer.end(false, { reason: 'invalid_webhook_data' });
        
        return NextResponse.json({ 
          received: true,
          ignored: true,
          error: 'invalid_webhook_data',
          message: 'Webhook data structure is invalid or corrupted'
        }, { status: 422 });
      } else {
        // Re-throw for general error handling
        throw processingError;
      }
    }

    // Extract metadata for routing and validation
    const metadataTimer = createTimedLogger(requestId, 'metadata-extraction');
    metadataTimer.start();
    
    const metadata = extractWebhookMetadata(event.data.object);
    metadataTimer.end(!!metadata);
    
    if (!metadata) {
      webhookLogger.log(LogLevel.WARN, 'Invalid webhook metadata', {
        eventId: event.id,
        processingId: requestId,
        metadata: { eventType: event.type },
        tags: ['webhook', 'metadata', 'invalid'],
      });
      
      monitoring.recordWebhookIgnored('invalid_metadata');
      processingTimer.end(false, { reason: 'invalid_metadata' });
      
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    if (!isWebhookVersionCompatible(metadata)) {
      webhookLogger.log(LogLevel.WARN, 'Incompatible webhook version', {
        eventId: event.id,
        processingId: requestId,
        orderId: metadata.orderId,
        metadata: { webhookVersion: metadata.webhookVersion },
        tags: ['webhook', 'version', 'incompatible'],
      });
      
      monitoring.recordWebhookIgnored('incompatible_version');
      processingTimer.end(false, { reason: 'incompatible_version' });
      
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    const securityInfo = enhancedSecurityValidation.securityInfo!;
    
    webhookLogger.log(LogLevel.INFO, 'Processing webhook business logic', {
      eventId: event.id,
      processingId: requestId,
      orderId: metadata.orderId,
      metadata: {
        eventType: event.type,
        webhookVersion: metadata.webhookVersion,
        orderSource: metadata.orderSource,
      },
      tags: ['webhook', 'business-logic', 'started'],
    });
    
    // Generate idempotency key for this processing
    const idempotencyKey = generateIdempotencyKey(event.id, securityInfo.payloadHash);
    
    // Process with idempotency protection
    const processingResult = await handleIdempotency(idempotencyKey, async () => {
      const orderProcessingTimer = createTimedLogger(requestId, 'order-processing');
      orderProcessingTimer.start();
      
      const result = await processWebhookEvent(event, metadata);
      
      orderProcessingTimer.end(result.success, {
        orderId: result.orderId,
        action: result.action,
      });
      
      if (!result.success) {
        webhookLogger.recordError(requestId, 'order-processing', result.error || 'Unknown processing error');
        throw new Error(result.error || 'Unknown processing error');
      }
      
      webhookLogger.log(LogLevel.INFO, 'Order processing completed successfully', {
        eventId: event.id,
        processingId: requestId,
        ...(result.orderId ? { orderId: result.orderId } : {}),
        metadata: {
          action: result.action,
          cartClearing: result.cartClearing?.success,
          emailNotification: result.emailNotification?.success,
        },
        tags: ['webhook', 'order-processing', 'success'],
      });
      
      return result;
    });

    businessLogicTimer.end(true, {
      orderId: processingResult.orderId,
      action: processingResult.action,
    });

    // Mark processed with enhanced security info
    markEventProcessedSecure(securityInfo, processingResult);
    monitoring.recordWebhookProcessed(event.type);
    
    // Complete processing metrics
    webhookLogger.completeProcessingMetrics(requestId, 'completed');
    processingTimer.end(true, {
      orderId: processingResult.orderId,
      action: processingResult.action,
    });

    webhookLogger.log(LogLevel.INFO, 'Webhook processing completed successfully', {
      eventId: event.id,
      processingId: requestId,
      orderId: processingResult.orderId,
      metadata: {
        eventType: event.type,
        action: processingResult.action,
        totalDuration: Date.now() - (processingTimer as any).startTime,
      },
      tags: ['webhook', 'completed', 'success'],
    });

    return NextResponse.json({ 
      received: true,
      processingId: securityInfo.processingId,
      orderId: processingResult.orderId
    }, { status: 200 });
  } catch (error) {
    // Enhanced error handling with comprehensive logging
    const message = error instanceof Error ? error.message : 'Unknown error';
    const messageLower = message.toLowerCase();
    
    // Complete processing metrics with failure
    try {
      webhookLogger.completeProcessingMetrics(requestId, 'failed');
      processingTimer.end(false, { error: message });
    } catch (metricsError) {
      // Don't let metrics errors interfere with error response
    }
    
    // Categorize errors for appropriate status codes
    if (messageLower.includes('signature') || messageLower.includes('verification')) {
      // Signature/security errors
      monitoring.recordWebhookSignatureInvalid();
      
      webhookLogger.log(LogLevel.ERROR, 'Webhook security error', {
        processingId: requestId,
        metadata: {
          error: message,
          sourceIp,
          hasSignature: !!signature,
          stack: error instanceof Error ? error.stack : undefined,
        },
        tags: ['webhook', 'error', 'security'],
        ...(error instanceof Error ? { error } : {}),
      });
      
      return NextResponse.json({ 
        error: 'invalid_signature', 
        message: 'Webhook verification failed' 
      }, { status: 400 });
      
    } else if (messageLower.includes('json') || messageLower.includes('parse') || 
               messageLower.includes('malformed') || messageLower.includes('corrupt') ||
               messageLower.includes('invalid_request_error') || messageLower.includes('validation')) {
      // Data format/validation errors - client errors (4xx)
      monitoring.recordWebhookError('invalid_data', {
        error: message,
        sourceIp,
        timestamp: new Date().toISOString(),
      });
      
      webhookLogger.log(LogLevel.WARN, 'Webhook data validation error', {
        processingId: requestId,
        metadata: {
          error: message,
          sourceIp,
          userAgent,
          stack: error instanceof Error ? error.stack : undefined,
        },
        tags: ['webhook', 'error', 'validation'],
        ...(error instanceof Error ? { error } : {}),
      });
      
      return NextResponse.json({ 
        error: 'invalid_data', 
        message: 'Webhook data is invalid or corrupted' 
      }, { status: 422 });
      
    } else if (messageLower.includes('timeout') || messageLower.includes('network') ||
               messageLower.includes('connection') || messageLower.includes('unavailable')) {
      // Network/timeout errors - server error but retryable
      monitoring.recordWebhookError('network_error', {
        error: message,
        sourceIp,
        timestamp: new Date().toISOString(),
      });
      
      webhookLogger.log(LogLevel.ERROR, 'Webhook network error', {
        processingId: requestId,
        metadata: {
          error: message,
          sourceIp,
          userAgent,
          stack: error instanceof Error ? error.stack : undefined,
        },
        tags: ['webhook', 'error', 'network'],
        ...(error instanceof Error ? { error } : {}),
      });
      
      return NextResponse.json({ 
        error: 'network_error', 
        message: 'Network or timeout error during processing' 
      }, { status: 503 });
      
    } else {
      // General processing error - server error
      monitoring.recordWebhookError('processing_exception', {
        error: message,
        sourceIp,
        timestamp: new Date().toISOString(),
      });
      
      webhookLogger.log(LogLevel.ERROR, 'Webhook processing error', {
        processingId: requestId,
        metadata: {
          error: message,
          sourceIp,
          userAgent,
          stack: error instanceof Error ? error.stack : undefined,
        },
        tags: ['webhook', 'error', 'processing'],
        ...(error instanceof Error ? { error } : {}),
      });
      
      return NextResponse.json({ 
        error: 'processing_error', 
        message: 'Webhook processing failed' 
      }, { status: 500 });
    }
  } finally {
    stopWebhookTimer();
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}


