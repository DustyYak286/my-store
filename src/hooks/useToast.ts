"use client";
import { useState, useCallback } from "react";

interface ToastState {
  message: string;
  isVisible: boolean;
  type: "success" | "error" | "info";
}

interface UseToastReturn {
  toast: ToastState;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  hideToast: () => void;
}

export const useToast = (): UseToastReturn => {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    isVisible: false,
    type: "success",
  });

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({
      message,
      isVisible: true,
      type,
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({
      ...prev,
      isVisible: false,
    }));
  }, []);

  return {
    toast,
    showToast,
    hideToast,
  };
}; 