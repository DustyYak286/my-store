/**
 * Pure Payment Flow Functions
 * 
 * Functional core for payment processing - no React, no side effects.
 * All external dependencies injected via Gateway interface.
 */

export interface PaymentGateway {
  detectMethods(signal?: AbortSignal): Promise<string[]>;
  createIntent(data: PaymentData, signal?: AbortSignal): Promise<PaymentIntent>;
  confirmPayment(clientSecret: string, orderInfo?: PaymentIntent, signal?: AbortSignal): Promise<PaymentResult>;
}

export interface PaymentData {
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
  };
  shippingAddress: Address;
  billingAddress: Address;
  items: CartItem[];
  currency: string;
}

export interface Address {
  fullName: string;
  streetAddress: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface PaymentIntent {
  clientSecret: string;
  orderId: string;
  orderNumber: string;
}

export type PaymentStatus = 'succeeded' | 'requires_action' | 'failed';

export interface PaymentResult {
  status: PaymentStatus;
  paymentIntent?: any;
  error?: PaymentError;
}

export interface PaymentError {
  type: string;
  code?: string;
  message: string;
  category: 'card' | 'authentication' | 'network' | 'validation' | 'unknown';
  isRetryable: boolean;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Initialize payment methods detection
 * Pure function - no side effects
 */
export async function initializePayment(gateway: PaymentGateway, signal?: AbortSignal): Promise<string[]> {
  return gateway.detectMethods(signal);
}

/**
 * Process payment submission
 * Pure function - orchestrates payment flow
 */
export async function submitPayment(
  gateway: PaymentGateway, 
  paymentData: PaymentData,
  signal?: AbortSignal
): Promise<PaymentResult> {
  try {
    // Step 1: Create payment intent
    const intent = await gateway.createIntent(paymentData, signal);
    
    // Step 2: Confirm payment
    const result = await gateway.confirmPayment(intent.clientSecret, intent, signal);
    
    return result;
  } catch (error) {
    return {
      status: 'failed',
      error: {
        type: 'payment_error',
        message: error instanceof Error ? error.message : 'Unknown payment error',
        category: 'unknown',
        isRetryable: true,
        severity: 'medium',
      }
    };
  }
}

/**
 * Calculate retry delay with exponential backoff
 * Pure function for retry logic
 */
export function calculateRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attemptNumber), 10000); // Max 10 seconds
}

/**
 * Determine if error is retryable
 * Pure function for error categorization
 */
export function shouldRetryPayment(error: PaymentError, attemptNumber: number, maxAttempts: number): boolean {
  return error.isRetryable && attemptNumber < maxAttempts;
}