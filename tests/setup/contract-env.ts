/**
 * Contract Test Environment Setup
 * 
 * Uses the new explicit loader pattern with integration mode.
 * Production-grade environment validation for contract tests.
 */

// Mark this as integration testing to prevent fake key injection
process.env.TEST_INTEGRATION = 'true';

// Import new explicit loader pattern
import { loadTestEnv, requireStripeKeys, setupTestEnvironmentVariables } from '@/../tests/config/test-environment';

// Load and validate environment in integration mode
const testConfig = loadTestEnv({ mode: 'integration' });

// Ensure Stripe keys are available for contract tests
requireStripeKeys(testConfig);

// Apply configuration to process.env for backward compatibility
setupTestEnvironmentVariables(testConfig);

console.log('✅ Contract test environment loaded with explicit loader (integration mode)');