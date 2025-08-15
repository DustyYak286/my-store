/**
 * Enhanced 3D Secure Authentication Manager
 * 
 * Comprehensive 3D Secure (SCA - Strong Customer Authentication) handling
 * with enhanced user experience, timeout management, and error recovery.
 * 
 * Features:
 * - Enhanced 3D Secure flow orchestration
 * - Authentication timeout management
 * - User-friendly authentication guidance
 * - Comprehensive error recovery
 * - Authentication state tracking
 * - Toast notification integration
 */

'use client';

import type { Stripe, PaymentIntent, StripeError } from '@stripe/stripe-js';
import { categorizeClientStripeError } from '@/lib/stripe-client';

// ====== TYPES AND INTERFACES ======

export interface AuthenticationState {
  isAuthenticating: boolean;
  authenticationStarted: boolean;
  authenticationMethod?: '3d_secure' | 'redirect' | 'challenge';
  timeoutWarningShown: boolean;
  authenticationStartTime: number | null;
  lastAuthError: AuthenticationError | null;
  redirectUrl?: string;
  challengeData?: any;
}

export interface AuthenticationError {
  type: string;
  code?: string;
  message: string;
  category: 'authentication' | 'timeout' | 'network' | 'user_cancelled' | 'unknown';
  isRetryable: boolean;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  authenticationMethod?: string;
}

export interface AuthenticationResult {
  success: boolean;
  paymentIntent?: PaymentIntent;
  error?: AuthenticationError;
  metadata?: {
    authenticationTime: number;
    authenticationMethod: string;
    wasTimedOut: boolean;
    retryAttempt?: number;
  };
}

export interface AuthenticationOptions {
  timeoutMs?: number;
  warningTimeoutMs?: number;
  enableUserGuidance?: boolean;
  maxRetries?: number;
  onAuthenticationStart?: (method: string) => void;
  onAuthenticationProgress?: (progress: number, message: string) => void;
  onAuthenticationSuccess?: (result: AuthenticationResult) => void;
  onAuthenticationError?: (error: AuthenticationError) => void;
  onTimeout?: (timeElapsed: number) => void;
  onUserGuidance?: (guidance: string, type: 'info' | 'warning' | 'error') => void;
}

// ====== CONSTANTS ======

const AUTHENTICATION_TIMEOUT = 180000; // 3 minutes for 3D Secure
const WARNING_TIMEOUT = 120000; // 2 minutes warning
const RETRY_DELAY = process.env.NODE_ENV === 'test' ? 100 : 3000; // Fast retries in tests

const AUTHENTICATION_MESSAGES = {
  STARTING: 'Starting secure authentication...',
  REDIRECT: 'Redirecting to your bank for authentication...',
  CHALLENGE: 'Please complete the authentication challenge...',
  PROCESSING: 'Processing authentication...',
  TIMEOUT_WARNING: 'Authentication is taking longer than expected. Please ensure you complete the process.',
  TIMEOUT_ERROR: 'Authentication timed out. Please try again.',
  USER_CANCELLED: 'Authentication was cancelled. Please try again.',
  NETWORK_ERROR: 'Network error during authentication. Please check your connection.',
  BANK_ERROR: 'Authentication failed at your bank. Please try again or contact your bank.',
  SUCCESS: 'Authentication completed successfully!',
};

const USER_GUIDANCE = {
  STARTING: 'You will be redirected to your bank to verify this payment.',
  POPUP_BLOCKED: 'Please allow pop-ups for payment authentication.',
  KEEP_WINDOW_OPEN: 'Keep this page open while completing authentication.',
  MOBILE_APP: 'You may need to open your banking app to complete authentication.',
  TIMEOUT_APPROACHING: 'Please complete authentication soon to avoid timeout.',
  RETRY_AVAILABLE: 'If authentication fails, you can try again.',
};

// ====== 3D SECURE AUTHENTICATION MANAGER ======

export class SecureAuthenticationManager {
  private stripe: Stripe;
  private state: AuthenticationState;
  private options: Required<AuthenticationOptions>;
  private timeoutRef: NodeJS.Timeout | null = null;
  private warningTimeoutRef: NodeJS.Timeout | null = null;
  private progressIntervalRef: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;

  constructor(stripe: Stripe, options: AuthenticationOptions = {}) {
    this.stripe = stripe;
    this.options = {
      timeoutMs: options.timeoutMs || AUTHENTICATION_TIMEOUT,
      warningTimeoutMs: options.warningTimeoutMs || WARNING_TIMEOUT,
      enableUserGuidance: options.enableUserGuidance ?? true,
      maxRetries: options.maxRetries || 2,
      onAuthenticationStart: options.onAuthenticationStart || (() => {}),
      onAuthenticationProgress: options.onAuthenticationProgress || (() => {}),
      onAuthenticationSuccess: options.onAuthenticationSuccess || (() => {}),
      onAuthenticationError: options.onAuthenticationError || (() => {}),
      onTimeout: options.onTimeout || (() => {}),
      onUserGuidance: options.onUserGuidance || (() => {}),
    };

    this.state = this.getInitialState();
  }

  private getInitialState(): AuthenticationState {
    return {
      isAuthenticating: false,
      authenticationStarted: false,
      timeoutWarningShown: false,
      authenticationStartTime: null,
      lastAuthError: null,
    };
  }

  /**
   * Enhanced 3D Secure authentication flow
   */
  async authenticate(
    clientSecret: string,
    retryAttempt: number = 1
  ): Promise<AuthenticationResult> {
    const startTime = Date.now();
    
    // Reset state for new authentication
    this.resetState();
    this.state.authenticationStarted = true;
    this.state.authenticationStartTime = startTime;
    this.state.isAuthenticating = true;

    // Create abort controller for this authentication
    this.abortController = new AbortController();

    try {
      console.log(`🔐 Starting 3D Secure authentication (attempt ${retryAttempt})`);
      
      // Setup timeouts and progress tracking
      this.setupTimeouts();
      this.startProgressTracking();

      // Provide user guidance
      if (this.options.enableUserGuidance) {
        this.options.onUserGuidance(USER_GUIDANCE.STARTING, 'info');
        this.options.onUserGuidance(USER_GUIDANCE.KEEP_WINDOW_OPEN, 'info');
      }

      // Notify authentication start
      this.options.onAuthenticationStart('3d_secure');
      this.options.onAuthenticationProgress(10, AUTHENTICATION_MESSAGES.STARTING);

      // Attempt to handle next action with enhanced error handling
      const result = await this.performAuthentication(clientSecret);

      if (this.abortController.signal.aborted) {
        throw new Error('Authentication was cancelled');
      }

      // Calculate authentication time
      const authenticationTime = Date.now() - startTime;

      if (result.success && result.paymentIntent) {
        console.log(`✅ 3D Secure authentication completed in ${authenticationTime}ms`);
        
        this.state.isAuthenticating = false;
        this.options.onAuthenticationProgress(100, AUTHENTICATION_MESSAGES.SUCCESS);
        
        const successResult: AuthenticationResult = {
          success: true,
          paymentIntent: result.paymentIntent,
          metadata: {
            authenticationTime,
            authenticationMethod: this.state.authenticationMethod || '3d_secure',
            wasTimedOut: false,
            retryAttempt,
          },
        };

        this.options.onAuthenticationSuccess(successResult);
        return successResult;
      } else {
        // Handle authentication error
        const authError = this.categorizeAuthenticationError(result.error, retryAttempt);
        
        // Determine if we should retry
        if (authError.isRetryable && retryAttempt < this.options.maxRetries) {
          console.log(`⏳ Retrying 3D Secure authentication in ${RETRY_DELAY}ms (attempt ${retryAttempt + 1})`);
          
          if (this.options.enableUserGuidance) {
            this.options.onUserGuidance(USER_GUIDANCE.RETRY_AVAILABLE, 'info');
          }

          // Wait before retry
          await this.delay(RETRY_DELAY);
          
          if (this.abortController.signal.aborted) {
            throw new Error('Authentication was cancelled during retry delay');
          }

          // Recursive retry
          return this.authenticate(clientSecret, retryAttempt + 1);
        } else {
          // No more retries or not retryable
          this.state.isAuthenticating = false;
          this.state.lastAuthError = authError;
          
          const failureResult: AuthenticationResult = {
            success: false,
            error: authError,
            metadata: {
              authenticationTime,
              authenticationMethod: this.state.authenticationMethod || '3d_secure',
              wasTimedOut: false,
              retryAttempt,
            },
          };

          this.options.onAuthenticationError(authError);
          return failureResult;
        }
      }
    } catch (error) {
      const authenticationTime = Date.now() - startTime;
      
      // Handle unexpected errors
      const authError = this.categorizeAuthenticationError(error, retryAttempt);
      
      this.state.isAuthenticating = false;
      this.state.lastAuthError = authError;

      const errorResult: AuthenticationResult = {
        success: false,
        error: authError,
        metadata: {
          authenticationTime,
          authenticationMethod: this.state.authenticationMethod || '3d_secure',
          wasTimedOut: authenticationTime > this.options.timeoutMs,
          retryAttempt,
        },
      };

      this.options.onAuthenticationError(authError);
      return errorResult;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Perform the actual authentication with Stripe
   */
  private async performAuthentication(clientSecret: string): Promise<{
    success: boolean;
    paymentIntent?: PaymentIntent;
    error?: any;
  }> {
    try {
      this.options.onAuthenticationProgress(30, AUTHENTICATION_MESSAGES.REDIRECT);
      
      // Detect authentication method
      this.state.authenticationMethod = '3d_secure';
      
      // Use Stripe's handleNextAction method
      const { error, paymentIntent } = await this.stripe.handleNextAction({
        clientSecret,
      });

      if (error) {
        console.warn('⚠️ 3D Secure authentication failed:', {
          type: error.type,
          code: error.code,
          message: error.message,
        });
        
        return {
          success: false,
          error,
        };
      }

      if (paymentIntent) {
        this.options.onAuthenticationProgress(90, AUTHENTICATION_MESSAGES.PROCESSING);
        
        // Check if payment intent is now in the correct state
        if (paymentIntent.status === 'succeeded') {
          return {
            success: true,
            paymentIntent,
          };
        } else if (paymentIntent.status === 'requires_action') {
          // Still requires action - this might be a multi-step authentication
          console.log('🔄 Multi-step authentication detected, continuing...');
          
          this.options.onAuthenticationProgress(60, AUTHENTICATION_MESSAGES.CHALLENGE);
          
          // Recursive call for multi-step authentication
          return this.performAuthentication(clientSecret);
        } else {
          // Other status - treat as error
          return {
            success: false,
            error: {
              type: 'authentication_incomplete',
              message: `Authentication incomplete. Payment status: ${paymentIntent.status}`,
            },
          };
        }
      }

      return {
        success: false,
        error: {
          type: 'no_result',
          message: 'No authentication result received',
        },
      };
    } catch (error) {
      console.error('❌ Authentication error:', error);
      return {
        success: false,
        error,
      };
    }
  }

  /**
   * Setup timeout management for authentication
   */
  private setupTimeouts(): void {
    // Clear existing timeouts
    this.clearTimeouts();

    // Warning timeout
    this.warningTimeoutRef = setTimeout(() => {
      if (this.state.isAuthenticating && !this.state.timeoutWarningShown) {
        this.state.timeoutWarningShown = true;
        this.options.onAuthenticationProgress(70, AUTHENTICATION_MESSAGES.TIMEOUT_WARNING);
        
        if (this.options.enableUserGuidance) {
          this.options.onUserGuidance(USER_GUIDANCE.TIMEOUT_APPROACHING, 'warning');
        }
      }
    }, this.options.warningTimeoutMs);

    // Main timeout
    this.timeoutRef = setTimeout(() => {
      if (this.state.isAuthenticating) {
        console.warn('⏰ 3D Secure authentication timeout reached');
        
        const timeElapsed = this.state.authenticationStartTime 
          ? Date.now() - this.state.authenticationStartTime 
          : this.options.timeoutMs;
        
        this.state.isAuthenticating = false;
        this.state.lastAuthError = {
          type: 'authentication_timeout',
          message: AUTHENTICATION_MESSAGES.TIMEOUT_ERROR,
          category: 'timeout',
          isRetryable: true,
          severity: 'medium',
          timestamp: Date.now(),
          authenticationMethod: this.state.authenticationMethod,
        };

        // Abort ongoing authentication
        if (this.abortController) {
          this.abortController.abort();
        }

        this.options.onTimeout(timeElapsed);
      }
    }, this.options.timeoutMs);
  }

  /**
   * Start progress tracking for better UX
   */
  private startProgressTracking(): void {
    let progress = 10;
    
    this.progressIntervalRef = setInterval(() => {
      if (this.state.isAuthenticating && progress < 80) {
        progress += Math.random() * 10;
        progress = Math.min(progress, 80); // Cap at 80% until actual completion
        
        const messages = [
          AUTHENTICATION_MESSAGES.REDIRECT,
          AUTHENTICATION_MESSAGES.CHALLENGE,
          AUTHENTICATION_MESSAGES.PROCESSING,
        ];
        
        const messageIndex = Math.floor(progress / 30);
        const message = messages[messageIndex] || AUTHENTICATION_MESSAGES.PROCESSING;
        
        this.options.onAuthenticationProgress(Math.round(progress), message);
      }
    }, 2000); // Update every 2 seconds
  }

  /**
   * Categorize authentication errors for better handling
   */
  private categorizeAuthenticationError(
    error: any,
    retryAttempt: number
  ): AuthenticationError {
    if (!error) {
      return {
        type: 'unknown_error',
        message: 'Unknown authentication error occurred',
        category: 'unknown',
        isRetryable: false,
        severity: 'high',
        timestamp: Date.now(),
        authenticationMethod: this.state.authenticationMethod,
      };
    }

    const errorMessage = error instanceof Error ? error.message : (error.message || 'Unknown error');
    
    // Handle user cancellation
    if (errorMessage.toLowerCase().includes('cancel') || 
        errorMessage.toLowerCase().includes('abort') ||
        error.type === 'user_cancelled') {
      return {
        type: 'user_cancelled',
        message: AUTHENTICATION_MESSAGES.USER_CANCELLED,
        category: 'user_cancelled',
        isRetryable: true,
        severity: 'low',
        timestamp: Date.now(),
        authenticationMethod: this.state.authenticationMethod,
      };
    }

    // Handle timeout errors
    if (errorMessage.toLowerCase().includes('timeout') ||
        error.type === 'authentication_timeout') {
      return {
        type: 'authentication_timeout',
        message: AUTHENTICATION_MESSAGES.TIMEOUT_ERROR,
        category: 'timeout',
        isRetryable: true,
        severity: 'medium',
        timestamp: Date.now(),
        authenticationMethod: this.state.authenticationMethod,
      };
    }

    // Handle network errors
    if (errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('connection') ||
        error.type === 'api_connection_error') {
      return {
        type: 'network_error',
        message: AUTHENTICATION_MESSAGES.NETWORK_ERROR,
        category: 'network',
        isRetryable: true,
        severity: 'medium',
        timestamp: Date.now(),
        authenticationMethod: this.state.authenticationMethod,
      };
    }

    // Use existing Stripe error categorization if available
    if (error.type && typeof error === 'object') {
      const categorized = categorizeClientStripeError(error as StripeError);
      
      // Override retryability for certain authentication error types
      const isAuthError = error.type === 'authentication_error' && error.code === 'authentication_failed';
      const shouldRetry = categorized.isRetryable && retryAttempt < this.options.maxRetries && !isAuthError;
      
      return {
        type: error.type,
        code: error.code,
        message: categorized.userMessage,
        category: categorized.category === 'authentication' ? 'authentication' : 'unknown',
        isRetryable: shouldRetry,
        severity: categorized.severity,
        timestamp: Date.now(),
        authenticationMethod: this.state.authenticationMethod,
      };
    }

    // Fallback for unknown errors
    return {
      type: 'authentication_error',
      message: AUTHENTICATION_MESSAGES.BANK_ERROR,
      category: 'authentication',
      isRetryable: retryAttempt < this.options.maxRetries,
      severity: 'high',
      timestamp: Date.now(),
      authenticationMethod: this.state.authenticationMethod,
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all timeouts and intervals
   */
  private clearTimeouts(): void {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = null;
    }
    
    if (this.warningTimeoutRef) {
      clearTimeout(this.warningTimeoutRef);
      this.warningTimeoutRef = null;
    }
    
    if (this.progressIntervalRef) {
      clearInterval(this.progressIntervalRef);
      this.progressIntervalRef = null;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.clearTimeouts();
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Reset authentication state
   */
  resetState(): void {
    this.cleanup();
    this.state = this.getInitialState();
  }

  /**
   * Cancel ongoing authentication
   */
  cancel(): void {
    console.log('🚫 3D Secure authentication cancelled by user');
    
    this.state.isAuthenticating = false;
    this.state.lastAuthError = {
      type: 'user_cancelled',
      message: AUTHENTICATION_MESSAGES.USER_CANCELLED,
      category: 'user_cancelled',
      isRetryable: true,
      severity: 'low',
      timestamp: Date.now(),
      authenticationMethod: this.state.authenticationMethod,
    };

    this.cleanup();
  }

  /**
   * Get current authentication state
   */
  getState(): Readonly<AuthenticationState> {
    return { ...this.state };
  }

  /**
   * Get authentication time elapsed
   */
  getTimeElapsed(): number {
    return this.state.authenticationStartTime 
      ? Date.now() - this.state.authenticationStartTime 
      : 0;
  }

  /**
   * Check if authentication is in timeout state
   */
  isTimedOut(): boolean {
    return this.getTimeElapsed() > this.options.timeoutMs;
  }
}

// ====== UTILITY FUNCTIONS ======

/**
 * Create a new SecureAuthenticationManager instance
 */
export const createSecureAuthenticationManager = (
  stripe: Stripe,
  options?: AuthenticationOptions
): SecureAuthenticationManager => {
  return new SecureAuthenticationManager(stripe, options);
};

/**
 * Enhanced 3D Secure authentication function (simplified interface)
 */
export const performSecureAuthentication = async (
  stripe: Stripe,
  clientSecret: string,
  options?: AuthenticationOptions
): Promise<AuthenticationResult> => {
  const manager = createSecureAuthenticationManager(stripe, options);
  return manager.authenticate(clientSecret);
};

export default SecureAuthenticationManager;