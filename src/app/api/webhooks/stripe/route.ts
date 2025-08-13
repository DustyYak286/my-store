/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, processPaymentIntentWebhook } from '@/lib/stripe';
import { WEBHOOK_CONFIG } from '@/constants/payments';
import { extractWebhookMetadata, isWebhookVersionCompatible } from '@/utils/webhookMetadata';
import { isEventFresh, isDuplicateEvent, markEventProcessed } from '@/utils/webhookHelpers';
import { monitoring } from '@/utils/monitoring';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stopWebhookTimer = monitoring.startTimer('api.webhook');
  const signature = request.headers.get('stripe-signature') || '';
  const requestId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const rawBody = await request.text();

    // Construct and verify event
    const event = constructWebhookEvent(rawBody, signature);
    monitoring.recordWebhookReceived(event.type);

    // Only handle specific event types
    if (!WEBHOOK_CONFIG.HANDLED_EVENTS.includes(event.type as any)) {
      monitoring.recordWebhookIgnored('unhandled_type');
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    // Timestamp recency check
    if (!isEventFresh(event.created, WEBHOOK_CONFIG.MAX_EVENT_AGE)) {
      monitoring.recordWebhookIgnored('stale_event');
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    // Deduplication check
    if (isDuplicateEvent(event.id)) {
      monitoring.recordWebhookIgnored('duplicate_event');
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    // Process payment intent event to extract core info
    const info = processPaymentIntentWebhook(event);

    // Extract metadata for routing and validation
    const metadata = extractWebhookMetadata(event.data.object);
    if (!metadata) {
      monitoring.recordWebhookIgnored('invalid_metadata');
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    if (!isWebhookVersionCompatible(metadata)) {
      monitoring.recordWebhookIgnored('incompatible_version');
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    // TODO: Update order status by metadata.orderId (pending → paid/failed)
    // This will be implemented in task 5.x. For now, we just accept and mark processed.

    // Mark processed (dedup)
    markEventProcessed(event.id);
    monitoring.recordWebhookProcessed(event.type);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // Signature errors or construction errors
    monitoring.recordWebhookSignatureInvalid();
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'invalid_signature', message }, { status: 400 });
  } finally {
    stopWebhookTimer();
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
}


