/**
 * Webhook Processing Utilities
 * 
 * Handles webhook event processing including order status updates,
 * payment confirmation, and audit trail management.
 */

import Stripe from 'stripe';
import { OrderStatus, PaymentStatus } from '@/types/order';
import { updateStoredOrderStatus, updateStoredOrderPayment, getOrderById } from '@/lib/orderStore';
import { monitoring } from '@/utils/monitoring';
import { 
  recordOrderStatusChange, 
  recordPaymentStatusChange, 
  recordWebhookProcessing 
} from '@/utils/auditTrail';
import { clearCartAfterPayment, CartClearingResult } from '@/utils/cartClearing';
import { sendOrderConfirmedEmail, sendPaymentFailedEmail, EmailResult } from '@/utils/emailHelpers';

/**
 * Categorize payment failures for better analytics and insights
 */
function categorizePaymentFailure(lastPaymentError: any): string {
  if (!lastPaymentError) return 'unknown';
  
  const code = lastPaymentError.code?.toLowerCase() || '';
  const declineCode = lastPaymentError.decline_code?.toLowerCase() || '';
  
  // Card-related failures
  if (declineCode) {
    if (['insufficient_funds', 'generic_decline'].includes(declineCode)) {
      return 'card_declined';
    }
    if (['expired_card', 'invalid_expiry_month', 'invalid_expiry_year'].includes(declineCode)) {
      return 'card_expired';
    }
    if (['incorrect_cvc', 'invalid_cvc'].includes(declineCode)) {
      return 'card_security_code';
    }
    if (['lost_card', 'stolen_card', 'pickup_card'].includes(declineCode)) {
      return 'card_security_issue';
    }
    if (['fraudulent', 'merchant_blacklist'].includes(declineCode)) {
      return 'fraud_prevention';
    }
    return 'card_declined';
  }
  
  // Authentication failures
  if (code.includes('authentication')) {
    return 'authentication_failed';
  }
  
  // Network/processing failures
  if (code.includes('network') || code.includes('timeout') || code.includes('processing')) {
    return 'processing_error';
  }
  
  // API/validation errors
  if (code.includes('invalid') || code.includes('missing')) {
    return 'validation_error';
  }
  
  return 'unknown';
}

interface WebhookMetadata {
  orderId: string;
  version: string;
  source: string;
}

interface ProcessingResult {
  success: boolean;
  orderId?: string;
  error?: string;
  action?: string;
  cartClearing?: CartClearingResult;
  emailNotification?: EmailResult;
}

/**
 * Process webhook events and update order status accordingly
 */
export async function processWebhookEvent(
  event: Stripe.Event,
  metadata: WebhookMetadata
): Promise<ProcessingResult> {
  const { orderId } = metadata;
  const eventType = event.type;

  try {
    // Get the order to verify it exists
    const order = getOrderById(orderId);
    if (!order) {
      const error = `Order not found for webhook event: ${orderId}`;
      monitoring.recordWebhookError('order_not_found', { orderId, eventType });
      return {
        success: false,
        error,
      };
    }

    // Process based on event type
    switch (eventType) {
      case 'payment_intent.succeeded':
        return await processPaymentSucceeded(event, orderId);
        
      case 'payment_intent.payment_failed':
        return await processPaymentFailed(event, orderId);
        
      default:
        // This shouldn't happen due to filtering in route, but handle gracefully
        return {
          success: true,
          orderId,
          action: 'ignored_unhandled_event',
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    monitoring.recordWebhookError('processing_exception', { 
      orderId, 
      eventType, 
      error: errorMessage 
    });
    
    // Record failed processing in audit trail
    recordWebhookProcessing(
      orderId,
      event.id,
      eventType,
      'processing_exception',
      false,
      errorMessage,
      {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      }
    );
    
    return {
      success: false,
      orderId,
      error: `Processing failed: ${errorMessage}`,
    };
  }
}

/**
 * Process payment_intent.succeeded event
 */
async function processPaymentSucceeded(
  event: Stripe.Event,
  orderId: string
): Promise<ProcessingResult> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const now = new Date().toISOString();

  try {
    // Get the original order to validate payment integrity
    const originalOrder = getOrderById(orderId);
    if (!originalOrder) {
      return {
        success: false,
        orderId,
        error: 'Order not found for payment verification',
      };
    }

    // CRITICAL SECURITY: Validate payment amount against original order
    // Skip validation if order is already paid (idempotent webhook handling)
    if (originalOrder.status !== 'paid') {
      const expectedAmount = originalOrder.payment?.amount || 
                            (originalOrder.totals?.total ? Math.round(originalOrder.totals.total * 100) : 0) ||
                            (originalOrder.total ? Math.round(originalOrder.total * 100) : 0);
      
      if (expectedAmount === 0) {
        monitoring.recordWebhookError('amount_verification_failed', {
          orderId,
          reason: 'Could not determine expected amount from order',
          orderData: {
            payment: originalOrder.payment,
            totals: originalOrder.totals,
            total: originalOrder.total
          }
        });
        throw new Error(`Payment amount verification failed: Could not determine expected amount for order ${orderId}`);
      }

      if (Math.abs(paymentIntent.amount - expectedAmount) > 1) { // Allow 1 bani tolerance for rounding
        monitoring.recordWebhookError('payment_tampering_detected', {
          orderId,
          expectedAmount,
          actualAmount: paymentIntent.amount,
          difference: paymentIntent.amount - expectedAmount,
          paymentIntentId: paymentIntent.id,
          webhook: event.id
        });
        throw new Error(`Payment amount tampering detected: expected ${expectedAmount} bani, got ${paymentIntent.amount} bani for order ${orderId}`);
      }
    } else {
      // Order already paid - this is likely a duplicate webhook, still verify amount but be more lenient
      const currentAmount = originalOrder.payment?.amount;
      if (currentAmount && Math.abs(paymentIntent.amount - currentAmount) > 1) {
        monitoring.recordWebhookError('duplicate_webhook_amount_mismatch', {
          orderId,
          currentAmount,
          webhookAmount: paymentIntent.amount,
          difference: paymentIntent.amount - currentAmount,
          paymentIntentId: paymentIntent.id,
          webhook: event.id
        });
        // Log but don't throw - allow idempotent processing to continue
        console.warn(`⚠️ Duplicate webhook amount mismatch for paid order ${orderId}: expected ${currentAmount}, got ${paymentIntent.amount}`);
      }
    }

    // Update payment information first
    const paymentUpdateResult = updateStoredOrderPayment(
      orderId,
      {
        paymentIntentId: paymentIntent.id,
        capturedAt: now,
        transactionId: paymentIntent.charges?.data[0]?.id,
        gatewayResponse: {
          stripePaymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          paymentMethod: paymentIntent.payment_method,
          created: paymentIntent.created,
        },
        metadata: {
          webhookEventId: event.id,
          webhookEventType: event.type,
          processedAt: now,
        },
      },
      'stripe_webhook'
    );

    if (!paymentUpdateResult.success) {
      monitoring.recordWebhookError('payment_update_failed', { 
        orderId, 
        error: paymentUpdateResult.error 
      });
      return {
        success: false,
        orderId,
        error: `Failed to update payment: ${paymentUpdateResult.error}`,
      };
    }

    // Get the current order to check status
    const currentOrder = getOrderById(orderId);
    if (!currentOrder) {
      return {
        success: false,
        orderId,
        error: 'Order not found when updating status',
      };
    }

    // If order is still PENDING, transition to PROCESSING first
    if (currentOrder.status === OrderStatus.PENDING) {
      const processingUpdateResult = await updateStoredOrderStatus(
        orderId,
        OrderStatus.PROCESSING,
        'Payment processing via Stripe webhook',
        'stripe_webhook',
        {
          webhookEventId: event.id,
          webhookEventType: event.type,
          paymentIntentId: paymentIntent.id,
          processedAt: now,
        }
      );

      if (!processingUpdateResult.success) {
        monitoring.recordWebhookError('status_update_failed', { 
          orderId, 
          error: processingUpdateResult.error,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.PROCESSING,
        });
        return {
          success: false,
          orderId,
          error: `Failed to update order to processing: ${processingUpdateResult.error}`,
        };
      }
    }

    // Update order status to PAID (only if not already PAID - idempotent webhook handling)
    const refreshedOrder = getOrderById(orderId);
    if (!refreshedOrder) {
      return {
        success: false,
        orderId,
        error: 'Order not found when updating status to PAID',
      };
    }

    let statusUpdateResult: { success: boolean; error?: string } = { success: true };
    
    if (refreshedOrder.status !== OrderStatus.PAID) {
      statusUpdateResult = await updateStoredOrderStatus(
        orderId,
        OrderStatus.PAID,
        'Payment confirmed via Stripe webhook',
        'stripe_webhook',
        {
          webhookEventId: event.id,
          webhookEventType: event.type,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          processedAt: now,
        }
      );

      if (!statusUpdateResult.success) {
        monitoring.recordWebhookError('status_update_failed', { 
          orderId, 
          error: statusUpdateResult.error 
        });
        return {
          success: false,
          orderId,
          error: `Failed to update order status: ${statusUpdateResult.error}`,
        };
      }
    } else {
      // Order already PAID - idempotent webhook processing
      console.log(`ℹ️ Order ${orderId} already in PAID status - idempotent webhook processing`);
    }

    // Clear the cart after successful payment
    const updatedOrder = getOrderById(orderId);
    let cartClearingResult: CartClearingResult | undefined;
    let emailResult: EmailResult | undefined;
    
    if (updatedOrder) {
      // Clear cart
      try {
        cartClearingResult = await clearCartAfterPayment(
          updatedOrder,
          'Payment successful via Stripe webhook'
        );
        
        if (cartClearingResult.success) {
          console.log(`✅ Cart cleared successfully for order ${orderId} using ${cartClearingResult.method}`);
        } else {
          console.warn(`⚠️ Cart clearing failed for order ${orderId}: ${cartClearingResult.error}`);
          // Don't fail the entire webhook processing for cart clearing failures
          monitoring.recordWebhookError('cart_clearing_failed', { 
            orderId, 
            error: cartClearingResult.error,
            method: cartClearingResult.method,
          });
        }
      } catch (cartError) {
        const cartErrorMessage = cartError instanceof Error ? cartError.message : 'Unknown cart clearing error';
        console.error(`❌ Cart clearing exception for order ${orderId}:`, cartErrorMessage);
        
        cartClearingResult = {
          success: false,
          method: 'failed',
          error: cartErrorMessage,
          orderId,
          timestamp: new Date().toISOString(),
        };
        
        monitoring.recordWebhookError('cart_clearing_exception', { 
          orderId, 
          error: cartErrorMessage 
        });
      }

      // Send order confirmation email
      try {
        emailResult = await sendOrderConfirmedEmail(updatedOrder);
        
        if (emailResult.success) {
          console.log(`📧 Order confirmation email sent for order ${orderId} (${emailResult.emailId})`);
        } else {
          console.warn(`⚠️ Order confirmation email failed for order ${orderId}: ${emailResult.error}`);
          // Don't fail the entire webhook processing for email failures
          monitoring.recordWebhookError('email_notification_failed', {
            orderId,
            error: emailResult.error,
            provider: emailResult.provider,
          });
        }
      } catch (emailError) {
        const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';
        console.error(`❌ Email notification exception for order ${orderId}:`, emailErrorMessage);
        
        emailResult = {
          success: false,
          error: emailErrorMessage,
          provider: 'unknown',
          timestamp: new Date().toISOString(),
        };
        
        monitoring.recordWebhookError('email_notification_exception', {
          orderId,
          error: emailErrorMessage,
        });
      }
    }

    // Record successful processing in monitoring
    monitoring.recordWebhookOrderUpdated(orderId, OrderStatus.PAID, paymentIntent.amount);
    
    // Record comprehensive audit trail
    recordWebhookProcessing(
      orderId,
      event.id,
      event.type,
      'payment_confirmed',
      true,
      undefined,
      {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        finalStatus: OrderStatus.PAID,
        paymentStatus: PaymentStatus.SUCCEEDED,
        cartClearing: cartClearingResult ? {
          success: cartClearingResult.success,
          method: cartClearingResult.method,
          error: cartClearingResult.error,
        } : undefined,
        emailNotification: emailResult ? {
          success: emailResult.success,
          emailId: emailResult.emailId,
          provider: emailResult.provider,
          error: emailResult.error,
        } : undefined,
      }
    );
    
    return {
      success: true,
      orderId,
      action: 'payment_confirmed',
      cartClearing: cartClearingResult,
      emailNotification: emailResult,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    monitoring.recordWebhookError('payment_succeeded_processing_failed', { 
      orderId, 
      error: errorMessage 
    });
    
    return {
      success: false,
      orderId,
      error: `Payment succeeded processing failed: ${errorMessage}`,
    };
  }
}

/**
 * Process payment_intent.payment_failed event
 */
async function processPaymentFailed(
  event: Stripe.Event,
  orderId: string
): Promise<ProcessingResult> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const now = new Date().toISOString();

  try {
    // Extract failure information
    const lastPaymentError = paymentIntent.last_payment_error;
    const failureReason = lastPaymentError?.message || 'Payment failed';
    const failureCode = lastPaymentError?.code || 'unknown';
    
    // Record detailed payment failure tracking for monitoring
    const failureDetails = {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      failureCode,
      failureReason,
      declineCode: lastPaymentError?.decline_code,
      failureMessage: lastPaymentError?.message,
      paymentMethodType: lastPaymentError?.payment_method?.type,
      cardBrand: lastPaymentError?.payment_method?.card?.brand,
      cardCountry: lastPaymentError?.payment_method?.card?.country,
      orderId,
      eventId: event.id,
    };
    
    // Enhanced failure tracking based on error type
    if (lastPaymentError?.decline_code) {
      monitoring.recordCardDecline(lastPaymentError.decline_code, failureDetails);
    } else if (lastPaymentError?.code === 'authentication_required' || 
               lastPaymentError?.code?.includes('authentication')) {
      monitoring.recordAuthenticationFailure(lastPaymentError.code, failureDetails);
    } else if (lastPaymentError?.code?.includes('network') || 
               lastPaymentError?.code?.includes('timeout')) {
      monitoring.recordNetworkTimeout('payment_processing', failureDetails);
    } else {
      // General payment failure tracking
      monitoring.recordPaymentFailure(failureCode, failureDetails);
    }
    
    // Additional categorized tracking for payment errors
    monitoring.recordPaymentError(failureCode, {
      ...failureDetails,
      category: categorizePaymentFailure(lastPaymentError),
    });

    // Update payment information first
    const paymentUpdateResult = updateStoredOrderPayment(
      orderId,
      {
        paymentIntentId: paymentIntent.id,
        failedAt: now,
        failureReason,
        failureCode,
        gatewayResponse: {
          stripePaymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          lastPaymentError: lastPaymentError || undefined,
          created: paymentIntent.created,
        },
        metadata: {
          webhookEventId: event.id,
          webhookEventType: event.type,
          processedAt: now,
        },
      },
      'stripe_webhook'
    );

    if (!paymentUpdateResult.success) {
      monitoring.recordWebhookError('payment_update_failed', { 
        orderId, 
        error: paymentUpdateResult.error 
      });
      return {
        success: false,
        orderId,
        error: `Failed to update payment: ${paymentUpdateResult.error}`,
      };
    }

    // Get the current order to check status
    const currentOrder = getOrderById(orderId);
    if (!currentOrder) {
      return {
        success: false,
        orderId,
        error: 'Order not found when updating status to failed',
      };
    }

    // If order is still PENDING, transition to PROCESSING first before FAILED
    if (currentOrder.status === OrderStatus.PENDING) {
      const processingUpdateResult = await updateStoredOrderStatus(
        orderId,
        OrderStatus.PROCESSING,
        'Payment processing started via Stripe webhook',
        'stripe_webhook',
        {
          webhookEventId: event.id,
          webhookEventType: event.type,
          paymentIntentId: paymentIntent.id,
          processedAt: now,
        }
      );

      if (!processingUpdateResult.success) {
        monitoring.recordWebhookError('status_update_failed', { 
          orderId, 
          error: processingUpdateResult.error,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.PROCESSING,
        });
        return {
          success: false,
          orderId,
          error: `Failed to update order to processing: ${processingUpdateResult.error}`,
        };
      }
    }

    // Update order status to FAILED
    const statusUpdateResult = await updateStoredOrderStatus(
      orderId,
      OrderStatus.FAILED,
      `Payment failed: ${failureReason}`,
      'stripe_webhook',
      {
        webhookEventId: event.id,
        webhookEventType: event.type,
        paymentIntentId: paymentIntent.id,
        failureReason,
        failureCode,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        processedAt: now,
      }
    );

    if (!statusUpdateResult.success) {
      monitoring.recordWebhookError('status_update_failed', { 
        orderId, 
        error: statusUpdateResult.error 
      });
      return {
        success: false,
        orderId,
        error: `Failed to update order status: ${statusUpdateResult.error}`,
      };
    }

    // Send payment failed email notification
    const orderForEmail = getOrderById(orderId);
    let emailResult: EmailResult | undefined;
    
    if (orderForEmail) {
      try {
        emailResult = await sendPaymentFailedEmail(orderForEmail, failureReason);
        
        if (emailResult.success) {
          console.log(`📧 Payment failed email sent for order ${orderId} (${emailResult.emailId})`);
        } else {
          console.warn(`⚠️ Payment failed email failed for order ${orderId}: ${emailResult.error}`);
          monitoring.recordWebhookError('email_notification_failed', {
            orderId,
            error: emailResult.error,
            provider: emailResult.provider,
          });
        }
      } catch (emailError) {
        const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';
        console.error(`❌ Email notification exception for order ${orderId}:`, emailErrorMessage);
        
        emailResult = {
          success: false,
          error: emailErrorMessage,
          provider: 'unknown',
          timestamp: new Date().toISOString(),
        };
        
        monitoring.recordWebhookError('email_notification_exception', {
          orderId,
          error: emailErrorMessage,
        });
      }
    }

    // Record failed processing in monitoring
    monitoring.recordWebhookOrderUpdated(orderId, OrderStatus.FAILED, paymentIntent.amount);
    
    // Record comprehensive audit trail
    recordWebhookProcessing(
      orderId,
      event.id,
      event.type,
      'payment_failed',
      true,
      undefined,
      {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        finalStatus: OrderStatus.FAILED,
        paymentStatus: PaymentStatus.FAILED,
        failureReason,
        failureCode,
        emailNotification: emailResult ? {
          success: emailResult.success,
          emailId: emailResult.emailId,
          provider: emailResult.provider,
          error: emailResult.error,
        } : undefined,
      }
    );
    
    return {
      success: true,
      orderId,
      action: 'payment_failed',
      emailNotification: emailResult,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    monitoring.recordWebhookError('payment_failed_processing_failed', { 
      orderId, 
      error: errorMessage 
    });
    
    return {
      success: false,
      orderId,
      error: `Payment failed processing failed: ${errorMessage}`,
    };
  }
}

/**
 * Validate webhook processing requirements
 */
export function validateWebhookProcessingRequirements(
  event: Stripe.Event,
  metadata: WebhookMetadata
): { isValid: boolean; error?: string } {
  // Validate event type
  if (!['payment_intent.succeeded', 'payment_intent.payment_failed'].includes(event.type)) {
    return {
      isValid: false,
      error: `Unsupported event type for processing: ${event.type}`,
    };
  }

  // Validate metadata
  if (!metadata.orderId) {
    return {
      isValid: false,
      error: 'Missing orderId in webhook metadata',
    };
  }

  // Validate payment intent object
  if (!event.data.object || typeof event.data.object !== 'object') {
    return {
      isValid: false,
      error: 'Invalid payment intent object in webhook event',
    };
  }

  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  // Validate payment intent has required fields
  if (!paymentIntent.id) {
    return {
      isValid: false,
      error: 'Missing payment intent ID',
    };
  }

  if (!paymentIntent.amount || paymentIntent.amount <= 0) {
    return {
      isValid: false,
      error: 'Invalid payment intent amount',
    };
  }

  return { isValid: true };
}

/**
 * Get order update summary for logging
 */
export function getOrderUpdateSummary(
  orderId: string,
  eventType: string,
  result: ProcessingResult
) {
  return {
    orderId,
    eventType,
    success: result.success,
    action: result.action,
    error: result.error,
    timestamp: new Date().toISOString(),
  };
}