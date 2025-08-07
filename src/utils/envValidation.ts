/**
 * Environment Variable Validation System
 * 
 * Provides runtime validation for all environment variables with:
 * - Type safety and schema validation
 * - Helpful error messages for deployment issues
 * - Graceful fallbacks and warnings
 * - Production-ready error handling
 */

// ====== VALIDATION SCHEMAS ======

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

interface EnvValidationSchema {
  key: string;
  category: string; // Explicit category for better organization
  required?: boolean;
  type: 'string' | 'number' | 'boolean' | 'regex' | 'color' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: string[];
  description: string;
}

// Environment variable schemas with validation rules
const ENV_SCHEMAS: EnvValidationSchema[] = [
  // === Checkout Configuration ===
  {
    key: 'NEXT_PUBLIC_CHECKOUT_COUNTRIES',
    category: 'Checkout',
    type: 'array',
    description: 'Comma-separated list of available countries',
  },
  {
    key: 'NEXT_PUBLIC_CHECKOUT_DEFAULT_SAME_AS_SHIPPING',
    category: 'Checkout',
    type: 'boolean',
    description: 'Default state for "Same as shipping" checkbox',
  },
  {
    key: 'NEXT_PUBLIC_CHECKOUT_PROCESSING_DELAY',
    category: 'Checkout',
    type: 'number',
    min: 0,
    max: 10000,
    description: 'Processing delay in milliseconds (0-10000)',
  },
  {
    key: 'NEXT_PUBLIC_CHECKOUT_REDIRECT_DELAY',
    category: 'Checkout',
    type: 'number',
    min: 0,
    max: 10000,
    description: 'Redirect delay after successful order (0-10000ms)',
  },

  // === Validation Configuration ===
  {
    key: 'NEXT_PUBLIC_VALIDATION_EMAIL_REGEX',
    category: 'Validation',
    type: 'regex',
    description: 'Email validation regex pattern',
  },
  {
    key: 'NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX',
    category: 'Validation',
    type: 'regex',
    description: 'Postal code validation regex pattern',
  },
  {
    key: 'NEXT_PUBLIC_VALIDATION_NAME_MIN_LENGTH',
    category: 'Validation',
    type: 'number',
    min: 1,
    max: 100,
    description: 'Minimum length for name fields (1-100)',
  },
  {
    key: 'NEXT_PUBLIC_VALIDATION_NAME_MAX_LENGTH',
    category: 'Validation',
    type: 'number',
    min: 1,
    max: 200,
    description: 'Maximum length for name fields (1-200)',
  },
  {
    key: 'NEXT_PUBLIC_VALIDATION_ADDRESS_MIN_LENGTH',
    category: 'Validation',
    type: 'number',
    min: 1,
    max: 100,
    description: 'Minimum length for address fields (1-100)',
  },
  {
    key: 'NEXT_PUBLIC_VALIDATION_CITY_MIN_LENGTH',
    category: 'Validation',
    type: 'number',
    min: 1,
    max: 100,
    description: 'Minimum length for city fields (1-100)',
  },

  // === UI Configuration ===
  {
    key: 'NEXT_PUBLIC_UI_PRIMARY_COLOR',
    category: 'UI',
    type: 'color',
    description: 'Primary brand color (hex format: #RRGGBB)',
  },
  {
    key: 'NEXT_PUBLIC_UI_PRIMARY_HOVER_COLOR',
    category: 'UI',
    type: 'color',
    description: 'Primary hover color (hex format: #RRGGBB)',
  },

  // === Feature Flags ===
  {
    key: 'NEXT_PUBLIC_FEATURE_REAL_TIME_VALIDATION',
    category: 'Features',
    type: 'boolean',
    description: 'Enable real-time form validation',
  },
  {
    key: 'NEXT_PUBLIC_FEATURE_AUTO_FILL_BILLING',
    category: 'Features',
    type: 'boolean',
    description: 'Auto-fill billing address from shipping',
  },
  {
    key: 'NEXT_PUBLIC_FEATURE_BILLING_ADDRESS_SECTION',
    category: 'Features',
    type: 'boolean',
    description: 'Show billing address section',
  },

  // === Messages ===
  {
    key: 'NEXT_PUBLIC_MESSAGE_ORDER_SUCCESS',
    category: 'Messages',
    type: 'string',
    min: 1,
    max: 200,
    description: 'Order success message (1-200 characters)',
  },
  {
    key: 'NEXT_PUBLIC_MESSAGE_ORDER_ERROR',
    category: 'Messages',
    type: 'string',
    min: 1,
    max: 200,
    description: 'Order error message (1-200 characters)',
  },
  {
    key: 'NEXT_PUBLIC_MESSAGE_FORM_INCOMPLETE',
    category: 'Messages',
    type: 'string',
    min: 1,
    max: 200,
    description: 'Form incomplete message (1-200 characters)',
  },

  // === Payment Configuration ===
  {
    key: 'STRIPE_SECRET_KEY',
    category: 'Payment',
    required: true,
    type: 'string',
    pattern: /^sk_(test|live)_[a-zA-Z0-9]{24,}$/,
    description: 'Stripe secret key (server-side) - must start with sk_test_ or sk_live_',
  },
  {
    key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    category: 'Payment',
    required: true,
    type: 'string',
    pattern: /^pk_(test|live)_[a-zA-Z0-9]{24,}$/,
    description: 'Stripe publishable key (client-side) - must start with pk_test_ or pk_live_',
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    category: 'Payment',
    required: true,
    type: 'string',
    pattern: /^whsec_[a-zA-Z0-9]{24,}$/,
    description: 'Stripe webhook secret for signature verification - must start with whsec_',
  },
];

// ====== SHARED PARSING UTILITIES ======

/**
 * Shared parsing functions to eliminate redundancy between validation and typed environment creation
 */
export const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

export const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const parseCountries = (value: string | undefined): string[] => {
  if (!value) {
    return [
      "United States", "Canada", "United Kingdom", "Australia", "Germany", 
      "France", "Italy", "Spain", "Netherlands", "Belgium", "Other"
    ];
  }
  return value.split(',').map(country => country.trim());
};

export const createRegex = (value: string | undefined, defaultPattern: string): RegExp => {
  if (!value) return new RegExp(defaultPattern);
  try {
    return new RegExp(value);
  } catch {
    return new RegExp(defaultPattern);
  }
};

// ====== VALIDATORS ======

const validateString = (value: string, schema: EnvValidationSchema): ValidationResult<string> => {
  if (schema.min && value.length < schema.min) {
    return { success: false, error: `Must be at least ${schema.min} characters` };
  }
  if (schema.max && value.length > schema.max) {
    return { success: false, error: `Must be no more than ${schema.max} characters` };
  }
  if (schema.pattern && !schema.pattern.test(value)) {
    return { success: false, error: 'Does not match required pattern' };
  }
  if (schema.allowedValues && !schema.allowedValues.includes(value)) {
    return { success: false, error: `Must be one of: ${schema.allowedValues.join(', ')}` };
  }
  return { success: true, data: value };
};

const validateNumber = (value: string, schema: EnvValidationSchema): ValidationResult<number> => {
  const num = parseNumber(value, NaN); // Use shared parser
  if (isNaN(num)) {
    return { success: false, error: 'Must be a valid number' };
  }
  if (schema.min !== undefined && num < schema.min) {
    return { success: false, error: `Must be at least ${schema.min}` };
  }
  if (schema.max !== undefined && num > schema.max) {
    return { success: false, error: `Must be no more than ${schema.max}` };
  }
  return { success: true, data: num };
};

const validateBoolean = (value: string): ValidationResult<boolean> => {
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === 'false') {
    return { success: true, data: parseBoolean(value, false) }; // Use shared parser
  }
  return { success: false, error: 'Must be "true" or "false"' };
};

const validateRegex = (value: string): ValidationResult<RegExp> => {
  try {
    // Use the same regex creation logic as shared parser for consistency
    const regex = new RegExp(value);
    return { success: true, data: regex };
  } catch (error) {
    return { success: false, error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
};

const validateColor = (value: string): ValidationResult<string> => {
  const colorPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!colorPattern.test(value)) {
    return { success: false, error: 'Must be a valid hex color (e.g., #FF0000)' };
  }
  return { success: true, data: value };
};

const validateArray = (value: string): ValidationResult<string[]> => {
  // Use similar logic to parseCountries but with validation
  const items = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  if (items.length === 0) {
    return { success: false, error: 'Must contain at least one item' };
  }
  return { success: true, data: items };
};

// ====== MAIN VALIDATION FUNCTION ======

interface EnvValidationResults {
  valid: boolean;
  errors: Array<{ key: string; error: string; description: string }>;
  warnings: Array<{ key: string; warning: string; description: string }>;
  summary: {
    totalChecked: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

/**
 * Validates all environment variables according to defined schemas
 * @param env - Environment object (defaults to process.env)
 * @param strict - If true, treats warnings as errors (useful for production)
 * @returns Validation results with errors and warnings
 */
export const validateEnvironmentVariables = (
  env: Record<string, string | undefined> = process.env,
  strict: boolean = false
): EnvValidationResults => {
  const errors: Array<{ key: string; error: string; description: string }> = [];
  const warnings: Array<{ key: string; warning: string; description: string }> = [];

  ENV_SCHEMAS.forEach(schema => {
    const value = env[schema.key];

    // Handle missing values
    if (!value) {
      if (schema.required || strict) {
        errors.push({
          key: schema.key,
          error: schema.required 
            ? 'Required environment variable is missing'
            : 'Environment variable not set (strict mode)',
          description: schema.description,
        });
      } else {
        warnings.push({
          key: schema.key,
          warning: 'Using default value (not set)',
          description: schema.description,
        });
      }
      return;
    }

    // Validate based on type
    let result: ValidationResult<any>;
    
    switch (schema.type) {
      case 'string':
        result = validateString(value, schema);
        break;
      case 'number':
        result = validateNumber(value, schema);
        break;
      case 'boolean':
        result = validateBoolean(value);
        break;
      case 'regex':
        result = validateRegex(value);
        break;
      case 'color':
        result = validateColor(value);
        break;
      case 'array':
        result = validateArray(value);
        break;
      default:
        result = { success: false, error: 'Unknown validation type' };
    }

    if (!result.success) {
      errors.push({
        key: schema.key,
        error: result.error || 'Validation failed',
        description: schema.description,
      });
    }

    if (result.warnings) {
      result.warnings.forEach(warning => {
        warnings.push({
          key: schema.key,
          warning,
          description: schema.description,
        });
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalChecked: ENV_SCHEMAS.length,
      passed: ENV_SCHEMAS.length - errors.length,
      failed: errors.length,
      warnings: warnings.length,
    },
  };
};

// ====== LOGGING AND ERROR REPORTING ======

/**
 * Logs validation results in a production-friendly format
 * @param results - Validation results to log
 * @param strict - Whether strict mode was used
 */
export const logValidationResults = (results: EnvValidationResults, strict: boolean = false): void => {
  const modeLabel = strict ? ' (STRICT MODE)' : '';
  
  if (results.valid) {
    console.log(`✅ Environment validation passed${modeLabel}`);
    if (results.warnings.length > 0) {
      console.log(`⚠️  ${results.warnings.length} warnings found:`);
      results.warnings.forEach(({ key, warning }) => {
        console.log(`   ${key}: ${warning}`);
      });
      
      if (strict) {
        console.log('💡 In strict mode, set all variables explicitly to avoid warnings');
      }
    }
  } else {
    console.error(`❌ Environment validation failed${modeLabel}`);
    console.error(`Found ${results.errors.length} errors:`);
    
    results.errors.forEach(({ key, error, description }) => {
      console.error(`\n❌ ${key}`);
      console.error(`   Error: ${error}`);
      console.error(`   Expected: ${description}`);
    });

    if (results.warnings.length > 0) {
      console.log(`\n⚠️  ${results.warnings.length} warnings:`);
      results.warnings.forEach(({ key, warning }) => {
        console.log(`   ${key}: ${warning}`);
      });
    }
    
    if (strict) {
      console.error('\n🚫 STRICT MODE: All environment variables must be explicitly set');
    }
  }

  console.log(`\n📊 Summary: ${results.summary.passed}/${results.summary.totalChecked} passed`);
};

/**
 * Validates environment and throws error if validation fails
 * Use this for critical validation that should prevent app startup
 * @param env - Environment object (defaults to process.env)
 * @param strict - If true, treats warnings as errors
 */
export const validateEnvironmentOrThrow = (
  env?: Record<string, string | undefined>,
  strict: boolean = false
): void => {
  const results = validateEnvironmentVariables(env, strict);
  logValidationResults(results, strict);
  
  if (!results.valid) {
    const mode = strict ? ' (strict mode)' : '';
    const errorMessage = `Environment validation failed${mode} with ${results.errors.length} errors. Check console for details.`;
    throw new Error(errorMessage);
  }
};

/**
 * Validates environment and returns results without throwing
 * Use this for non-critical validation or when you want to handle errors gracefully
 * @param env - Environment object (defaults to process.env)
 * @param strict - If true, treats warnings as errors
 */
export const validateEnvironmentSafe = (
  env?: Record<string, string | undefined>,
  strict: boolean = false
): EnvValidationResults => {
  const results = validateEnvironmentVariables(env, strict);
  logValidationResults(results, strict);
  return results;
};

// ====== DEVELOPMENT HELPERS ======

/**
 * Generates example .env file with all available variables
 * Now uses explicit categories for better organization
 */
export const generateEnvExample = (): string => {
  const lines = [
    '# Environment Variables Configuration',
    '# Copy this file to .env.local and customize as needed',
    '',
  ];

  // Group schemas by category for better organization
  const categorizedSchemas = ENV_SCHEMAS.reduce((acc, schema) => {
    if (!acc[schema.category]) {
      acc[schema.category] = [];
    }
    acc[schema.category]!.push(schema); // Non-null assertion since we just initialized it
    return acc;
  }, {} as Record<string, EnvValidationSchema[]>);

  // Generate sections by category
  Object.entries(categorizedSchemas).forEach(([category, schemas]) => {
    lines.push(`# === ${category.toUpperCase()} CONFIGURATION ===`);
    
    schemas.forEach(schema => {
      lines.push(`# ${schema.description}`);
      
      // Add example values based on type
      let exampleValue = '';
      switch (schema.type) {
        case 'boolean':
          exampleValue = 'true';
          break;
        case 'number':
          exampleValue = schema.min ? schema.min.toString() : '1000';
          break;
        case 'color':
          exampleValue = '#7C4D59';
          break;
        case 'array':
          exampleValue = 'United States,Canada,United Kingdom';
          break;
        case 'regex':
          exampleValue = '^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$';
          break;
        default:
          if (schema.key.includes('STRIPE_SECRET_KEY')) {
            exampleValue = 'sk_test_...your_stripe_secret_key';
          } else if (schema.key.includes('STRIPE_PUBLISHABLE_KEY')) {
            exampleValue = 'pk_test_...your_stripe_publishable_key';
          } else if (schema.key.includes('STRIPE_WEBHOOK_SECRET')) {
            exampleValue = 'whsec_...your_webhook_secret';
          } else {
            exampleValue = 'Your value here';
          }
      }
      
      lines.push(`${schema.key}="${exampleValue}"`);
      lines.push('');
    });
  });

  return lines.join('\n');
};

/**
 * Checks if running in development mode
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Checks if running in production mode
 */
export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

// ====== TYPE-SAFE ENVIRONMENT ACCESS ======

/**
 * Type-safe environment variable object
 * Contains validated and parsed environment variables
 */
export interface TypedEnvironment {
  // Checkout Configuration
  checkout: {
    countries: string[];
    defaultSameAsShipping: boolean;
    processingDelay: number;
    redirectDelay: number;
  };
  
  // Validation Configuration
  validation: {
    emailRegex: RegExp;
    postalCodeRegex: RegExp;
    nameMinLength: number;
    nameMaxLength: number;
    addressMinLength: number;
    cityMinLength: number;
  };
  
  // UI Configuration
  ui: {
    primaryColor: string;
    primaryHoverColor: string;
  };
  
  // Feature Flags
  features: {
    realTimeValidation: boolean;
    autoFillBilling: boolean;
    billingAddressSection: boolean;
  };
  
  // Messages
  messages: {
    orderSuccess: string;
    orderError: string;
    formIncomplete: string;
  };

  // Payment Configuration
  payment: {
    stripeSecretKey: string;
    stripePublishableKey: string;
    stripeWebhookSecret: string;
  };
}

/**
 * Cached typed environment variables
 * Prevents re-parsing on every access
 */
let cachedTypedEnv: TypedEnvironment | null = null;

/**
 * Creates a type-safe environment object with validated and parsed values
 * This replaces direct access to process.env for better type safety
 * 
 * @param env - Environment object (defaults to process.env)
 * @param strict - Whether to use strict validation
 * @returns Type-safe environment object
 */
export const createTypedEnvironment = (
  env: Record<string, string | undefined> = process.env,
  strict: boolean = false
): TypedEnvironment => {
  // Validate first to ensure all values are correct
  const validationResults = validateEnvironmentVariables(env, strict);
  
  if (!validationResults.valid) {
    throw new Error(
      `Cannot create typed environment: validation failed with ${validationResults.errors.length} errors. ` +
      'Fix environment variables before creating typed environment.'
    );
  }

  // Reuse validation parsing logic to eliminate redundancy

  // Create the typed environment object using shared parsing functions
  return {
    checkout: {
      countries: parseCountries(env.NEXT_PUBLIC_CHECKOUT_COUNTRIES),
      defaultSameAsShipping: parseBoolean(env.NEXT_PUBLIC_CHECKOUT_DEFAULT_SAME_AS_SHIPPING, true),
      processingDelay: parseNumber(env.NEXT_PUBLIC_CHECKOUT_PROCESSING_DELAY, 1000),
      redirectDelay: parseNumber(env.NEXT_PUBLIC_CHECKOUT_REDIRECT_DELAY, 2000),
    },
    
    validation: {
      emailRegex: createRegex(env.NEXT_PUBLIC_VALIDATION_EMAIL_REGEX, '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'),
      postalCodeRegex: createRegex(env.NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX, '^[A-Za-z0-9\\s-]{3,10}$'),
      nameMinLength: parseNumber(env.NEXT_PUBLIC_VALIDATION_NAME_MIN_LENGTH, 2),
      nameMaxLength: parseNumber(env.NEXT_PUBLIC_VALIDATION_NAME_MAX_LENGTH, 50),
      addressMinLength: parseNumber(env.NEXT_PUBLIC_VALIDATION_ADDRESS_MIN_LENGTH, 5),
      cityMinLength: parseNumber(env.NEXT_PUBLIC_VALIDATION_CITY_MIN_LENGTH, 2),
    },
    
    ui: {
      primaryColor: env.NEXT_PUBLIC_UI_PRIMARY_COLOR || '#7C4D59',
      primaryHoverColor: env.NEXT_PUBLIC_UI_PRIMARY_HOVER_COLOR || '#633a48',
    },
    
    features: {
      realTimeValidation: parseBoolean(env.NEXT_PUBLIC_FEATURE_REAL_TIME_VALIDATION, true),
      autoFillBilling: parseBoolean(env.NEXT_PUBLIC_FEATURE_AUTO_FILL_BILLING, true),
      billingAddressSection: parseBoolean(env.NEXT_PUBLIC_FEATURE_BILLING_ADDRESS_SECTION, true),
    },
    
    messages: {
      orderSuccess: env.NEXT_PUBLIC_MESSAGE_ORDER_SUCCESS || 'Thank you for your order!',
      orderError: env.NEXT_PUBLIC_MESSAGE_ORDER_ERROR || 'Something went wrong. Please try again.',
      formIncomplete: env.NEXT_PUBLIC_MESSAGE_FORM_INCOMPLETE || 'Please fill in all required fields to place your order',
    },

    payment: {
      stripeSecretKey: env.STRIPE_SECRET_KEY!,
      stripePublishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET!,
    },
  };
};

/**
 * Get the cached typed environment variables
 * Creates and caches on first access for performance
 * 
 * @param forceRefresh - Force recreation of cached environment
 * @returns Type-safe environment object
 */
export const getTypedEnvironment = (forceRefresh: boolean = false): TypedEnvironment => {
  if (!cachedTypedEnv || forceRefresh) {
    cachedTypedEnv = createTypedEnvironment();
  }
  return cachedTypedEnv;
};

/**
 * Type-safe environment access with validation
 * Use this instead of process.env for better type safety
 * 
 * Usage:
 * ```typescript
 * import { env } from '@/utils/envValidation';
 * 
 * const primaryColor = env.ui.primaryColor;  // Type-safe!
 * const countries = env.checkout.countries;  // Type-safe!
 * ```
 */
export const env = new Proxy({} as TypedEnvironment, {
  get(target, prop) {
    // Directly call getTypedEnvironment which handles its own caching
    return getTypedEnvironment()[prop as keyof TypedEnvironment];
  }
});