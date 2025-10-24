/**
 * Stripe SDK Probe - Test outside Jest
 * 
 * This will definitively tell us if the issue is Jest/transform related
 * or a fundamental Stripe package problem.
 */

const Stripe = require('stripe').default || require('stripe')
const dotenv = require('dotenv')

// Load environment
dotenv.config({ path: '.env.local' })

console.log('=== Stripe SDK Probe ===')

try {
  // Check Stripe package version
  const stripeVersion = require('stripe/package.json').version
  console.log('✅ Stripe package version:', stripeVersion)
} catch (e) {
  console.log('❌ Could not detect Stripe package version:', e.message)
}

// Test Stripe instance creation
const key = process.env.STRIPE_SECRET_KEY
if (!key?.startsWith('sk_test_')) {
  console.log('❌ No valid Stripe test key found')
  process.exit(1)
}

console.log('✅ Using Stripe key:', key.slice(0, 10) + '...')

// Create Stripe instance
const stripe = new Stripe(key, {
  apiVersion: '2025-07-30.basil',
  timeout: 30000,
  maxNetworkRetries: 2,
})

console.log('✅ Stripe instance created')
console.log('Available properties:', Object.keys(stripe).sort())
console.log('Has customers API:', !!stripe.customers)
console.log('Has paymentIntents API:', !!stripe.paymentIntents)
console.log('Has webhooks API:', !!stripe.webhooks)
console.log('customers type:', typeof stripe.customers)

if (stripe.customers) {
  console.log('✅ Full Stripe SDK detected - customers API available')
  console.log('customers methods:', Object.keys(stripe.customers))
} else {
  console.log('❌ Partial Stripe SDK - missing customers API')
  console.log('This suggests a package installation or import issue')
}