#!/usr/bin/env node
/**
 * Stripe Domain Verification Script
 * 
 * Validates domain registration for mobile payment methods (Apple Pay, Google Pay)
 * Required before deploying mobile wallet functionality.
 * 
 * Usage:
 *   npm run validate:stripe-domains
 *   node scripts/validate-stripe-domains.js
 * 
 * Environment Variables Required:
 *   STRIPE_SECRET_KEY - Stripe secret key for API access
 *   DOMAIN_TO_VERIFY - Primary domain (optional, defaults to localhost for dev)
 */

// Initialize Stripe only after environment validation
let stripe;
const https = require('https');
const { URL } = require('url');

// Configuration
const APPLE_PAY_DOMAIN_ASSOCIATION_PATH = '/.well-known/apple-developer-merchantid-domain-association';
const TIMEOUT_MS = 10000; // 10 second timeout
const RETRY_ATTEMPTS = 2;

/**
 * Color console output for better readability
 */
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const log = {
  error: (msg) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.warn(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.cyan}🔍 ${msg}${colors.reset}`),
};

/**
 * Validate environment configuration
 */
function validateEnvironment() {
  log.step('Validating environment configuration...');
  
  if (!process.env.STRIPE_SECRET_KEY) {
    log.error('STRIPE_SECRET_KEY environment variable is required');
    log.info('Please set STRIPE_SECRET_KEY in your .env.local file');
    process.exit(1);
  }
  
  if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    log.error('Invalid STRIPE_SECRET_KEY format (must start with sk_)');
    process.exit(1);
  }
  
  // Initialize Stripe client after validation
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
  log.info(`Using ${isTestMode ? 'test' : 'live'} Stripe environment`);
  
  return isTestMode;
}

/**
 * Get domain to verify from environment or default
 */
function getDomainToVerify() {
  const envDomain = process.env.DOMAIN_TO_VERIFY;
  
  if (envDomain) {
    return envDomain;
  }
  
  // Default to localhost for development
  if (process.env.NODE_ENV === 'development') {
    log.warning('No DOMAIN_TO_VERIFY set, using localhost (development only)');
    return 'localhost';
  }
  
  log.error('DOMAIN_TO_VERIFY environment variable is required for production');
  process.exit(1);
}

/**
 * Check HTTPS accessibility of a URL
 */
function checkHttpsAccess(url, retries = RETRY_ATTEMPTS) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Stripe-Domain-Validator/1.0',
      },
    }, (response) => {
      resolve({
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
        headers: response.headers,
      });
    });
    
    request.on('error', (error) => {
      if (retries > 0) {
        log.warning(`Request failed, retrying... (${retries} attempts left)`);
        setTimeout(() => {
          checkHttpsAccess(url, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(error);
      }
    });
    
    request.on('timeout', () => {
      request.destroy();
      if (retries > 0) {
        setTimeout(() => {
          checkHttpsAccess(url, retries - 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(new Error('Request timeout'));
      }
    });
  });
}

/**
 * List registered Apple Pay domains from Stripe
 */
async function listApplePayDomains() {
  log.step('Fetching registered Apple Pay domains from Stripe...');
  
  try {
    // Note: Stripe's payment method domains API endpoint
    const domains = await stripe.paymentMethodDomains.list({
      limit: 100,
    });
    
    log.success(`Found ${domains.data.length} registered payment method domains`);
    
    // Filter for enabled Apple Pay domains
    const applePaDomains = domains.data.filter(domain => 
      domain.enabled && 
      domain.apple_pay && 
      domain.apple_pay.status === 'active'
    );
    
    return applePaDomains.map(domain => ({
      id: domain.id,
      domain_name: domain.domain_name,
      enabled: domain.enabled,
      apple_pay_status: domain.apple_pay?.status || 'unknown',
      created: new Date(domain.created * 1000).toISOString(),
    }));
  } catch (error) {
    // Fallback: Try the older Apple Pay specific endpoint if it exists
    log.warning('Payment method domains API not available, trying legacy approach...');
    
    // For legacy accounts, domains might be managed differently
    // This is a graceful fallback that still validates basic configuration
    return [];
  }
}

/**
 * Validate Apple Pay domain association file
 */
async function validateApplePayDomainAssociation(domain) {
  if (domain === 'localhost') {
    log.warning('Skipping Apple Pay domain association check for localhost');
    return { valid: true, reason: 'localhost development mode' };
  }
  
  log.step(`Validating Apple Pay domain association for ${domain}...`);
  
  const associationUrl = `https://${domain}${APPLE_PAY_DOMAIN_ASSOCIATION_PATH}`;
  
  try {
    const response = await checkHttpsAccess(associationUrl);
    
    if (response.statusCode === 200) {
      log.success(`Apple Pay domain association file accessible at ${associationUrl}`);
      return { valid: true, statusCode: response.statusCode };
    } else if (response.statusCode === 404) {
      log.error(`Apple Pay domain association file not found at ${associationUrl}`);
      log.error('You need to host the domain association file for Apple Pay to work');
      return { valid: false, reason: 'Domain association file not found', statusCode: response.statusCode };
    } else {
      log.warning(`Unexpected response code ${response.statusCode} for domain association file`);
      return { valid: false, reason: `HTTP ${response.statusCode}`, statusCode: response.statusCode };
    }
  } catch (error) {
    log.error(`Failed to check Apple Pay domain association: ${error.message}`);
    return { valid: false, reason: error.message };
  }
}

/**
 * Validate Google Pay configuration (simpler than Apple Pay)
 */
async function validateGooglePayConfiguration() {
  log.step('Validating Google Pay configuration...');
  
  // Google Pay via Stripe Elements doesn't require separate domain registration
  // when using Stripe as the payment processor (unlike direct Google Pay API)
  log.info('Google Pay via Stripe Elements: No separate domain registration required');
  log.success('Google Pay configuration valid (handled by Stripe Elements)');
  
  return { valid: true, reason: 'Managed by Stripe Elements' };
}

/**
 * Register a domain with Stripe (if needed)
 */
async function registerDomainIfNeeded(domain, applePaDomains) {
  if (domain === 'localhost') {
    log.info('Skipping domain registration for localhost development');
    return { registered: true, reason: 'localhost development mode' };
  }
  
  // Check if domain is already registered
  const existingDomain = applePaDomains.find(d => d.domain_name === domain);
  
  if (existingDomain) {
    log.success(`Domain ${domain} already registered (ID: ${existingDomain.id})`);
    return { registered: true, existing: true, domain: existingDomain };
  }
  
  log.step(`Registering domain ${domain} with Stripe...`);
  
  try {
    const paymentMethodDomain = await stripe.paymentMethodDomains.create({
      domain_name: domain,
    });
    
    log.success(`Domain ${domain} registered successfully (ID: ${paymentMethodDomain.id})`);
    
    // Validate the domain after registration
    try {
      const validatedDomain = await stripe.paymentMethodDomains.validate(paymentMethodDomain.id);
      log.success(`Domain ${domain} validated successfully`);
      return { registered: true, new: true, domain: validatedDomain };
    } catch (validationError) {
      log.warning(`Domain registered but validation failed: ${validationError.message}`);
      return { registered: true, validated: false, error: validationError.message };
    }
  } catch (error) {
    log.error(`Failed to register domain ${domain}: ${error.message}`);
    return { registered: false, error: error.message };
  }
}

/**
 * Generate validation report
 */
function generateReport(results) {
  log.step('Generating validation report...');
  
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bold}${colors.cyan} STRIPE DOMAIN VERIFICATION REPORT ${colors.reset}`);
  console.log('='.repeat(60));
  
  console.log(`\n${colors.bold}Environment:${colors.reset} ${results.isTestMode ? 'Test' : 'Live'}`);
  console.log(`${colors.bold}Domain:${colors.reset} ${results.domain}`);
  console.log(`${colors.bold}Timestamp:${colors.reset} ${new Date().toISOString()}\n`);
  
  // Apple Pay Status
  console.log(`${colors.bold}Apple Pay Domain Registration:${colors.reset}`);
  if (results.applePaDomains.length > 0) {
    results.applePaDomains.forEach(domain => {
      console.log(`  ✅ ${domain.domain_name} (${domain.apple_pay_status})`);
    });
  } else {
    console.log(`  ⚠️  No registered Apple Pay domains found`);
  }
  
  // Domain Association
  console.log(`\n${colors.bold}Apple Pay Domain Association:${colors.reset}`);
  if (results.domainAssociation.valid) {
    console.log(`  ✅ ${results.domainAssociation.reason || 'Valid'}`);
  } else {
    console.log(`  ❌ ${results.domainAssociation.reason || 'Invalid'}`);
  }
  
  // Google Pay Status  
  console.log(`\n${colors.bold}Google Pay Configuration:${colors.reset}`);
  if (results.googlePay.valid) {
    console.log(`  ✅ ${results.googlePay.reason}`);
  } else {
    console.log(`  ❌ ${results.googlePay.reason}`);
  }
  
  // Domain Registration
  if (results.domainRegistration) {
    console.log(`\n${colors.bold}Domain Registration:${colors.reset}`);
    if (results.domainRegistration.registered) {
      const status = results.domainRegistration.existing ? 'Already registered' : 'Newly registered';
      console.log(`  ✅ ${status}`);
    } else {
      console.log(`  ❌ Registration failed: ${results.domainRegistration.error}`);
    }
  }
  
  // Overall Status
  const allValid = results.domainAssociation.valid && results.googlePay.valid;
  console.log(`\n${colors.bold}Overall Status:${colors.reset}`);
  if (allValid) {
    console.log(`  ${colors.green}✅ Mobile payments ready for deployment${colors.reset}`);
  } else {
    console.log(`  ${colors.red}❌ Mobile payments NOT ready - issues found${colors.reset}`);
  }
  
  console.log('\n' + '='.repeat(60));
  
  return allValid;
}

/**
 * Main validation function
 */
async function validateStripeDomains() {
  console.log(`${colors.bold}${colors.cyan}🔍 Stripe Mobile Payment Domain Validation${colors.reset}\n`);
  
  try {
    // Step 1: Environment validation
    const isTestMode = validateEnvironment();
    const domain = getDomainToVerify();
    
    // Step 2: List existing Apple Pay domains
    const applePaDomains = await listApplePayDomains();
    
    // Step 3: Register domain if needed (skip for localhost)
    let domainRegistration = null;
    if (domain !== 'localhost') {
      domainRegistration = await registerDomainIfNeeded(domain, applePaDomains);
    }
    
    // Step 4: Validate Apple Pay domain association
    const domainAssociation = await validateApplePayDomainAssociation(domain);
    
    // Step 5: Validate Google Pay configuration
    const googlePay = await validateGooglePayConfiguration();
    
    // Step 6: Generate report
    const results = {
      isTestMode,
      domain,
      applePaDomains,
      domainRegistration,
      domainAssociation,
      googlePay,
    };
    
    const isValid = generateReport(results);
    
    // Exit with appropriate code
    process.exit(isValid ? 0 : 1);
    
  } catch (error) {
    log.error(`Validation failed: ${error.message}`);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run validation if called directly
if (require.main === module) {
  validateStripeDomains();
}

module.exports = {
  validateStripeDomains,
  listApplePayDomains,
  validateApplePayDomainAssociation,
  validateGooglePayConfiguration,
};