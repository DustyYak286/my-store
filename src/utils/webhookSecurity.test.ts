/**
 * Webhook Security Tests
 * 
 * Comprehensive tests for advanced webhook security features
 */

import crypto from 'crypto';
import {
  validatePayloadSize,
  validateTimestamp,
  validateDuplication,
  validateRateLimit,
  validateSignatureStrict,
  validateWebhookSecurity,
  generatePayloadHash,
  generateProcessingId,
  extractSecurityInfo,
  generateIdempotencyKey,
  handleIdempotency,
  markEventProcessed,
  resetSecurityStores,
  getSecurityStats,
  DEFAULT_SECURITY_CONFIG,
} from './webhookSecurity';

// Mock monitoring
jest.mock('./monitoring', () => ({
  monitoring: {
    recordWebhookSecurityViolation: jest.fn(),
    recordWebhookRateLimitExceeded: jest.fn(),
    recordWebhookIgnored: jest.fn(),
  },
}));

describe('Webhook Security', () => {
  beforeEach(() => {
    resetSecurityStores();
    jest.clearAllMocks();
  });

  describe('generatePayloadHash', () => {
    it('should generate consistent hash for same payload', () => {
      const payload = 'test payload';
      const hash1 = generatePayloadHash(payload);
      const hash2 = generatePayloadHash(payload);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different hashes for different payloads', () => {
      const hash1 = generatePayloadHash('payload1');
      const hash2 = generatePayloadHash('payload2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateProcessingId', () => {
    it('should generate unique processing IDs', () => {
      const id1 = generateProcessingId();
      const id2 = generateProcessingId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^wh_\d+_[a-f0-9]{16}$/);
    });
  });

  describe('extractSecurityInfo', () => {
    it('should extract security info correctly', () => {
      const eventId = 'evt_test123';
      const timestamp = 1234567890;
      const signature = 't=1234567890,v1=signature';
      const payload = 'test payload';

      const info = extractSecurityInfo(eventId, timestamp, signature, payload);

      expect(info.eventId).toBe(eventId);
      expect(info.timestamp).toBe(timestamp);
      expect(info.signature).toBe(signature);
      expect(info.payloadHash).toBe(generatePayloadHash(payload));
      expect(info.source).toBe('stripe');
      expect(info.processingId).toMatch(/^wh_\d+_[a-f0-9]{16}$/);
    });

    it('should detect unknown source for invalid signature format', () => {
      const info = extractSecurityInfo('evt_test', 123, 'invalid', 'payload');
      expect(info.source).toBe('unknown');
    });
  });

  describe('validatePayloadSize', () => {
    it('should accept payload within size limit', () => {
      const result = validatePayloadSize('small payload');
      expect(result.isValid).toBe(true);
    });

    it('should reject oversized payload', () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const config = { ...DEFAULT_SECURITY_CONFIG, maxPayloadSize: 1024 * 1024 };
      
      const result = validatePayloadSize(largePayload, config);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('payload_too_large');
      expect(result.metadata?.payloadSize).toBeGreaterThan(config.maxPayloadSize);
    });
  });

  describe('validateTimestamp', () => {
    it('should accept fresh timestamp', () => {
      const recentTimestamp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      const result = validateTimestamp(recentTimestamp);
      
      expect(result.isValid).toBe(true);
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const result = validateTimestamp(oldTimestamp);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('event_too_old_strict');
    });

    it('should reject future timestamp in strict mode', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 120; // 2 minutes in future
      const result = validateTimestamp(futureTimestamp);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('future_event');
    });

    it('should accept future timestamp in non-strict mode', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 120;
      const config = { ...DEFAULT_SECURITY_CONFIG, strictTimestampValidation: false };
      
      const result = validateTimestamp(futureTimestamp, config);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateDuplication', () => {
    it('should accept new event', () => {
      const securityInfo = extractSecurityInfo('evt_new', 123, 't=123,v1=sig', 'payload');
      const result = validateDuplication(securityInfo);
      
      expect(result.isValid).toBe(true);
    });

    it('should detect duplicate event with same payload', () => {
      const securityInfo1 = extractSecurityInfo('evt_dup', 123, 't=123,v1=sig', 'payload');
      const securityInfo2 = extractSecurityInfo('evt_dup', 123, 't=123,v1=sig', 'payload');
      
      // Mark first as processed
      markEventProcessed(securityInfo1);
      
      // Second should be detected as duplicate
      const result = validateDuplication(securityInfo2);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('duplicate_event');
    });

    it('should detect payload hash mismatch (potential replay attack)', () => {
      const securityInfo1 = extractSecurityInfo('evt_replay', 123, 't=123,v1=sig', 'original');
      const securityInfo2 = extractSecurityInfo('evt_replay', 123, 't=123,v1=sig', 'modified');
      
      // Mark first as processed
      markEventProcessed(securityInfo1);
      
      // Second with different payload should be flagged as suspicious
      const result = validateDuplication(securityInfo2);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('payload_hash_mismatch');
      expect(result.metadata?.suspicious).toBe(true);
    });
  });

  describe('validateRateLimit', () => {
    it('should accept requests within rate limit', () => {
      const result = validateRateLimit('127.0.0.1');
      expect(result.isValid).toBe(true);
    });

    it('should reject requests exceeding rate limit', () => {
      const config = { ...DEFAULT_SECURITY_CONFIG, rateLimitPerMinute: 2 };
      const identifier = '127.0.0.1';
      
      // First two requests should pass
      expect(validateRateLimit(identifier, config).isValid).toBe(true);
      expect(validateRateLimit(identifier, config).isValid).toBe(true);
      
      // Third should be rejected
      const result = validateRateLimit(identifier, config);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
    });
  });

  describe('validateSignatureStrict', () => {
    it('should validate correct signature', () => {
      const payload = 'test payload';
      const secret = 'whsec_test123';
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Generate valid signature
      const payloadForSigning = `${timestamp}.${payload}`;
      const signature = crypto.createHmac('sha256', secret).update(payloadForSigning).digest('hex');
      const signatureHeader = `t=${timestamp},v1=${signature}`;
      
      const result = validateSignatureStrict(payload, signatureHeader, secret);
      expect(result.isValid).toBe(true);
    });

    it('should reject malformed signature', () => {
      const result = validateSignatureStrict('payload', 'invalid', 'secret');
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('malformed_signature');
    });

    it('should reject signature with invalid timestamp tolerance', () => {
      const payload = 'test payload';
      const secret = 'whsec_test123';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 1000; // Very old
      
      const payloadForSigning = `${oldTimestamp}.${payload}`;
      const signature = crypto.createHmac('sha256', secret).update(payloadForSigning).digest('hex');
      const signatureHeader = `t=${oldTimestamp},v1=${signature}`;
      
      const result = validateSignatureStrict(payload, signatureHeader, secret, 300);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('signature_timestamp_invalid');
    });

    it('should reject incorrect signature', () => {
      const payload = 'test payload';
      const secret = 'whsec_test123';
      const timestamp = Math.floor(Date.now() / 1000);
      const wrongSignature = 'wrong_signature';
      const signatureHeader = `t=${timestamp},v1=${wrongSignature}`;
      
      const result = validateSignatureStrict(payload, signatureHeader, secret);
      
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('signature_verification_failed');
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate consistent idempotency key', () => {
      const eventId = 'evt_test123';
      const payloadHash = generatePayloadHash('test payload');
      
      const key1 = generateIdempotencyKey(eventId, payloadHash);
      const key2 = generateIdempotencyKey(eventId, payloadHash);
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^wh_evt_test123_[a-f0-9]{16}$/);
    });
  });

  describe('handleIdempotency', () => {
    it('should execute function once and cache result', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const key = 'test_key';
      
      // First call should execute function
      const result1 = await handleIdempotency(key, mockFn);
      expect(result1).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      // Second call should return cached result
      const result2 = await handleIdempotency(key, mockFn);
      expect(result2).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should cache errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('test error'));
      const key = 'error_key';
      
      // First call should execute and cache error
      await expect(handleIdempotency(key, mockFn)).rejects.toThrow('test error');
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      // Second call should return cached error
      await expect(handleIdempotency(key, mockFn)).rejects.toThrow('test error');
      expect(mockFn).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('validateWebhookSecurity', () => {
    it('should pass all validations for valid webhook', async () => {
      const payload = 'valid payload';
      const secret = 'whsec_test123';
      const timestamp = Math.floor(Date.now() / 1000);
      const eventId = 'evt_test123';
      const sourceIp = '127.0.0.1';
      
      // Generate valid signature
      const payloadForSigning = `${timestamp}.${payload}`;
      const sig = crypto.createHmac('sha256', secret).update(payloadForSigning).digest('hex');
      const signature = `t=${timestamp},v1=${sig}`;
      
      const result = await validateWebhookSecurity(
        payload,
        signature,
        secret,
        eventId,
        timestamp,
        sourceIp
      );
      
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.securityInfo).toBeDefined();
    });

    it('should fail with multiple violations', async () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB
      const invalidSignature = 'invalid';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 1000;
      const eventId = 'evt_test123';
      const sourceIp = '127.0.0.1';
      const secret = 'whsec_test123';
      
      const result = await validateWebhookSecurity(
        largePayload,
        invalidSignature,
        secret,
        eventId,
        oldTimestamp,
        sourceIp
      );
      
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.securityInfo).toBeUndefined();
      
      // Should have multiple violation types
      const violationTypes = result.violations.map(v => v.check);
      expect(violationTypes).toContain('payload_size');
      expect(violationTypes).toContain('signature');
      expect(violationTypes).toContain('timestamp');
    });
  });

  describe('getSecurityStats', () => {
    it('should return correct store statistics', () => {
      const stats = getSecurityStats();
      
      expect(stats.processedEvents).toBe(0);
      expect(stats.rateLimitEntries).toBe(0);
      expect(stats.idempotencyEntries).toBe(0);
      
      // Add some entries and check again
      const securityInfo = extractSecurityInfo('evt_test', 123, 't=123,v1=sig', 'payload');
      markEventProcessed(securityInfo);
      validateRateLimit('127.0.0.1');
      
      const newStats = getSecurityStats();
      expect(newStats.processedEvents).toBe(1);
      expect(newStats.rateLimitEntries).toBe(1);
    });
  });
});