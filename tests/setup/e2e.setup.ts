/**
 * E2E Test Setup
 * 
 * Configures the test environment for E2E tests using real Stripe test API
 */

// Ensure we're using real Stripe, not mocks
jest.dontMock('stripe');

// CRITICAL: Load environment variables using centralized configuration
// Import centralized test environment configuration first
import { loadTestEnv, requireStripeKeys } from '@/../tests/config/test-environment';

// Load test environment in integration mode for E2E tests
const testConfig = loadTestEnv({ mode: 'integration' });

// Validate Stripe keys for E2E tests
try {
  requireStripeKeys(testConfig);
  console.log('[SUCCESS] E2E environment validated with centralized config');
} catch (error) {
  throw new Error(`E2E setup failed: ${error.message}`);
}

// Set test environment
process.env.NODE_ENV = 'test';

// Use validated configuration from centralized system
const realStripeKey = testConfig.STRIPE_SECRET_KEY;
const realPublishableKey = testConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const realWebhookSecret = testConfig.STRIPE_WEBHOOK_SECRET;

console.log('[CONFIG] E2E Environment Loading (Centralized):');
console.log('  Environment loaded via centralized config');
console.log('  STRIPE_SECRET_KEY:', realStripeKey?.substring(0, 20) + '...');
console.log('  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', realPublishableKey?.substring(0, 20) + '...');
console.log('  STRIPE_WEBHOOK_SECRET:', realWebhookSecret?.substring(0, 20) + '...');

// Validate all keys are present and correct format
if (!realStripeKey?.startsWith('sk_test_')) {
  throw new Error(`Invalid STRIPE_SECRET_KEY in .env.local: ${realStripeKey}`);
}
if (!realPublishableKey?.startsWith('pk_test_')) {
  throw new Error(`Invalid NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local: ${realPublishableKey}`);
}
if (!realWebhookSecret?.startsWith('whsec_')) {
  throw new Error(`Invalid STRIPE_WEBHOOK_SECRET in .env.local: ${realWebhookSecret}`);
}

// Keys are already validated by requireStripeKeys() - this is redundant but kept for clarity
// All validation is now handled by the centralized test environment system

// Log that we're using real Stripe
console.log('[LINK] E2E Tests: Using real Stripe test API');
console.log('[KEY] Stripe Secret Key:', realStripeKey?.substring(0, 15) + '...');
console.log('[SUCCESS] E2E environment validation complete');

// Extend timeout for real API calls
jest.setTimeout(180000); // 3 minutes

// Import required modules for HTTP agent cleanup
import https from 'https';
import http from 'http';
import Stripe from 'stripe';

// Production-grade HTTP agent with short keep-alive timeout (following suggestions.md)
const stripeHttpsAgent = new https.Agent({ 
  keepAlive: true,
  keepAliveMsecs: 100,  // Short timeout prevents hanging
  timeout: 30000,       // 30 second timeout
});

const stripeHttpAgent = new http.Agent({ 
  keepAlive: true,
  keepAliveMsecs: 100,  // Short timeout prevents hanging
  timeout: 30000,       // 30 second timeout
});

// Production-grade Stripe instance with best practices
const stripeForE2E = new Stripe(realStripeKey!, {
  apiVersion: '2023-10-16',     // Pin version to avoid drift
  httpAgent: stripeHttpsAgent,  // Use HTTPS agent for E2E
  maxNetworkRetries: 1,         // Sane for tests
  timeout: 30000,               // 30 second timeout
});

// Make the controlled Stripe instance available globally for E2E tests
(global as any).__STRIPE_E2E__ = stripeForE2E;

// Handle Undici/fetch agent cleanup for E2E tests
let undiciDispatcher: any = null;
try {
  const { Agent, setGlobalDispatcher } = require('undici');
  undiciDispatcher = new Agent({ 
    keepAliveTimeout: 1000,      // 1 second
    keepAliveMaxTimeout: 1000    // 1 second max
  });
  setGlobalDispatcher(undiciDispatcher);
} catch (error) {
  // Undici might not be available, that's fine
  console.log('[INFO]  Undici not available for E2E, skipping dispatcher setup');
}

// Global test state for cleanup
(global as any).__E2E_TEST_STATE__ = {
  createdPaymentIntents: [] as string[],
  createdOrders: [] as string[],
  stripeHttpsAgent,
  stripeHttpAgent,
  undiciDispatcher,
};

// Enhanced cleanup function for E2E tests
afterAll(async () => {
  console.log('[CLEAR] E2E Test Cleanup: Starting comprehensive cleanup...');
  
  const testState = (global as any).__E2E_TEST_STATE__;
  
  try {
    // 1. Cleanup any created payment intents (optional - Stripe test mode cleans up automatically)
    if (testState.createdPaymentIntents.length > 0) {
      console.log(`[CLEAR] Found ${testState.createdPaymentIntents.length} payment intents to potentially cleanup`);
    }

    // 2. CRITICAL: Destroy Stripe HTTP agents to close keep-alive sockets
    if (testState.stripeHttpsAgent) {
      testState.stripeHttpsAgent.destroy();
      console.log('[SUCCESS] Stripe HTTPS agent destroyed');
    }
    
    if (testState.stripeHttpAgent) {
      testState.stripeHttpAgent.destroy();
      console.log('[SUCCESS] Stripe HTTP agent destroyed');
    }

    // 3. Close Undici dispatcher if we set one
    if (testState.undiciDispatcher && typeof testState.undiciDispatcher.close === 'function') {
      await testState.undiciDispatcher.close();
      console.log('[SUCCESS] Undici dispatcher closed (E2E)');
    }

    // 4. Clear webhook logger singleton state
    try {
      const { webhookLogger } = require('../../src/utils/webhookLogger');
      if (webhookLogger && typeof webhookLogger.destroy === 'function') {
        webhookLogger.destroy();
      }
      if (webhookLogger && typeof webhookLogger.clearAll === 'function') {
        webhookLogger.clearAll();
      }
      console.log('[SUCCESS] Webhook logger cleaned up');
    } catch (error) {
      console.log('[INFO]  Webhook logger cleanup not needed');
    }

    console.log('[SUCCESS] E2E Test Cleanup: Comprehensive cleanup complete');
  } catch (error) {
    console.error('[ERROR] Error during E2E cleanup:', error);
  }
});

// Helper to track created resources
export function trackPaymentIntent(id: string) {
  const testState = (global as any).__E2E_TEST_STATE__;
  testState.createdPaymentIntents.push(id);
}

export function trackOrder(id: string) {
  const testState = (global as any).__E2E_TEST_STATE__;
  testState.createdOrders.push(id);
}