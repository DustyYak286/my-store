/**
 * Product-related Types
 * 
 * All types related to products, inventory, and product display
 */

import type { ID, Price, Review } from './common'

// Product stock information
export interface ProductStock {
  quantity: number
  lowStockThreshold: number
  inStock: boolean
}

// Complete product definition
export interface Product {
  id: ID
  name: string
  description: string
  price: Price
  images: string[]
  stock: ProductStock
  reviews: Review[]
  category?: string
  tags?: string[]
  specifications?: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

// Product summary for lists/cards
export interface ProductSummary {
  id: ID
  name: string
  price: Price
  image: string
  inStock: boolean
}

// Product search/filter types
export interface ProductFilters {
  category?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  tags?: string[]
  sortBy?: 'name' | 'price' | 'rating' | 'newest'
  sortOrder?: 'asc' | 'desc'
}

// Product API responses
export interface ProductListResponse {
  products: Product[]
  total: number
  page: number
  limit: number
}

// Product variant (for future expansion)
export interface ProductVariant {
  id: ID
  name: string
  price: Price
  sku: string
  attributes: Record<string, string> // e.g., { color: 'red', size: 'M' }
}

// Product with variants (for future multi-variant products)
export interface ProductWithVariants extends Omit<Product, 'price'> {
  variants: ProductVariant[]
  defaultVariant: ID
}