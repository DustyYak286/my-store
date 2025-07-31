/**
 * Common Types
 * 
 * Shared utility types used across the application
 */

// Base API Response Structure
export interface APIResponse<T = any> {
  data: T
  message?: string
  success: boolean
}

// Generic ID type for consistency
export type ID = string | number

// Price structure used throughout the app
export interface Price {
  original: number
  discount?: number
  currency: string
}

// Generic pagination interface
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// Loading states
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Generic error structure
export interface ErrorInfo {
  message: string
  code?: string | number
  details?: any
}

// Toast/Notification types
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id?: string
  message: string
  type: ToastType
  duration?: number
  isVisible?: boolean
}

// Form field types
export interface FormField {
  label: string
  name: string
  type?: string
  value: string
  error?: string
  required?: boolean
  placeholder?: string
}

// Generic component props
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

// Navigation types
export interface NavigationItem {
  name: string
  path: string
  external?: boolean
}

// Review/Rating structure
export interface Review {
  id: ID
  author: string
  rating: number
  comment: string
  date: string
  verified?: boolean
}