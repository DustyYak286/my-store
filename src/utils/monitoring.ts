/**
 * Monitoring and Metrics Utilities
 *
 * Lightweight in-memory counters and latency histograms for payment API
 * instrumentation. Designed to be easily swapped with a real metrics backend.
 */

type Tier = 'burst' | 'payment' | 'general' | 'suspicious';
type HistogramKey = 'api.create_intent' | 'api.initialize_intent' | 'stripe.create_payment_intent' | 'stripe.initialize_payment_intent' | 'api.webhook' | 'client.payment_processing';

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
  private paymentFailureReasons: Record<string, number> = {};
  private paymentRetriesByAttempt: Record<number, number> = {};
  private paymentRetryDelaySum = 0;
  private paymentRetryCount = 0;
  private cardDeclineReasons: Record<string, number> = {};
  private authenticationFailures: Record<string, number> = {};
  private networkTimeouts: number = 0;
  private webhookErrorsByType: Record<string, number> = {};
  private webhookOrderUpdatedTotal = 0;

  private histograms: Record<HistogramKey, HistogramBuckets> = {
    'api.create_intent': { bounds: [100, 300, 1000, 3000, 10000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
    'api.initialize_intent': { bounds: [50, 150, 500, 1000, 3000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
    'stripe.create_payment_intent': { bounds: [50, 200, 500, 1000, 3000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
    'stripe.initialize_payment_intent': { bounds: [50, 150, 500, 1000, 3000, Infinity], counts: [0, 0, 0, 0, 0, 0] },
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

  public recordWebhookSecurityViolation(violationType: string, metadata?: Record<string, any>): void {
    // Track security violations for monitoring
    if (!this.webhookErrorsByType[violationType]) {
      this.webhookErrorsByType[violationType] = 0;
    }
    this.webhookErrorsByType[violationType]++;
    
    console.warn(`🚨 Webhook security violation: ${violationType}`, metadata);
  }

  public recordWebhookRateLimitExceeded(identifier: string, metadata?: Record<string, any>): void {
    this.webhookErrorsByType['rate_limit_exceeded'] = (this.webhookErrorsByType['rate_limit_exceeded'] || 0) + 1;
    console.warn(`⚠️ Webhook rate limit exceeded for: ${identifier}`, metadata);
  }

  public recordWebhookIdempotencyHit(idempotencyKey: string): void {
    this.webhookIgnoredByReason['idempotency_hit'] = (this.webhookIgnoredByReason['idempotency_hit'] || 0) + 1;
    console.log(`🔄 Webhook idempotency hit: ${idempotencyKey}`);
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

  public recordPaymentFailure(reason: string, details: Record<string, unknown> = {}): void {
    this.paymentFailureReasons[reason] = (this.paymentFailureReasons[reason] || 0) + 1;
    
    // Categorize specific failure types for deeper analysis
    const reasonLower = reason.toLowerCase();
    
    // Track card decline reasons
    if (reasonLower.includes('card_declined') || reasonLower.includes('declined')) {
      const declineCode = details.decline_code as string || 'generic_decline';
      this.cardDeclineReasons[declineCode] = (this.cardDeclineReasons[declineCode] || 0) + 1;
    }
    
    // Track authentication failures
    if (reasonLower.includes('authentication') || reasonLower.includes('3d_secure')) {
      const authFailureType = details.failure_reason as string || 'authentication_failed';
      this.authenticationFailures[authFailureType] = (this.authenticationFailures[authFailureType] || 0) + 1;
    }
    
    // Track network timeouts
    if (reasonLower.includes('timeout') || reasonLower.includes('network')) {
      this.networkTimeouts += 1;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Payment failure recorded: ${reason}`, {
        details,
        totalFailuresOfThisType: this.paymentFailureReasons[reason]
      });
    }
  }

  public recordCardDecline(declineCode: string, metadata: Record<string, unknown> = {}): void {
    this.recordPaymentFailure('card_declined', { decline_code: declineCode, ...metadata });
  }

  public recordAuthenticationFailure(failureReason: string, metadata: Record<string, unknown> = {}): void {
    this.recordPaymentFailure('authentication_failed', { failure_reason: failureReason, ...metadata });
  }

  public recordNetworkTimeout(timeoutType: 'api_request' | 'payment_processing' | 'webhook_delivery', metadata: Record<string, unknown> = {}): void {
    this.recordPaymentFailure('network_timeout', { timeout_type: timeoutType, ...metadata });
  }

  public recordEvent(eventType: string, metadata: Record<string, unknown> = {}): void {
    // Generic event recording for cart clearing and other events
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Event recorded: ${eventType}`, metadata);
    }
    
    // In a production system, this could send to an external monitoring service
    // For now, we'll just log it
  }

  public recordPaymentRetry(attempt: number, delayMs: number): void {
    this.paymentRetriesByAttempt[attempt] = (this.paymentRetriesByAttempt[attempt] || 0) + 1;
    this.paymentRetryDelaySum += delayMs;
    this.paymentRetryCount += 1;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Payment retry recorded: attempt ${attempt}, delay ${delayMs}ms`);
    }
  }

  public recordWebhookError(type: string, metadata: Record<string, unknown> = {}): void {
    this.webhookErrorsByType[type] = (this.webhookErrorsByType[type] || 0) + 1;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Webhook error recorded: ${type}`, metadata);
    }
  }

  public recordWebhookProcessingError(error: string): void {
    this.recordWebhookError('processing_error', { error });
  }

  public recordWebhookOrderUpdated(orderId: string, status: string, amount: number): void {
    this.webhookOrderUpdatedTotal += 1;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Order updated via webhook: ${orderId} -> ${status} (${amount})`);
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
        failureReasons: { ...this.paymentFailureReasons },
        cardDeclineReasons: { ...this.cardDeclineReasons },
        authenticationFailures: { ...this.authenticationFailures },
        networkTimeouts: this.networkTimeouts,
        retriesByAttempt: { ...this.paymentRetriesByAttempt },
        averageRetryDelay: this.paymentRetryCount > 0 ? this.paymentRetryDelaySum / this.paymentRetryCount : 0,
        totalRetries: this.paymentRetryCount,
      },
      histograms: {
        api: { bounds: this.histograms['api.create_intent'].bounds, counts: [...this.histograms['api.create_intent'].counts] },
        apiInit: { bounds: this.histograms['api.initialize_intent'].bounds, counts: [...this.histograms['api.initialize_intent'].counts] },
        stripe: { bounds: this.histograms['stripe.create_payment_intent'].bounds, counts: [...this.histograms['stripe.create_payment_intent'].counts] },
        stripeInit: { bounds: this.histograms['stripe.initialize_payment_intent'].bounds, counts: [...this.histograms['stripe.initialize_payment_intent'].counts] },
        webhook: { bounds: this.histograms['api.webhook'].bounds, counts: [...this.histograms['api.webhook'].counts] },
        clientPayment: { bounds: this.histograms['client.payment_processing'].bounds, counts: [...this.histograms['client.payment_processing'].counts] },
      },
      webhook: {
        receivedByType: { ...this.webhookReceivedByType },
        processedByType: { ...this.webhookProcessedByType },
        ignoredByReason: { ...this.webhookIgnoredByReason },
        signatureInvalidTotal: this.webhookSignatureInvalidTotal,
        errorsByType: { ...this.webhookErrorsByType },
        orderUpdatedTotal: this.webhookOrderUpdatedTotal,
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
    this.paymentFailureReasons = {};
    this.paymentRetriesByAttempt = {};
    this.paymentRetryDelaySum = 0;
    this.paymentRetryCount = 0;
    this.cardDeclineReasons = {};
    this.authenticationFailures = {};
    this.networkTimeouts = 0;
    this.webhookErrorsByType = {};
    this.webhookOrderUpdatedTotal = 0;
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
      failureCount: Object.values(snapshot.failureByCategory || {}).reduce((sum, count) => sum + (count as number), 0) + 
                   Object.values((snapshot.paymentErrors as any)?.failureReasons || {}).reduce((sum, count) => sum + (count as number), 0),
      successRate: snapshot.attemptsTotal > 0 ? 
        (snapshot.successTotal / snapshot.attemptsTotal * 100).toFixed(2) + '%' : '0%',
    },
    failures: { ...snapshot.failureByCategory, ...((snapshot.paymentErrors as any)?.failureReasons || {}) },
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

// Utility function to get detailed payment failure insights
export function getPaymentFailureInsights() {
  const snapshot = monitoring.snapshot();
  const paymentErrors = snapshot.paymentErrors as any;
  
  // Calculate total failures across all categories
  const totalFailures = Object.values(paymentErrors.failureReasons).reduce((sum, count) => sum + (count as number), 0);
  const cardDeclines = Object.values(paymentErrors.cardDeclineReasons).reduce((sum, count) => sum + (count as number), 0);
  const authFailures = Object.values(paymentErrors.authenticationFailures).reduce((sum, count) => sum + (count as number), 0);
  
  // Get top failure reasons
  const topFailureReasons = Object.entries(paymentErrors.failureReasons)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 10)
    .map(([reason, count]) => ({
      reason,
      count: count as number,
      percentage: totalFailures > 0 ? ((count as number) / totalFailures * 100).toFixed(1) + '%' : '0%'
    }));

  // Get top card decline reasons
  const topDeclineReasons = Object.entries(paymentErrors.cardDeclineReasons)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([code, count]) => ({
      code,
      count: count as number,
      percentage: cardDeclines > 0 ? ((count as number) / cardDeclines * 100).toFixed(1) + '%' : '0%'
    }));

  // Get authentication failure breakdown
  const authFailureBreakdown = Object.entries(paymentErrors.authenticationFailures)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .map(([type, count]) => ({
      type,
      count: count as number,
      percentage: authFailures > 0 ? ((count as number) / authFailures * 100).toFixed(1) + '%' : '0%'
    }));

  return {
    summary: {
      totalFailures,
      cardDeclines,
      authenticationFailures: authFailures,
      networkTimeouts: paymentErrors.networkTimeouts,
      averageRetryDelay: paymentErrors.averageRetryDelay,
      totalRetries: paymentErrors.totalRetries,
    },
    breakdown: {
      topFailureReasons,
      cardDeclineReasons: topDeclineReasons,
      authenticationFailures: authFailureBreakdown,
      retryAttempts: paymentErrors.retriesByAttempt,
    },
    insights: generateFailureInsights(paymentErrors),
    timestamp: snapshot.timestamp,
  };
}

// Generate actionable insights from failure data
function generateFailureInsights(paymentErrors: any): Array<{ type: 'warning' | 'info' | 'critical', message: string, action?: string }> {
  const insights = [];
  const totalFailures = Object.values(paymentErrors.failureReasons).reduce((sum, count) => sum + (count as number), 0);
  const cardDeclines = Object.values(paymentErrors.cardDeclineReasons).reduce((sum, count) => sum + (count as number), 0);
  const networkTimeouts = paymentErrors.networkTimeouts;
  
  // High failure rate warning
  if (totalFailures > 50) {
    const failureRate = totalFailures / (totalFailures + (monitoring as any).successTotal) * 100;
    if (failureRate > 10) {
      insights.push({
        type: 'critical',
        message: `High payment failure rate detected: ${failureRate.toFixed(1)}%`,
        action: 'Review payment processing pipeline and card acceptance settings'
      });
    } else if (failureRate > 5) {
      insights.push({
        type: 'warning',
        message: `Elevated payment failure rate: ${failureRate.toFixed(1)}%`,
        action: 'Monitor failure patterns and consider optimization'
      });
    }
  }
  
  // Card decline patterns
  if (cardDeclines > 10) {
    const topDeclineCode = Object.entries(paymentErrors.cardDeclineReasons)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    if (topDeclineCode && (topDeclineCode[1] as number) > cardDeclines * 0.3) {
      insights.push({
        type: 'warning',
        message: `High frequency of "${topDeclineCode[0]}" card declines (${topDeclineCode[1]} occurrences)`,
        action: 'Consider updating payment messaging or contacting payment processor'
      });
    }
  }
  
  // Network timeout issues
  if (networkTimeouts > 5) {
    insights.push({
      type: 'warning',
      message: `Frequent network timeouts detected (${networkTimeouts} occurrences)`,
      action: 'Check payment processor connectivity and timeout settings'
    });
  }
  
  // High retry rate
  if (paymentErrors.totalRetries > totalFailures * 0.5) {
    insights.push({
      type: 'info',
      message: `High retry rate indicates transient failures (${paymentErrors.totalRetries} retries for ${totalFailures} failures)`,
      action: 'Consider adjusting retry logic or investigating intermittent issues'
    });
  }
  
  return insights;
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


