// Storage keys for localStorage/sessionStorage
export const STORAGE_KEYS = {
  CART: 'analenn_cart',
  ORDER_COMPLETION: 'analenn_order_completion',
  // Add other storage keys here as needed
  // USER_PREFERENCES: 'analenn_user_prefs',
  // THEME: 'analenn_theme',
} as const;

// Export individual keys for convenience
export const CART_STORAGE_KEY = STORAGE_KEYS.CART;
export const ORDER_COMPLETION_KEY = STORAGE_KEYS.ORDER_COMPLETION; 