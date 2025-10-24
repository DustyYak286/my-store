/**
 * Global Setup for Integration Tests
 * 
 * Runs once before all integration tests to set up the testing environment
 */

import { loadEnvConfig } from '@next/env';
import { loadTestEnv, requireStripeKeys } from '@/../tests/config/test-environment';

export default async function globalSetup() {
  console.log('[CONFIG] Setting up integration test environment with centralized config...');

  // Load and validate centralized environment configuration with integration mode
  let config;
  try {
    config = loadTestEnv({ mode: 'integration' });
    requireStripeKeys(config);
    console.log('[SUCCESS] Centralized environment configuration validated');
  } catch (error) {
    throw new Error(`Global setup failed: ${error.message}`);
  }
  
  // Load Next.js env config for any additional Next.js specific variables
  const projectDir = process.cwd();
  loadEnvConfig(projectDir);

  // Use validated configuration from centralized system
  const secretKey = config.STRIPE_SECRET_KEY!;
  const publishableKey = config.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

  // Test Stripe API connectivity with controlled agent (production-grade pattern)
  let testAgent: any = null;
  try {
    const https = require('https');
    const Stripe = require('stripe');
    
    // Create short-lived agent for connectivity test
    testAgent = new https.Agent({ 
      keepAlive: true, 
      keepAliveMsecs: 100  // Short timeout
    });
    
    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',     // Pin version
      httpAgent: testAgent,
      maxNetworkRetries: 1,
      timeout: 10000,
    });

    // Simple API call to verify connectivity
    await stripe.paymentMethods.list({ limit: 1 });
    console.log('[SUCCESS] Stripe API connectivity verified');
  } catch (error) {
    console.error('[ERROR] Failed to connect to Stripe API:', error);
    throw new Error(
      'Could not establish connection to Stripe API. ' +
      'Please verify your test keys and internet connection.'
    );
  } finally {
    // CRITICAL: Destroy the test agent immediately after verification
    if (testAgent) {
      testAgent.destroy();
      console.log('[SUCCESS] Stripe connectivity test agent destroyed');
    }
  }

  // Set test-specific environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_INTEGRATION = 'true';

  console.log('[SUCCESS] Integration test environment setup complete');
}