// Checkout Form Configuration
// This file centralizes all configurable values for the checkout form

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

// Helper function to parse boolean from environment variable
const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Helper function to parse number from environment variable
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Helper function to parse countries array
const parseCountries = (value: string | undefined): string[] => {
  if (!value) {
    return [
      "United States", "Canada", "United Kingdom", "Australia", "Germany", 
      "France", "Italy", "Spain", "Netherlands", "Belgium", "Other"
    ];
  }
  return value.split(',').map(country => country.trim());
};

// Helper function to create RegExp from string
const createRegex = (value: string | undefined, defaultPattern: string): RegExp => {
  if (!value) return new RegExp(defaultPattern);
  try {
    return new RegExp(value);
  } catch {
    return new RegExp(defaultPattern);
  }
};

// Configuration object - reads from environment variables with fallbacks
export const checkoutConfig: CheckoutConfig = {
  countries: parseCountries(process.env.NEXT_PUBLIC_CHECKOUT_COUNTRIES),
  defaultSameAsShipping: parseBoolean(process.env.NEXT_PUBLIC_CHECKOUT_DEFAULT_SAME_AS_SHIPPING, true),
  processingDelay: parseNumber(process.env.NEXT_PUBLIC_CHECKOUT_PROCESSING_DELAY, 1000),
  redirectDelay: parseNumber(process.env.NEXT_PUBLIC_CHECKOUT_REDIRECT_DELAY, 2000),

  validation: {
    emailRegex: createRegex(process.env.NEXT_PUBLIC_VALIDATION_EMAIL_REGEX, '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'),
    postalCodeRegex: createRegex(process.env.NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX, '^[A-Za-z0-9\\s-]{3,10}$'),
    nameMinLength: parseNumber(process.env.NEXT_PUBLIC_VALIDATION_NAME_MIN_LENGTH, 2),
    nameMaxLength: parseNumber(process.env.NEXT_PUBLIC_VALIDATION_NAME_MAX_LENGTH, 50),
    addressMinLength: parseNumber(process.env.NEXT_PUBLIC_VALIDATION_ADDRESS_MIN_LENGTH, 5),
    cityMinLength: parseNumber(process.env.NEXT_PUBLIC_VALIDATION_CITY_MIN_LENGTH, 2),
  },

  ui: {
    primaryColor: process.env.NEXT_PUBLIC_UI_PRIMARY_COLOR || '#7C4D59',
    primaryHoverColor: process.env.NEXT_PUBLIC_UI_PRIMARY_HOVER_COLOR || '#633a48',
  },

  features: {
    realTimeValidation: parseBoolean(process.env.NEXT_PUBLIC_FEATURE_REAL_TIME_VALIDATION, true),
    autoFillBilling: parseBoolean(process.env.NEXT_PUBLIC_FEATURE_AUTO_FILL_BILLING, true),
    billingAddressSection: parseBoolean(process.env.NEXT_PUBLIC_FEATURE_BILLING_ADDRESS_SECTION, true),
  },

  messages: {
    orderSuccess: process.env.NEXT_PUBLIC_MESSAGE_ORDER_SUCCESS || 'Thank you for your order!',
    orderError: process.env.NEXT_PUBLIC_MESSAGE_ORDER_ERROR || 'Something went wrong. Please try again.',
    formIncomplete: process.env.NEXT_PUBLIC_MESSAGE_FORM_INCOMPLETE || 'Please fill in all required fields to place your order',
  },
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