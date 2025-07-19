// Centralized API paths configuration
// This makes the codebase easier to maintain and refactor

export const API_PATHS = {
  // Products API endpoints
  products: '/api/products',
  productById: (id) => `/api/products/${id}`,
  
  // Future API endpoints can be added here
  // cart: '/api/cart',
  // orders: '/api/orders',
  // users: '/api/users',
};

// Helper function to build API URLs with base URL if needed
export const buildApiUrl = (path, baseUrl = '') => {
  return `${baseUrl}${path}`;
};

// Export individual paths for convenience
export const PRODUCTS_API = API_PATHS.products;
export const PRODUCT_BY_ID_API = API_PATHS.productById;

/* Usage Examples:

// Instead of hardcoded URLs:
// fetch('/api/products')
// fetch(`/api/products/${id}`)

// Use centralized paths:
import { API_PATHS, PRODUCTS_API, PRODUCT_BY_ID_API } from '@/utils/apiPaths';

// Get all products
const response = await fetch(PRODUCTS_API);

// Get specific product
const response = await fetch(API_PATHS.productById(1));

// With custom base URL (for different environments)
const response = await fetch(buildApiUrl(PRODUCTS_API, 'https://api.example.com'));

*/ 