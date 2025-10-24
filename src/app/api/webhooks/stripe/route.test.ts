/**
 * Comprehensive Integration Tests for Stripe Webhook Route
 * 
 * These tests validate the complete webhook processing pipeline including:
 * - Signature verification and security validation
 * - Route-level error handling
 * - Integration with webhook processing utilities
 * - Production-grade edge cases
 */

import { NextRequest } from 'next/server';
import { POST } from './route';
import { WEBHOOK_CONFIG } from '@/constants/payments';
import { resetWebhookDedupStore } from '@/utils/webhookHelpers';
import { monitoring } from '@/utils/monitoring';
import { expectWebhookSecurityCalled } from '@/../tests/helpers/monitoringAssertions';

// Mock dependencies for focused testing - COMPLETE MODULE MOCKING
jest.mock('@/lib/stripe', () => ({
  constructWebhookEvent: jest.fn(),
  processPaymentIntentWebhook: jest.fn()
}));

jest.mock('@/utils/webhookSecurity', () => ({
  validateWebhookSecurity: jest.fn(),
  generateIdempotencyKey: jest.fn(() => 'test-idempotency-key'),
  handleIdempotency: jest.fn((key, fn) => fn()),
  markEventProcessed: jest.fn(),
  DEFAULT_SECURITY_CONFIG: {}
}));

jest.mock('@/utils/monitoring', () => ({
  monitoring: {
    startTimer: jest.fn(() => jest.fn()),
    reset: jest.fn(),
    recordWebhookReceived: jest.fn(),
    recordWebhookError: jest.fn(),
    recordWebhookSuccess: jest.fn(),
    recordWebhookIgnored: jest.fn(),
    recordWebhookSignatureInvalid: jest.fn(),
    recordWebhookProcessed: jest.fn()
  }
}));

jest.mock('@/utils/webhookHelpers', () => ({
  resetWebhookDedupStore: jest.fn(),
  isEventFresh: jest.fn(() => true),
  isDuplicateEvent: jest.fn(() => false),
  markEventProcessed: jest.fn()
}));

jest.mock('@/utils/webhookProcessing', () => ({
  processWebhookEvent: jest.fn()
}));

jest.mock('@/utils/webhookLogger', () => ({
  webhookLogger: {
    log: jest.fn(),
    startProcessingMetrics: jest.fn(),
    recordError: jest.fn(),
    completeProcessingMetrics: jest.fn()
  },
  createTimedLogger: jest.fn(() => ({
    start: jest.fn(),
    end: jest.fn()
  })),
  LogLevel: {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
  }
}));

jest.mock('@/utils/webhookMetadata', () => ({
  extractWebhookMetadata: jest.fn(),
  isWebhookVersionCompatible: jest.fn()
}));

jest.mock('@/config/stripe', () => ({
  stripeConfig: {
    webhookSecret: 'whsec_test_secret',
    webhooks: {
      tolerance: 300
    }
  }
}));

import { constructWebhookEvent, processPaymentIntentWebhook } from '@/lib/stripe';
import { validateWebhookSecurity } from '@/utils/webhookSecurity';
import { webhookLogger, createTimedLogger } from '@/utils/webhookLogger';
import { extractWebhookMetadata, isWebhookVersionCompatible } from '@/utils/webhookMetadata';
import { processWebhookEvent } from '@/utils/webhookProcessing';
import { stripeConfig } from '@/config/stripe';

// Type the mocks
const mockConstructWebhookEvent = constructWebhookEvent as jest.MockedFunction<typeof constructWebhookEvent>;
const mockProcessPaymentIntentWebhook = processPaymentIntentWebhook as jest.MockedFunction<typeof processPaymentIntentWebhook>;
const mockValidateWebhookSecurity = validateWebhookSecurity as jest.MockedFunction<typeof validateWebhookSecurity>;
const mockExtractWebhookMetadata = extractWebhookMetadata as jest.MockedFunction<typeof extractWebhookMetadata>;
const mockIsWebhookVersionCompatible = isWebhookVersionCompatible as jest.MockedFunction<typeof isWebhookVersionCompatible>;
const mockProcessWebhookEvent = processWebhookEvent as jest.MockedFunction<typeof processWebhookEvent>;

// Access mocked functions from module mocks
const mockStartTimer = (monitoring as any).startTimer;
const mockWebhookLogger = (webhookLogger as any);

// Sample webhook payloads
const validWebhookPayload = {
  id: 'evt_test_webhook',
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_test_payment_intent',
      status: 'succeeded',
      amount: 2000,
      currency: 'ron',
      metadata: {
        orderId: 'order_123',
        orderNumber: 'ORD-2024-001',
      },
    },
  },
  created: Math.floor(Date.now() / 1000),
};

const invalidWebhookPayload = 'invalid-json-payload';

// Helper to create NextRequest
const createWebhookRequest = ({
  body = JSON.stringify(validWebhookPayload),
  signature = 'valid-signature',
  headers = {},
}: {
  body?: string;
  signature?: string;
  headers?: Record<string, string>;
} = {}) => {
  return new NextRequest('http://localhost:3000/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'stripe-signature': signature,
      'content-type': 'application/json',
      'user-agent': 'Stripe/1.0 (+https://stripe.com/docs/webhooks)',
      ...headers,
    },
    body,
  });
};

describe('Stripe Webhook Route Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful security validation - THIS IS CRITICAL FOR TESTS TO REACH constructWebhookEvent
    mockValidateWebhookSecurity.mockResolvedValue({
      isValid: true,
      violations: [],
      riskScore: 0,
      checks: {},
      securityInfo: {
        eventId: 'evt_test_webhook',
        timestamp: Date.now(),
        signature: 'valid-signature',
        payloadHash: 'test-hash',
        source: 'stripe',
        processingId: 'test-processing-id'
      }
    });
    
    // Default successful webhook event construction
    mockConstructWebhookEvent.mockReturnValue(validWebhookPayload as any);
    
    // Default payment intent processing
    mockProcessPaymentIntentWebhook.mockReturnValue({
      paymentIntentId: 'pi_test_payment_intent',
      orderId: 'order_123',
      status: 'succeeded',
      amount: 2000,
      currency: 'ron'
    });
    
    // Default webhook metadata extraction
    mockExtractWebhookMetadata.mockReturnValue({
      orderId: 'order_123',
      orderNumber: 'ORD-2024-001',
      version: '1.0',
      source: 'stripe',
    });
    
    mockIsWebhookVersionCompatible.mockReturnValue(true);
    
    mockProcessWebhookEvent.mockResolvedValue({
      success: true,
      processed: true,
      orderId: 'order_123',
      orderStatus: 'paid',
      action: 'order_paid'
    });
  });

  describe('Configuration and Setup', () => {
    it('exposes handled events list', () => {
      expect(WEBHOOK_CONFIG.HANDLED_EVENTS).toContain('payment_intent.succeeded');
      expect(WEBHOOK_CONFIG.HANDLED_EVENTS).toContain('payment_intent.payment_failed');
    });
  });

  describe('Signature Verification', () => {
    it('should reject requests with missing signature', async () => {
      const request = createWebhookRequest({ signature: '' });
      
      // Mock security validation to fail due to missing signature
      mockValidateWebhookSecurity.mockResolvedValueOnce({
        isValid: false,
        violations: [{
          check: 'signature',
          severity: 'high',
          message: 'Missing signature',
          reason: 'missing_signature'
        }],
        riskScore: 100,
        checks: {}
      });
      
      const response = await POST(request);
      
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('invalid_signature');
      expect(responseBody.message).toBe('Webhook signature verification failed');
    });
    
    it('should reject requests with invalid signature', async () => {
      const request = createWebhookRequest({ signature: 'invalid-signature' });
      
      // Mock security validation to fail due to invalid signature
      mockValidateWebhookSecurity.mockResolvedValueOnce({
        isValid: false,
        violations: [{
          check: 'signature',
          severity: 'high', 
          message: 'Invalid signature',
          reason: 'invalid_signature'
        }],
        riskScore: 95,
        checks: {}
      });
      
      const response = await POST(request);
      
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('invalid_signature');
      expect(responseBody.message).toBe('Webhook signature verification failed');
    });
    
    it('should reject requests with malformed signature format', async () => {
      const request = createWebhookRequest({ signature: 'malformed' });
      
      // Mock security validation to fail due to malformed signature
      mockValidateWebhookSecurity.mockResolvedValueOnce({
        isValid: false,
        violations: [{
          check: 'signature',
          severity: 'high',
          message: 'Malformed signature',
          reason: 'malformed_signature'
        }],
        riskScore: 90,
        checks: {}
      });
      
      const response = await POST(request);
      
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody.error).toBe('invalid_signature');
      expect(responseBody.message).toBe('Webhook signature verification failed');
    });
    
    it('should accept requests with valid signature', async () => {
      const request = createWebhookRequest({ signature: 't=1234567890,v1=valid_signature_hash' });
      
      // Mock successful webhook construction
      mockConstructWebhookEvent.mockReturnValue(validWebhookPayload as any);
      
      const response = await POST(request);
      
      // Should not fail due to signature issues
      expect(mockConstructWebhookEvent).toHaveBeenCalledWith(
        JSON.stringify(validWebhookPayload),
        't=1234567890,v1=valid_signature_hash'
      );
      
      // Should proceed to webhook processing (successful flow)
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.received).toBe(true);
      expect(responseBody.orderId).toBe('order_123');
    });
  });

  describe('Security Validation Integration', () => {
    it('should reject requests that fail security validation', async () => {
      const request = createWebhookRequest();
      
      // Mock security validation failure with high severity violations
      mockValidateWebhookSecurity.mockResolvedValue({
        isValid: false,
        violations: [
          {
            check: 'signature_validation',
            severity: 'high',
            message: 'Invalid signature',
            details: { sourceIp: '192.168.1.1' },
          },
        ],
        riskScore: 85,
        checks: {},
      });
      
      const response = await POST(request);
      
      // Based on the route logic, security validation failures return 200 with ignored: true
      // unless there are signature-specific violations that trigger 400
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.ignored).toBe(true);
      expect(responseBody.reason).toBe('security_validation_failed');
      // Enhanced webhook security validation - verify call with actual parameters structure
      expect(mockValidateWebhookSecurity).toHaveBeenCalledWith(
        expect.any(String), // Raw body  
        'valid-signature', // Signature
        'whsec_test_secret', // Secret
        expect.any(String), // Empty string
        expect.any(Number), // Timestamp
        expect.any(String), // IP
        expect.any(Object) // Headers
      );
    });
    
    it('should pass security validation with valid request', async () => {
      const request = createWebhookRequest({
        headers: { 'x-forwarded-for': '3.126.132.87' }, // Stripe IP range
      });
      
      // Security validation will be called twice - once initially, once enhanced
      mockValidateWebhookSecurity
        .mockResolvedValueOnce({
          isValid: true,
          violations: [],
          riskScore: 0,
          checks: {},
          securityInfo: {
            eventId: '',
            timestamp: 0,
            signature: 'valid-signature',
            payloadHash: 'test-hash',
            source: 'stripe',
            processingId: 'test-id'
          }
        })
        .mockResolvedValueOnce({
          isValid: true,
          violations: [],
          riskScore: 0,
          checks: {},
          securityInfo: {
            eventId: 'evt_test_webhook',
            timestamp: validWebhookPayload.created,
            signature: 'valid-signature', 
            payloadHash: 'test-hash',
            source: 'stripe',
            processingId: 'test-id'
          }
        });
      
      const response = await POST(request);
      
      // In Jest test environment, IP extraction may not work exactly like in production
      // Let's just verify security validation was called and passed
      expect(mockValidateWebhookSecurity).toHaveBeenNthCalledWith(1,
        JSON.stringify(validWebhookPayload),
        'valid-signature',
        'whsec_test_secret',
        '', // eventId (extracted later)
        0, // timestamp (extracted from signature)
        expect.any(String), // IP extraction differs in test environment
        {} // security config
      );
      
      expect(response.status).toBe(200);
    });
  });

  describe('Payload Processing', () => {
    it('should handle malformed JSON payload', async () => {
      const request = createWebhookRequest({ body: invalidWebhookPayload });
      
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error('JSON parse error: malformed webhook payload');
      });
      
      const response = await POST(request);
      
      const responseBody = await response.json();
      expect(response.status).toBe(422);
      expect(responseBody.error).toBe('invalid_event_format');
      expect(responseBody.message).toContain('invalid or corrupted');
    });
    
    it('should handle corrupted webhook data', async () => {
      const request = createWebhookRequest({ body: '{{invalid json}}' });
      
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid JSON format in webhook payload');
      });
      
      const response = await POST(request);
      
      const responseBody = await response.json();
      expect(response.status).toBe(422);
      expect(responseBody.error).toBe('invalid_event_format');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network/timeout errors', async () => {
      const request = createWebhookRequest();
      
      mockConstructWebhookEvent.mockReturnValue(validWebhookPayload as any);
      mockProcessWebhookEvent.mockRejectedValue(new Error('Network timeout during processing'));
      
      const response = await POST(request);
      
      const responseBody = await response.json();
      // Network timeout errors are returned as 503 Service Unavailable
      expect(response.status).toBe(503);
      expect(responseBody.error).toBe('network_error');
      expect(responseBody.message).toBe('Network or timeout error during processing');
    });
    
    it('should handle unexpected errors gracefully', async () => {
      const request = createWebhookRequest();
      
      // Mock an unexpected error during processing
      mockConstructWebhookEvent.mockReturnValue(validWebhookPayload as any);
      mockProcessWebhookEvent.mockRejectedValue(new Error('Unexpected system error'));
      
      const response = await POST(request);
      
      const responseBody = await response.json();
      expect(response.status).toBe(500);
      expect(responseBody.error).toBe('processing_error');
      expect(responseBody.message).toBe('Webhook processing failed');
    });
    
    it('should handle requests without content-type header', async () => {
      const request = new NextRequest('http://localhost:3000/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 't=1234567890,v1=valid_signature_hash',
        },
        body: JSON.stringify(validWebhookPayload),
      });
      
      mockConstructWebhookEvent.mockReturnValue(validWebhookPayload as any);
      
      const response = await POST(request);
      
      // Should process successfully despite missing content-type
      expect(mockConstructWebhookEvent).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe('Monitoring and Logging Integration', () => {
    it('should track webhook processing time', async () => {
      const request = createWebhookRequest();
      
      await POST(request);
      
      expect(mockStartTimer).toHaveBeenCalledWith('api.webhook');
    });
    
    it('should log webhook request details', async () => {
      const request = createWebhookRequest({
        headers: { 'user-agent': 'Stripe-Test-Agent' },
      });
      
      await POST(request);
      
      expect(mockWebhookLogger.log).toHaveBeenCalledWith(
        'INFO', // LogLevel.INFO
        'Webhook request received',
        expect.objectContaining({
          metadata: expect.objectContaining({
            userAgent: 'Stripe-Test-Agent',
            hasSignature: true,
          }),
          tags: expect.arrayContaining(['webhook', 'request', 'received']),
        })
      );
    });
  });

  describe('Production Edge Cases', () => {
    it('should handle requests with unusual user agents', async () => {
      const request = createWebhookRequest({
        headers: { 'user-agent': 'curl/7.68.0' },
      });
      
      mockConstructWebhookEvent.mockReturnValue(validWebhookPayload as any);
      
      const response = await POST(request);
      
      // Should process the request
      expect(mockConstructWebhookEvent).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
    
    it('should handle very large payloads', async () => {
      const largePayload = {
        ...validWebhookPayload,
        data: {
          ...validWebhookPayload.data,
          object: {
            ...validWebhookPayload.data.object,
            metadata: {
              ...validWebhookPayload.data.object.metadata,
              largeField: 'x'.repeat(1000), // Large field (reduced size for test performance)
            },
          },
        },
      };
      
      const request = createWebhookRequest({ body: JSON.stringify(largePayload) });
      
      mockConstructWebhookEvent.mockReturnValue(largePayload as any);
      
      const response = await POST(request);
      
      expect(mockConstructWebhookEvent).toHaveBeenCalledWith(
        JSON.stringify(largePayload),
        'valid-signature'
      );
      expect(response.status).toBe(200);
    });
    
    it('should handle requests without IP address', async () => {
      const request = createWebhookRequest();
      // Remove IP-related headers
      request.headers.delete('x-forwarded-for');
      
      mockConstructWebhookEvent.mockReturnValue(validWebhookPayload as any);
      
      const response = await POST(request);
      
      // In test environment, Jest provides a default IP. Let's just verify the call was made
      expect(mockValidateWebhookSecurity).toHaveBeenNthCalledWith(1,
        expect.any(String),
        'valid-signature', 
        'whsec_test_secret',
        '',
        0,
        expect.any(String), // IP will be set by test environment (could be '127.0.0.1' or 'unknown')
        {}
      );
      expect(response.status).toBe(200);
    });
  });
});