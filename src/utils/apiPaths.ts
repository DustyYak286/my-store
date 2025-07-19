// Centralized API paths configuration with TypeScript support
// This makes the codebase easier to maintain and refactor

interface ApiPaths {
  products: string;
  productById: (id: string | number) => string;
}

export const API_PATHS: ApiPaths = {
  // Products API endpoints
  products: '/api/products',
  productById: (id: string | number) => `/api/products/${id}`,
  
  // Future API endpoints can be added here
  // cart: '/api/cart',
  // orders: '/api/orders',
  // users: '/api/users',
};

// Helper function to build API URLs with base URL if needed
export const buildApiUrl = (path: string, baseUrl: string = ''): string => {
  return `${baseUrl}${path}`;
};

// Export individual paths for convenience
export const PRODUCTS_API: string = API_PATHS.products;
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