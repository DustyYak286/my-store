/**
 * Monitoring and Metrics Utilities
 *
 * Lightweight in-memory counters and latency histograms for payment API
 * instrumentation. Designed to be easily swapped with a real metrics backend.
 */

type Tier = 'burst' | 'payment' | 'general' | 'suspicious';
type HistogramKey = 'api.create_intent' | 'stripe.create_payment_intent' | 'api.webhook';

interface HistogramBuckets {
  bounds: number[];
  counts: number[];
}

class MetricsRegistry {
  private attemptsTotal = 0;
  private successTotal = 0;
  private failureByCategory: Record<string, number> = {};
  private validationErrorsByType: Record<string, number> = {};
  private originBlockedTotal = 0;
  private rateLimitBlockedByTier: Record<Tier, number> = {
    burst: 0,
    payment: 0,
    general: 0,
    suspicious: 0,
  };
  private webhookReceivedByType: Record<string, number> = {};
  private webhookProcessedByType: Record<string, number> = {};
  private webhookIgnoredByReason: Record<string, number> = {};
  private webhookSignatureInvalidTotal = 0;

  private histograms: Record<HistogramKey, HistogramBuckets> = {
    'api.create_intent': { bounds: [100, 300, 1000, 3000, 10000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
    'stripe.create_payment_intent': { bounds: [50, 200, 500, 1000, 3000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
    'api.webhook': { bounds: [10, 50, 200, 500, 2000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
  };

  public startTimer(key: HistogramKey): () => void {
    const start = Date.now();
    return () => {
      const elapsed = Date.now() - start;
      this.observe(key, elapsed);
    };
  }

  private observe(key: HistogramKey, ms: number): void {
    const h = this.histograms[key];
    const idx = h.bounds.findIndex(bound => ms <= bound);
    const bucket = idx === -1 ? h.counts.length - 1 : idx;
    h.counts[bucket] += 1;
  }

  public recordPaymentAttempt(): void {
    this.attemptsTotal += 1;
  }

  public recordPaymentSuccess(): void {
    this.successTotal += 1;
  }

  public recordPaymentFailure(category: string): void {
    this.failureByCategory[category] = (this.failureByCategory[category] || 0) + 1;
  }

  public recordValidationError(type: string): void {
    this.validationErrorsByType[type] = (this.validationErrorsByType[type] || 0) + 1;
  }

  public recordOriginBlocked(): void {
    this.originBlockedTotal += 1;
  }

  public recordRateLimitBlocked(tier: Tier): void {
    this.rateLimitBlockedByTier[tier] = (this.rateLimitBlockedByTier[tier] || 0) + 1;
  }

  public recordWebhookReceived(type: string): void {
    this.webhookReceivedByType[type] = (this.webhookReceivedByType[type] || 0) + 1;
  }

  public recordWebhookProcessed(type: string): void {
    this.webhookProcessedByType[type] = (this.webhookProcessedByType[type] || 0) + 1;
  }

  public recordWebhookIgnored(reason: string): void {
    this.webhookIgnoredByReason[reason] = (this.webhookIgnoredByReason[reason] || 0) + 1;
  }

  public recordWebhookSignatureInvalid(): void {
    this.webhookSignatureInvalidTotal += 1;
  }

  public snapshot(): Record<string, unknown> {
    return {
      attemptsTotal: this.attemptsTotal,
      successTotal: this.successTotal,
      failureByCategory: { ...this.failureByCategory },
      validationErrorsByType: { ...this.validationErrorsByType },
      originBlockedTotal: this.originBlockedTotal,
      rateLimitBlockedByTier: { ...this.rateLimitBlockedByTier },
      histograms: {
        api: { bounds: this.histograms['api.create_intent'].bounds, counts: [...this.histograms['api.create_intent'].counts] },
        stripe: { bounds: this.histograms['stripe.create_payment_intent'].bounds, counts: [...this.histograms['stripe.create_payment_intent'].counts] },
        webhook: { bounds: this.histograms['api.webhook'].bounds, counts: [...this.histograms['api.webhook'].counts] },
      },
      webhook: {
        receivedByType: { ...this.webhookReceivedByType },
        processedByType: { ...this.webhookProcessedByType },
        ignoredByReason: { ...this.webhookIgnoredByReason },
        signatureInvalidTotal: this.webhookSignatureInvalidTotal,
      },
      timestamp: new Date().toISOString(),
    };
  }

  public reset(): void {
    this.attemptsTotal = 0;
    this.successTotal = 0;
    this.failureByCategory = {};
    this.validationErrorsByType = {};
    this.originBlockedTotal = 0;
    this.rateLimitBlockedByTier = { burst: 0, payment: 0, general: 0, suspicious: 0 };
    this.webhookReceivedByType = {};
    this.webhookProcessedByType = {};
    this.webhookIgnoredByReason = {};
    this.webhookSignatureInvalidTotal = 0;
    Object.keys(this.histograms).forEach(k => {
      const key = k as HistogramKey;
      this.histograms[key].counts = this.histograms[key].counts.map(() => 0);
    });
  }
}

export const monitoring = new MetricsRegistry();

export type Monitoring = typeof monitoring;


