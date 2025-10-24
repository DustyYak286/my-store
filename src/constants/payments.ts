/**
 * Payment Constants
 * 
 * Centralized configuration for payment processing including
 * currency settings, limits, retry logic, and timeouts.
 */

// ====== CURRENCY CONFIGURATION ======

export const PAYMENT_CURRENCY = 'ron' as const;

export const CURRENCY_CONFIG = {
  code: 'RON',
  symbol: 'lei',
  locale: 'ro-RO',
  decimalPlaces: 2,
} as const;

// ====== PAYMENT LIMITS ======

export const PAYMENT_LIMITS = {
  // Minimum payment amount in smallest currency unit (bani for RON)
  // 2.50 RON = 250 bani
  MIN_AMOUNT: 250,
  
  // Maximum payment amount in smallest currency unit (bani for RON)
  // Stripe limit for RON is 999,999.99 RON, but we need to account for 19% VAT
  // So max pre-tax: 999,999.99 / 1.19 = 840,336.13 RON = 84,033,613 bani
  MAX_AMOUNT: 84033613,
  
  // Human-readable versions for display
  MIN_AMOUNT_DISPLAY: 2.50,
  // Maximum amount before tax (accounting for 19% VAT to stay within Stripe's 999,999.99 RON limit)
  MAX_AMOUNT_DISPLAY: 840336.13,
} as const;

// ====== RETRY CONFIGURATION ======

export const RETRY_CONFIG = {
  // Maximum number of payment attempts allowed
  MAX_ATTEMPTS: 3,
  
  // Base delay for exponential backoff (in milliseconds)
  BASE_DELAY: 1000,
  
  // Multiplier for exponential backoff
  BACKOFF_MULTIPLIER: 2,
  
  // Maximum delay between retries (in milliseconds)
  MAX_DELAY: 30000,
  
  // Specific retry configurations by error category
  CATEGORY_SPECIFIC: {
    // Card processing errors - quick retry
    PROCESSING_ERROR: {
      maxAttempts: 2,
      baseDelay: 2000,
      backoffMultiplier: 1.5,
    },
    
    // Network timeouts - longer delays
    TIMEOUT: {
      maxAttempts: 3,
      baseDelay: 3000,
      backoffMultiplier: 2,
    },
    
    // Rate limiting - exponential backoff
    RATE_LIMIT: {
      maxAttempts: 2,
      baseDelay: 5000,
      backoffMultiplier: 2,
    },
    
    // Authentication errors - moderate retry
    AUTHENTICATION: {
      maxAttempts: 2,
      baseDelay: 3000,
      backoffMultiplier: 1.5,
    },
    
    // Server errors - longer delays
    SERVER_ERROR: {
      maxAttempts: 2,
      baseDelay: 5000,
      backoffMultiplier: 2,
    },
    
    // Server overload - very long delays
    SERVER_OVERLOAD: {
      maxAttempts: 2,
      baseDelay: 10000,
      backoffMultiplier: 1.5,
    },
  },
} as const;

// ====== TIMEOUT CONFIGURATION ======

export const TIMEOUT_CONFIG = {
  // Client-side payment processing timeout (in milliseconds)
  PAYMENT_TIMEOUT: 60000, // 60 seconds
  
  // Warning threshold for long-running payments (in milliseconds)
  WARNING_TIMEOUT: 30000, // 30 seconds
  
  // API request timeout (in milliseconds)
  API_REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // Webhook processing timeout (in milliseconds)
  WEBHOOK_TIMEOUT: 10000, // 10 seconds
} as const;

// ====== STRIPE CONFIGURATION ======

export const STRIPE_CONFIG = {
  // Supported payment methods
  PAYMENT_METHODS: ['card', 'apple_pay', 'google_pay'] as const,
  
  // Card element options
  CARD_ELEMENT_OPTIONS: {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: false,
  },
  
  // Payment element options for new Stripe Elements
  PAYMENT_ELEMENT_OPTIONS: {
    layout: 'tabs' as const,
    paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
  },
  
  // Appearance customization for Stripe Elements
  STRIPE_APPEARANCE: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#7C4D59',
      colorBackground: '#ffffff',
      colorText: '#30313d',
      colorDanger: '#df1b41',
      fontFamily: 'Inter, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
    },
  },
} as const;

// ====== WEBHOOK CONFIGURATION ======

export const WEBHOOK_CONFIG = {
  // Webhook event types to handle
  HANDLED_EVENTS: [
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
  ] as const,
  
  // Webhook signature tolerance (in seconds)
  SIGNATURE_TOLERANCE: 300, // 5 minutes
  
  // Maximum age for webhook events (in milliseconds)
  MAX_EVENT_AGE: 300000, // 5 minutes
} as const;

// ====== ORDER STATUS CONFIGURATION ======

export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// ====== ERROR MESSAGES ======

export const PAYMENT_ERROR_MESSAGES = {
  // Generic errors
  GENERIC_ERROR: 'Payment failed. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  TIMEOUT_ERROR: 'Payment timed out. Please try again.',
  
  // Card-specific errors - declined (not retryable)
  CARD_DECLINED: 'Your card was declined. Please try a different payment method.',
  INSUFFICIENT_FUNDS: 'Insufficient funds. Please try a different payment method.',
  EXPIRED_CARD: 'Your card has expired. Please try a different payment method.',
  LOST_CARD: 'This card has been reported as lost. Please use a different payment method.',
  STOLEN_CARD: 'This card has been reported as stolen. Please use a different payment method.',
  RESTRICTED_CARD: 'Your card has restrictions that prevent this payment. Please try a different card.',
  
  // Card-specific errors - validation (user fixable)
  INCORRECT_CVC: 'Your card\'s security code is incorrect. Please try again.',
  INCORRECT_NUMBER: 'Your card number is incorrect. Please check and try again.',
  INCORRECT_ZIP: 'Your postal/ZIP code doesn\'t match your card. Please check and try again.',
  INVALID_EXPIRY: 'Your card expiry date is invalid. Please check and try again.',
  
  // Card-specific errors - processing (retryable)
  PROCESSING_ERROR: 'Temporary processing error. Please try again in a moment.',
  ISSUER_UNAVAILABLE: 'Your bank is temporarily unavailable. Please try again.',
  TEMPORARY_DECLINE: 'Payment temporarily declined. Please try again or use a different card.',
  
  // Authentication errors - 3D Secure specific
  AUTHENTICATION_REQUIRED: 'Additional authentication required. Please complete the verification.',
  AUTHENTICATION_FAILED: 'Authentication failed. Please try again.',
  THREEDS_FAILED: 'Card authentication failed. Please verify with your bank and try again.',
  THREEDS_TIMEOUT: '3D Secure authentication timed out. Please try again.',
  
  // Network-specific errors
  CONNECTION_TIMEOUT: 'Connection timed out. Please check your internet and try again.',
  CONNECTION_ERROR: 'Network connection error. Please check your internet and try again.',
  SERVER_OVERLOAD: 'Payment service is busy. Please try again in a moment.',
  SERVER_ERROR: 'Payment service error. Please try again.',
  
  // Rate limiting with specific delays
  RATE_LIMITED: 'Too many payment attempts. Please wait a moment and try again.',
  RATE_LIMITED_WITH_DELAY: (seconds: number) => `Too many requests. Please wait ${seconds} seconds and try again.`,
  
  // Payment method specific
  APPLE_PAY_UNAVAILABLE: 'Apple Pay is not available. Please try card payment instead.',
  GOOGLE_PAY_UNAVAILABLE: 'Google Pay is not available. Please try card payment instead.',
  PAYMENT_METHOD_UNAVAILABLE: 'This payment method is not available. Please try card payment instead.',
  
  // Amount errors
  AMOUNT_TOO_SMALL: `Minimum payment amount is ${PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY} ${CURRENCY_CONFIG.code}.`,
  AMOUNT_TOO_LARGE: `Maximum payment amount is ${PAYMENT_LIMITS.MAX_AMOUNT_DISPLAY.toLocaleString('ro-RO')} ${CURRENCY_CONFIG.code} (before tax).`,
  
  // Payment intent errors
  INTENT_CREATION_FAILED: 'Failed to initialize payment. Please try again.',
  INTENT_CONFIRMATION_FAILED: 'Failed to confirm payment. Please try again.',
  
  // Browser/device specific
  BROWSER_NOT_SUPPORTED: 'Your browser doesn\'t support this payment method. Please try card payment.',
  DEVICE_NOT_SUPPORTED: 'Your device doesn\'t support this payment method. Please try card payment.',
  
  // Retry messages
  RETRY_EXHAUSTED: `Maximum attempts reached (${RETRY_CONFIG.MAX_ATTEMPTS}). Please try again later.`,
  RETRY_AVAILABLE: 'Payment failed. Please try again.',
  RETRY_WITH_DELAY: (seconds: number) => `Retrying in ${seconds} seconds...`,
} as const;

// ====== SUCCESS MESSAGES ======

export const PAYMENT_SUCCESS_MESSAGES = {
  PAYMENT_SUCCEEDED: 'Payment successful! Your order is being processed.',
  REDIRECT_MESSAGE: 'Redirecting to order confirmation...',
} as const;

// ====== MONITORING CONFIGURATION ======

export const MONITORING_CONFIG = {
  // Metrics collection intervals (in milliseconds)
  METRICS_INTERVAL: 60000, // 1 minute
  
  // Success rate thresholds for alerts
  SUCCESS_RATE_WARNING: 0.95, // 95%
  SUCCESS_RATE_CRITICAL: 0.90, // 90%
  
  // Processing time thresholds (in milliseconds)
  PROCESSING_TIME_WARNING: 10000, // 10 seconds
  PROCESSING_TIME_CRITICAL: 30000, // 30 seconds
  
  // Error tracking configuration
  ERROR_TRACKING: {
    SAMPLE_RATE: 1.0, // 100% error tracking
    MAX_BREADCRUMBS: 100,
    ENVIRONMENT_DETECTION: true,
  },
} as const;

// ====== HELPER FUNCTIONS ======

/**
 * Convert amount from display format (RON) to Stripe format (bani)
 * @param amount Amount in RON (e.g., 10.50)
 * @returns Amount in bani (e.g., 1050)
 */
export const toStripeAmount = (amount: number): number => {
  return Math.round(amount * Math.pow(10, CURRENCY_CONFIG.decimalPlaces));
};

/**
 * Convert amount from Stripe format (bani) to display format (RON)
 * @param amount Amount in bani (e.g., 1050)
 * @returns Amount in RON (e.g., 10.50)
 */
export const fromStripeAmount = (amount: number): number => {
  return amount / Math.pow(10, CURRENCY_CONFIG.decimalPlaces);
};

/**
 * Format amount for display with currency
 * @param amount Amount in RON
 * @returns Formatted string (e.g., "10,50 lei")
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat(CURRENCY_CONFIG.locale, {
    style: 'currency',
    currency: CURRENCY_CONFIG.code,
    minimumFractionDigits: CURRENCY_CONFIG.decimalPlaces,
    maximumFractionDigits: CURRENCY_CONFIG.decimalPlaces,
  }).format(amount);
};

/**
 * Validate payment amount is within allowed limits
 * @param amount Amount in RON
 * @returns Validation result
 */
export const validatePaymentAmount = (amount: number): {
  isValid: boolean;
  error?: string;
} => {
  // Check for invalid number types
  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return {
      isValid: false,
      error: 'Invalid payment amount. Please enter a valid number.',
    };
  }
  
  // Check for negative amounts
  if (amount <= 0) {
    return {
      isValid: false,
      error: 'Payment amount must be greater than zero.',
    };
  }
  
  // Check minimum amount (2.50 RON)
  if (amount < PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY) {
    return {
      isValid: false,
      error: PAYMENT_ERROR_MESSAGES.AMOUNT_TOO_SMALL,
    };
  }
  
  // Check maximum amount (4,999,999 RON)
  if (amount > PAYMENT_LIMITS.MAX_AMOUNT_DISPLAY) {
    return {
      isValid: false,
      error: PAYMENT_ERROR_MESSAGES.AMOUNT_TOO_LARGE,
    };
  }
  
  // Check for excessive decimal places (RON supports 2 decimal places)
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > CURRENCY_CONFIG.decimalPlaces) {
    return {
      isValid: false,
      error: `Amount cannot have more than ${CURRENCY_CONFIG.decimalPlaces} decimal places for RON currency.`,
    };
  }
  
  return { isValid: true };
};

/**
 * Calculate retry delay with exponential backoff
 * @param attempt Current attempt number (1-based)
 * @param category Optional error category for specific retry logic
 * @returns Delay in milliseconds
 */
export const calculateRetryDelay = (
  attempt: number,
  category?: keyof typeof RETRY_CONFIG.CATEGORY_SPECIFIC
): number => {
  // Use category-specific configuration if available
  if (category && RETRY_CONFIG.CATEGORY_SPECIFIC[category]) {
    const config = RETRY_CONFIG.CATEGORY_SPECIFIC[category];
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, RETRY_CONFIG.MAX_DELAY);
  }
  
  // Default exponential backoff
  const delay = RETRY_CONFIG.BASE_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.MAX_DELAY);
};

/**
 * Get maximum retry attempts for a specific error category
 * @param category Error category
 * @returns Maximum retry attempts allowed
 */
export const getMaxRetriesForCategory = (
  category?: keyof typeof RETRY_CONFIG.CATEGORY_SPECIFIC
): number => {
  if (category && RETRY_CONFIG.CATEGORY_SPECIFIC[category]) {
    return RETRY_CONFIG.CATEGORY_SPECIFIC[category].maxAttempts;
  }
  return RETRY_CONFIG.MAX_ATTEMPTS;
};

/**
 * Determine if an error category is retryable
 * @param category Error category
 * @param subCategory Error subcategory
 * @returns Whether the error should be retried
 */
export const isErrorRetryable = (
  category: string,
  subCategory?: string
): boolean => {
  // Never retry declined cards
  if (category === 'card' && subCategory === 'declined') {
    return false;
  }
  
  // Never retry validation errors that aren't user-fixable
  if (category === 'validation' && subCategory === 'payment_method_unavailable') {
    return false;
  }
  
  // Retry network, processing, authentication, and rate limit errors
  const retryableCategories = ['network', 'authentication', 'rate_limit'];
  const retryableSubCategories = ['processing_error', 'card_validation'];
  
  return retryableCategories.includes(category) || 
         (!!subCategory && retryableSubCategories.includes(subCategory));
};

/**
 * Validate and normalize currency code
 * @param currency Currency code to validate
 * @returns Validation result with normalized currency
 */
export const validateCurrency = (currency?: string): {
  isValid: boolean;
  normalizedCurrency: string;
  error?: string;
  warning?: string;
} => {
  // Default to RON if no currency provided
  if (!currency) {
    return {
      isValid: true,
      normalizedCurrency: PAYMENT_CURRENCY,
    };
  }
  
  // Normalize currency code to lowercase for comparison
  const normalizedInput = currency.toLowerCase().trim();
  
  // Check if it's RON (our only supported currency)
  if (normalizedInput === PAYMENT_CURRENCY) {
    return {
      isValid: true,
      normalizedCurrency: PAYMENT_CURRENCY,
    };
  }
  
  // Handle common variations and typos
  const ronVariations = ['ron', 'leu', 'lei', 'romanian leu', 'rl'];
  if (ronVariations.includes(normalizedInput)) {
    return {
      isValid: true,
      normalizedCurrency: PAYMENT_CURRENCY,
      warning: `Currency normalized from '${currency}' to 'RON'.`,
    };
  }
  
  // Reject unsupported currencies
  return {
    isValid: false,
    normalizedCurrency: PAYMENT_CURRENCY,
    error: `Unsupported currency '${currency}'. Only RON (Romanian Leu) is supported.`,
  };
};

/**
 * Check if payment method is supported
 * @param method Payment method to check
 * @returns Whether the payment method is supported
 */
export const isPaymentMethodSupported = (method: string): method is typeof STRIPE_CONFIG.PAYMENT_METHODS[number] => {
  return STRIPE_CONFIG.PAYMENT_METHODS.includes(method as any);
};

// ====== ERROR CATEGORIZATION TYPES ======

export type ErrorCategory = 'card' | 'authentication' | 'network' | 'validation' | 'rate_limit' | 'unknown';
export type ErrorSubCategory = 
  | 'declined' | 'processing_error' | 'card_validation'
  | '3d_secure_failed' | 'general_auth_error'
  | 'timeout' | 'connection_error' | 'server_overload' | 'server_error' | 'api_error' | 'payment_intent_error'
  | 'payment_method_unavailable' | 'browser_not_supported'
  | 'api_rate_limit'
  | 'unhandled_error';

export type ErrorSeverity = 'low' | 'medium' | 'high';

export interface EnhancedPaymentError {
  category: ErrorCategory;
  subCategory?: ErrorSubCategory;
  isRetryable: boolean;
  userMessage: string;
  severity: ErrorSeverity;
  retryDelay?: number;
  maxRetries?: number;
  timestamp: number;
  attempt: number;
  code?: string;
  type?: string;
}

// Type exports for better TypeScript integration
export type PaymentMethod = typeof STRIPE_CONFIG.PAYMENT_METHODS[number];
export type WebhookEvent = typeof WEBHOOK_CONFIG.HANDLED_EVENTS[number];
export type RetryCategory = keyof typeof RETRY_CONFIG.CATEGORY_SPECIFIC;