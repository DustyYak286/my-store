/**
 * Contract Test Setup
 * 
 * Setup for contract tests that verify our integration with real Stripe Test APIs.
 * These tests validate API contracts, parameter validation, and error handling
 * without the full weight of E2E tests.
 */

import { getStripe, resetStripeClient } from './stripeClient'

// Add version diagnostics (expert recommendation #5)
try {
  const stripeVersion = require('stripe/package.json').version
  console.log('Contract tests using stripe@', stripeVersion)
} catch (e) {
  console.log('Could not detect Stripe version')
}

// Helper for secret masking (expert recommendation #5)
const mask = (s: string) => s.slice(0, 4) + '•••' + s.slice(-4)

// Validate environment for contract tests
const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
] as const

beforeAll(() => {
  // Ensure we're using test keys
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey?.startsWith('sk_test_')) {
    throw new Error(
      'Contract tests must use Stripe test keys (sk_test_...). ' +
      'Set STRIPE_SECRET_KEY to a test key or skip contract tests.'
    )
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey?.startsWith('pk_test_')) {
    throw new Error(
      'Contract tests must use Stripe test keys (pk_test_...). ' +
      'Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to a test key or skip contract tests.'
    )
  }

  // Validate all required environment variables
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing environment variables for contract tests: ${missing.join(', ')}`)
  }

  console.log('✅ Contract test environment validated')
  console.log('Using Stripe secret key:', mask(secretKey))
  console.log('Using Stripe publishable key:', mask(publishableKey))
})

// Initialize Stripe singleton for contract tests
beforeAll(() => {
  // Validate environment - the singleton will handle Stripe creation
  const stripe = getStripe()
  
  // Make Stripe instance available globally for backward compatibility
  // (Eventually we'll migrate all tests to use getStripe() directly)
  ;(global as any).__STRIPE_INTEGRATION__ = stripe
})

// Cleanup after each test to prevent test pollution
afterEach(async () => {
  // Add small delay to avoid hitting Stripe rate limits
  await new Promise(resolve => setTimeout(resolve, 100))
})

// Global cleanup
afterAll(async () => {
  // Clean up singleton instance
  resetStripeClient()
  ;(global as any).__STRIPE_INTEGRATION__ = undefined
  console.log('🧹 Contract test cleanup completed')
})