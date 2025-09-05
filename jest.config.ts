import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Expert recommendation: Separate "contract tests" as a Jest project
// This prevents unit-test globals and transforms from affecting Stripe SDK
const config: Config = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: [
        '<rootDir>/tests/setup/test-env.ts',  // Load first
        '<rootDir>/jest.setup.ts',
        '<rootDir>/tests/setup/unit.setup.ts', // Unit test specific setup with mocks
      ],
      testEnvironment: 'jsdom',
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // Mock environment validation for unit tests
        '^@/utils/envValidation$': '<rootDir>/__mocks__/utils/envValidation',
      },
      maxWorkers: 1,
      clearMocks: true,
      restoreMocks: true,
      testTimeout: 30000,
      // Transform files properly for unit tests
      transform: {
        '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
      },
    },
    {
      displayName: 'contract',
      testMatch: ['<rootDir>/tests/contract/**/*.test.{ts,js}'],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup/contract-env.ts'],          // loads real env
      setupFilesAfterEnv: ['<rootDir>/tests/setup/contract.setup.ts'],
      testTimeout: 60_000,
      // Expert recommendation: Stripe APIs + account rate limits are happier serially
      maxWorkers: 1,
      // Exclude node_modules from transformation to avoid SDK corruption (expert rec. #7.4)
      transformIgnorePatterns: [
        '/node_modules/(?!stripe/)',  // Transform everything in node_modules except stripe
      ],
      // Minimal transforms for contract tests - only transform our test files
      transform: {
        '^.+\\.(ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)