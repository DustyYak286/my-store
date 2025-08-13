/**
 * Tests for Stripe server-side utilities
 */

import { handleStripeError } from '@/lib/stripe';
import { stripeConfig } from '@/config/stripe';
import * as stripeLib from '@/lib/stripe';

describe('Stripe Server Utilities', () => {
  describe('stripeConfig access', () => {
    it('should have webhook tolerance configured', () => {
      expect(stripeConfig.webhooks.tolerance).toBe(300);
    });

    it('should have correct API version', () => {
      expect(stripeConfig.api.version).toBe('2022-11-15');
    });
  });

  describe('handleStripeError', () => {
    it('should categorize card errors', () => {
      const cardError = new Error('Card declined') as any;
      cardError.type = 'card_error';
      cardError.code = 'card_declined';

      const result = handleStripeError(cardError);

      expect(result.category).toBe('card');
      expect(result.isRetryable).toBe(false);
    });

    it('should categorize rate limit errors', () => {
      const rateLimitError = new Error('Rate limit exceeded') as any;
      rateLimitError.type = 'rate_limit_error';

      const result = handleStripeError(rateLimitError);

      expect(result.category).toBe('rate_limit');
      expect(result.isRetryable).toBe(true);
    });

    it('should categorize API connection errors', () => {
      const connectionError = new Error('Connection failed') as any;
      connectionError.type = 'api_connection_error';

      const result = handleStripeError(connectionError);

      expect(result.category).toBe('unknown');
      expect(result.isRetryable).toBe(false);
    });

    it('should categorize API errors', () => {
      const apiError = new Error('API error') as any;
      apiError.type = 'api_error';

      const result = handleStripeError(apiError);

      expect(result.category).toBe('api');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Unknown error');

      const result = handleStripeError(unknownError as any);

      expect(result.category).toBe('unknown');
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('constructWebhookEvent', () => {
    it('should throw StripeConfigError on invalid signature and pass configured tolerance', () => {
      const constructEventMock = jest.fn(() => {
        throw new Error('Invalid signature');
      });

      jest.isolateModules(() => {
        jest.doMock('stripe', () => ({
          __esModule: true,
          default: class MockStripe {
            public webhooks = { constructEvent: constructEventMock };
            constructor(_secret: string, _options: any) {}
          },
        }));

        const { constructWebhookEvent } = require('@/lib/stripe') as typeof stripeLib;

        expect(() => constructWebhookEvent('test-payload', 'bad-signature'))
          .toThrow(/Webhook verification failed/);
      });

      expect(constructEventMock).toHaveBeenCalledTimes(1);
      const args = constructEventMock.mock.calls[0] as unknown[];
      // Assert tolerance (4th argument) is passed from configuration
      expect(args?.[3]).toBe(stripeConfig.webhooks.tolerance);
    });
  });
});