/**
 * useStripePayment Hook - Compatibility Shim
 * 
 * This file now exports the compatibility wrapper that maintains the v1 API
 * while using the new v2 architecture internally.
 * 
 * @deprecated The v1 API is deprecated. New code should use useStripePaymentV2 directly.
 */

export * from './useStripePayment.compat';
export { useStripePayment as default } from './useStripePayment.compat';