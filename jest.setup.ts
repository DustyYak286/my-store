import '@testing-library/jest-dom';

// Set up test environment variables FIRST - before any imports
// Only set Stripe keys for unit tests (integration tests use real keys from .env.local)
if (process.env.TEST_INTEGRATION !== 'true') {
  process.env.STRIPE_SECRET_KEY = 'sk_test_51234567890abcdefghijk';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_51234567890abcdefghijk';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test1234567890abcdefghijk';
}
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';

// Feature flags for testing
process.env.NEXT_PUBLIC_CHECKOUT_ENABLE_BILLING_ADDRESS = 'true';
process.env.NEXT_PUBLIC_CHECKOUT_ENABLE_REALTIME_VALIDATION = 'true';
process.env.NEXT_PUBLIC_CHECKOUT_COUNTRIES = 'US,CA,GB,EU,RO';

// Clear module cache to ensure env vars are picked up
jest.resetModules();

// Suppress environment validation logging during tests
// This prevents duplicate validation messages in test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = (...args) => {
  const message = args[0];
  if (typeof message === 'string' && (
    message.includes('Environment validation') ||
    message.includes('warnings found') ||
    message.includes('Summary:') ||
    message.includes('Development mode') ||
    message.includes('NEXT_PUBLIC_') ||
    message.includes('Using default value') ||
    message.includes('Stripe initialized')
  )) {
    return; // Suppress environment validation logs in tests
  }
  originalConsoleLog(...args);
};

// Store the original console.error for restoration
(global as any).__originalConsoleError = originalConsoleError;

// Check if console.error is already a jest mock (has mockImplementation property)
const isConsoleMocked = console.error && typeof console.error.mockImplementation === 'function';

// Only override console.error if it hasn't been mocked by a test
if (!isConsoleMocked) {
  console.error = (...args) => {
    const message = String(args[0]);
    if (typeof message === 'string') {
      // Suppress Stripe validation errors in tests
      if (message.includes('Environment validation failed') ||
          message.includes('Found') && message.includes('errors:') ||
          message.includes('STRIPE_SECRET_KEY') ||
          message.includes('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') ||
          message.includes('STRIPE_WEBHOOK_SECRET') ||
          message.includes('Required environment variable is missing')) {
        return;
      }
      
      // Suppress React act() warnings - these are handled by test quality monitoring
      if (message.includes('An update to') && message.includes('not wrapped in act')) {
        // Track count for monitoring (increment global counter if it exists)
        if (typeof global.__actWarningCount === 'number') {
          global.__actWarningCount++;
        }
        return; // Suppress the warning
      }
    }
    
    originalConsoleError(...args);
  };
}

// Polyfill fetch APIs for Node environment
if (typeof global.fetch === 'undefined') {
  const nodeFetch = require('node-fetch');
  global.fetch = nodeFetch;
  global.Request = nodeFetch.Request;
  global.Response = nodeFetch.Response;
  global.Headers = nodeFetch.Headers;
}

// Ensure globalThis has the same references
globalThis.fetch = global.fetch;
globalThis.Request = global.Request;
globalThis.Response = global.Response;
globalThis.Headers = global.Headers;