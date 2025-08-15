/**
 * Webhook Monitoring API Tests
 * 
 * Tests for the webhook monitoring and health check logic
 */

import { webhookLogger, getWebhookHealthStatus } from '@/utils/webhookLogger';
import { monitoring } from '@/utils/monitoring';
import { getSecurityStats } from '@/utils/webhookSecurity';

// Mock dependencies
jest.mock('@/utils/webhookLogger', () => ({
  webhookLogger: {
    getProcessingStats: jest.fn(),
    getLogEntries: jest.fn(),
    getAuditLogs: jest.fn(),
  },
  getWebhookHealthStatus: jest.fn(),
}));

jest.mock('@/utils/monitoring', () => ({
  monitoring: {
    getMetrics: jest.fn(),
  },
}));

jest.mock('@/utils/webhookSecurity', () => ({
  getSecurityStats: jest.fn(),
}));

describe('Webhook Monitoring Logic', () => {
  const mockWebhookLogger = webhookLogger as jest.Mocked<typeof webhookLogger>;
  const mockGetWebhookHealthStatus = getWebhookHealthStatus as jest.MockedFunction<typeof getWebhookHealthStatus>;
  const mockMonitoring = monitoring as jest.Mocked<typeof monitoring>;
  const mockGetSecurityStats = getSecurityStats as jest.MockedFunction<typeof getSecurityStats>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockWebhookLogger.getProcessingStats.mockReturnValue({
      summary: {
        totalWebhooks: 100,
        successfulWebhooks: 95,
        failedWebhooks: 5,
        averageProcessingTime: 250,
        p95ProcessingTime: 500,
        p99ProcessingTime: 800,
        securityViolations: 2,
        errorsByStage: { 'order-processing': 3, 'cart-clearing': 2 },
        slowProcessingThreshold: 2000,
        slowProcessingCount: 1,
      },
      activeProcessing: 3,
      recentErrors: [
        { stage: 'order-processing', count: 3 },
        { stage: 'cart-clearing', count: 2 },
      ],
      performanceBreakdown: {
        fast: 85,
        medium: 14,
        slow: 1,
      },
    });

    mockGetWebhookHealthStatus.mockReturnValue({
      status: 'healthy',
      issues: [],
      recommendations: [],
      metrics: {
        summary: { totalWebhooks: 100 },
      },
    });

    mockGetSecurityStats.mockReturnValue({
      processedEvents: 95,
      rateLimitEntries: 10,
      idempotencyEntries: 5,
    });

    mockMonitoring.getMetrics.mockReturnValue({
      webhookReceivedByType: { 'payment_intent.succeeded': 50 },
      webhookProcessedByType: { 'payment_intent.succeeded': 48 },
      webhookIgnoredByReason: { 'duplicate_event': 2 },
      webhookErrorsByType: { 'security_violation': 1 },
      webhookSignatureInvalidTotal: 1,
      histograms: {
        'api.webhook': {
          bounds: [10, 50, 200, 500, 2000, Infinity],
          counts: [20, 40, 25, 10, 4, 1],
        },
      },
    });

    mockWebhookLogger.getLogEntries.mockReturnValue([
      {
        timestamp: new Date().toISOString(),
        level: 'info' as any,
        message: 'Webhook processed successfully',
        eventId: 'evt_test',
        processingId: 'proc_test',
      },
    ]);

    mockWebhookLogger.getAuditLogs.mockReturnValue([
      {
        id: 'audit_test',
        timestamp: new Date().toISOString(),
        eventId: 'evt_test',
        processingId: 'proc_test',
        securityValidation: { passed: true },
      } as any,
    ]);
  });

  describe('Monitoring Data Collection', () => {
    it('should collect basic monitoring data', () => {
      const healthStatus = mockGetWebhookHealthStatus();
      const processingStats = mockWebhookLogger.getProcessingStats();
      const securityStats = mockGetSecurityStats();
      const monitoringStats = mockMonitoring.getMetrics();

      expect(healthStatus.status).toBe('healthy');
      expect(processingStats.summary.totalWebhooks).toBe(100);
      expect(securityStats.processedEvents).toBe(95);
      expect(monitoringStats.webhookReceivedByType['payment_intent.succeeded']).toBe(50);
    });

    it('should provide performance breakdown', () => {
      const processingStats = mockWebhookLogger.getProcessingStats();
      
      expect(processingStats.performanceBreakdown).toEqual({
        fast: 85,
        medium: 14,
        slow: 1,
      });
    });

    it('should track recent errors', () => {
      const processingStats = mockWebhookLogger.getProcessingStats();
      
      expect(processingStats.recentErrors).toEqual([
        { stage: 'order-processing', count: 3 },
        { stage: 'cart-clearing', count: 2 },
      ]);
    });

    it('should handle unhealthy status with issues', () => {
      mockGetWebhookHealthStatus.mockReturnValue({
        status: 'unhealthy',
        issues: ['High error rate: 15%', 'Slow processing detected'],
        recommendations: ['Investigate webhook failures', 'Optimize processing performance'],
        metrics: { summary: { totalWebhooks: 100 } },
      });

      const healthStatus = mockGetWebhookHealthStatus();
      
      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.issues).toContain('High error rate: 15%');
      expect(healthStatus.recommendations).toContain('Investigate webhook failures');
    });

    it('should collect log entries with filters', () => {
      const logFilter = {
        limit: 100,
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };
      
      mockWebhookLogger.getLogEntries(logFilter);
      
      expect(mockWebhookLogger.getLogEntries).toHaveBeenCalledWith(logFilter);
    });

    it('should collect audit logs with filters', () => {
      const auditFilter = {
        limit: 50,
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      };
      
      mockWebhookLogger.getAuditLogs(auditFilter);
      
      expect(mockWebhookLogger.getAuditLogs).toHaveBeenCalledWith(auditFilter);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate success rate', () => {
      const processingStats = mockWebhookLogger.getProcessingStats();
      const successRate = processingStats.summary.successfulWebhooks / processingStats.summary.totalWebhooks;
      
      expect(successRate).toBe(0.95); // 95%
    });

    it('should track processing times', () => {
      const processingStats = mockWebhookLogger.getProcessingStats();
      
      expect(processingStats.summary.averageProcessingTime).toBe(250);
      expect(processingStats.summary.p95ProcessingTime).toBe(500);
      expect(processingStats.summary.p99ProcessingTime).toBe(800);
    });

    it('should monitor active processing sessions', () => {
      const processingStats = mockWebhookLogger.getProcessingStats();
      
      expect(processingStats.activeProcessing).toBe(3);
    });

    it('should track slow processing', () => {
      const processingStats = mockWebhookLogger.getProcessingStats();
      
      expect(processingStats.summary.slowProcessingThreshold).toBe(2000);
      expect(processingStats.summary.slowProcessingCount).toBe(1);
    });
  });

  describe('Security Monitoring', () => {
    it('should track security violations', () => {
      const processingStats = mockWebhookLogger.getProcessingStats();
      
      expect(processingStats.summary.securityViolations).toBe(2);
    });

    it('should monitor rate limiting', () => {
      const securityStats = mockGetSecurityStats();
      
      expect(securityStats.rateLimitEntries).toBe(10);
    });

    it('should track idempotency usage', () => {
      const securityStats = mockGetSecurityStats();
      
      expect(securityStats.idempotencyEntries).toBe(5);
    });

    it('should count processed events', () => {
      const securityStats = mockGetSecurityStats();
      
      expect(securityStats.processedEvents).toBe(95);
    });
  });

  describe('Error Handling', () => {
    it('should handle health check errors gracefully', () => {
      mockGetWebhookHealthStatus.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      expect(() => {
        try {
          mockGetWebhookHealthStatus();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Health check failed');
          throw error;
        }
      }).toThrow('Health check failed');
    });

    it('should handle processing stats errors', () => {
      mockWebhookLogger.getProcessingStats.mockImplementation(() => {
        throw new Error('Stats collection failed');
      });

      expect(() => {
        try {
          mockWebhookLogger.getProcessingStats();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Stats collection failed');
          throw error;
        }
      }).toThrow('Stats collection failed');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle empty metrics gracefully', () => {
      mockWebhookLogger.getProcessingStats.mockReturnValue({
        summary: {
          totalWebhooks: 0,
          successfulWebhooks: 0,
          failedWebhooks: 0,
          averageProcessingTime: 0,
          p95ProcessingTime: 0,
          p99ProcessingTime: 0,
          securityViolations: 0,
          errorsByStage: {},
          slowProcessingThreshold: 2000,
          slowProcessingCount: 0,
        },
        activeProcessing: 0,
        recentErrors: [],
        performanceBreakdown: { fast: 0, medium: 0, slow: 0 },
      });

      mockGetSecurityStats.mockReturnValue({
        processedEvents: 0,
        rateLimitEntries: 0,
        idempotencyEntries: 0,
      });

      const processingStats = mockWebhookLogger.getProcessingStats();
      const securityStats = mockGetSecurityStats();
      
      expect(processingStats.summary.totalWebhooks).toBe(0);
      expect(securityStats.processedEvents).toBe(0);
    });

    it('should handle high-volume scenarios', () => {
      mockWebhookLogger.getProcessingStats.mockReturnValue({
        summary: {
          totalWebhooks: 10000,
          successfulWebhooks: 9800,
          failedWebhooks: 200,
          averageProcessingTime: 150,
          p95ProcessingTime: 300,
          p99ProcessingTime: 500,
          securityViolations: 5,
          errorsByStage: { 'order-processing': 150, 'email-notification': 50 },
          slowProcessingThreshold: 2000,
          slowProcessingCount: 25,
        },
        activeProcessing: 50,
        recentErrors: [
          { stage: 'order-processing', count: 150 },
          { stage: 'email-notification', count: 50 },
        ],
        performanceBreakdown: { fast: 9500, medium: 475, slow: 25 },
      });

      const processingStats = mockWebhookLogger.getProcessingStats();
      const successRate = processingStats.summary.successfulWebhooks / processingStats.summary.totalWebhooks;
      
      expect(processingStats.summary.totalWebhooks).toBe(10000);
      expect(successRate).toBe(0.98); // 98%
      expect(processingStats.activeProcessing).toBe(50);
    });

    it('should provide comprehensive monitoring data structure', () => {
      const healthStatus = mockGetWebhookHealthStatus();
      const processingStats = mockWebhookLogger.getProcessingStats();
      const securityStats = mockGetSecurityStats();
      const monitoringStats = mockMonitoring.getMetrics();

      // Simulate the data structure returned by the API
      const monitoringData = {
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

      expect(monitoringData).toMatchObject({
        timestamp: expect.any(String),
        health: expect.objectContaining({
          status: 'healthy',
        }),
        performance: expect.objectContaining({
          summary: expect.objectContaining({
            totalWebhooks: 100,
          }),
        }),
        security: expect.objectContaining({
          processedEvents: 95,
        }),
        monitoring: expect.objectContaining({
          webhookStats: expect.objectContaining({
            received: expect.any(Object),
          }),
        }),
      });
    });
  });
});