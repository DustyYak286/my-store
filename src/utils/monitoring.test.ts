import { monitoring } from './monitoring';

describe('Monitoring utilities', () => {
  beforeEach(() => {
    monitoring.reset();
  });

  it('records attempts, successes and failures', () => {
    monitoring.recordPaymentAttempt();
    monitoring.recordPaymentAttempt();
    monitoring.recordPaymentSuccess();
    monitoring.recordPaymentFailure('card');
    monitoring.recordValidationError('amount');
    monitoring.recordOriginBlocked();
    monitoring.recordRateLimitBlocked('payment');

    const snap = monitoring.snapshot();
    expect(snap.attemptsTotal).toBe(2);
    expect(snap.successTotal).toBe(1);
    expect((snap.failureByCategory as any).card).toBe(1);
    expect((snap.validationErrorsByType as any).amount).toBe(1);
    expect(snap.originBlockedTotal).toBe(1);
    expect((snap.rateLimitBlockedByTier as any).payment).toBe(1);
  });

  it('tracks histograms with timers', async () => {
    const stopApi = monitoring.startTimer('api.create_intent');
    await new Promise(r => setTimeout(r, 5));
    stopApi();

    const stopStripe = monitoring.startTimer('stripe.create_payment_intent');
    await new Promise(r => setTimeout(r, 5));
    stopStripe();

    const snap = monitoring.snapshot();
    const apiCounts = (snap.histograms as any).api.counts as number[];
    const stripeCounts = (snap.histograms as any).stripe.counts as number[];
    expect(apiCounts.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(stripeCounts.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});


