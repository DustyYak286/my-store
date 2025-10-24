/**
 * Cart-related Types
 * 
 * All types related to shopping cart functionality
 */

import type { ID, Price } from './common'

// Cart item structure
export interface CartItem {
  id: ID
  name: string
  price: Price
  image: string
  quantity: number
  variant?: {
    id: ID
    name: string
    attributes: Record<string, string>
  }
}

// Cart totals calculation
export interface CartTotals {
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  currency: string
}

// Cart context interface
export interface CartContextType {
  items: CartItem[]
  itemCount: number
  totalPrice: number
  totals: CartTotals
  addItem: (item: CartItem, quantity?: number) => void
  removeItem: (itemId: ID) => void
  updateQuantity: (itemId: ID, quantity: number) => void
  clearCart: () => void
  isLoading: boolean
}

// Cart storage structure (localStorage)
export interface CartStorage {
  cartId: string
  items: CartItem[]
  createdAt: string
  updatedAt: string
}

// Cart modal context
export interface CartModalContextType {
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
}

// Discount/Coupon types (for future expansion)
export interface Discount {
  id: ID
  code: string
  type: 'percentage' | 'fixed'
  value: number
  minimumAmount?: number
  expiresAt?: string
}

// Shipping option types (for future expansion)
export interface ShippingOption {
  id: ID
  name: string
  price: number
  estimatedDays: string
  description?: string
}