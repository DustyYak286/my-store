// Storage keys for localStorage/sessionStorage
export const STORAGE_KEYS = {
  CART: 'analenn_cart',
  // Add other storage keys here as needed
  // USER_PREFERENCES: 'analenn_user_prefs',
  // THEME: 'analenn_theme',
} as const;

// Export individual keys for convenience
export const CART_STORAGE_KEY = STORAGE_KEYS.CART; 