/**
 * Contract Test Stripe Client Singleton
 * 
 * Production-grade Stripe client for contract tests.
 * Uses singleton pattern to avoid multiple instantiations and ensure
 * proper resource management across test files.
 */

// Use default import only (expert recommendation #1)
import Stripe from 'stripe'
import { testConfig } from '@/../tests/config/test-environment'

let stripe: Stripe | undefined

export function getStripe(): Stripe {
  if (!stripe) {
    const key = testConfig.STRIPE_SECRET_KEY!
    
    // Validate we have a real test key
    if (!key?.startsWith('sk_test_')) {
      throw new Error('Contract tests require a valid Stripe test key (sk_test_...)')
    }
    
    // Add version diagnostics (expert recommendation #5)
    try {
      const stripeVersion = require('stripe/package.json').version
      console.log('stripe@', stripeVersion)
    } catch (e) {
      console.log('Could not detect Stripe version')
    }
    
    // Mask secrets properly (expert recommendation #5)
    const mask = (s: string) => s.slice(0, 4) + '•••' + s.slice(-4)
    console.log('Using Stripe key:', mask(key))
    
    // Use stable API version, avoid preview tags (expert recommendation #1)
    stripe = new Stripe(key, {
      apiVersion: '2025-07-30.basil', // Latest stable version
      timeout: 30000,
      maxNetworkRetries: 2,
      appInfo: { name: 'contract-tests', version: 'tests' }
    })
    
    console.log('Stripe instance created. Available methods:', Object.keys(stripe))
    console.log('Has customers?', !!stripe.customers)
    console.log('Has paymentIntents?', !!stripe.paymentIntents)
    console.log('stripe.customers type:', typeof stripe.customers)
  }
  
  return stripe
}

/**
 * Reset the singleton instance (for cleanup in tests)
 */
export function resetStripeClient(): void {
  stripe = undefined
}