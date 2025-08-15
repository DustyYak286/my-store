import { monitoring, getPaymentMetricsSummary } from './monitoring';

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

  it('tracks client payment processing timer', async () => {
    const stopClientTimer = monitoring.startTimer('client.payment_processing');
    await new Promise(r => setTimeout(r, 10));
    stopClientTimer();

    const snap = monitoring.snapshot();
    const clientCounts = (snap.histograms as any).clientPayment.counts as number[];
    expect(clientCounts.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('records payment errors with metadata', () => {
    monitoring.recordPaymentError('card_declined', {
      attemptNumber: 1,
      processingTime: 1500,
      category: 'card',
      isRetryable: false,
      severity: 'high',
    });

    monitoring.recordPaymentError('network_timeout', {
      attemptNumber: 2,
      processingTime: 30000,
      category: 'network',
      isRetryable: true,
      severity: 'medium',
    });

    const snap = monitoring.snapshot();
    expect((snap.paymentErrors as any).errorsByType.card_declined).toBe(1);
    expect((snap.paymentErrors as any).errorsByType.network_timeout).toBe(1);
  });

  it('records payment retries with delays', () => {
    monitoring.recordPaymentRetry(1, 1000);
    monitoring.recordPaymentRetry(2, 2000);
    monitoring.recordPaymentRetry(3, 4000);

    const snap = monitoring.snapshot();
    const paymentErrors = snap.paymentErrors as any;
    
    expect(paymentErrors.retriesByAttempt['1']).toBe(1);
    expect(paymentErrors.retriesByAttempt['2']).toBe(1);
    expect(paymentErrors.retriesByAttempt['3']).toBe(1);
    expect(paymentErrors.totalRetries).toBe(3);
    expect(paymentErrors.averageRetryDelay).toBeCloseTo(2333.333333333333, 10); // (1000 + 2000 + 4000) / 3
  });

  it('records webhook events', () => {
    monitoring.recordWebhookReceived('payment_intent.succeeded');
    monitoring.recordWebhookProcessed('payment_intent.succeeded');
    monitoring.recordWebhookIgnored('duplicate_event');
    monitoring.recordWebhookSignatureInvalid();

    const snap = monitoring.snapshot();
    const webhook = snap.webhook as any;
    
    expect(webhook.receivedByType['payment_intent.succeeded']).toBe(1);
    expect(webhook.processedByType['payment_intent.succeeded']).toBe(1);
    expect(webhook.ignoredByReason.duplicate_event).toBe(1);
    expect(webhook.signatureInvalidTotal).toBe(1);
  });

  describe('getPaymentMetricsSummary', () => {
    beforeEach(() => {
      monitoring.reset();
    });

    it('provides comprehensive payment metrics summary', () => {
      // Setup test data
      monitoring.recordPaymentAttempt();
      monitoring.recordPaymentAttempt();
      monitoring.recordPaymentAttempt();
      monitoring.recordPaymentSuccess();
      monitoring.recordPaymentFailure('card');
      monitoring.recordPaymentFailure('network');
      monitoring.recordValidationError('amount');
      monitoring.recordValidationError('card');
      
      const summary = getPaymentMetricsSummary();
      
      expect(summary.overview.totalAttempts).toBe(3);
      expect(summary.overview.successCount).toBe(1);
      expect(summary.overview.failureCount).toBe(2);
      expect(summary.overview.successRate).toBe('33.33%');
      
      expect(summary.failures.card).toBe(1);
      expect(summary.failures.network).toBe(1);
      
      expect(summary.validationErrors.amount).toBe(1);
      expect(summary.validationErrors.card).toBe(1);
      
      expect(summary.timestamp).toBeDefined();
    });

    it('handles zero metrics gracefully', () => {
      const summary = getPaymentMetricsSummary();
      
      expect(summary.overview.totalAttempts).toBe(0);
      expect(summary.overview.successCount).toBe(0);
      expect(summary.overview.failureCount).toBe(0);
      expect(summary.overview.successRate).toBe('0%');
      
      expect(summary.performanceSummary.apiLatency.count).toBe(0);
      expect(summary.performanceSummary.stripeLatency.count).toBe(0);
      expect(summary.performanceSummary.clientProcessing.count).toBe(0);
      expect(summary.performanceSummary.webhookLatency.count).toBe(0);
    });

    it('calculates histogram statistics correctly', async () => {
      // Add multiple timer measurements
      const stopApi1 = monitoring.startTimer('api.create_intent');
      await new Promise(r => setTimeout(r, 50));
      stopApi1();

      const stopApi2 = monitoring.startTimer('api.create_intent');
      await new Promise(r => setTimeout(r, 150));
      stopApi2();

      const stopApi3 = monitoring.startTimer('api.create_intent');
      await new Promise(r => setTimeout(r, 250));
      stopApi3();

      const summary = getPaymentMetricsSummary();
      const apiLatency = summary.performanceSummary.apiLatency;
      
      expect(apiLatency.count).toBe(3);
      expect(apiLatency.p50).toBeGreaterThan(0);
      expect(apiLatency.p95).toBeGreaterThan(0);
      expect(apiLatency.p99).toBeGreaterThan(0);
    });

    it('includes payment retry statistics', () => {
      monitoring.recordPaymentRetry(1, 1000);
      monitoring.recordPaymentRetry(2, 2000);
      monitoring.recordPaymentRetry(1, 1500);
      
      const summary = getPaymentMetricsSummary();
      const paymentErrors = summary.paymentErrors;
      
      expect(paymentErrors.retriesByAttempt['1']).toBe(2);
      expect(paymentErrors.retriesByAttempt['2']).toBe(1);
      expect(paymentErrors.totalRetries).toBe(3);
      expect(paymentErrors.averageRetryDelay).toBeCloseTo(1500, 10); // (1000 + 2000 + 1500) / 3
    });
  });

  describe('reset functionality', () => {
    it('resets all metrics to initial state', () => {
      // Add some data
      monitoring.recordPaymentAttempt();
      monitoring.recordPaymentSuccess();
      monitoring.recordPaymentFailure('card');
      monitoring.recordValidationError('amount');
      monitoring.recordPaymentRetry(1, 1000);
      monitoring.recordPaymentError('test_error', { test: true });
      
      const beforeReset = monitoring.snapshot();
      expect(beforeReset.attemptsTotal).toBe(1);
      expect(beforeReset.successTotal).toBe(1);
      
      // Reset
      monitoring.reset();
      
      const afterReset = monitoring.snapshot();
      expect(afterReset.attemptsTotal).toBe(0);
      expect(afterReset.successTotal).toBe(0);
      expect(Object.keys(afterReset.failureByCategory)).toHaveLength(0);
      expect(Object.keys(afterReset.validationErrorsByType)).toHaveLength(0);
      expect((afterReset.paymentErrors as any).totalRetries).toBe(0);
      expect((afterReset.paymentErrors as any).averageRetryDelay).toBe(0);
    });
  });
});


