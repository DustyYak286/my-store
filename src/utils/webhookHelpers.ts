/**
 * Webhook Helpers
 *
 * Security and deduplication utilities for Stripe webhook processing.
 */

// In-memory deduplication store (replace with Redis in production)
const processedEvents = new Map<string, number>();

// Cleanup processed events periodically
const DEDUP_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupProcessedEvents(now: number): void {
  for (const [id, ts] of processedEvents.entries()) {
    if (now - ts > DEDUP_TTL_MS) {
      processedEvents.delete(id);
    }
  }
}

if (typeof setInterval === 'function') {
  setInterval(() => cleanupProcessedEvents(Date.now()), DEDUP_CLEANUP_INTERVAL_MS);
}

export function isEventFresh(eventCreatedSeconds: number, maxAgeMs: number): boolean {
  const eventMs = eventCreatedSeconds * 1000;
  return Date.now() - eventMs <= maxAgeMs;
}

export function isDuplicateEvent(eventId: string): boolean {
  return processedEvents.has(eventId);
}

export function markEventProcessed(eventId: string): void {
  processedEvents.set(eventId, Date.now());
}

// Test helper to reset dedup store
export function resetWebhookDedupStore() {
  processedEvents.clear();
}


