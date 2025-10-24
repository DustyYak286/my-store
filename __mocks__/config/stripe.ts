/**
 * Mock Stripe Config for Unit Tests
 */

export const stripeConfig = {
  secretKey: 'sk_test_mock_secret_key',
  publishableKey: 'pk_test_mock_publishable_key',
  currency: 'ron',
  api: {
    version: '2025-07-30.basil',
    timeout: 10000,
    maxRetries: 3,
  },
  webhookSecret: 'whsec_test_mock_webhook_secret',
};

export const getServerStripeOptions = jest.fn(() => ({
  apiVersion: stripeConfig.api.version,
  timeout: stripeConfig.api.timeout,
  maxNetworkRetries: stripeConfig.api.maxRetries,
  telemetry: false,
}));

export const getClientStripeOptions = jest.fn(() => ({
  apiVersion: stripeConfig.api.version,
  locale: 'ro',
}));

export const isTestMode = jest.fn(() => true);