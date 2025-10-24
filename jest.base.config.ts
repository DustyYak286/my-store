import type { Config } from 'jest'

// Shared base configuration for all test types
export const baseConfig: Partial<Config> = {
  setupFilesAfterEnv: [
    '<rootDir>/tests/config/test-environment.ts',  // Load centralized environment first
    '<rootDir>/tests/setup/test-env.ts',           // Legacy compatibility layer
    '<rootDir>/jest.setup.ts',
    // NOTE: integration.setup.ts is NOT included in base config as it forces real Stripe
    // It's only used by specific test configs that need real Stripe (api-integration, contract)
  ],
  testEnvironment: 'node', // Use node environment for API tests
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock environment validation for tests
    '^@/utils/envValidation$': '<rootDir>/__mocks__/utils/envValidation',
    // Mock stripe configuration for tests
    '^@/config/stripe$': '<rootDir>/__mocks__/config/stripe',
  },
  // Run tests serially to avoid conflicts and rate limiting
  maxWorkers: 1,
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Transform settings for Next.js
  transform: {
    '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  
  // Global test timeout
  testTimeout: 30000,
  // Collect coverage from test-relevant files
  collectCoverageFrom: [
    'src/app/api/**/*.{ts,tsx}',
    'src/lib/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  // Environment setup for tests
  globalSetup: '<rootDir>/tests/setup/global.setup.ts',
  globalTeardown: '<rootDir>/tests/setup/global.teardown.ts',
}