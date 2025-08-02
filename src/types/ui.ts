/**
 * UI Component Types
 * 
 * Types for UI components, forms, and interactive elements
 */

import type { BaseComponentProps, ToastType } from './common'

// Toast component props
export interface ToastProps extends BaseComponentProps {
  message: string
  isVisible: boolean
  onClose: () => void
  duration?: number
  type?: ToastType
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center'
}

// Form input field props
export interface InputFieldProps extends BaseComponentProps {
  label: string
  name: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  error?: string | undefined
  placeholder?: string
  required?: boolean
  disabled?: boolean
  autoComplete?: string
}

// Select field props
export interface SelectFieldProps extends BaseComponentProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void
  options: string[]
  error?: string | undefined
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

// Button variants and props
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends BaseComponentProps {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}

// Modal props
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

// Layout props
export interface LayoutProps extends BaseComponentProps {
  children: React.ReactNode
}

// Error boundary props
export interface ErrorBoundaryProps extends BaseComponentProps {
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  children: React.ReactNode
}

// Loading spinner props
export interface LoadingSpinnerProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

// Footer section structure
export interface FooterItem {
  name: string
  href: string
  external?: boolean
}

export interface FooterSection {
  title: string
  items: FooterItem[]
}

// FAQ structure
export interface FAQ {
  id: string
  question: string
  answer: string
  category?: string
}

// Intersection observer options
export interface UseIntersectionObserverOptions {
  threshold?: number
  rootMargin?: string
  enabled?: boolean
}