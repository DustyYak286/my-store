"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { monitoring } from '@/utils/monitoring';
import { PAYMENT_ERROR_MESSAGES, RETRY_CONFIG } from '@/constants/payments';

// ====== INTERFACES ======

interface PaymentErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  showRetryButton?: boolean;
  maxRetries?: number;
}

interface PaymentErrorBoundaryState {
  hasError: boolean;
  error?: Error | undefined;
  errorInfo?: ErrorInfo | undefined;
  retryCount: number;
  isRetrying: boolean;
  errorId: string | null;
}

/**
 * Payment-specific error boundary with enhanced error handling,
 * retry functionality, and payment context awareness
 */
export class PaymentErrorBoundary extends Component<PaymentErrorBoundaryProps, PaymentErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: PaymentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      isRetrying: false,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<PaymentErrorBoundaryState> {
    const errorId = `pe_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[PAYMENT] PaymentErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
    });

    this.setState(prevState => ({
      error,
      errorInfo,
    }));

    // Record error in monitoring system
    monitoring.recordPaymentError('component_error', {
      errorMessage: error.message,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
      componentStack: errorInfo.componentStack?.split('\n')[1] || 'Unknown',
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.reportErrorToService(error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * Report error to external service (placeholder for real implementation)
   */
  private reportErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // TODO: Integrate with error reporting service (Sentry, etc.)
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      context: 'payment',
    };

    // In a real implementation, you would send this to your error service
    console.log('[STATS] Error report (would be sent to service):', errorReport);
  };

  /**
   * Categorize payment-related errors
   */
  private categorizeError = (error: Error): {
    category: 'stripe' | 'network' | 'validation' | 'component' | 'unknown';
    isRetryable: boolean;
    userMessage: string;
    technicalMessage: string;
  } => {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Stripe-specific errors
    if (message.includes('stripe') || stack.includes('stripe')) {
      if (message.includes('network') || message.includes('connection')) {
        return {
          category: 'network',
          isRetryable: true,
          userMessage: PAYMENT_ERROR_MESSAGES.NETWORK_ERROR,
          technicalMessage: 'Stripe network connection error',
        };
      }
      if (message.includes('key') || message.includes('authentication')) {
        return {
          category: 'stripe',
          isRetryable: false,
          userMessage: 'Payment service configuration error. Please contact support.',
          technicalMessage: 'Stripe authentication error',
        };
      }
      return {
        category: 'stripe',
        isRetryable: true,
        userMessage: PAYMENT_ERROR_MESSAGES.GENERIC_ERROR,
        technicalMessage: 'Stripe service error',
      };
    }

    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return {
        category: 'network',
        isRetryable: true,
        userMessage: PAYMENT_ERROR_MESSAGES.NETWORK_ERROR,
        technicalMessage: 'Network connectivity error',
      };
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        category: 'validation',
        isRetryable: true, // Users can fix validation errors
        userMessage: 'Please check your payment information and try again.',
        technicalMessage: 'Validation error',
      };
    }

    // Component/rendering errors
    if (message.includes('render') || message.includes('component') || stack.includes('react')) {
      return {
        category: 'component',
        isRetryable: true,
        userMessage: 'Payment form loading error. Please refresh the page.',
        technicalMessage: 'React component error',
      };
    }

    // Unknown errors
    return {
      category: 'unknown',
      isRetryable: true,
      userMessage: PAYMENT_ERROR_MESSAGES.GENERIC_ERROR,
      technicalMessage: 'Unknown error occurred',
    };
  };

  /**
   * Handle retry with exponential backoff
   */
  private handleRetry = () => {
    const maxRetries = this.props.maxRetries || RETRY_CONFIG.MAX_ATTEMPTS;
    
    if (this.state.retryCount >= maxRetries) {
      console.warn('[PAYMENT] Maximum retry attempts reached');
      monitoring.recordPaymentError('max_retries_reached', {
        errorId: this.state.errorId,
        maxRetries,
      });
      return;
    }

    this.setState({ isRetrying: true });

    // Calculate delay with exponential backoff
    const delayMs = Math.min(
      RETRY_CONFIG.BASE_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, this.state.retryCount),
      RETRY_CONFIG.MAX_DELAY
    );

    console.log(`[PAYMENT] Retrying payment component in ${delayMs}ms (attempt ${this.state.retryCount + 1}/${maxRetries})`);

    // Record retry attempt
    monitoring.recordPaymentRetry(this.state.retryCount + 1, delayMs);

    this.retryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1,
        isRetrying: false,
      }));

      // Call optional retry handler
      if (this.props.onRetry) {
        this.props.onRetry();
      }
    }, delayMs);
  };

  /**
   * Reset error state manually
   */
  private resetError = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      isRetrying: false,
      errorId: null,
    });

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  /**
   * Handle navigation back to safety
   */
  private handleGoBack = () => {
    // Record navigation
    monitoring.recordPaymentError('user_navigated_back', {
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
    });

    // Navigate back or to safe route
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  /**
   * Handle page refresh
   */
  private handleRefresh = () => {
    monitoring.recordPaymentError('user_refreshed', {
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
    });
    
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Categorize the error for better user experience
      const errorInfo = this.categorizeError(this.state.error);
      const maxRetries = this.props.maxRetries || RETRY_CONFIG.MAX_ATTEMPTS;
      const showRetryButton = this.props.showRetryButton !== false && 
                             errorInfo.isRetryable && 
                             this.state.retryCount < maxRetries;

      return (
        <div className="min-h-[400px] bg-gray-50 flex items-center justify-center px-4 py-8 rounded-lg">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center border border-gray-200">
            <div className="mb-6">
              {/* Error Icon */}
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>

              {/* Error Title */}
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Payment Error
              </h2>

              {/* User-friendly Error Message */}
              <p className="text-gray-600 mb-4 leading-relaxed">
                {errorInfo.userMessage}
              </p>

              {/* Retry Information */}
              {errorInfo.isRetryable && this.state.retryCount > 0 && (
                <p className="text-sm text-gray-500 mb-4">
                  Attempt {this.state.retryCount} of {maxRetries}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Retry Button */}
              {showRetryButton && (
                <button
                  onClick={this.handleRetry}
                  disabled={this.state.isRetrying}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {this.state.isRetrying ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Retrying...
                    </span>
                  ) : (
                    `Try Again${this.state.retryCount > 0 ? ` (${this.state.retryCount}/${maxRetries})` : ''}`
                  )}
                </button>
              )}

              {/* Reset Button (alternative to retry) */}
              {!showRetryButton && (
                <button
                  onClick={this.resetError}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Start Over
                </button>
              )}

              {/* Refresh Button */}
              <button
                onClick={this.handleRefresh}
                className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Refresh Page
              </button>

              {/* Go Back Button */}
              <button
                onClick={this.handleGoBack}
                className="w-full bg-gray-100 text-gray-600 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <- Go Back
              </button>
            </div>

            {/* Error ID for Support */}
            {this.state.errorId && (
              <div className="mt-6 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Error ID for Support:</p>
                <code className="text-xs font-mono text-gray-700 bg-gray-200 px-2 py-1 rounded">
                  {this.state.errorId}
                </code>
              </div>
            )}

            {/* Development Error Details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-3 text-center">
                  [DEBUG] Technical Details (Development)
                </summary>
                <div className="bg-gray-100 p-4 rounded-lg text-xs space-y-3">
                  <div>
                    <strong className="text-gray-800">Error Category:</strong>
                    <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                      {errorInfo.category}
                    </span>
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {errorInfo.isRetryable ? 'Retryable' : 'Not Retryable'}
                    </span>
                  </div>
                  
                  <div>
                    <strong className="text-gray-800">Technical Message:</strong>
                    <p className="text-gray-600 mt-1">{errorInfo.technicalMessage}</p>
                  </div>
                  
                  <div>
                    <strong className="text-gray-800">Error Message:</strong>
                    <p className="text-red-600 mt-1 font-mono">{this.state.error.message}</p>
                  </div>
                  
                  {this.state.errorInfo && (
                    <div>
                      <strong className="text-gray-800">Component Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1 text-gray-600 text-xs bg-white p-2 rounded border">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}

                  <div>
                    <strong className="text-gray-800">Retry Count:</strong>
                    <span className="ml-2">{this.state.retryCount}</span>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ====== HOC WRAPPER ======

/**
 * Higher-Order Component for wrapping components with PaymentErrorBoundary
 */
export function withPaymentErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    onRetry?: () => void;
    showRetryButton?: boolean;
    maxRetries?: number;
  } = {}
) {
  const WrappedComponent = (props: P) => (
    <PaymentErrorBoundary {...options}>
      <Component {...props} />
    </PaymentErrorBoundary>
  );

  WrappedComponent.displayName = `withPaymentErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// ====== UTILITY FUNCTIONS ======

/**
 * Create a payment error boundary with specific configuration
 */
export const createPaymentErrorBoundary = (
  children: ReactNode,
  options: {
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    onRetry?: () => void;
    showRetryButton?: boolean;
    maxRetries?: number;
  } = {}
) => (
  <PaymentErrorBoundary {...options}>
    {children}
  </PaymentErrorBoundary>
);

export default PaymentErrorBoundary;