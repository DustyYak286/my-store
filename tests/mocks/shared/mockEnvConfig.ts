/**
 * Shared Environment Configuration for Tests
 * 
 * Single source of truth for mock environment objects
 * Used by both __mocks__ and factory patterns
 */

export const MOCK_ENV_CONFIG = {
  payment: {
    stripeSecretKey: 'sk_test_51234567890abcdefghijk',
    stripePublishableKey: 'pk_test_51234567890abcdefghijk',
    stripeWebhookSecret: 'whsec_test1234567890abcdefghijk',
  },
  checkout: {
    countries: [
      "United States", "Canada", "United Kingdom", "Australia", "Germany", 
      "France", "Italy", "Spain", "Netherlands", "Belgium", "Romania"
    ],
    defaultSameAsShipping: true,
    processingDelay: 100,
    redirectDelay: 100,
  },
  validation: {
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    emailMaxLength: 150,
    postalCodeRegex: /^[A-Za-z0-9\s-]{3,10}$/,
    nameMinLength: 1,
    nameMaxLength: 100,
    addressMinLength: 1,
    cityMinLength: 1,
  },
  ui: {
    primaryColor: '#7C4D59',
    primaryHoverColor: '#6A3E49',
  },
  features: {
    realTimeValidation: true,
    autoFillBilling: true,
    billingAddressSection: true,
  },
  messages: {
    orderSuccess: 'Order placed successfully! You will receive a confirmation email shortly.',
    orderError: 'There was an error processing your order. Please try again.',
    formIncomplete: 'Please fill in all required fields before proceeding.',
  },
} as const;

export const MOCK_VALIDATION_RESULT = {
  valid: true,
  errors: [],
  warnings: [],
  summary: { totalChecked: 0, passed: 0, failed: 0, warnings: 0 }
} as const;

export const MOCK_ENV_INFO = {
  nodeEnv: 'test',
  isProduction: false,
  isDevelopment: false,
  isTest: true
} as const;

export const MOCK_STRIPE_KEYS = {
  NODE_ENV: 'test',
  STRIPE_SECRET_KEY: 'sk_test_mock_key',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_key',
  STRIPE_WEBHOOK_SECRET: 'whsec_mock_secret'
} as const;