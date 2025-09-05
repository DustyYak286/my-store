import type { Config } from 'jest'
import nextJest from 'next/jest.js'
import { baseConfig } from './jest.base.config'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Contract test specific configuration (small subset of real Stripe tests)
const config: Config = {
  ...baseConfig,
  displayName: 'Contract Tests (Real Stripe API)',
  testEnvironment: 'node',
  
  // Prevent unit test setup from overriding real Stripe keys
  setupFiles: [
    '<rootDir>/tests/setup/contract-env.ts',
  ],
  testMatch: [
    '<rootDir>/tests/contract/**/*.test.{ts,tsx,js,jsx}',
  ],
  // Extended timeout for real API calls
  testTimeout: 60000,
  coverageDirectory: 'coverage/contract',
  
  // Use real modules for contract tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Use real environment validation for contract tests
    '^@/utils/envValidation$': '<rootDir>/src/utils/envValidation',
  },
  
  // Don't automatically mock anything
  automock: false,
  
  // Contract-specific setup
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/test-env.ts',
    '<rootDir>/jest.setup.ts',
    '<rootDir>/tests/setup/contract.setup.ts',
  ],
  
  // Run contract tests serially to avoid API rate limits
  maxWorkers: 1,
  
  // Verbose output to track API calls
  verbose: true,
  
  // Memory management for API tests
  logHeapUsage: true,
  
  // Clear mocks but don't restore mocks (let real APIs work)
  clearMocks: true,
  restoreMocks: false,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)