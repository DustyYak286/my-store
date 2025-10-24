/**
 * Checkout-related Types
 * 
 * All types related to checkout process, forms, and payment
 */

import type { ID, Price } from './common'
import type { CartItem } from './cart'

// Address structure (shared between shipping and billing)
export interface Address {
  fullName: string
  streetAddress: string
  city: string
  postalCode: string
  country: string
  state?: string
  company?: string
  phone?: string
}

// Checkout form data
export interface CheckoutFormData {
  // Contact Information
  email: string
  
  // Addresses
  shippingAddress: Address
  billingAddress: Address
  
  // Options
  sameAsShipping: boolean
  
  // Payment (for future expansion)
  paymentMethod?: 'card' | 'paypal' | 'apple_pay'
  savePaymentMethod?: boolean
}

// Legacy form data interface (for backward compatibility)
export interface FormData {
  email: string
  shippingFullName: string
  shippingStreetAddress: string
  shippingCity: string
  shippingPostalCode: string
  shippingCountry: string
  billingFullName: string
  billingStreetAddress: string
  billingCity: string
  billingPostalCode: string
  billingCountry: string
  sameAsShipping: boolean
}

// Form validation
export interface ValidationRules {
  customValidator: (value: string, context?: { sameAsShipping: boolean }) => string | null
}

export interface FormErrors extends Partial<FormData> {}
export interface FormTouched extends Record<string, boolean> {}

// Checkout hook return type
export interface UseCheckoutFormReturn {
  formData: FormData
  errors: FormErrors
  touched: FormTouched
  isFormValid: boolean
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void
  handleSameAsShippingChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  validateForm: () => boolean
}

// Order structure
export interface Order {
  id: ID
  customerId?: ID
  status: OrderStatus
  items: OrderItem[]
  shipping: Address
  billing: Address
  payment: PaymentInfo
  totals: OrderTotals
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  productId: ID
  name: string
  price: Price
  quantity: number
  image: string
}

export interface OrderTotals {
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  currency: string
}

export type OrderStatus = 
  | 'pending' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded'

// Payment information (for future expansion)
export interface PaymentInfo {
  method: 'card' | 'paypal' | 'apple_pay' | 'google_pay'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transactionId?: string
  last4?: string
  brand?: string
}

// Checkout configuration
export interface CheckoutConfig {
  countries: string[]
  defaultSameAsShipping: boolean
  processingDelay: number
  redirectDelay: number
  validation: ValidationConfig
  ui: UIConfig
  features: FeatureFlags
  messages: Messages
}

export interface ValidationConfig {
  emailRegex: RegExp
  postalCodeRegex: RegExp
  nameMinLength: number
  nameMaxLength: number
  addressMinLength: number
  cityMinLength: number
}

export interface UIConfig {
  primaryColor: string
  primaryHoverColor: string
}

export interface FeatureFlags {
  realTimeValidation: boolean
  autoFillBilling: boolean
  billingAddressSection: boolean
}

export interface Messages {
  orderSuccess: string
  orderError: string
  formIncomplete: string
}