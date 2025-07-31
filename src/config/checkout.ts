// Checkout Form Configuration
// This file centralizes all configurable values for the checkout form
// Now uses type-safe environment variables for better reliability

import { env, TypedEnvironment, validateEnvironmentSafe, isDevelopment } from "@/utils/envValidation";

export interface CheckoutConfig {
  // Form Configuration
  countries: string[];
  defaultSameAsShipping: boolean;
  processingDelay: number;
  redirectDelay: number;

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
}

// NOTE: Helper functions have been moved to envValidation.ts for better organization
// and to eliminate code duplication. The typed environment provides all parsed values.

// Validate environment variables (non-blocking in production)
const envValidation = validateEnvironmentSafe();

// In development, log validation results for debugging
if (isDevelopment() && envValidation.warnings.length > 0) {
  console.log('🔧 Development mode: Environment variable warnings detected');
}

// Configuration object - now uses type-safe environment variables
// This eliminates code duplication and provides better type safety
export const checkoutConfig: CheckoutConfig = {
  // Direct mapping from typed environment - no manual parsing needed!
  countries: env.checkout.countries,
  defaultSameAsShipping: env.checkout.defaultSameAsShipping,
  processingDelay: env.checkout.processingDelay,
  redirectDelay: env.checkout.redirectDelay,
  validation: env.validation,
  ui: env.ui,
  features: env.features,
  messages: env.messages,
};

// Export individual config sections for easier import
export const {
  countries,
  defaultSameAsShipping,
  processingDelay,
  redirectDelay,
  validation,
  ui,
  features,
  messages,
} = checkoutConfig; 