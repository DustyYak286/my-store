/**
 * Conditional Stripe Mock
 * 
 * Only mocks Stripe for unit tests, allows real Stripe for E2E/integration tests
 */

import { shouldUseRealStripe } from './test-environment';

// Store the original Stripe constructor
let originalStripe: any = null;
let mockStripe: any = null;

/**
 * Setup conditional mocking before tests run
 */
export function setupConditionalStripeMock() {
  // Only setup mocking for unit tests
  if (!shouldUseRealStripe()) {
    // Load the mock implementation
    mockStripe = require('../../__mocks__/stripe.js');
    
    // Mock the stripe module
    jest.doMock('stripe', () => mockStripe);
    console.log('🧪 Using mocked Stripe for unit tests');
  } else {
    // Ensure no mocking for E2E/integration tests
    jest.dontMock('stripe');
    console.log('🔗 Using real Stripe test API for E2E/integration tests');
  }
}

/**
 * Cleanup after tests
 */
export function cleanupConditionalStripeMock() {
  if (mockStripe) {
    jest.clearAllMocks();
  }
}