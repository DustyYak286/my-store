/**
 * Test Environment Configuration (Legacy Wrapper)
 * 
 * This file now uses the new explicit loader pattern.
 * Kept for backward compatibility with existing test setups.
 * 
 * @deprecated Use @/../tests/config/test-environment directly for new code
 */

// Import the new explicit loader pattern
import { loadTestEnv, setupTestEnvironmentVariables } from '@/../tests/config/test-environment';

// Load configuration using the new explicit pattern
const testConfig = loadTestEnv({ mode: 'unit' });

// Legacy export for backward compatibility
export const TEST_ENV_VARS = {
  NODE_ENV: testConfig.NODE_ENV,
  TEST_MODE: String(testConfig.TEST_MODE), // Convert boolean back to string for legacy API
  NEXT_PUBLIC_CHECKOUT_ENABLE_BILLING_ADDRESS: String(testConfig.NEXT_PUBLIC_CHECKOUT_ENABLE_BILLING_ADDRESS),
  NEXT_PUBLIC_CHECKOUT_ENABLE_REALTIME_VALIDATION: String(testConfig.NEXT_PUBLIC_CHECKOUT_ENABLE_REALTIME_VALIDATION),
  NEXT_PUBLIC_CHECKOUT_COUNTRIES: testConfig.NEXT_PUBLIC_CHECKOUT_COUNTRIES,
  NEXT_PUBLIC_VALIDATION_EMAIL_REGEX: testConfig.NEXT_PUBLIC_VALIDATION_EMAIL_REGEX,
  NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX: testConfig.NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX,
};

// Legacy functions for backward compatibility
export function setupTestEnvironment() {
  setupTestEnvironmentVariables(testConfig);
}

export function teardownTestEnvironment() {
  // Environment variables are now managed centrally
  // This function is kept for API compatibility but does nothing
}

// Auto-setup when imported
setupTestEnvironment();
console.log('[SUCCESS] Legacy test environment wrapper loaded (using explicit loader)');