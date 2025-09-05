/**
 * Stripe Configuration
 * 
 * Centralized Stripe configuration with environment variable integration,
 * validation, and production-ready error handling.
 */

import { env } from '@/utils/envValidation';
import { PAYMENT_CURRENCY, STRIPE_CONFIG, TIMEOUT_CONFIG } from '@/constants/payments';
import { getCountriesFromEnv } from '@/config/checkout';

// ====== ENVIRONMENT DETECTION ======

/**
 * Determine if we're running in test mode based on Stripe keys
 * @returns True if using test keys, false for live keys
 */
export const isTestMode = (): boolean => {
  try {
    const publishableKey = env.payment.stripePublishableKey;
    return publishableKey.startsWith('pk_test_');
  } catch {
    // Fallback to development mode detection if env access fails
    return process.env.NODE_ENV === 'development';
  }
};

/**
 * Get environment label for logging and debugging
 * @returns Environment label string
 */
export const getEnvironmentLabel = (): string => {
  if (process.env.NODE_ENV === 'development') return 'development';
  if (process.env.NODE_ENV === 'test') {
    return isTestMode() ? 'test' : 'test-live';
  }
  if (process.env.NODE_ENV === 'production') {
    return isTestMode() ? 'production-test' : 'production-live';
  }
  return 'unknown';
};

// ====== STRIPE CONFIGURATION ======

/**
 * Stripe configuration object with environment-specific settings
 */
export const stripeConfig = {
  // API Keys (validated by environment system)
  get publishableKey(): string {
    return env.payment.stripePublishableKey;
  },
  
  get secretKey(): string {
    return env.payment.stripeSecretKey;
  },
  
  get webhookSecret(): string {
    return env.payment.stripeWebhookSecret;
  },
  
  // Environment detection
  get isTestMode(): boolean {
    return isTestMode();
  },
  
  get environmentLabel(): string {
    return getEnvironmentLabel();
  },
  
  // Currency configuration
  currency: PAYMENT_CURRENCY,
  
  // API configuration
  api: {
    version: '2022-11-15' as const, // Stable Stripe API version
    timeout: TIMEOUT_CONFIG.API_REQUEST_TIMEOUT,
    maxRetries: 3,
  },
  
  // Payment Intent configuration
  paymentIntent: {
    // Disable automatic payment methods to prevent Link conflicts
    automaticPaymentMethods: {
      enabled: false, // Explicitly disabled to prevent Link
      allow_redirects: 'never' as const, // Client-side confirmation only
    },
    captureMethod: 'automatic' as const,
    confirmationMethod: 'automatic' as const,
    currency: PAYMENT_CURRENCY,
  },
  
  // Elements configuration
  elements: {
    appearance: STRIPE_CONFIG.STRIPE_APPEARANCE,
    clientSecret: null as string | null, // Set dynamically
    loader: 'auto' as const,
  },
  
  // Webhook configuration
  webhooks: {
    tolerance: 300,  // 5 minutes
    timeout: 30000,  // 30 seconds
    maxRetries: 3,   // Retry configuration
    events: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'payment_intent.canceled',
      'charge.succeeded',
      'charge.failed',
    ] as const,
  },
} as const;

// ====== VALIDATION HELPERS ======

/**
 * Validate Stripe key format
 * @param key Stripe API key to validate
 * @param expectedPrefix Expected key prefix (pk_, sk_, whsec_)
 * @returns Validation result
 */
export const validateStripeKey = (
  key: string,
  expectedPrefix: string
): { isValid: boolean; error?: string } => {
  if (!key) {
    return { isValid: false, error: 'Key is required' };
  }
  
  if (!key.startsWith(expectedPrefix)) {
    return { 
      isValid: false, 
      error: `Key must start with ${expectedPrefix}` 
    };
  }
  
  // Basic length validation (Stripe keys are typically 24+ chars after prefix)
  const keyWithoutPrefix = key.substring(expectedPrefix.length);
  if (keyWithoutPrefix.length < 24) {
    return { 
      isValid: false, 
      error: 'Key appears to be too short' 
    };
  }
  
  return { isValid: true };
};

/**
 * Validate all Stripe configuration
 * @returns Validation result with details
 */
export const validateStripeConfiguration = (): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Validate publishable key
    const publishableValidation = validateStripeKey(
      stripeConfig.publishableKey, 
      'pk_'
    );
    if (!publishableValidation.isValid) {
      errors.push(`Publishable key: ${publishableValidation.error}`);
    }
    
    // Validate secret key
    const secretValidation = validateStripeKey(
      stripeConfig.secretKey, 
      'sk_'
    );
    if (!secretValidation.isValid) {
      errors.push(`Secret key: ${secretValidation.error}`);
    }
    
    // Validate webhook secret
    const webhookValidation = validateStripeKey(
      stripeConfig.webhookSecret, 
      'whsec_'
    );
    if (!webhookValidation.isValid) {
      errors.push(`Webhook secret: ${webhookValidation.error}`);
    }
    
    // Check key consistency (test vs live)
    const publishableIsTest = stripeConfig.publishableKey.startsWith('pk_test_');
    const secretIsTest = stripeConfig.secretKey.startsWith('sk_test_');
    
    if (publishableIsTest !== secretIsTest) {
      errors.push('Publishable key and secret key environment mismatch (test vs live)');
    }
    
    // Environment-specific warnings
    if (process.env.NODE_ENV === 'production' && stripeConfig.isTestMode) {
      warnings.push('Using test Stripe keys in production environment');
    }
    
    if (process.env.NODE_ENV === 'development' && !stripeConfig.isTestMode) {
      warnings.push('Using live Stripe keys in development environment');
    }
    
  } catch (error) {
    errors.push(`Configuration access error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

// ====== STRIPE INSTANCE OPTIONS ======

/**
 * Get Stripe constructor options for server-side usage
 * @returns Stripe options object
 */
export const getServerStripeOptions = () => ({
  // apiVersion: stripeConfig.api.version, // Use default API version
  timeout: stripeConfig.api.timeout,
  maxNetworkRetries: stripeConfig.api.maxRetries,
  telemetry: false, // Disable telemetry for server-side usage
  appInfo: {
    name: 'My Store',
    version: '1.0.0',
  },
});

/**
 * Get Stripe.js options for client-side usage
 * @returns StripeJS options object
 */
export const getClientStripeOptions = () => ({
  // apiVersion: stripeConfig.api.version, // Use default API version
  stripeAccount: undefined, // Not using Connect
  locale: 'ro' as const, // Romanian locale for RON currency
});

// ====== PAYMENT INTENT HELPERS ======

/**
 * Helper function to convert country name to ISO-3166 alpha-2 code for Stripe
 * Dynamically handles any countries configured in environment variables
 */
function getCountryCodeForStripe(countryName: string): string {
  // Dynamic country-to-ISO mapping based on environment configuration
  const countryCodeMap: Record<string, string> = {
    // European countries
    'Romania': 'RO',
    'Germany': 'DE', 
    'France': 'FR',
    'Italy': 'IT',
    'Spain': 'ES',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Austria': 'AT',
    'Poland': 'PL',
    'Czech Republic': 'CZ',
    'Hungary': 'HU',
    'Slovakia': 'SK',
    'Slovenia': 'SI',
    'Croatia': 'HR',
    'Bulgaria': 'BG',
    'Greece': 'GR',
    'Portugal': 'PT',
    'Sweden': 'SE',
    'Denmark': 'DK',
    'Finland': 'FI',
    'Norway': 'NO',
    'Switzerland': 'CH',
    'Luxembourg': 'LU',
    // North America
    'United States': 'US',
    'Canada': 'CA',
    'Mexico': 'MX',
    // Other common countries
    'United Kingdom': 'GB',
    'Australia': 'AU',
    'New Zealand': 'NZ',
    'Japan': 'JP',
    'South Korea': 'KR',
    'Singapore': 'SG',
    // Fallbacks
    'Other': 'US', // Default fallback
  };
  
  return countryCodeMap[countryName] || countryName.slice(0, 2).toUpperCase();
}

/**
 * Get the default billing country from environment configuration
 * Uses the first country in the configured list as the default
 */
function getDefaultBillingCountryForStripe(): string {
  const countries = getCountriesFromEnv();
  // Use the first configured country as default, fallback to Romania if none configured
  const firstCountry = countries[0] || 'Romania';
  return getCountryCodeForStripe(firstCountry);
}

/**
 * Get default Payment Intent creation parameters with environment-driven configuration
 * @param amount Amount in smallest currency unit (bani)
 * @param orderId Order ID to include in metadata
 * @returns Payment Intent parameters
 */
export const getPaymentIntentParams = (
  amount: number,
  orderId: string
) => {
  const params: any = {
    amount,
    currency: stripeConfig.currency,
    capture_method: stripeConfig.paymentIntent.captureMethod,
    // Restrict to card payments only - this prevents Link from being offered
    payment_method_types: ['card'],
    metadata: {
      orderId,
      environment: stripeConfig.environmentLabel,
      timestamp: new Date().toISOString(),
      source: 'api_create_intent',
      // Include environment-driven default billing country for webhook processing
      default_billing_country: getDefaultBillingCountryForStripe(),
    },
  };

  // Remove automatic_payment_methods since we're explicitly setting payment_method_types
  // This ensures Link is not offered and prevents country selector conflicts
  params.confirmation_method = stripeConfig.paymentIntent.confirmationMethod;

  return params;
};

/**
 * Get Elements options for client-side Stripe Elements
 * @param clientSecret Payment Intent client secret
 * @returns Elements options
 */
export const getElementsOptions = (clientSecret: string) => ({
  clientSecret,
  appearance: stripeConfig.elements.appearance,
  loader: stripeConfig.elements.loader,
});

// ====== ERROR HANDLING ======

/**
 * Enhanced Stripe error with additional context
 */
export interface StripeConfigError extends Error {
  code?: string | undefined;
  type?: string | undefined;
  context?: Record<string, unknown> | undefined;
}

/**
 * Create a standardized Stripe configuration error
 * @param message Error message
 * @param code Error code
 * @param context Additional error context
 * @returns StripeConfigError
 */
export const createStripeConfigError = (
  message: string,
  code?: string,
  context?: Record<string, unknown>
): StripeConfigError => {
  const error: StripeConfigError = new Error(message);
  error.name = 'StripeConfigError';
  error.code = code;
  error.type = 'configuration_error';
  error.context = context;
  return error;
};

/**
 * Validate configuration and throw if invalid
 * Used during application startup to ensure proper configuration
 */
export const validateConfigurationOrThrow = (): void => {
  const validation = validateStripeConfiguration();
  
  if (!validation.isValid) {
    const errorMessage = validation.errors.join(', ');
    throw createStripeConfigError(
      `Invalid Stripe configuration: ${errorMessage}`,
      'INVALID_CONFIGURATION',
      { errors: validation.errors, warnings: validation.warnings }
    );
  }
  
  // Log warnings without throwing
  if (validation.warnings.length > 0) {
    console.warn('Stripe configuration warnings:', validation.warnings);
  }
};

// ====== LOGGING AND DEBUGGING ======

/**
 * Get safe configuration summary for logging (no sensitive data)
 * @returns Safe configuration object
 */
export const getConfigurationSummary = () => ({
  environment: stripeConfig.environmentLabel,
  isTestMode: stripeConfig.isTestMode,
  currency: stripeConfig.currency,
  apiVersion: stripeConfig.api.version,
  hasPublishableKey: !!stripeConfig.publishableKey,
  hasSecretKey: !!stripeConfig.secretKey,
  hasWebhookSecret: !!stripeConfig.webhookSecret,
  publishableKeyPrefix: stripeConfig.publishableKey.substring(0, 8) + '...',
  secretKeyPrefix: stripeConfig.secretKey.substring(0, 8) + '...',
});

/**
 * Log configuration status (safe for production)
 */
export const logConfigurationStatus = (): void => {
  const summary = getConfigurationSummary();
  const validation = validateStripeConfiguration();
  
  console.log('🔧 Stripe Configuration:', summary);
  
  if (validation.isValid) {
    console.log('✅ Stripe configuration is valid');
  } else {
    console.error('❌ Stripe configuration errors:', validation.errors);
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️  Stripe configuration warnings:', validation.warnings);
  }
};

// Export configuration for easy access
export default stripeConfig;