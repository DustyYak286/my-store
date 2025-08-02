import '@testing-library/jest-dom'

// Suppress environment validation logging during tests
// This prevents duplicate validation messages in test output
const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = args[0];
  if (typeof message === 'string' && (
    message.includes('Environment validation') ||
    message.includes('warnings found') ||
    message.includes('Summary:') ||
    message.includes('Development mode') ||
    message.includes('NEXT_PUBLIC_') ||
    message.includes('Using default value')
  )) {
    return; // Suppress environment validation logs in tests
  }
  originalConsoleLog(...args);
};