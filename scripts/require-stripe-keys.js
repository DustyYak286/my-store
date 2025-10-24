#!/usr/bin/env node

/**
 * Stripe Keys Validation Script
 * 
 * This script validates that required Stripe environment variables are present
 * and correctly formatted before running tests that require real Stripe API calls.
 * 
 * Usage:
 *   node scripts/require-stripe-keys.js
 *   node scripts/require-stripe-keys.js --strict (treats warnings as errors)
 */

const fs = require('fs')
const path = require('path')

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
}

// Configuration
const REQUIRED_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET', 
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
]

const EXIT_CODES = {
  SUCCESS: 0,
  MISSING_KEYS: 1,
  INVALID_FORMAT: 2,
  MISMATCHED_ENV: 3,
  SCRIPT_ERROR: 4
}

/**
 * Load environment variables from .env files
 */
function loadEnvironment() {
  const envFiles = ['.env.local', '.env']
  
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file)
    if (fs.existsSync(envPath)) {
      console.log(`${colors.blue}📄 Loading environment from ${file}${colors.reset}`)
      require('dotenv').config({ path: envPath })
      break
    }
  }
}

/**
 * Validate that all required keys are present
 */
function validateRequiredKeys() {
  const missingKeys = REQUIRED_KEYS.filter(key => !process.env[key])
  
  if (missingKeys.length > 0) {
    console.error(`${colors.red}${colors.bold}❌ Missing required environment variables:${colors.reset}`)
    missingKeys.forEach(key => {
      console.error(`   ${colors.red}• ${key}${colors.reset}`)
    })
    console.error(`\n${colors.yellow}💡 To fix this:${colors.reset}`)
    console.error(`   1. Create a .env.local file in the project root`)
    console.error(`   2. Add your Stripe test keys:`)
    console.error(`      STRIPE_SECRET_KEY=sk_test_...`)
    console.error(`      STRIPE_WEBHOOK_SECRET=whsec_...`)
    console.error(`      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`)
    console.error(`   3. Get test keys from: https://dashboard.stripe.com/test/apikeys`)
    
    return { success: false, code: EXIT_CODES.MISSING_KEYS }
  }
  
  return { success: true }
}

/**
 * Validate key formats and environment consistency
 */
function validateKeyFormats() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  
  const issues = []
  
  // Check secret key format
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    issues.push({
      type: 'error',
      message: 'STRIPE_SECRET_KEY must start with sk_test_ or sk_live_',
      current: secretKey.substring(0, 10) + '...'
    })
  }
  
  // Check publishable key format  
  if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
    issues.push({
      type: 'error',
      message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_',
      current: publishableKey.substring(0, 10) + '...'
    })
  }
  
  // Check webhook secret format
  if (!webhookSecret.startsWith('whsec_')) {
    issues.push({
      type: 'error', 
      message: 'STRIPE_WEBHOOK_SECRET must start with whsec_',
      current: webhookSecret.substring(0, 10) + '...'
    })
  }
  
  // Check environment consistency
  const isSecretTest = secretKey.startsWith('sk_test_')
  const isPublishableTest = publishableKey.startsWith('pk_test_')
  
  if (isSecretTest !== isPublishableTest) {
    issues.push({
      type: 'error',
      message: 'Secret key and publishable key must be from the same environment (both test or both live)',
      current: `Secret: ${isSecretTest ? 'test' : 'live'}, Publishable: ${isPublishableTest ? 'test' : 'live'}`
    })
  }
  
  // Warn if using live keys (this script is primarily for test environments)
  if (!isSecretTest) {
    issues.push({
      type: 'warning',
      message: 'Using live Stripe keys - ensure this is intentional',
      current: 'Live environment detected'
    })
  }
  
  // Report issues
  if (issues.length > 0) {
    const errors = issues.filter(i => i.type === 'error')
    const warnings = issues.filter(i => i.type === 'warning')
    
    if (errors.length > 0) {
      console.error(`${colors.red}${colors.bold}❌ Key format errors:${colors.reset}`)
      errors.forEach(issue => {
        console.error(`   ${colors.red}• ${issue.message}${colors.reset}`)
        console.error(`     Current: ${issue.current}`)
      })
    }
    
    if (warnings.length > 0) {
      console.warn(`${colors.yellow}${colors.bold}⚠️  Warnings:${colors.reset}`)
      warnings.forEach(issue => {
        console.warn(`   ${colors.yellow}• ${issue.message}${colors.reset}`)
        console.warn(`     ${issue.current}`)
      })
    }
    
    if (errors.length > 0) {
      return { success: false, code: EXIT_CODES.INVALID_FORMAT }
    }
    
    // Handle strict mode for warnings
    const isStrict = process.argv.includes('--strict')
    if (isStrict && warnings.length > 0) {
      console.error(`\n${colors.red}Strict mode: treating warnings as errors${colors.reset}`)
      return { success: false, code: EXIT_CODES.MISMATCHED_ENV }
    }
  }
  
  return { success: true }
}

/**
 * Test basic connectivity to Stripe (optional)
 * Note: Contract tests handle their own connectivity testing
 */
async function testConnectivity() {
  console.log(`${colors.blue}🔌 Skipping connectivity test - contract tests handle this directly${colors.reset}`)
  return { success: true }
}

/**
 * Main validation function
 */
async function main() {
  console.log(`${colors.bold}🔑 Validating Stripe environment keys...${colors.reset}\n`)
  
  try {
    // Load environment
    loadEnvironment()
    
    // Validate required keys are present
    const requiredResult = validateRequiredKeys()
    if (!requiredResult.success) {
      process.exit(requiredResult.code)
    }
    
    // Validate key formats
    const formatResult = validateKeyFormats()
    if (!formatResult.success) {
      process.exit(formatResult.code)
    }
    
    // Test connectivity (optional)
    await testConnectivity()
    
    // Success
    console.log(`\n${colors.green}${colors.bold}✅ All Stripe environment validations passed!${colors.reset}`)
    console.log(`${colors.green}   Ready to run tests with real Stripe API${colors.reset}`)
    
    process.exit(EXIT_CODES.SUCCESS)
    
  } catch (error) {
    console.error(`${colors.red}${colors.bold}💥 Script error:${colors.reset}`)
    console.error(`   ${error.message}`)
    console.error(`   ${error.stack}`)
    process.exit(EXIT_CODES.SCRIPT_ERROR)
  }
}

// Run the script
if (require.main === module) {
  main()
}

module.exports = {
  validateRequiredKeys,
  validateKeyFormats,
  testConnectivity,
  EXIT_CODES
}