/**
 * Payment Success Page
 * 
 * Displays successful payment confirmation with order details,
 * conversion tracking, and next steps for the customer.
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, ShoppingBag, Mail, Printer } from 'lucide-react';
// Order fetching now handled via API calls
import { searchAuditTrail } from '@/utils/auditTrail';
import { formatPrice } from '@/utils/formatPrice';
import { useCartClearingCheck, useCartClearing } from '@/hooks/useCartClearing';
import { Order } from '@/types/order';

interface ConversionTrackingProps {
  order: Order;
  paymentIntentId: string;
}

/**
 * Conversion tracking component for analytics
 */
function ConversionTracking({ order, paymentIntentId }: ConversionTrackingProps) {
  useEffect(() => {
    // Track successful conversion
    if (typeof window !== 'undefined') {
      // Google Analytics 4 conversion tracking
      if ('gtag' in window) {
        (window as any).gtag('event', 'purchase', {
          transaction_id: order.id,
          value: order.totals.total,
          currency: order.currency.toUpperCase(),
          items: order.items.map(item => ({
            item_id: item.id.toString(),
            item_name: item.name,
            category: 'Product',
            quantity: item.quantity,
            price: item.unitPrice,
          })),
        });
      }

      // Facebook Pixel conversion tracking
      if ('fbq' in window) {
        (window as any).fbq('track', 'Purchase', {
          value: order.totals.total,
          currency: order.currency.toUpperCase(),
          content_ids: order.items.map(item => item.id.toString()),
          content_type: 'product',
          num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
        });
      }

      // Custom analytics event
      if ('dataLayer' in window) {
        (window as any).dataLayer.push({
          event: 'ecommerce_purchase',
          ecommerce: {
            transaction_id: order.id,
            affiliation: 'My Store',
            value: order.totals.total,
            currency: order.currency.toUpperCase(),
            items: order.items.map(item => ({
              item_id: item.id.toString(),
              item_name: item.name,
              quantity: item.quantity,
              price: item.unitPrice,
            })),
          },
          payment_method: 'stripe',
          payment_intent_id: paymentIntentId,
          order_number: order.orderNumber,
        });
      }

      console.log('[TRACK] Conversion tracked:', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.totals.total,
        currency: order.currency,
        paymentIntentId,
      });
    }
  }, [order, paymentIntentId]);

  return null;
}

/**
 * Order summary component
 */
function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
      
      <div className="space-y-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <img
                className="h-16 w-16 rounded-md object-cover"
                src={item.image}
                alt={item.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/placeholder-product.jpg';
                }}
              />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
              <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
            </div>
            <div className="text-sm font-medium text-gray-900">
              {formatPrice(item.unitPrice * item.quantity)} {order.currency}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatPrice(order.totals.subtotal)} {order.currency}</span>
        </div>
        {order.totals.discount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount</span>
            <span>-{formatPrice(order.totals.discount)} {order.currency}</span>
          </div>
        )}
        {order.totals.shipping > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Shipping</span>
            <span>{formatPrice(order.totals.shipping)} {order.currency}</span>
          </div>
        )}
        {order.totals.tax > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax</span>
            <span>{formatPrice(order.totals.tax)} {order.currency}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2">
          <div className="flex justify-between text-base font-medium text-gray-900">
            <span>Total</span>
            <span>{formatPrice(order.totals.total)} {order.currency}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Payment success page component
 */
export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const { checkAndClearIfNeeded } = useCartClearingCheck();
  const { recordOrderCompletion } = useCartClearing();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<{
    paymentIntentId: string;
    amount: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    const loadOrder = async () => {
      const orderId = searchParams.get('order_id');
      const orderNumber = searchParams.get('order_number');
      const paymentIntentId = searchParams.get('payment_intent');
      
      if (!orderId && !orderNumber) {
        setError('Missing order information. Please check your email for order confirmation.');
        setLoading(false);
        return;
      }

      try {
        // Production-grade order fetching via API
        const orderIdentifier = orderId || orderNumber;
        console.log(`[DEBUG] Fetching order via API: ${orderIdentifier}`);
        
        const response = await fetch(`/api/orders/${orderIdentifier}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log(`[ERROR] Order not found via API: ${orderIdentifier}`);
            setError('Order not found. Please contact support if you believe this is an error.');
          } else if (response.status === 429) {
            setError('Too many requests. Please wait a moment and refresh the page.');
          } else {
            console.error(`[ERROR] API error fetching order: ${response.status} ${response.statusText}`);
            setError('Unable to load order details. Please try again or contact support.');
          }
          setLoading(false);
          return;
        }

        const apiResult = await response.json();
        
        if (!apiResult.success) {
          console.error(`[ERROR] API returned error:`, apiResult.error);
          setError('Unable to load order details. Please contact support if you believe this is an error.');
          setLoading(false);
          return;
        }

        // Transform API response to match expected structure
        const foundOrder = {
          ...apiResult.order,
          // Ensure payment object exists and has required fields
          payment: {
            paymentIntentId: paymentIntentId || apiResult.order.payment?.paymentIntentId || '',
            amount: apiResult.order.totals.total,
            capturedAt: apiResult.order.payment?.capturedAt || new Date().toISOString(),
            ...apiResult.order.payment
          },
          // Ensure timestamps object exists with proper structure
          timestamps: {
            createdAt: apiResult.order.timestamps?.createdAt || apiResult.order.createdAt || new Date().toISOString(),
            updatedAt: apiResult.order.timestamps?.updatedAt || apiResult.order.updatedAt || new Date().toISOString(),
            ...apiResult.order.timestamps
          },
          // Ensure customer info exists
          customerInfo: apiResult.order.customerInfo || {
            email: '',
            firstName: '',
            lastName: '',
          },
          // Ensure all fields that might be accessed exist
          shippingAddress: apiResult.order.shippingAddress || {},
          billingAddress: apiResult.order.billingAddress || {},
        };
        
        console.log(`[SUCCESS] Order loaded via API: ${foundOrder.id} (${foundOrder.orderNumber}) - Status: ${foundOrder.status}`);

        if (!foundOrder) {
          setError('Order not found. Please contact support if you believe this is an error.');
          setLoading(false);
          return;
        }

      // Verify this is a successful order (more tolerant of processing states)
      if (foundOrder.status === 'failed' || foundOrder.status === 'cancelled' || 
          foundOrder.paymentStatus === 'failed' || foundOrder.paymentStatus === 'cancelled') {
        setError('Payment was not successful. Please contact support if you believe this is an error.');
        setLoading(false);
        return;
      }
      
      // Allow orders that are processing, paid, or have succeeded payment status
      if (foundOrder.status !== 'paid' && foundOrder.status !== 'processing' && 
          foundOrder.paymentStatus !== 'succeeded' && foundOrder.paymentStatus !== 'processing') {
        setError('Payment confirmation is still processing. Please refresh the page in a few moments.');
        setLoading(false);
        return;
      }

      setOrder(foundOrder);

      // Set payment details from order or URL params
      setPaymentDetails({
        paymentIntentId: paymentIntentId || foundOrder.payment.paymentIntentId || '',
        amount: foundOrder.totals.total,
        currency: foundOrder.currency,
      });

      // Record order completion for cart clearing resilience
      recordOrderCompletion({
        orderId: foundOrder.id,
        orderNumber: foundOrder.orderNumber,
        paymentIntentId: paymentIntentId || foundOrder.payment.paymentIntentId,
        amount: foundOrder.totals.total,
        currency: foundOrder.currency,
      });

      // Clear cart after successful payment confirmation
      const sessionId = typeof window !== 'undefined' 
        ? sessionStorage.getItem('checkout_session_id') 
        : null;
      
      checkAndClearIfNeeded(sessionId || undefined, orderId || undefined)
        .then(result => {
          if (result.cleared) {
            console.log(`[CLEAR] Cart cleared on success page: ${result.reason}`);
          }
        })
        .catch(err => {
          console.warn('Cart clearing check failed on success page:', err);
        });

      setLoading(false);
    } catch (err) {
      console.error('Error loading order:', err);
      setError('Unable to load order details. Please try again or contact support.');
      setLoading(false);
    }
    };

    loadOrder();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
            <p className="mt-4 text-center text-sm text-gray-600">
              Loading your order confirmation...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="flex justify-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-3 text-center sm:mt-5">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Unable to Load Order
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">{error}</p>
              </div>
              <div className="mt-5">
                <Link
                  href="/"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Return to Store
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order || !paymentDetails) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Conversion tracking */}
      <ConversionTracking order={order} paymentIntentId={paymentDetails.paymentIntentId} />
      
      <div className="max-w-3xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-green-50 px-6 py-8 sm:px-8">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8 text-green-500" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h1 className="text-2xl font-bold text-gray-900" data-testid="payment-success">Payment Successful!</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Thank you for your purchase. Your order has been confirmed.
                </p>
              </div>
            </div>
          </div>

          {/* Order details */}
          <div className="px-6 py-6 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Order info */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Order Information</h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Order Number</dt>
                    <dd className="text-sm text-gray-900 font-mono">{order.orderNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Order Date</dt>
                    <dd className="text-sm text-gray-900">
                      {new Date(order.timestamps.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
                    <dd className="text-sm text-gray-900">Credit Card</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Total Amount</dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatPrice(order.totals.total)} {order.currency}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Shipping info */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Shipping Information</h2>
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-900">{order.shippingAddress.fullName}</p>
                  <p>{order.shippingAddress.streetAddress}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.postalCode}
                  </p>
                  <p>{order.shippingAddress.country}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <p className="text-sm text-gray-900">{order.customerInfo.email}</p>
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div className="mt-8">
              <OrderSummary order={order} />
            </div>

            {/* Actions */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Receipt
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Continue Shopping
                </Link>
              </div>
            </div>

            {/* What's next */}
            <div className="mt-8 bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">What happens next?</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <Mail className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
                  You'll receive an order confirmation email shortly
                </li>
                <li className="flex items-start">
                  <svg className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  We'll prepare your order for shipping
                </li>
                <li className="flex items-start">
                  <svg className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z" />
                  </svg>
                  You'll get tracking information when your order ships
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}