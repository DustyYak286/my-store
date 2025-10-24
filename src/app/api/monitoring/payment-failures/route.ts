/**
 * Payment Failure Monitoring API
 * 
 * GET /api/monitoring/payment-failures
 * 
 * Provides detailed payment failure insights and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPaymentFailureInsights } from '@/utils/monitoring';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInsights = searchParams.get('insights') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get comprehensive payment failure insights
    const insights = getPaymentFailureInsights();

    // Filter data based on query parameters
    const response = {
      summary: insights.summary,
      breakdown: {
        topFailureReasons: insights.breakdown.topFailureReasons.slice(0, limit),
        cardDeclineReasons: insights.breakdown.cardDeclineReasons.slice(0, Math.min(5, limit)),
        authenticationFailures: insights.breakdown.authenticationFailures.slice(0, Math.min(5, limit)),
        retryAttempts: insights.breakdown.retryAttempts,
      },
      ...(includeInsights && { insights: insights.insights }),
      timestamp: insights.timestamp,
      meta: {
        dataPoints: {
          totalFailureReasons: Object.keys(insights.breakdown.topFailureReasons).length,
          cardDeclineTypes: insights.breakdown.cardDeclineReasons.length,
          authFailureTypes: insights.breakdown.authenticationFailures.length,
        },
        configuration: {
          insightsEnabled: includeInsights,
          resultLimit: limit,
        },
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[ERROR] Payment failure monitoring API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve payment failure insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

/**
 * Reset payment failure metrics (for testing/admin purposes)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { monitoring } = await import('@/utils/monitoring');
    
    // Reset all metrics
    monitoring.reset();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Payment failure metrics reset successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ERROR] Failed to reset payment failure metrics:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to reset payment failure metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}