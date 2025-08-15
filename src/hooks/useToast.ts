"use client";
import { useState, useCallback, useMemo } from "react";

// ====== ENHANCED TOAST TYPES ======

export type ToastType = "success" | "error" | "info" | "warning" | "loading";
export type ToastSeverity = "low" | "medium" | "high";

export interface ToastAction {
  label: string;
  action: () => void;
  variant?: "primary" | "secondary";
}

export interface ToastState {
  id: string;
  message: string;
  isVisible: boolean;
  type: ToastType;
  duration?: number;
  persistent?: boolean;
  dismissible?: boolean;
  progress?: number;
  severity?: ToastSeverity;
  actions?: ToastAction[];
  metadata?: Record<string, any>;
}

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  persistent?: boolean;
  dismissible?: boolean;
  progress?: number;
  severity?: ToastSeverity;
  actions?: ToastAction[];
  metadata?: Record<string, any>;
}

interface UseToastReturn {
  toast: ToastState;
  showToast: (message: string, options?: ToastOptions) => string;
  updateToast: (id: string, updates: Partial<ToastState>) => void;
  hideToast: (id?: string) => void;
  clearAllToasts: () => void;
}

export const useToast = (): UseToastReturn => {
  const [toast, setToast] = useState<ToastState>({
    id: "",
    message: "",
    isVisible: false,
    type: "success",
    duration: 5000,
    persistent: false,
    dismissible: true,
    severity: "low",
  });

  const generateId = useCallback(() => {
    return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const showToast = useCallback((message: string, options: ToastOptions = {}): string => {
    const id = generateId();
    const newToast: ToastState = {
      id,
      message,
      isVisible: true,
      type: options.type || "success",
      duration: options.duration || 5000,
      persistent: options.persistent || false,
      dismissible: options.dismissible !== false,
      progress: options.progress,
      severity: options.severity || "low",
      actions: options.actions,
      metadata: options.metadata,
    };
    
    setToast(newToast);
    
    // Auto-hide after duration (if not persistent)
    if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, newToast.duration);
    }
    
    return id;
  }, [generateId]);

  const updateToast = useCallback((id: string, updates: Partial<ToastState>) => {
    setToast((prev) => {
      if (prev.id === id) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, []);

  const hideToast = useCallback((id?: string) => {
    setToast((prev) => {
      if (!id || prev.id === id) {
        return { ...prev, isVisible: false };
      }
      return prev;
    });
  }, []);

  const clearAllToasts = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false, message: "" }));
  }, []);

  return useMemo(() => ({
    toast,
    showToast,
    updateToast,
    hideToast,
    clearAllToasts,
  }), [toast, showToast, updateToast, hideToast, clearAllToasts]);
};

// Legacy compatibility function for existing code
export const useLegacyToast = () => {
  const { toast, showToast: enhancedShowToast, hideToast } = useToast();
  
  const showToast = useCallback((message: string, type: ToastType = "success") => {
    enhancedShowToast(message, { type });
  }, [enhancedShowToast]);
  
  return { toast, showToast, hideToast };
};

// ====== PAYMENT-SPECIFIC TOAST UTILITIES ======

/**
 * Enhanced toast utilities specifically for payment flows
 */
export const usePaymentToast = () => {
  const { showToast, updateToast, hideToast } = useToast();
  
  const showPaymentProcessing = useCallback((message: string = "Processing payment...") => {
    return showToast(message, {
      type: "loading",
      persistent: true,
      dismissible: false,
      progress: 0,
      metadata: { paymentFlow: true, step: 'processing' },
    });
  }, [showToast]);
  
  const showPaymentRetry = useCallback((attempt: number, maxAttempts: number, retryDelay: number) => {
    const seconds = Math.ceil(retryDelay / 1000);
    return showToast(
      `Payment failed. Retrying in ${seconds} seconds... (Attempt ${attempt}/${maxAttempts})`,
      {
        type: "warning",
        duration: retryDelay + 1000, // Slightly longer than retry delay
        dismissible: true,
        severity: "medium",
        metadata: { paymentFlow: true, step: 'retry', attempt, maxAttempts },
      }
    );
  }, [showToast]);
  
  const showPaymentSuccess = useCallback((message: string = "Payment successful!", orderInfo?: { orderId: string; amount: number }) => {
    return showToast(message, {
      type: "success",
      duration: 5000,
      dismissible: true,
      severity: "low",
      metadata: { 
        paymentFlow: true, 
        step: 'success',
        orderInfo,
      },
    });
  }, [showToast]);
  
  const showPaymentError = useCallback((error: {
    message: string;
    category?: string;
    isRetryable?: boolean;
    severity?: ToastSeverity;
    code?: string;
  }) => {
    const actions: ToastAction[] = [];
    
    if (error.isRetryable) {
      actions.push({
        label: "Try Again",
        action: () => {
          // This will be handled by the payment component
          console.log('Payment retry requested');
        },
        variant: "primary",
      });
    }
    
    return showToast(error.message, {
      type: "error",
      severity: error.severity || "high",
      duration: error.isRetryable ? 10000 : 8000, // Longer duration for retryable errors
      dismissible: true,
      actions,
      metadata: {
        paymentFlow: true,
        step: 'error',
        errorCategory: error.category,
        errorCode: error.code,
        isRetryable: error.isRetryable,
      },
    });
  }, [showToast]);
  
  const showAuthenticationRequired = useCallback((message: string = "Additional authentication required") => {
    return showToast(message, {
      type: "info",
      persistent: true,
      dismissible: false,
      severity: "medium",
      metadata: { paymentFlow: true, step: 'authentication' },
    });
  }, [showToast]);
  
  const showAuthenticationProgress = useCallback((progress: number, message: string = "Processing authentication...") => {
    return showToast(message, {
      type: "loading",
      persistent: true,
      dismissible: false,
      progress: progress,
      severity: "medium",
      metadata: { 
        paymentFlow: true, 
        step: 'authentication_progress',
        progress: progress,
      },
    });
  }, [showToast]);
  
  const showAuthenticationGuidance = useCallback((guidance: string, type: 'info' | 'warning' | 'error' = 'info') => {
    const toastType = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
    const severity = type === 'error' ? 'high' : type === 'warning' ? 'medium' : 'low';
    
    return showToast(guidance, {
      type: toastType,
      duration: type === 'info' ? 8000 : 12000, // Longer duration for warnings/errors
      dismissible: true,
      severity: severity,
      metadata: { 
        paymentFlow: true, 
        step: 'authentication_guidance',
        guidanceType: type,
      },
    });
  }, [showToast]);
  
  const showSecureAuthenticationStart = useCallback((method: string = "3D Secure") => {
    return showToast(`Starting ${method} authentication...`, {
      type: "loading",
      persistent: true,
      dismissible: false,
      progress: 10,
      severity: "medium",
      metadata: { 
        paymentFlow: true, 
        step: 'secure_authentication_start',
        authMethod: method,
      },
    });
  }, [showToast]);
  
  const showSecureAuthenticationComplete = useCallback((method: string = "3D Secure", duration: number) => {
    const durationText = duration < 1000 ? `${duration}ms` : `${Math.round(duration / 1000)}s`;
    
    return showToast(`${method} authentication completed successfully! (${durationText})`, {
      type: "success",
      duration: 5000,
      dismissible: true,
      severity: "low",
      metadata: { 
        paymentFlow: true, 
        step: 'secure_authentication_complete',
        authMethod: method,
        authDuration: duration,
      },
    });
  }, [showToast]);
  
  const showPaymentTimeout = useCallback((timeElapsed: number, canRetry: boolean = true) => {
    const actions: ToastAction[] = [];
    
    if (canRetry) {
      actions.push({
        label: "Try Again",
        action: () => {
          console.log('Payment timeout retry requested');
        },
        variant: "primary",
      });
    }
    
    return showToast(
      `Payment timed out after ${Math.round(timeElapsed / 1000)} seconds. Please try again.`,
      {
        type: "warning",
        severity: "medium",
        duration: 10000,
        dismissible: true,
        actions,
        metadata: {
          paymentFlow: true,
          step: 'timeout',
          timeElapsed,
          canRetry,
        },
      }
    );
  }, [showToast]);
  
  const updatePaymentProgress = useCallback((toastId: string, progress: number, message?: string) => {
    const updates: Partial<ToastState> = { progress };
    if (message) {
      updates.message = message;
    }
    updateToast(toastId, updates);
  }, [updateToast]);
  
  return {
    showPaymentProcessing,
    showPaymentRetry,
    showPaymentSuccess,
    showPaymentError,
    showAuthenticationRequired,
    showAuthenticationProgress,
    showAuthenticationGuidance,
    showSecureAuthenticationStart,
    showSecureAuthenticationComplete,
    showPaymentTimeout,
    updatePaymentProgress,
    hideToast,
  };
}; 