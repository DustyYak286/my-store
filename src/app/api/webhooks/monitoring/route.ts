/**
 * Webhook Monitoring API
 * 
 * GET /api/webhooks/monitoring - Get webhook processing statistics and health
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookLogger, getWebhookHealthStatus } from '@/utils/webhookLogger';
import { monitoring } from '@/utils/monitoring';
import { getSecurityStats } from '@/utils/webhookSecurity';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';
    const includeLogs = searchParams.get('logs') === 'true';
    const includeAudit = searchParams.get('audit') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get core metrics
    const healthStatus = getWebhookHealthStatus();
    const processingStats = webhookLogger.getProcessingStats();
    const securityStats = getSecurityStats();
    const monitoringStats = monitoring.getMetrics();

    // Build response
    const response: any = {
      timestamp: new Date().toISOString(),
      health: {
        status: healthStatus.status,
        issues: healthStatus.issues,
        recommendations: healthStatus.recommendations,
      },
      performance: {
        summary: processingStats.summary,
        activeProcessing: processingStats.activeProcessing,
        performanceBreakdown: processingStats.performanceBreakdown,
      },
      security: {
        processedEvents: securityStats.processedEvents,
        rateLimitEntries: securityStats.rateLimitEntries,
        idempotencyEntries: securityStats.idempotencyEntries,
      },
      monitoring: {
        webhookStats: {
          received: monitoringStats.webhookReceivedByType,
          processed: monitoringStats.webhookProcessedByType,
          ignored: monitoringStats.webhookIgnoredByReason,
          errors: monitoringStats.webhookErrorsByType,
          signatureInvalid: monitoringStats.webhookSignatureInvalidTotal,
        },
        latency: monitoringStats.histograms['api.webhook'],
      },
    };

    // Add detailed information if requested
    if (includeDetails) {
      response.details = {
        recentErrors: processingStats.recentErrors,
        performancePercentiles: {
          average: processingStats.summary.averageProcessingTime,
          p95: processingStats.summary.p95ProcessingTime,
          p99: processingStats.summary.p99ProcessingTime,
        },
        errorsByStage: processingStats.summary.errorsByStage,
        slowProcessing: {
          threshold: processingStats.summary.slowProcessingThreshold,
          count: processingStats.summary.slowProcessingCount,
        },
      };
    }

    // Add recent logs if requested
    if (includeLogs) {
      response.recentLogs = webhookLogger.getLogEntries({
        limit: Math.min(limit, 500),
        since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      });
    }

    // Add audit logs if requested
    if (includeAudit) {
      response.auditLogs = webhookLogger.getAuditLogs({
        limit: Math.min(limit, 200),
        since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      });
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      error: 'monitoring_error',
      message: 'Failed to retrieve monitoring data',
      details: message,
    }, { status: 500 });
  }
}

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ 
    error: 'method_not_allowed', 
    message: 'Use GET to retrieve monitoring data' 
  }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ 
    error: 'method_not_allowed', 
    message: 'Use GET to retrieve monitoring data' 
  }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ 
    error: 'method_not_allowed', 
    message: 'Use GET to retrieve monitoring data' 
  }, { status: 405 });
}