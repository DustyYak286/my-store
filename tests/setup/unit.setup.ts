/**
 * Unit Test Setup
 * 
 * Configures mocked environment for fast unit tests with production-grade
 * warning monitoring and async resource management.
 * 
 * Features:
 * - Console noise reduction for cleaner test output
 * - React act() warning budget enforcement (max 10 warnings)
 * - Global async cleanup to prevent timing issues
 * - Automatic warning count tracking for CI integration
 * 
 * See tests/setup/README.md for detailed usage and troubleshooting.
 */

// Enable Stripe mocking for unit tests
jest.mock('stripe');

console.log('[TEST] Unit Tests: Using mocked Stripe SDK');

// Import async utilities for proper cleanup
import { flushAsync } from './async-utils';

// Shorter timeout for unit tests
jest.setTimeout(30000); // 30 seconds

// Mock console methods to reduce noise in unit tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Warning budget tracking
let actWarningCount = 0;
const MAX_ACT_WARNINGS = 10; // Baseline + threshold

beforeAll(() => {
  // Initialize global warning counter for jest.setup.ts to track
  global.__actWarningCount = 0;
  
  // Suppress noisy logs in unit tests
  console.log = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('[REDIRECT] Payment intent creation') ||
      message.includes('[LOCK] Checking rate limits') ||
      message.includes('[SUCCESS] Security validation passed') ||
      message.includes('Payment methods initialized:') ||
      message.includes('[CONFIG] Creating payment request with amount:')
    )) {
      return; // Suppress these logs in unit tests
    }
    originalConsoleLog(...args);
  };
  
  console.warn = (...args) => {
    const message = args[0];
    if (typeof message === 'string' && (
      message.includes('[WARN] Header warnings') ||
      message.includes('[WARN] Security warnings')
    )) {
      return; // Suppress these warnings in unit tests
    }
    originalConsoleWarn(...args);
  };
});

// Global async cleanup to prevent act() warnings
afterEach(async () => {
  // Allow any pending async operations to complete before test cleanup
  await flushAsync();
});

afterAll(() => {
  // Get final count from global counter
  const finalCount = global.__actWarningCount || 0;
  
  // Check warning budget - fail if too many new warnings
  if (finalCount > MAX_ACT_WARNINGS) {
    throw new Error(`Warning budget exceeded: ${finalCount} React act() warnings (max: ${MAX_ACT_WARNINGS})`);
  }
  
  // Log final warning count for monitoring
  if (finalCount > 0) {
    originalConsoleLog(`[INFO] Test run completed with ${finalCount} suppressed act() warnings (budget: ${MAX_ACT_WARNINGS})`);
  }
  
  // Restore original console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});