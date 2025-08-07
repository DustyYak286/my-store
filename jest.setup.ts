import '@testing-library/jest-dom'

// Set up test environment variables to prevent validation failures
// ⚠️  WARNING: These are FAKE keys with correct format for testing only
// ⚠️  These are NOT real Stripe keys and cannot be used for actual payments
// ⚠️  Real keys should NEVER be committed to version control
process.env.STRIPE_SECRET_KEY = 'sk_test_fake1234567890abcdefghijk';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_fake1234567890abcdefghijk';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake1234567890abcdefghijk';

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

console.error = (...args) => {
  const message = args[0];
  if (typeof message === 'string' && (
    message.includes('Environment validation failed') ||
    message.includes('Found') && message.includes('errors:') ||
    message.includes('STRIPE_SECRET_KEY') ||
    message.includes('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') ||
    message.includes('STRIPE_WEBHOOK_SECRET') ||
    message.includes('Required environment variable is missing')
  )) {
    return; // Suppress Stripe validation errors in tests
  }
  originalConsoleError(...args);
};