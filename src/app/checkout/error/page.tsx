/**
 * Payment Error Page
 * 
 * Displays payment failure information with helpful next steps,
 * error tracking, and recovery options for customers.
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CreditCard, HelpCircle, ArrowLeft } from 'lucide-react';
import { getOrderById, getOrderByNumber } from '@/lib/orderStore';
import { searchAuditTrail } from '@/utils/auditTrail';
import { formatPrice } from '@/utils/formatPrice';
import { Order } from '@/types/order';

interface ErrorTrackingProps {
  orderId?: string;
  error: string;
  errorCode?: string;
  paymentIntentId?: string;
}

/**
 * Error tracking component for analytics and debugging
 */
function ErrorTracking({ orderId, error, errorCode, paymentIntentId }: ErrorTrackingProps) {
  useEffect(() => {
    // Track payment failure for analytics
    if (typeof window !== 'undefined') {
      // Google Analytics 4 error tracking
      if ('gtag' in window) {
        (window as any).gtag('event', 'payment_failed', {
          error_message: error,
          error_code: errorCode,
          payment_intent_id: paymentIntentId,
          order_id: orderId,
        });
      }

      // Facebook Pixel error tracking
      if ('fbq' in window) {
        (window as any).fbq('track', 'InitiateCheckout');
      }

      // Custom analytics event
      if ('dataLayer' in window) {
        (window as any).dataLayer.push({
          event: 'payment_error',
          error_details: {
            message: error,
            code: errorCode,
            payment_intent_id: paymentIntentId,
            order_id: orderId,
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log('[ERROR] Payment error tracked:', {
        orderId,
        error,
        errorCode,
        paymentIntentId,
      });
    }
  }, [orderId, error, errorCode, paymentIntentId]);

  return null;
}

/**
 * Error type classification and user-friendly messages
 */
function getErrorInfo(error: string, errorCode?: string) {
  const errorLower = error.toLowerCase();
  const code = errorCode?.toLowerCase();

  // Card declined errors
  if (code === 'card_declined' || errorLower.includes('declined')) {
    return {
      type: 'card_declined',
      title: 'Payment Declined',
      message: 'Your payment was declined by your bank or card issuer.',
      suggestions: [
        'Check that your card details are correct',
        'Ensure you have sufficient funds',
        'Try a different payment method',
        'Contact your bank to ensure the payment isn\'t blocked',
      ],
      canRetry: true,
      severity: 'warning',
    };
  }

  // Insufficient funds
  if (code === 'insufficient_funds' || errorLower.includes('insufficient')) {
    return {
      type: 'insufficient_funds',
      title: 'Insufficient Funds',
      message: 'Your card doesn\'t have enough available balance for this purchase.',
      suggestions: [
        'Check your account balance',
        'Try a different payment method',
        'Contact your bank for more information',
      ],
      canRetry: true,
      severity: 'warning',
    };
  }

  // Expired card
  if (code === 'expired_card' || errorLower.includes('expired')) {
    return {
      type: 'expired_card',
      title: 'Expired Card',
      message: 'The payment card you used has expired.',
      suggestions: [
        'Check the expiration date on your card',
        'Use an unexpired payment method',
        'Update your payment information',
      ],
      canRetry: true,
      severity: 'warning',
    };
  }

  // Incorrect CVC
  if (code === 'incorrect_cvc' || errorLower.includes('cvc') || errorLower.includes('security')) {
    return {
      type: 'incorrect_cvc',
      title: 'Incorrect Security Code',
      message: 'The security code (CVC/CVV) you entered is incorrect.',
      suggestions: [
        'Check the 3-4 digit code on the back of your card',
        'Re-enter your payment information carefully',
      ],
      canRetry: true,
      severity: 'warning',
    };
  }

  // Processing errors
  if (code === 'processing_error' || errorLower.includes('processing')) {
    return {
      type: 'processing_error',
      title: 'Processing Error',
      message: 'There was a temporary issue processing your payment.',
      suggestions: [
        'Please try again in a few minutes',
        'Check your internet connection',
        'Contact support if the issue persists',
      ],
      canRetry: true,
      severity: 'error',
    };
  }

  // Network/connection errors
  if (errorLower.includes('network') || errorLower.includes('connection') || errorLower.includes('timeout')) {
    return {
      type: 'network_error',
      title: 'Connection Error',
      message: 'There was a network issue while processing your payment.',
      suggestions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Refresh the page and retry',
      ],
      canRetry: true,
      severity: 'error',
    };
  }

  // 3D Secure authentication failed
  if (errorLower.includes('authentication') || code === 'authentication_failed') {
    return {
      type: 'authentication_failed',
      title: '3D Secure Authentication Failed',
      message: 'The 3D Secure authentication for your card was not completed.',
      suggestions: [
        'Complete the 3D Secure verification with your bank',
        'Try a different payment method',
        'Contact your bank if you\'re having trouble with verification',
      ],
      canRetry: true,
      severity: 'warning',
    };
  }

  // Generic fallback
  return {
    type: 'generic_error',
    title: 'Payment Failed',
    message: error || 'Your payment could not be processed at this time.',
    suggestions: [
      'Please try again with a different payment method',
      'Check that all your payment details are correct',
      'Contact support if the issue continues',
    ],
    canRetry: true,
    severity: 'error',
  };
}

/**
 * Retry payment button component
 */
function RetryPaymentButton({ orderId }: { orderId?: string }) {
  const handleRetry = () => {
    // Redirect back to checkout with order context
    const checkoutUrl = orderId 
      ? `/checkout?retry=true&order_id=${orderId}`
      : '/checkout?retry=true';
    
    if (window.location.assign) {
      window.location.assign(checkoutUrl);
    } else {
      window.location.href = checkoutUrl;
    }
  };

  return (
    <button
      onClick={handleRetry}
      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    >
      <CreditCard className="h-5 w-5 mr-2" />
      Try Payment Again
    </button>
  );
}

/**
 * Payment error page component
 */
export default function PaymentErrorPage() {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorInfo, setErrorInfo] = useState<ReturnType<typeof getErrorInfo> | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<{
    paymentIntentId?: string;
    errorCode?: string;
    errorMessage: string;
  } | null>(null);

  useEffect(() => {
    const orderId = searchParams.get('order_id');
    const orderNumber = searchParams.get('order_number');
    const paymentIntentId = searchParams.get('payment_intent');
    const errorMessage = searchParams.get('error') || 'Payment failed';
    const errorCode = searchParams.get('error_code');
    
    // Set payment details from URL params
    setPaymentDetails({
      ...(paymentIntentId ? { paymentIntentId } : {}),
      ...(errorCode ? { errorCode } : {}),
      errorMessage,
    });

    // Get error classification
    const errorClassification = getErrorInfo(errorMessage, errorCode || undefined);
    setErrorInfo(errorClassification);

    // Try to find the associated order if provided
    if (orderId || orderNumber) {
      try {
        let foundOrder: Order | null = null;
        
        if (orderId) {
          foundOrder = getOrderById(orderId);
        } else if (orderNumber) {
          foundOrder = getOrderByNumber(orderNumber);
        }

        if (foundOrder) {
          setOrder(foundOrder);
        }
      } catch (err) {
        console.error('Error loading order for error page:', err);
      }
    }

    setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
            </div>
            <p className="mt-4 text-center text-sm text-gray-600">
              Loading error details...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!errorInfo || !paymentDetails) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Error tracking */}
      <ErrorTracking
        {...(order?.id ? { orderId: order.id } : {})}
        error={paymentDetails.errorMessage}
        {...(paymentDetails.errorCode ? { errorCode: paymentDetails.errorCode } : {})}
        {...(paymentDetails.paymentIntentId ? { paymentIntentId: paymentDetails.paymentIntentId } : {})}
      />
      
      <div className="max-w-3xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          {/* Header */}
          <div className={`px-6 py-8 sm:px-8 ${
            errorInfo.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50'
          }`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle 
                  className={`h-8 w-8 ${
                    errorInfo.severity === 'error' ? 'text-red-500' : 'text-yellow-500'
                  }`} 
                  aria-hidden="true" 
                />
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-900">{errorInfo.title}</h1>
                <p className="mt-1 text-sm text-gray-600">
                  {errorInfo.message}
                </p>
              </div>
            </div>
          </div>

          {/* Error details and suggestions */}
          <div className="px-6 py-6 sm:px-8">
            {/* Order information if available */}
            {order && (
              <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-medium text-gray-900 mb-3">Order Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-500">Order Number:</span>
                    <span className="ml-2 font-mono text-gray-900">{order.orderNumber}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Amount:</span>
                    <span className="ml-2 text-gray-900">
                      {formatPrice(order.totals.total)} {order.currency}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* What to do next */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">What you can do:</h2>
              <ul className="space-y-3">
                {errorInfo.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-gray-400 mt-2 mr-3"></span>
                    <span className="text-sm text-gray-600">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                {errorInfo.canRetry && order?.id && <RetryPaymentButton orderId={order.id} />}
                
                <Link
                  href="/checkout"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Checkout
                </Link>

                <Link
                  href="/support"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Contact Support
                </Link>
              </div>
            </div>

            {/* Help section */}
            <div className="mt-8 bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">Need Help?</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p>
                  If you continue to experience issues, our support team is here to help:
                </p>
                <ul className="mt-2 space-y-1 ml-4">
                  <li>• Email: support@mystore.com</li>
                  <li>• Phone: 1-800-SUPPORT</li>
                  <li>• Live Chat: Available 24/7</li>
                </ul>
                <p className="mt-3 text-xs text-blue-700">
                  {paymentDetails.paymentIntentId && (
                    <>Reference ID: {paymentDetails.paymentIntentId}</>
                  )}
                </p>
              </div>
            </div>

            {/* Common payment issues */}
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Common Payment Issues</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Card Issues</h4>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Expired card</li>
                    <li>• Incorrect card details</li>
                    <li>• Insufficient funds</li>
                    <li>• Card blocked by bank</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Technical Issues</h4>
                  <ul className="text-gray-600 space-y-1">
                    <li>• Internet connection problems</li>
                    <li>• Browser compatibility</li>
                    <li>• Temporary server issues</li>
                    <li>• Payment processor downtime</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}