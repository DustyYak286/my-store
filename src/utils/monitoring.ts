/**
 * Monitoring and Metrics Utilities
 *
 * Lightweight in-memory counters and latency histograms for payment API
 * instrumentation. Designed to be easily swapped with a real metrics backend.
 */

type Tier = 'burst' | 'payment' | 'general' | 'suspicious';
type HistogramKey = 'api.create_intent' | 'stripe.create_payment_intent' | 'api.webhook' | 'client.payment_processing';

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
  private paymentErrorsByType: Record<string, number> = {};
  private paymentRetriesByAttempt: Record<number, number> = {};
  private paymentRetryDelaySum = 0;
  private paymentRetryCount = 0;

  private histograms: Record<HistogramKey, HistogramBuckets> = {
    'api.create_intent': { bounds: [100, 300, 1000, 3000, 10000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
    'stripe.create_payment_intent': { bounds: [50, 200, 500, 1000, 3000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
    'api.webhook': { bounds: [10, 50, 200, 500, 2000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
    'client.payment_processing': { bounds: [1000, 5000, 15000, 30000, 60000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
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
    if (h.counts[bucket] !== undefined) {
      h.counts[bucket] += 1;
    }
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

  public recordPaymentError(type: string, metadata: Record<string, unknown> = {}): void {
    this.paymentErrorsByType[type] = (this.paymentErrorsByType[type] || 0) + 1;
    
    // Log detailed error information for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Payment error recorded: ${type}`, metadata);
    }
  }

  public recordPaymentRetry(attempt: number, delayMs: number): void {
    this.paymentRetriesByAttempt[attempt] = (this.paymentRetriesByAttempt[attempt] || 0) + 1;
    this.paymentRetryDelaySum += delayMs;
    this.paymentRetryCount += 1;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Payment retry recorded: attempt ${attempt}, delay ${delayMs}ms`);
    }
  }

  public snapshot(): Record<string, unknown> {
    return {
      attemptsTotal: this.attemptsTotal,
      successTotal: this.successTotal,
      failureByCategory: { ...this.failureByCategory },
      validationErrorsByType: { ...this.validationErrorsByType },
      originBlockedTotal: this.originBlockedTotal,
      rateLimitBlockedByTier: { ...this.rateLimitBlockedByTier },
      paymentErrors: {
        errorsByType: { ...this.paymentErrorsByType },
        retriesByAttempt: { ...this.paymentRetriesByAttempt },
        averageRetryDelay: this.paymentRetryCount > 0 ? this.paymentRetryDelaySum / this.paymentRetryCount : 0,
        totalRetries: this.paymentRetryCount,
      },
      histograms: {
        api: { bounds: this.histograms['api.create_intent'].bounds, counts: [...this.histograms['api.create_intent'].counts] },
        stripe: { bounds: this.histograms['stripe.create_payment_intent'].bounds, counts: [...this.histograms['stripe.create_payment_intent'].counts] },
        webhook: { bounds: this.histograms['api.webhook'].bounds, counts: [...this.histograms['api.webhook'].counts] },
        clientPayment: { bounds: this.histograms['client.payment_processing'].bounds, counts: [...this.histograms['client.payment_processing'].counts] },
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
    this.paymentErrorsByType = {};
    this.paymentRetriesByAttempt = {};
    this.paymentRetryDelaySum = 0;
    this.paymentRetryCount = 0;
    Object.keys(this.histograms).forEach(k => {
      const key = k as HistogramKey;
      this.histograms[key].counts = this.histograms[key].counts.map(() => 0);
    });
  }
}

export const monitoring = new MetricsRegistry();

export type Monitoring = typeof monitoring;

// Utility function to get current payment metrics summary
export function getPaymentMetricsSummary() {
  const snapshot = monitoring.snapshot();
  
  return {
    overview: {
      totalAttempts: snapshot.attemptsTotal,
      successCount: snapshot.successTotal,
      failureCount: Object.values(snapshot.failureByCategory).reduce((sum, count) => sum + (count as number), 0),
      successRate: snapshot.attemptsTotal > 0 ? 
        (snapshot.successTotal / snapshot.attemptsTotal * 100).toFixed(2) + '%' : '0%',
    },
    failures: snapshot.failureByCategory,
    validationErrors: snapshot.validationErrorsByType,
    paymentErrors: snapshot.paymentErrors,
    performanceSummary: {
      apiLatency: calculateHistogramStats(snapshot.histograms.api),
      stripeLatency: calculateHistogramStats(snapshot.histograms.stripe),
      clientProcessing: calculateHistogramStats(snapshot.histograms.clientPayment),
      webhookLatency: calculateHistogramStats(snapshot.histograms.webhook),
    },
    timestamp: snapshot.timestamp,
  };
}

// Helper function to calculate histogram statistics
function calculateHistogramStats(histogram: { bounds: number[], counts: number[] }) {
  const totalCount = histogram.counts.reduce((sum, count) => sum + count, 0);
  
  if (totalCount === 0) {
    return { count: 0, p50: 0, p95: 0, p99: 0 };
  }

  let p50Count = Math.ceil(totalCount * 0.5);
  let p95Count = Math.ceil(totalCount * 0.95);
  let p99Count = Math.ceil(totalCount * 0.99);

  let runningCount = 0;
  let p50 = 0, p95 = 0, p99 = 0;

  for (let i = 0; i < histogram.counts.length; i++) {
    runningCount += histogram.counts[i];
    
    if (p50Count > 0 && runningCount >= p50Count && p50 === 0) {
      p50 = histogram.bounds[i] === Infinity ? histogram.bounds[i - 1] || 0 : histogram.bounds[i];
      p50Count = 0;
    }
    
    if (p95Count > 0 && runningCount >= p95Count && p95 === 0) {
      p95 = histogram.bounds[i] === Infinity ? histogram.bounds[i - 1] || 0 : histogram.bounds[i];
      p95Count = 0;
    }
    
    if (p99Count > 0 && runningCount >= p99Count && p99 === 0) {
      p99 = histogram.bounds[i] === Infinity ? histogram.bounds[i - 1] || 0 : histogram.bounds[i];
      p99Count = 0;
    }
  }

  return {
    count: totalCount,
    p50: p50 || histogram.bounds[histogram.bounds.length - 2] || 0,
    p95: p95 || histogram.bounds[histogram.bounds.length - 2] || 0,
    p99: p99 || histogram.bounds[histogram.bounds.length - 2] || 0,
  };
}


