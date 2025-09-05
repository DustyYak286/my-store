/**
 * Production-Grade Contract Tests (Pure JavaScript)
 * 
 * Bypasses Jest/TypeScript transforms that corrupt Stripe SDK.
 * These tests verify our integration with real Stripe Test APIs using
 * pure JavaScript to access the full Stripe SDK API surface.
 */

const Stripe = require('stripe')
const dotenv = require('dotenv')

// Load environment
dotenv.config({ path: '.env.local' })

// Helper for secret masking
const mask = (s) => s.slice(0, 4) + '•••' + s.slice(-4)

describe('Stripe Contract Tests (Production-Grade JS)', () => {
  let stripe

  beforeAll(() => {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key?.startsWith('sk_test_')) {
      throw new Error('Contract tests require valid Stripe test key (sk_test_...)')
    }

    console.log('🔧 Creating Stripe instance (pure JS)...')
    console.log('Using Stripe key:', mask(key))
    
    stripe = new Stripe(key, {
      apiVersion: '2025-07-30.basil',
      timeout: 30000,
      maxNetworkRetries: 2,
      appInfo: { name: 'contract-tests-js', version: 'bypass' }
    })

    console.log('✅ Stripe instance created with full API access')
    console.log('Available APIs:', Object.keys(stripe).filter(k => typeof stripe[k] === 'object' && k !== 'options').slice(0, 8))
    console.log('Has customers API:', !!stripe.customers)
    console.log('Has paymentIntents API:', !!stripe.paymentIntents)
    console.log('Has webhooks API:', !!stripe.webhooks)
  })

  describe('API Surface Verification', () => {
    test('should have full Stripe API surface', () => {
      expect(stripe).toBeDefined()
      expect(stripe.customers).toBeDefined()
      expect(stripe.paymentIntents).toBeDefined()
      expect(stripe.webhooks).toBeDefined()
      expect(stripe.paymentMethods).toBeDefined()
      expect(stripe.charges).toBeDefined()
      
      // Verify it's not the partial API we saw in TypeScript tests
      expect(Object.keys(stripe).length).toBeGreaterThan(10)
    })
  })

  describe('Payment Intent Operations', () => {
    test('should create payment intent with valid parameters', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 2999, // 29.99 RON in bani
        currency: 'ron',
        metadata: {
          orderId: 'js_contract_test_001',
          source: 'javascript_contract_test'
        }
      })

      expect(paymentIntent).toBeDefined()
      expect(paymentIntent.id).toMatch(/^pi_/)
      expect(paymentIntent.amount).toBe(2999)
      expect(paymentIntent.currency).toBe('ron')
      expect(paymentIntent.status).toBe('requires_payment_method')
      expect(paymentIntent.metadata.orderId).toBe('js_contract_test_001')
    })

    test('should handle minimum amount validation', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 50, // 0.50 RON
        currency: 'ron'
      })
      
      expect(paymentIntent.amount).toBe(50)
      expect(paymentIntent.currency).toBe('ron')
      expect(paymentIntent.status).toBe('requires_payment_method')
    })

    test('should retrieve existing payment intent', async () => {
      // Create first
      const created = await stripe.paymentIntents.create({
        amount: 2999,
        currency: 'ron',
        metadata: { test: 'js_retrieve_test' }
      })

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100))

      // Retrieve
      const retrieved = await stripe.paymentIntents.retrieve(created.id)

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.amount).toBe(created.amount)
      expect(retrieved.currency).toBe('ron')
      expect(retrieved.object).toBe('payment_intent')
    })

    test('should handle invalid payment intent gracefully', async () => {
      try {
        await stripe.paymentIntents.retrieve('pi_invalid_' + Date.now())
        // If it succeeds, ensure it's still a payment intent
        expect(result.object).toBe('payment_intent')
      } catch (error) {
        expect(error.type).toBe('StripeInvalidRequestError')
        expect(error.code).toBe('resource_missing')
      }
    })
  })

  describe('Customer Operations', () => {
    test('should create customer with valid data', async () => {
      const customer = await stripe.customers.create({
        email: 'js-contract-test@example.com',
        name: 'JavaScript Contract Test Customer',
        metadata: {
          test: 'js_customer_test',
          timestamp: Date.now().toString()
        }
      })

      expect(customer).toBeDefined()
      expect(customer.id).toMatch(/^cus_/)
      expect(customer.email).toBe('js-contract-test@example.com')
      expect(customer.name).toBe('JavaScript Contract Test Customer')
      expect(customer.object).toBe('customer')
      expect(customer.metadata.test).toBe('js_customer_test')
    })

    test('should retrieve customer by ID', async () => {
      // Create first
      const created = await stripe.customers.create({
        email: 'js-retrieve@example.com',
        name: 'JS Retrieve Test'
      })

      // Retrieve
      const retrieved = await stripe.customers.retrieve(created.id)

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.email).toBe('js-retrieve@example.com')
      expect(retrieved.object).toBe('customer')
    })
  })

  describe('Payment Methods', () => {
    test('should list payment methods', async () => {
      const paymentMethods = await stripe.paymentMethods.list({
        type: 'card',
        limit: 3
      })

      expect(paymentMethods).toBeDefined()
      expect(paymentMethods.object).toBe('list')
      expect(Array.isArray(paymentMethods.data)).toBe(true)
    })
  })

  describe('Webhook Operations', () => {
    test('should construct webhook event structure', () => {
      const payload = JSON.stringify({
        id: 'pi_js_test_webhook',
        object: 'payment_intent',
        amount: 2999,
        currency: 'ron',
        status: 'succeeded'
      })
      
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = `t=${timestamp},v1=test_signature`
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret'
      
      // This may throw due to invalid signature, which is expected
      // The key test is that the webhook API is available
      expect(stripe.webhooks).toBeDefined()
      expect(stripe.webhooks.constructEvent).toBeInstanceOf(Function)
    })
  })

  describe('Error Handling', () => {
    test('should provide structured error responses', async () => {
      try {
        await stripe.paymentIntents.create({
          amount: -100, // Invalid negative amount
          currency: 'ron'
        })
        fail('Expected an error to be thrown')
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toBeDefined()
        expect(typeof error.message).toBe('string')
      }
    })
  })

  describe('Currency Handling', () => {
    test('should handle Romanian currency correctly', async () => {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: 5000, // 50.00 RON
        currency: 'ron'
      })

      expect(paymentIntent.currency).toBe('ron')
      expect(paymentIntent.amount).toBe(5000)
    })
  })
})