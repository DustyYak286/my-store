import { NextRequest, NextResponse } from 'next/server';
import type { CreateOrderRequest } from '@/types/order';

/**
 * Create a properly formatted test request
 * Ensures proper header and body formatting for API route testing
 */
export function createTestRequest(
  url: string,
  options: RequestInit & { body?: any } = {}
): NextRequest {
  const { body, ...init } = options;
  
  return new NextRequest(url, {
    ...init,
    method: init.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
      ...init.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Create test payment data with proper structure
 * Provides consistent test data that matches the expected API format
 */
export function createTestPaymentData(
  overrides: Partial<CreateOrderRequest> = {}
): CreateOrderRequest {
  return {
    customerInfo: {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: '+40123456789',
      ...overrides.customerInfo,
    },
    shippingAddress: {
      fullName: 'Test User',
      streetAddress: '123 Test Street',
      city: 'Bucharest',
      postalCode: '012345',
      country: 'RO',
      state: 'B',
      ...overrides.shippingAddress,
    },
    billingAddress: overrides.billingAddress || {
      fullName: 'Test User',
      streetAddress: '123 Test Street',
      city: 'Bucharest',
      postalCode: '012345',
      country: 'RO',
      state: 'B',
    },
    items: overrides.items || [
      {
        id: 1,
        name: 'Test Product',
        price: 29.99,
        quantity: 1,
        image: '/test.jpg',
      },
    ],
    currency: overrides.currency || 'ron',
    clientRequestId: `test_${Date.now()}`,
  };
}

/**
 * Validate Stripe response structure
 * Ensures the API response has the expected Stripe payment intent format
 */
export function validateStripeResponse(response: any) {
  expect(response).toHaveProperty('success');
  expect(response).toHaveProperty('paymentIntent');
  expect(response.paymentIntent).toHaveProperty('id');
  expect(response.paymentIntent).toHaveProperty('clientSecret');
  expect(response.paymentIntent.id).toMatch(/^pi_/);
  expect(response.paymentIntent.clientSecret).toMatch(/^pi_.*_secret_/);
}

/**
 * Validate error response structure
 * Ensures error responses follow the expected format
 */
export function validateErrorResponse(response: any, expectedError: string) {
  expect(response).toHaveProperty('success', false);
  expect(response).toHaveProperty('error');
  expect(response.error).toHaveProperty('code', expectedError);
  expect(response.error).toHaveProperty('message');
}

/**
 * Create a test request with malformed JSON (for testing error handling)
 */
export function createMalformedJsonRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    },
    body: '{"invalid": json}', // Invalid JSON
  });
}

/**
 * Create a test request with missing required fields
 */
export function createInvalidRequest(url: string, missingField: string): NextRequest {
  const data = createTestPaymentData();
  
  // Remove the specified field to create invalid data
  if (missingField === 'customerInfo.email') {
    delete data.customerInfo.email;
  } else if (missingField === 'items') {
    data.items = [];
  } else if (missingField === 'shippingAddress') {
    delete (data as any).shippingAddress;
  }
  
  return createTestRequest(url, { body: data });
}

/**
 * Create a test request with amount below minimum
 */
export function createBelowMinimumAmountRequest(url: string): NextRequest {
  const data = createTestPaymentData({
    items: [
      {
        id: 1,
        name: 'Cheap Item',
        price: 1.00, // Below 2.50 RON minimum
        quantity: 1,
        image: '/test.jpg',
      },
    ],
  });
  
  return createTestRequest(url, { body: data });
}

/**
 * Wait for async operation to complete (useful for webhook testing)
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await waitFor(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Test data generators for different scenarios
 */
export const TestScenarios = {
  validPayment: () => createTestPaymentData(),
  
  invalidEmail: () => createTestPaymentData({
    customerInfo: { email: 'invalid-email' },
  }),
  
  emptyItems: () => createTestPaymentData({
    items: [],
  }),
  
  belowMinimumAmount: () => createTestPaymentData({
    items: [{ id: 1, name: 'Cheap', price: 1.00, quantity: 1, image: '/test.jpg' }],
  }),
  
  aboveMaximumAmount: () => createTestPaymentData({
    items: [{ id: 1, name: 'Expensive', price: 5000000, quantity: 1, image: '/test.jpg' }],
  }),
  
  internationalShipping: () => createTestPaymentData({
    shippingAddress: {
      fullName: 'Test User',
      streetAddress: '123 Test St',
      city: 'New York',
      postalCode: '10001',
      country: 'US',
      state: 'NY',
    },
  }),
};

/**
 * Mock console methods to capture logs during testing
 */
export class MockConsole {
  private originalConsole: typeof console;
  public logs: string[] = [];
  public errors: string[] = [];
  public warns: string[] = [];

  constructor() {
    this.originalConsole = { ...console };
  }

  mock() {
    console.log = (...args) => {
      this.logs.push(args.join(' '));
    };
    
    console.error = (...args) => {
      this.errors.push(args.join(' '));
    };
    
    console.warn = (...args) => {
      this.warns.push(args.join(' '));
    };
  }

  restore() {
    Object.assign(console, this.originalConsole);
  }

  clear() {
    this.logs = [];
    this.errors = [];
    this.warns = [];
  }

  hasLog(message: string): boolean {
    return this.logs.some(log => log.includes(message));
  }

  hasError(message: string): boolean {
    return this.errors.some(error => error.includes(message));
  }

  hasWarn(message: string): boolean {
    return this.warns.some(warn => warn.includes(message));
  }
}

/**
 * Helper to assert async operations throw specific errors
 */
export async function expectAsyncError<T>(
  operation: () => Promise<T>,
  expectedError?: string | RegExp
): Promise<Error> {
  try {
    await operation();
    throw new Error('Expected operation to throw an error, but it succeeded');
  } catch (error) {
    if (expectedError && error instanceof Error) {
      if (typeof expectedError === 'string') {
        expect(error.message).toContain(expectedError);
      } else {
        expect(error.message).toMatch(expectedError);
      }
    }
    return error as Error;
  }
}