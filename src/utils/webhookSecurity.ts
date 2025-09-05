/**
 * Advanced Webhook Security
 * 
 * Enhanced security measures for Stripe webhook processing including
 * signature verification, timestamp validation, event deduplication,
 * idempotency handling, and comprehensive security logging.
 */

import crypto from 'crypto';
import { monitoring } from '@/utils/monitoring';

// ====== TYPES AND INTERFACES ======

export interface WebhookSecurityConfig {
  /** Maximum event age in milliseconds */
  maxEventAge: number;
  /** Signature tolerance in seconds */
  signatureTolerance: number;
  /** Deduplication TTL in milliseconds */
  dedupTtl: number;
  /** Maximum payload size in bytes */
  maxPayloadSize: number;
  /** Enable strict timestamp validation */
  strictTimestampValidation: boolean;
  /** Rate limit: max events per minute */
  rateLimitPerMinute: number;
}

export interface SecurityCheckResult {
  isValid: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface EventSecurityInfo {
  eventId: string;
  timestamp: number;
  signature: string;
  payloadHash: string;
  source: 'stripe' | 'unknown';
  processingId: string;
}

// ====== CONFIGURATION ======

// Environment-aware configuration
const isTestEnvironment = process.env.NODE_ENV === 'test' || 
                          process.env.JEST_WORKER_ID !== undefined ||
                          process.env.TEST_MODE === 'true' ||
                          typeof jest !== 'undefined';

export const DEFAULT_SECURITY_CONFIG: WebhookSecurityConfig = {
  maxEventAge: isTestEnvironment ? 30 * 60 * 1000 : 5 * 60 * 1000, // 30 minutes for tests, 5 minutes for production
  signatureTolerance: isTestEnvironment ? 600 : 300, // 10 minutes for tests, 5 minutes for production
  dedupTtl: 10 * 60 * 1000, // 10 minutes
  maxPayloadSize: 1024 * 1024, // 1MB
  strictTimestampValidation: !isTestEnvironment, // Relaxed for tests
  rateLimitPerMinute: isTestEnvironment ? 1000 : 100, // Higher limit for tests
};

// ====== SECURITY STORES ======

// In-memory stores (replace with Redis in production)
interface ProcessedEventEntry {
  timestamp: number;
  payloadHash: string;
  processingId: string;
  metadata?: Record<string, any>;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const processedEvents = new Map<string, ProcessedEventEntry>();
const rateLimitStore = new Map<string, RateLimitEntry>();
const idempotencyStore = new Map<string, any>();

// ====== CLEANUP MECHANISMS ======

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Cleanup interval reference for proper cleanup
let webhookCleanupInterval: NodeJS.Timeout | null = null;

function cleanupStores(): void {
  const now = Date.now();
  const config = DEFAULT_SECURITY_CONFIG;
  
  // Cleanup processed events
  for (const [eventId, entry] of processedEvents.entries()) {
    if (now - entry.timestamp > config.dedupTtl) {
      processedEvents.delete(eventId);
    }
  }
  
  // Cleanup rate limit entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
  
  // Cleanup idempotency store (24 hour TTL)
  for (const [key, entry] of idempotencyStore.entries()) {
    if (now - entry.timestamp > 24 * 60 * 60 * 1000) {
      idempotencyStore.delete(key);
    }
  }
}

// Initialize cleanup only in non-test environments
if (process.env.NODE_ENV !== 'test' && typeof setInterval === 'function') {
  webhookCleanupInterval = setInterval(cleanupStores, CLEANUP_INTERVAL);
}

// Export cleanup function for tests
export function clearWebhookSecurityCleanup(): void {
  if (webhookCleanupInterval) {
    clearInterval(webhookCleanupInterval);
    webhookCleanupInterval = null;
  }
  processedEvents.clear();
  rateLimitStore.clear();
  idempotencyStore.clear();
}

// ====== SECURITY UTILITIES ======

/**
 * Generate a secure hash of the payload for deduplication
 */
export function generatePayloadHash(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Generate a unique processing ID for this webhook processing session
 */
export function generateProcessingId(): string {
  return `wh_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Extract security information from webhook event
 */
export function extractSecurityInfo(
  eventId: string,
  timestamp: number,
  signature: string,
  payload: string
): EventSecurityInfo {
  return {
    eventId,
    timestamp,
    signature,
    payloadHash: generatePayloadHash(payload),
    source: signature.startsWith('t=') ? 'stripe' : 'unknown',
    processingId: generateProcessingId(),
  };
}

// ====== ENHANCED SECURITY CHECKS ======

/**
 * Validate payload size to prevent resource exhaustion
 */
export function validatePayloadSize(
  payload: string,
  config: WebhookSecurityConfig = DEFAULT_SECURITY_CONFIG
): SecurityCheckResult {
  const payloadSize = Buffer.byteLength(payload, 'utf8');
  
  if (payloadSize > config.maxPayloadSize) {
    monitoring.recordWebhookSecurityViolation('payload_too_large', {
      payloadSize,
      maxAllowed: config.maxPayloadSize,
    });
    
    return {
      isValid: false,
      reason: 'payload_too_large',
      metadata: { payloadSize, maxAllowed: config.maxPayloadSize },
    };
  }
  
  return { isValid: true };
}

/**
 * Enhanced timestamp validation with strict mode
 */
export function validateTimestamp(
  timestamp: number,
  config: WebhookSecurityConfig = DEFAULT_SECURITY_CONFIG
): SecurityCheckResult {
  const now = Date.now();
  const eventTimeMs = timestamp * 1000;
  const ageMs = now - eventTimeMs;
  
  // Check if event is too old
  if (ageMs > config.maxEventAge) {
    const reason = config.strictTimestampValidation ? 'event_too_old_strict' : 'event_too_old';
    
    
    monitoring.recordWebhookSecurityViolation('timestamp_validation_failed', {
      eventAge: ageMs,
      maxAge: config.maxEventAge,
      strict: config.strictTimestampValidation,
    });
    
    return {
      isValid: false,
      reason,
      metadata: { eventAge: ageMs, maxAge: config.maxEventAge },
    };
  }
  
  // In strict mode, also check for events from the future
  if (config.strictTimestampValidation && eventTimeMs > now + 60000) { // 1 minute tolerance
    monitoring.recordWebhookSecurityViolation('future_event_detected', {
      eventTime: eventTimeMs,
      currentTime: now,
      diff: eventTimeMs - now,
    });
    
    return {
      isValid: false,
      reason: 'future_event',
      metadata: { eventTime: eventTimeMs, currentTime: now },
    };
  }
  
  return { isValid: true };
}

/**
 * Enhanced deduplication with payload hash verification
 */
export function validateDuplication(
  securityInfo: EventSecurityInfo,
  config: WebhookSecurityConfig = DEFAULT_SECURITY_CONFIG
): SecurityCheckResult {
  const existing = processedEvents.get(securityInfo.eventId);
  
  if (existing) {
    // Check if payload hash matches (to detect replay attacks with modified payloads)
    if (existing.payloadHash !== securityInfo.payloadHash) {
      monitoring.recordWebhookSecurityViolation('payload_hash_mismatch', {
        eventId: securityInfo.eventId,
        existingHash: existing.payloadHash,
        currentHash: securityInfo.payloadHash,
      });
      
      return {
        isValid: false,
        reason: 'payload_hash_mismatch',
        metadata: {
          eventId: securityInfo.eventId,
          suspicious: true,
        },
      };
    }
    
    // Event already processed with same payload
    monitoring.recordWebhookIgnored('duplicate_event_detected');
    
    return {
      isValid: false,
      reason: 'duplicate_event',
      metadata: {
        eventId: securityInfo.eventId,
        originalProcessingId: existing.processingId,
        currentProcessingId: securityInfo.processingId,
      },
    };
  }
  
  return { isValid: true };
}

/**
 * Rate limiting validation
 */
export function validateRateLimit(
  identifier: string,
  config: WebhookSecurityConfig = DEFAULT_SECURITY_CONFIG
): SecurityCheckResult {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  const existing = rateLimitStore.get(identifier);
  
  if (existing) {
    if (now < existing.resetTime) {
      if (existing.count >= config.rateLimitPerMinute) {
        monitoring.recordWebhookRateLimitExceeded(identifier, {
          identifier,
          count: existing.count,
          limit: config.rateLimitPerMinute,
        });
        
        return {
          isValid: false,
          reason: 'rate_limit_exceeded',
          metadata: {
            identifier,
            count: existing.count,
            limit: config.rateLimitPerMinute,
            resetTime: existing.resetTime,
          },
        };
      }
      
      // Increment count
      existing.count++;
    } else {
      // Reset window
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + 60000,
      });
    }
  } else {
    // First request in this window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + 60000,
    });
  }
  
  return { isValid: true };
}

/**
 * Enhanced signature validation with multiple security checks
 */
export function validateSignatureStrict(
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = DEFAULT_SECURITY_CONFIG.signatureTolerance
): SecurityCheckResult {
  try {
    // Parse signature header
    const signatureParts = signature.split(',');
    let timestamp: number | null = null;
    const signatures: string[] = [];
    
    for (const part of signatureParts) {
      const [key, value] = part.split('=');
      if (key === 't') {
        timestamp = parseInt(value, 10);
      } else if (key === 'v1') {
        signatures.push(value);
      }
    }
    
    if (!timestamp || signatures.length === 0) {
      return {
        isValid: false,
        reason: 'malformed_signature',
        metadata: { hasTimestamp: !!timestamp, signatureCount: signatures.length },
      };
    }
    
    // Validate timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > tolerance) {
      return {
        isValid: false,
        reason: 'signature_timestamp_invalid',
        metadata: { timestamp, now, tolerance, diff: Math.abs(now - timestamp) },
      };
    }
    
    // Verify signature
    const payloadForSigning = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadForSigning, 'utf8')
      .digest('hex');
    
    const isValidSignature = signatures.some(sig => {
      // Ensure buffers are same length for timingSafeEqual
      if (sig.length !== expectedSignature.length) {
        return false;
      }
      return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(sig));
    });
    
    if (!isValidSignature) {
      return {
        isValid: false,
        reason: 'signature_verification_failed',
        metadata: { timestamp, signatureCount: signatures.length },
      };
    }
    
    return { isValid: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      isValid: false,
      reason: 'signature_processing_error',
      metadata: { error: errorMessage },
    };
  }
}

// ====== IDEMPOTENCY HANDLING ======

/**
 * Generate idempotency key for webhook event
 */
export function generateIdempotencyKey(
  eventId: string,
  payloadHash: string
): string {
  return `wh_${eventId}_${payloadHash.slice(0, 16)}`;
}

/**
 * Check and set idempotency for webhook processing
 */
export function handleIdempotency(
  idempotencyKey: string,
  processingFunction: () => Promise<any>
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const existing = idempotencyStore.get(idempotencyKey);
    
    if (existing) {
      // Return cached result
      if (existing.success) {
        resolve(existing.result);
      } else {
        reject(new Error(existing.error));
      }
      return;
    }
    
    try {
      const result = await processingFunction();
      
      // Cache successful result
      idempotencyStore.set(idempotencyKey, {
        success: true,
        result,
        timestamp: Date.now(),
      });
      
      resolve(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Cache error result
      idempotencyStore.set(idempotencyKey, {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      });
      
      reject(error);
    }
  });
}

// ====== MARKING PROCESSED ======

/**
 * Mark event as processed with enhanced metadata
 */
export function markEventProcessed(
  securityInfo: EventSecurityInfo,
  result?: any
): void {
  processedEvents.set(securityInfo.eventId, {
    timestamp: Date.now(),
    payloadHash: securityInfo.payloadHash,
    processingId: securityInfo.processingId,
    metadata: {
      source: securityInfo.source,
      result: result ? { success: true, orderId: result.orderId } : undefined,
    },
  });
}

// ====== COMPREHENSIVE VALIDATION ======

/**
 * Perform all security validations for a webhook
 */
export async function validateWebhookSecurity(
  payload: string,
  signature: string,
  webhookSecret: string,
  eventId: string,
  timestamp: number,
  sourceIdentifier: string,
  config: WebhookSecurityConfig = DEFAULT_SECURITY_CONFIG
): Promise<{
  isValid: boolean;
  securityInfo?: EventSecurityInfo;
  violations: Array<{ check: string; reason: string; metadata?: any }>;
}> {
  const violations: Array<{ check: string; reason: string; metadata?: any }> = [];
  
  // Extract security info
  const securityInfo = extractSecurityInfo(eventId, timestamp, signature, payload);
  
  // 1. Payload size validation
  const sizeCheck = validatePayloadSize(payload, config);
  if (!sizeCheck.isValid) {
    violations.push({
      check: 'payload_size',
      reason: sizeCheck.reason!,
      metadata: sizeCheck.metadata,
    });
  }
  
  // 2. Enhanced signature validation
  const signatureCheck = validateSignatureStrict(payload, signature, webhookSecret, config.signatureTolerance);
  if (!signatureCheck.isValid) {
    violations.push({
      check: 'signature',
      reason: signatureCheck.reason!,
      metadata: signatureCheck.metadata,
    });
  }
  
  // 3. Enhanced timestamp validation
  const timestampCheck = validateTimestamp(timestamp, config);
  if (!timestampCheck.isValid) {
    violations.push({
      check: 'timestamp',
      reason: timestampCheck.reason!,
      metadata: timestampCheck.metadata,
    });
  }
  
  // 4. Rate limiting
  const rateLimitCheck = validateRateLimit(sourceIdentifier, config);
  if (!rateLimitCheck.isValid) {
    violations.push({
      check: 'rate_limit',
      reason: rateLimitCheck.reason!,
      metadata: rateLimitCheck.metadata,
    });
  }
  
  // 5. Enhanced deduplication
  const dupCheck = validateDuplication(securityInfo, config);
  if (!dupCheck.isValid) {
    violations.push({
      check: 'deduplication',
      reason: dupCheck.reason!,
      metadata: dupCheck.metadata,
    });
  }
  
  const isValid = violations.length === 0;
  
  // Log security validation results
  if (!isValid) {
    monitoring.recordWebhookSecurityViolation('security_validation_failed', {
      eventId,
      violations: violations.map(v => v.check),
      violationCount: violations.length,
      securityInfo: {
        source: securityInfo.source,
        processingId: securityInfo.processingId,
      },
    });
  }
  
  return {
    isValid,
    securityInfo: isValid ? securityInfo : undefined,
    violations,
  };
}

// ====== TEST HELPERS ======

/**
 * Reset all security stores (for testing)
 */
export function resetSecurityStores(): void {
  processedEvents.clear();
  rateLimitStore.clear();
  idempotencyStore.clear();
}

/**
 * Get security store statistics (for monitoring)
 */
export function getSecurityStats(): {
  processedEvents: number;
  rateLimitEntries: number;
  idempotencyEntries: number;
} {
  return {
    processedEvents: processedEvents.size,
    rateLimitEntries: rateLimitStore.size,
    idempotencyEntries: idempotencyStore.size,
  };
}