import type { Config } from 'jest'
import nextJest from 'next/jest.js'
import { baseConfig } from './jest.base.config'

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Mocked integration test specific configuration
const config: Config = {
  ...baseConfig,
  displayName: 'Integration Tests (Mocked)',
  testMatch: [
    '<rootDir>/tests/integration-mocked/**/*.test.{ts,tsx,js,jsx}',
  ],
  // Standard timeout for mocked tests
  testTimeout: 30000,
  coverageDirectory: 'coverage/integration-mocked',
  
  // Use __mocks__ directory for integration tests
  automock: false,
  
  // Proper Jest cleanup configuration (omit resetMocks to keep custom implementations)
  clearMocks: true,
  restoreMocks: true,
  
  // MOCKED integration-specific setup - NO real Stripe setup
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/test-env.ts',
    '<rootDir>/jest.setup.ts',
    '<rootDir>/tests/setup/integration-mocks.setup.ts', // Mock setup for mocked integration tests
    // NOTE: integration.setup.ts is NOT included here as it forces real Stripe (jest.dontMock)
    // Real Stripe setup is handled by api-integration and contract test configs
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)