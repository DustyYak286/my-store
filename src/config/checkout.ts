// Checkout Form Configuration
// This file centralizes all configurable values for the checkout form
// Uses type-safe environment variables with consistent access patterns

import { env, validateEnvironmentSafe, isDevelopment, parseCountries } from "@/utils/envValidation";

export interface CheckoutConfig {
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

  // Form Configuration (non-hydration sensitive)
  defaultSameAsShipping: boolean;
  processingDelay: number;
  redirectDelay: number;
}

// Validate environment variables (non-blocking in production)
const envValidation = validateEnvironmentSafe();

// In development, log validation results for debugging
if (isDevelopment() && envValidation.warnings.length > 0) {
  console.log('🔧 Development mode: Environment variable warnings detected');
}

/**
 * Checkout configuration object with type-safe environment variables
 * 
 * Note: Countries are handled directly in components to avoid SSR hydration issues
 * since they depend on environment variables that may change between server and client
 */
export const checkoutConfig: CheckoutConfig = {
  // Direct mapping from typed environment - no manual parsing needed!
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
  defaultSameAsShipping,
  processingDelay,
  redirectDelay,
  validation,
  ui,
  features,
  messages,
} = checkoutConfig;

/**
 * Utility function to get countries from environment variable
 * Use this in components that need country lists to ensure consistency
 * Uses shared parsing logic to eliminate redundancy
 * 
 * @param fallback - Optional fallback countries list
 * @returns Array of country names
 */
export const getCountriesFromEnv = (fallback?: string[]): string[] => {
  // Use shared parsing function with optional custom fallback
  const countries = parseCountries(process.env.NEXT_PUBLIC_CHECKOUT_COUNTRIES);
  
  // If a custom fallback is provided and no env var is set, use the fallback
  if (!process.env.NEXT_PUBLIC_CHECKOUT_COUNTRIES && fallback) {
    return fallback;
  }
  
  return countries;
}; 