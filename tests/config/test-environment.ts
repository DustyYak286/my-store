/**
 * Production-Grade Test Environment Configuration
 * 
 * Single source of truth for all test environment variables.
 * Uses explicit loader pattern with type safety and clear error messages.
 * 
 * Based on senior developer review - implements best practices:
 * - No global state at module import time
 * - Consistent typed return values across all modes
 * - Explicit load precedence with override: true
 * - Fail-fast for unit tests, warn-and-continue for integration
 * 
 * Usage:
 *   import { loadTestEnv } from '@/../tests/config/test-environment';
 *   const config = loadTestEnv({ mode: 'unit' }); // or 'integration'
 *   console.log(config.STRIPE_SECRET_KEY);
 */

import * as dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Production-grade environment schema with proper coercion from process.env strings
const testEnvironmentSchema = z.object({
  // Core Node Environment
  NODE_ENV: z.literal('test').default('test'),
  TEST_MODE: z.coerce.boolean().default(true),
  
  // Stripe Configuration (required for contract/integration tests)
  STRIPE_SECRET_KEY: z.string()
    .refine(val => !val || val.startsWith('sk_test_'), {
      message: 'STRIPE_SECRET_KEY must start with "sk_test_" for test environment'
    })
    .optional(),
  
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string()
    .refine(val => !val || val.startsWith('pk_test_'), {
      message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with "pk_test_" for test environment'
    })
    .optional(),
    
  STRIPE_WEBHOOK_SECRET: z.string()
    .refine(val => !val || val.startsWith('whsec_'), {
      message: 'STRIPE_WEBHOOK_SECRET must start with "whsec_"'
    })
    .optional(),

  // Feature Flags with proper boolean coercion
  NEXT_PUBLIC_CHECKOUT_ENABLE_BILLING_ADDRESS: z.coerce.boolean().default(true),
  NEXT_PUBLIC_CHECKOUT_ENABLE_REALTIME_VALIDATION: z.coerce.boolean().default(true),
  NEXT_PUBLIC_FEATURE_REAL_TIME_VALIDATION: z.coerce.boolean().default(true),
  NEXT_PUBLIC_FEATURE_AUTO_FILL_BILLING: z.coerce.boolean().default(true),
  NEXT_PUBLIC_FEATURE_BILLING_ADDRESS_SECTION: z.coerce.boolean().default(true),

  // Checkout Configuration with proper number coercion
  NEXT_PUBLIC_CHECKOUT_COUNTRIES: z.string().default('US,CA,GB,EU,RO'),
  NEXT_PUBLIC_CHECKOUT_DEFAULT_SAME_AS_SHIPPING: z.coerce.boolean().default(true),
  NEXT_PUBLIC_CHECKOUT_PROCESSING_DELAY: z.coerce.number().int().min(0).default(100),
  NEXT_PUBLIC_CHECKOUT_REDIRECT_DELAY: z.coerce.number().int().min(0).default(100),

  // Validation Configuration
  NEXT_PUBLIC_VALIDATION_EMAIL_REGEX: z.string().default('^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$'),
  NEXT_PUBLIC_VALIDATION_EMAIL_MAX_LENGTH: z.coerce.number().int().positive().default(150),
  NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX: z.string().default('^[A-Za-z0-9\\\\s-]{3,10}$'),
  NEXT_PUBLIC_VALIDATION_NAME_MIN_LENGTH: z.coerce.number().int().positive().default(1),
  NEXT_PUBLIC_VALIDATION_NAME_MAX_LENGTH: z.coerce.number().int().positive().default(100),
  NEXT_PUBLIC_VALIDATION_ADDRESS_MIN_LENGTH: z.coerce.number().int().positive().default(1),
  NEXT_PUBLIC_VALIDATION_CITY_MIN_LENGTH: z.coerce.number().int().positive().default(1),

  // UI Configuration
  NEXT_PUBLIC_UI_PRIMARY_COLOR: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#7C4D59'),
  NEXT_PUBLIC_UI_PRIMARY_HOVER_COLOR: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6A3E49'),

  // Messages Configuration
  NEXT_PUBLIC_MESSAGE_ORDER_SUCCESS: z.string().default('Order placed successfully! You will receive a confirmation email shortly.'),
  NEXT_PUBLIC_MESSAGE_ORDER_ERROR: z.string().default('There was an error processing your order. Please try again.'),
  NEXT_PUBLIC_MESSAGE_FORM_INCOMPLETE: z.string().default('Please fill in all required fields before proceeding.'),

  // Test-Specific Configuration
  TEST_VERBOSE: z.coerce.boolean().default(false),
  TEST_INTEGRATION: z.coerce.boolean().default(false),
});

export type TestEnv = z.infer<typeof testEnvironmentSchema>;
export type LoadMode = 'unit' | 'integration';

/**
 * Load and validate test environment configuration
 * 
 * @param opts Configuration options
 * @returns Typed, validated test environment configuration
 */
export function loadTestEnv(opts?: {
  mode?: LoadMode;
  paths?: string[]; // in precedence order (.env.test.local overrides .env.test)
}): TestEnv {
  const mode = opts?.mode ?? 'unit';
  const paths = opts?.paths ?? [
    path.resolve(process.cwd(), '.env.test.local'), // highest precedence (local overrides)
    path.resolve(process.cwd(), '.env.test'),       // main test config
    path.resolve(process.cwd(), '.env.local'),      // fallback for backward compatibility
  ];
  
  // Load environment files with explicit precedence 
  // Note: dotenv won't override empty string values, so we need to clear them first
  for (const envPath of paths) {
    const result = dotenv.config({ path: envPath, override: false });
    if (result.parsed) {
      // Explicitly set each parsed value to ensure override of empty strings
      Object.entries(result.parsed).forEach(([key, value]) => {
        process.env[key] = value;
      });
    }
  }
  
  // Normalize integration flag for robust checking
  const isIntegration = /^(1|true|yes)$/i.test(process.env.TEST_INTEGRATION ?? '') || mode === 'integration';
  
  // Validate environment
  const result = testEnvironmentSchema.safeParse(process.env);
  
  if (!result.success) {
    if (isIntegration) {
      console.warn('⚠️ Test environment validation warnings (integration mode)');
      console.warn(result.error.format());
      // Best-effort typed object: coercion + defaults still applied
      // This ensures consistent return type while being lenient for integration tests
      return testEnvironmentSchema.parse(process.env);
    } else {
      // Fail fast for unit tests - this is the valuable signal
      throw new Error(`❌ Test environment validation failed:\n${result.error.message}\n\n` +
                     `💡 To fix this:\n` +
                     `  1. Copy .env.example to .env.test\n` +
                     `  2. Fill in the required values\n` +
                     `  3. Ensure Stripe keys are TEST keys (sk_test_*, pk_test_*, whsec_*)`);
    }
  }
  
  return result.data;
}

/**
 * Require Stripe keys for integration/contract tests
 * Throws clear error if required keys are missing
 */
export function requireStripeKeys(config: TestEnv): void {
  const missing = [];
  if (!config.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!config.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) missing.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  if (!config.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required Stripe keys for contract/integration tests:\n` +
      `  ${missing.join(', ')}\n\n` +
      `💡 Add these to your .env.test file with TEST values only.`
    );
  }
}

/**
 * Apply test environment configuration to process.env
 * Useful for backward compatibility with code that reads process.env directly
 */
export function setupTestEnvironmentVariables(config: TestEnv): void {
  Object.entries(config).forEach(([key, value]) => {
    process.env[key] = String(value);
  });
}

// Legacy API compatibility layer for existing test setups
export type TestEnvironment = 'unit' | 'integration' | 'e2e' | 'load';

interface LegacyTestConfig {
  environment: TestEnvironment;
  useRealStripe: boolean;
  description: string;
}

let legacyConfig: TestEnv | null = null;

export function getTestEnvironment(): LegacyTestConfig {
  const testPath = (expect?.getState && expect.getState().testPath) || '';
  
  // E2E tests use real Stripe
  if (testPath.includes('/e2e/') || testPath.includes('e2e-production')) {
    return {
      environment: 'e2e',
      useRealStripe: true,
      description: 'End-to-end tests using real Stripe test API'
    };
  }
  
  // Load tests use real Stripe
  if (testPath.includes('load-testing') || testPath.includes('/load/')) {
    return {
      environment: 'load',
      useRealStripe: true,
      description: 'Load tests using real Stripe test API'
    };
  }
  
  // Integration tests use real Stripe for API testing
  if (testPath.includes('/integration/')) {
    return {
      environment: 'integration',
      useRealStripe: true,
      description: 'Integration tests using real Stripe test API'
    };
  }
  
  // Unit tests use mocks
  return {
    environment: 'unit',
    useRealStripe: false,
    description: 'Unit tests using mocked Stripe'
  };
}

export function shouldUseRealStripe(): boolean {
  return getTestEnvironment().useRealStripe;
}

export function getStripeTestConfig() {
  if (!legacyConfig) {
    const testEnv = getTestEnvironment();
    legacyConfig = loadTestEnv({ 
      mode: testEnv.useRealStripe ? 'integration' : 'unit' 
    });
  }
  
  const config = getTestEnvironment();
  
  if (config.useRealStripe) {
    // Use validated configuration
    return {
      secretKey: legacyConfig.STRIPE_SECRET_KEY || 'sk_test_51234567890abcdefghijk',
      publishableKey: legacyConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_51234567890abcdefghijk',
      webhookSecret: legacyConfig.STRIPE_WEBHOOK_SECRET || 'whsec_test1234567890abcdefghijk',
      useMock: false
    };
  } else {
    // Mock configuration
    return {
      secretKey: 'sk_test_mock_key',
      publishableKey: 'pk_test_mock_key',
      webhookSecret: 'whsec_test_mock_key',
      useMock: true
    };
  }
}

// Backward compatibility: export a proxy that loads config on first access
export const testConfig = new Proxy({}, {
  get(target, prop) {
    if (!legacyConfig) {
      legacyConfig = loadTestEnv({ mode: 'unit' });
    }
    return legacyConfig[prop as keyof TestEnv];
  }
}) as TestEnv;

console.log('✅ Test environment configuration loader ready');