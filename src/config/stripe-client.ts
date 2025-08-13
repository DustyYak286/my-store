/**
 * Client-side Stripe Configuration
 * 
 * Client-only configuration that only uses NEXT_PUBLIC environment variables
 * to avoid bundling server-side configuration into the client build.
 */

export const clientStripeConfig = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  apiVersion: '2022-11-15' as const,
  locale: 'ro' as const,
  appearance: {
    theme: 'stripe' as const,
    variables: { 
      colorPrimary: '#7C4D59',
      colorBackground: '#ffffff',
      colorText: '#30313d',
      colorDanger: '#df1b41',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '6px',
    },
  },
} as const;