/**
 * Stripe Gateway Implementation
 * 
 * Imperative shell that adapts external dependencies (Stripe, API) 
 * to the pure PaymentGateway interface.
 */

import type { Stripe, StripeElements } from '@stripe/stripe-js';
import type { PaymentGateway, PaymentData, PaymentIntent, PaymentResult } from '@/core/paymentFlow';

export interface StripeGatewayDependencies {
  stripe: Stripe | null;
  elements: StripeElements | null;
  apiEndpoint: string;
}

export function createStripeGateway(deps: StripeGatewayDependencies): PaymentGateway {
  const { stripe, elements, apiEndpoint } = deps;

  return {
    async detectMethods(signal?: AbortSignal): Promise<string[]> {
      // For now, return static list. Could be enhanced to detect available methods
      if (signal?.aborted) throw new Error('Operation aborted');
      
      if (!stripe) {
        throw new Error('Stripe not initialized');
      }

      // Basic payment methods detection
      return ['card', 'apple_pay', 'google_pay'];
    },

    async createIntent(data: PaymentData, signal?: AbortSignal): Promise<PaymentIntent> {
      if (signal?.aborted) throw new Error('Operation aborted');

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerInfo: data.customerInfo,
          shippingAddress: data.shippingAddress,
          billingAddress: data.billingAddress,
          items: data.items,
          currency: data.currency,
          clientRequestId: `client_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Server error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.paymentIntent?.clientSecret || !result.order?.id) {
        throw new Error(result.error?.message || 'Failed to create payment intent');
      }

      return {
        clientSecret: result.paymentIntent.clientSecret,
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
      };
    },

    async confirmPayment(clientSecret: string, orderInfo?: PaymentIntent, signal?: AbortSignal): Promise<PaymentResult> {
      if (signal?.aborted) throw new Error('Operation aborted');
      
      if (!stripe || !elements) {
        throw new Error('Stripe or Elements not initialized');
      }

      try {
        // First, submit the elements (required by Stripe Payment Element API)
        const { error: submitError } = await elements.submit();
        
        if (submitError) {
          return {
            status: 'failed',
            error: {
              type: submitError.type || 'unknown',
              code: submitError.code,
              message: submitError.message || 'Payment submission failed',
              category: categorizeStripeError(submitError.type),
              isRetryable: isRetryableError(submitError.type),
              severity: getErrorSeverity(submitError.type),
            }
          };
        }

        // Build return URL with order information for 3DS flows
        let return_url = `${window.location.origin}/checkout/success`;
        if (orderInfo) {
          const successParams = new URLSearchParams();
          successParams.set('order_id', orderInfo.orderId);
          successParams.set('order_number', orderInfo.orderNumber);
          return_url = `${return_url}?${successParams.toString()}`;
        }

        // Then confirm the payment
        const result = await stripe.confirmPayment({
          elements,
          clientSecret,
          confirmParams: {
            return_url,
          },
          redirect: 'if_required',
        });

        if (signal?.aborted) {
          throw new Error('Operation aborted');
        }

        if (result.error) {
          return {
            status: 'failed',
            error: {
              type: result.error.type || 'unknown',
              code: result.error.code,
              message: result.error.message || 'Payment failed',
              category: categorizeStripeError(result.error.type),
              isRetryable: isRetryableError(result.error.type),
              severity: getErrorSeverity(result.error.type),
            }
          };
        }

        const status = result.paymentIntent?.status;
        if (status === 'succeeded') {
          return {
            status: 'succeeded',
            paymentIntent: result.paymentIntent,
          };
        } else if (status === 'requires_action') {
          return {
            status: 'requires_action',
            paymentIntent: result.paymentIntent,
          };
        } else {
          return {
            status: 'failed',
            error: {
              type: 'payment_incomplete',
              message: `Payment not completed. Status: ${status}`,
              category: 'unknown',
              isRetryable: true,
              severity: 'medium',
            }
          };
        }
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }

        return {
          status: 'failed',
          error: {
            type: 'confirmation_error',
            message: error instanceof Error ? error.message : 'Payment confirmation failed',
            category: 'network',
            isRetryable: true,
            severity: 'medium',
          }
        };
      }
    },
  };
}

// Helper functions for error categorization
function categorizeStripeError(errorType?: string): 'card' | 'authentication' | 'network' | 'validation' | 'unknown' {
  if (!errorType) return 'unknown';
  
  if (errorType.includes('card')) return 'card';
  if (errorType.includes('authentication') || errorType.includes('3d_secure')) return 'authentication';
  if (errorType.includes('api') || errorType.includes('connection')) return 'network';
  if (errorType.includes('validation') || errorType.includes('parameter')) return 'validation';
  
  return 'unknown';
}

function isRetryableError(errorType?: string): boolean {
  if (!errorType) return false;
  
  const nonRetryableTypes = [
    'card_declined',
    'invalid_cvc',
    'invalid_expiry_month',
    'invalid_expiry_year',
    'invalid_number',
  ];
  
  return !nonRetryableTypes.includes(errorType);
}

function getErrorSeverity(errorType?: string): 'low' | 'medium' | 'high' {
  if (!errorType) return 'medium';
  
  if (errorType.includes('card_declined')) return 'high';
  if (errorType.includes('authentication')) return 'medium';
  if (errorType.includes('network') || errorType.includes('api')) return 'low';
  
  return 'medium';
}