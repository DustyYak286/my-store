import type { Config } from 'jest'
import nextJest from 'next/jest.js'
import { baseConfig } from './jest.base.config'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// API Integration test specific configuration
const config: Config = {
  ...baseConfig,
  displayName: 'API Integration Tests (Real Stripe)',
  testEnvironment: 'node', // Use node environment for API integration tests with Next.js APIs
  testMatch: [
    '<rootDir>/tests/api-integration/**/*.test.{ts,tsx,js,jsx}',
  ],
  // Extended timeout for API integration tests (increased for production-grade tests)
  testTimeout: 180000,
  
  // API integration-specific setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/test-env.ts',  // Load first
    '<rootDir>/jest.setup.ts',
    '<rootDir>/tests/setup/e2e.setup.ts', // E2E specific setup
  ],
  // Additional coverage for API integration tests
  collectCoverageFrom: [
    'src/app/api/**/*.{ts,tsx}',
    'src/lib/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage/api-integration',
  // Verbose output for API integration tests to track progress
  verbose: true,
  // Memory management for long-running API integration tests
  logHeapUsage: true,
  
  // CRITICAL: Override module mapping to use real modules for API integration tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Use real environment validation for API integration tests
    '^@/utils/envValidation$': '<rootDir>/src/utils/envValidation',
  },
  
  // Don't automatically mock anything for API integration tests
  automock: false,
  
  // Clear mocks but don't restore mocks (let real APIs work)
  clearMocks: true,
  restoreMocks: false,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)