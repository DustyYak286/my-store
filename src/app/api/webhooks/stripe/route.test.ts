import { WEBHOOK_CONFIG } from '@/constants/payments';
import { resetWebhookDedupStore } from '@/utils/webhookHelpers';
import { monitoring } from '@/utils/monitoring';

describe('Stripe Webhook Route (basic behaviors)', () => {
  beforeEach(() => {
    resetWebhookDedupStore();
    monitoring.reset();
  });

  it('exposes handled events list', () => {
    expect(WEBHOOK_CONFIG.HANDLED_EVENTS).toContain('payment_intent.succeeded');
    expect(WEBHOOK_CONFIG.HANDLED_EVENTS).toContain('payment_intent.payment_failed');
  });
});


