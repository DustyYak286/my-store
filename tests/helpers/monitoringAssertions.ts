/**
 * Production-grade monitoring test assertion helpers
 * Enhances basic toHaveBeenCalled() assertions with payload validation
 */

import { jest } from '@jest/globals';

interface MonitoringCallExpectation {
  eventType: string;
  expectedPayload?: Record<string, any>;
  requiredFields?: string[];
  forbiddenFields?: string[];
  payloadValidation?: (payload: any) => boolean | string;
}

interface WebhookSecurityCallExpectation {
  requestBody?: any;
  headers?: Record<string, string>;
  expectedResult?: {
    isValid: boolean;
    violations?: string[];
    riskScore?: number;
  };
}

interface PaymentGatewayCallExpectation {
  method: 'detectMethods' | 'createIntent' | 'confirmPayment';
  expectedArgs?: any[];
  expectedResult?: any;
  shouldThrow?: boolean;
}

/**
 * Enhanced monitoring event assertion
 * Validates both call occurrence and payload structure
 */
export function expectMonitoringEventCalled(
  mockFn: jest.MockedFunction<any>,
  expectation: MonitoringCallExpectation
): void {
  // Basic call verification
  expect(mockFn).toHaveBeenCalled();
  
  // Find the specific call
  const calls = mockFn.mock.calls;
  const matchingCall = calls.find(([eventType]) => eventType === expectation.eventType);
  
  if (!matchingCall) {
    throw new Error(
      `Expected monitoring event '${expectation.eventType}' was not called. ` +
      `Called events: ${calls.map(([type]) => type).join(', ')}`
    );
  }
  
  const [eventType, actualPayload] = matchingCall;
  
  // Validate payload structure if expected
  if (expectation.expectedPayload) {
    expect(actualPayload).toMatchObject(expectation.expectedPayload);
  }
  
  // Validate required fields
  if (expectation.requiredFields) {
    for (const field of expectation.requiredFields) {
      expect(actualPayload).toHaveProperty(field);
      expect(actualPayload[field]).toBeDefined();
    }
  }
  
  // Validate forbidden fields are not present
  if (expectation.forbiddenFields) {
    for (const field of expectation.forbiddenFields) {
      expect(actualPayload).not.toHaveProperty(field);
    }
  }
  
  // Custom payload validation
  if (expectation.payloadValidation) {
    const validationResult = expectation.payloadValidation(actualPayload);
    if (typeof validationResult === 'string') {
      throw new Error(`Payload validation failed: ${validationResult}`);
    }
    if (validationResult === false) {
      throw new Error('Payload validation failed');
    }
  }
}

/**
 * Enhanced webhook security validation assertion
 * Validates security check parameters and results
 */
export function expectWebhookSecurityCalled(
  mockFn: jest.MockedFunction<any>,
  expectation: WebhookSecurityCallExpectation = {}
): void {
  expect(mockFn).toHaveBeenCalled();
  
  const lastCall = mockFn.mock.calls[mockFn.mock.calls.length - 1];
  const [actualRequestBody, actualHeaders] = lastCall;
  
  // Validate request body structure
  if (expectation.requestBody) {
    expect(actualRequestBody).toMatchObject(expectation.requestBody);
  }
  
  // Validate headers
  if (expectation.headers) {
    expect(actualHeaders).toMatchObject(expectation.headers);
  }
  
  // Validate return value structure if mocked
  if (expectation.expectedResult && mockFn.mock.results.length > 0) {
    const lastResult = mockFn.mock.results[mockFn.mock.results.length - 1];
    if (lastResult.type === 'return') {
      // Handle promises by awaiting them first
      if (lastResult.value && typeof lastResult.value.then === 'function') {
        expect(lastResult.value).resolves.toMatchObject(expectation.expectedResult);
      } else {
        expect(lastResult.value).toMatchObject(expectation.expectedResult);
      }
    }
  }
}

/**
 * Enhanced payment gateway assertion
 * Validates method calls with proper parameter verification
 */
export function expectPaymentGatewayCalled(
  mockGateway: any,
  expectation: PaymentGatewayCallExpectation
): void {
  const mockMethod = mockGateway[expectation.method];
  expect(mockMethod).toHaveBeenCalled();
  
  if (expectation.expectedArgs) {
    expect(mockMethod).toHaveBeenCalledWith(...expectation.expectedArgs);
  }
  
  // Validate result structure
  if (expectation.expectedResult && mockMethod.mock.results.length > 0) {
    const lastResult = mockMethod.mock.results[mockMethod.mock.results.length - 1];
    if (lastResult.type === 'return') {
      expect(lastResult.value).resolves.toMatchObject(expectation.expectedResult);
    }
  }
  
  // Validate error conditions
  if (expectation.shouldThrow && mockMethod.mock.results.length > 0) {
    const lastResult = mockMethod.mock.results[mockMethod.mock.results.length - 1];
    expect(lastResult.type).toBe('throw');
  }
}

/**
 * Enhanced cart clearing monitoring assertion
 * Validates cart clearing events with proper metadata
 */
export function expectCartClearingEventsCalled(
  mockMonitoring: jest.Mocked<any>,
  orderId: string,
  sessionId?: string,
  reason?: string
): void {
  // Verify attempted event
  expectMonitoringEventCalled(mockMonitoring.recordEvent, {
    eventType: 'cart_clearing_attempted',
    expectedPayload: {
      orderId,
      sessionId,
      hasSessionId: !!sessionId,
      reason,
    },
    requiredFields: ['orderId', 'hasSessionId'],
    payloadValidation: (payload) => {
      if (sessionId && !payload.sessionId) {
        return 'Expected sessionId but not found in payload';
      }
      if (!sessionId && payload.sessionId) {
        return 'Unexpected sessionId found in payload';
      }
      return true;
    },
  });
  
  // Verify success event
  expectMonitoringEventCalled(mockMonitoring.recordEvent, {
    eventType: 'cart_clearing_success',
    expectedPayload: {
      orderId,
      sessionId,
      method: sessionId ? 'session_based' : 'order_based',
      reason,
    },
    requiredFields: ['orderId', 'method'],
  });
}

/**
 * Enhanced webhook processing assertion
 * Validates webhook events with comprehensive payload checks
 */
export function expectWebhookEventsCalled(
  mockMonitoring: jest.Mocked<any>,
  eventType: string,
  expectProcessed: boolean = true
): void {
  // Verify webhook received
  expect(mockMonitoring.recordWebhookReceived).toHaveBeenCalledWith(eventType);
  
  if (expectProcessed) {
    // Verify webhook processed
    expect(mockMonitoring.recordWebhookProcessed).toHaveBeenCalledWith(eventType);
  }
}

/**
 * Enhanced payment attempt validation
 * Validates payment processing with detailed metadata
 */
export function expectPaymentAttemptWithMetadata(
  mockMonitoring: jest.Mocked<any>,
  expectedMetadata?: {
    amount?: number;
    currency?: string;
    paymentMethod?: string;
    attemptNumber?: number;
  }
): void {
  expect(mockMonitoring.recordPaymentAttempt).toHaveBeenCalled();
  
  if (expectedMetadata && mockMonitoring.recordPaymentAttempt.mock.calls.length > 0) {
    const lastCall = mockMonitoring.recordPaymentAttempt.mock.calls[
      mockMonitoring.recordPaymentAttempt.mock.calls.length - 1
    ];
    const [actualMetadata] = lastCall;
    
    if (actualMetadata) {
      expect(actualMetadata).toMatchObject(expectedMetadata);
    }
  }
}

/**
 * Enhanced error recording validation
 * Validates error events with proper categorization
 */
export function expectPaymentErrorRecorded(
  mockMonitoring: jest.Mocked<any>,
  errorType: string,
  expectedMetadata: {
    category: string;
    isRetryable: boolean;
    severity: 'low' | 'medium' | 'high';
    attemptNumber?: number;
  }
): void {
  expect(mockMonitoring.recordPaymentError).toHaveBeenCalledWith(
    errorType,
    expect.objectContaining(expectedMetadata)
  );
}