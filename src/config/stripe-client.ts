/**
 * Client-side Stripe Configuration
 * 
 * Client-only configuration that only uses NEXT_PUBLIC environment variables
 * to avoid bundling server-side configuration into the client build.
 */

// Validate Stripe publishable key with helpful error message
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!publishableKey) {
  console.error('[ERROR] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set in environment variables');
  console.error('Please check your .env.local file and restart the development server');
}
if (publishableKey && !publishableKey.startsWith('pk_')) {
  console.error('[ERROR] Invalid Stripe publishable key format. Must start with pk_test_ or pk_live_');
}

export const clientStripeConfig = {
  publishableKey: publishableKey || '',
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