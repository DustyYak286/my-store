/**
 * Mock Setup for Integration Tests
 * 
 * This file sets up all the necessary mocks for integration tests.
 * It must run before any tests to ensure mocks are applied correctly.
 */

// Stripe client mocking is handled by factory pattern in individual tests
// Integration tests use jest.doMock() with createMockStripeOperations() for test isolation

// Order store mocking is handled by factory pattern in individual tests
// Integration tests use jest.doMock() with createMockOrderStore() for test isolation

// Environment validation is handled by Jest module mapper -> __mocks__/utils/envValidation
// Removed duplicate mock to prevent conflicts (integration tests use __mocks__ via moduleNameMapper)

console.log('✅ Integration test mocks configured successfully');