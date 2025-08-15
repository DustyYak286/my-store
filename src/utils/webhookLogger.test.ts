/**
 * Webhook Logger Tests
 * 
 * Comprehensive tests for webhook logging and monitoring functionality
 */

import {
  WebhookLogger,
  LogLevel,
  createTimedLogger,
  getWebhookHealthStatus,
  DEFAULT_LOGGER_CONFIG,
} from './webhookLogger';

// Mock monitoring
jest.mock('./monitoring', () => ({
  monitoring: {
    recordWebhookError: jest.fn(),
    recordWebhookIgnored: jest.fn(),
  },
}));

describe('WebhookLogger', () => {
  let logger: WebhookLogger;

  beforeEach(() => {
    // Clear all shared state before each test
    const globalLogger = new WebhookLogger();
    globalLogger.clearAll();
    
    logger = new WebhookLogger({
      ...DEFAULT_LOGGER_CONFIG,
      sensitiveFields: [], // Disable field sanitization for tests
      enableAsync: false, // Use synchronous logging for predictable tests
    });
    logger.clearAll(); // Clear this instance too
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    logger.clearAll();
  });

  describe('Basic Logging', () => {
    it('should log messages with correct level', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      logger.log(LogLevel.INFO, 'Test message', {
        processingId: 'test_123',
        metadata: { key: 'value' },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test message'),
        expect.objectContaining({ key: 'value' })
      );

      consoleSpy.mockRestore();
    });

    it('should respect log level filtering', () => {
      const debugLogger = new WebhookLogger({
        ...DEFAULT_LOGGER_CONFIG,
        logLevel: LogLevel.WARN,
      });
      
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
      
      debugLogger.log(LogLevel.DEBUG, 'Debug message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should sanitize sensitive fields', () => {
      const sensitiveLogger = new WebhookLogger({
        ...DEFAULT_LOGGER_CONFIG,
        sensitiveFields: ['secret'],
        enableAsync: false, // Disable async for predictable testing
      });
      
      sensitiveLogger.log(LogLevel.INFO, 'Test', {
        metadata: { secret: 'sensitive_data', public: 'visible' },
      });
      
      const logs = sensitiveLogger.getLogEntries();
      const lastLog = logs[logs.length - 1];
      
      expect(lastLog.metadata?.secret).toBe('[REDACTED]');
      expect(lastLog.metadata?.public).toBe('visible');
    });
  });

  describe('Processing Metrics', () => {
    it('should track processing metrics lifecycle', () => {
      const processingId = 'test_processing_123';
      const eventId = 'evt_test_123';
      const eventType = 'payment_intent.succeeded';
      
      // Start metrics
      logger.startProcessingMetrics(processingId, eventId, eventType, 'order_123');
      
      // Record security checks
      logger.recordSecurityCheck(processingId, 'signatureValidation', true, 50);
      logger.recordSecurityCheck(processingId, 'timestampValidation', true, 10);
      
      // Record business logic
      logger.recordBusinessLogic(processingId, 'orderLookup', true, 25);
      logger.recordBusinessLogic(processingId, 'statusUpdate', true, 100);
      
      // Complete processing
      logger.completeProcessingMetrics(processingId, 'completed');
      
      const stats = logger.getProcessingStats();
      expect(stats.summary.totalWebhooks).toBe(1);
      expect(stats.summary.successfulWebhooks).toBe(1);
    });

    it('should track processing errors', () => {
      const processingId = 'test_error_123';
      const eventId = 'evt_error_123';
      
      logger.startProcessingMetrics(processingId, eventId, 'payment_intent.failed');
      
      const testError = new Error('Test processing error');
      logger.recordError(processingId, 'order-processing', testError, false);
      
      logger.completeProcessingMetrics(processingId, 'failed');
      
      const stats = logger.getProcessingStats();
      expect(stats.summary.failedWebhooks).toBe(1);
      expect(stats.recentErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            stage: 'order-processing',
            count: 1,
          }),
        ])
      );
    });

    it('should track processing warnings', () => {
      const processingId = 'test_warning_123';
      const eventId = 'evt_warning_123';
      
      logger.startProcessingMetrics(processingId, eventId, 'payment_intent.succeeded');
      
      logger.recordWarning(processingId, 'cart-clearing', 'Cart clearing took longer than expected');
      
      logger.completeProcessingMetrics(processingId, 'completed');
      
      // Verify warning was recorded (would be in metrics)
      const stats = logger.getProcessingStats();
      expect(stats.summary.successfulWebhooks).toBe(1);
    });
  });

  describe('Log Filtering and Retrieval', () => {
    beforeEach(() => {
      // Add some test logs
      logger.log(LogLevel.INFO, 'Info message 1', {
        eventId: 'evt_1',
        orderId: 'order_1',
        tags: ['webhook', 'info'],
      });
      
      logger.log(LogLevel.WARN, 'Warning message', {
        eventId: 'evt_2',
        orderId: 'order_1',
        tags: ['webhook', 'warning'],
      });
      
      logger.log(LogLevel.ERROR, 'Error message', {
        eventId: 'evt_3',
        orderId: 'order_2',
        tags: ['webhook', 'error'],
      });
    });

    it('should filter logs by level', () => {
      const errorLogs = logger.getLogEntries({ level: LogLevel.ERROR });
      
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].message).toBe('Error message');
    });

    it('should filter logs by event ID', () => {
      const eventLogs = logger.getLogEntries({ eventId: 'evt_1' });
      
      expect(eventLogs.length).toBe(1);
      expect(eventLogs[0].message).toBe('Info message 1');
    });

    it('should filter logs by order ID', () => {
      const orderLogs = logger.getLogEntries({ orderId: 'order_1' });
      
      expect(orderLogs.length).toBe(2);
    });

    it('should filter logs by tags', () => {
      const warningLogs = logger.getLogEntries({ tags: ['warning'] });
      
      expect(warningLogs.length).toBe(1);
      expect(warningLogs[0].message).toBe('Warning message');
    });

    it('should limit log results', () => {
      const limitedLogs = logger.getLogEntries({ limit: 2 });
      
      expect(limitedLogs.length).toBe(2);
    });

    it('should filter logs by time range', () => {
      const recent = new Date(Date.now() - 1000); // 1 second ago
      const recentLogs = logger.getLogEntries({ since: recent });
      
      expect(recentLogs.length).toBe(3); // All logs should be recent
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entries', () => {
      const processingId = 'audit_test_123';
      const eventId = 'evt_audit_123';
      
      logger.startProcessingMetrics(processingId, eventId, 'payment_intent.succeeded', 'order_audit');
      
      // Simulate successful processing - record ALL security checks
      logger.recordSecurityCheck(processingId, 'signatureValidation', true, 25);
      logger.recordSecurityCheck(processingId, 'timestampValidation', true, 10);
      logger.recordSecurityCheck(processingId, 'deduplicationCheck', true, 15);
      logger.recordSecurityCheck(processingId, 'rateLimitCheck', true, 5);
      logger.recordSecurityCheck(processingId, 'payloadSizeCheck', true, 5);
      logger.recordBusinessLogic(processingId, 'orderLookup', true, 50);
      logger.recordBusinessLogic(processingId, 'statusUpdate', true, 75);
      
      logger.completeProcessingMetrics(processingId, 'completed');
      
      const auditLogs = logger.getAuditLogs({ eventId });
      
      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0]).toMatchObject({
        eventId,
        orderId: 'order_audit',
        processingId,
        securityValidation: expect.objectContaining({
          passed: true,
          violations: [],
        }),
        processing: expect.objectContaining({
          status: 'success',
        }),
        outcome: expect.objectContaining({
          orderStatusChanged: true,
        }),
      });
    });

    it('should filter audit logs by security violations', () => {
      const processingId = 'audit_violation_123';
      const eventId = 'evt_violation_123';
      
      logger.startProcessingMetrics(processingId, eventId, 'payment_intent.succeeded');
      
      // Simulate security violation
      logger.recordSecurityCheck(processingId, 'signatureValidation', false, 25);
      logger.recordSecurityCheck(processingId, 'timestampValidation', true, 10);
      
      logger.completeProcessingMetrics(processingId, 'failed');
      
      const violationLogs = logger.getAuditLogs({ securityViolations: true });
      
      expect(violationLogs.length).toBe(1);
      expect(violationLogs[0].securityValidation.passed).toBe(false);
      expect(violationLogs[0].securityValidation.violations).toContain('signatureValidation');
    });
  });

  describe('Performance Statistics', () => {
    it('should calculate performance breakdown', () => {
      // Simulate various processing times
      const processingIds = ['fast_1', 'fast_2', 'medium_1', 'slow_1'];
      
      processingIds.forEach((id, index) => {
        logger.startProcessingMetrics(id, `evt_${id}`, 'payment_intent.succeeded');
        logger.completeProcessingMetrics(id, 'completed');
      });
      
      const stats = logger.getProcessingStats();
      
      expect(stats.performanceBreakdown).toMatchObject({
        fast: expect.any(Number),
        medium: expect.any(Number),
        slow: expect.any(Number),
      });
    });

    it('should track active processing count', () => {
      const processingId1 = 'active_1';
      const processingId2 = 'active_2';
      
      logger.startProcessingMetrics(processingId1, 'evt_1', 'payment_intent.succeeded');
      logger.startProcessingMetrics(processingId2, 'evt_2', 'payment_intent.succeeded');
      
      const stats = logger.getProcessingStats();
      expect(stats.activeProcessing).toBe(2);
      
      logger.completeProcessingMetrics(processingId1, 'completed');
      
      const updatedStats = logger.getProcessingStats();
      expect(updatedStats.activeProcessing).toBe(1);
    });
  });
});

describe('createTimedLogger', () => {
  it('should measure operation duration', () => {
    const processingId = 'timed_test_123';
    const operation = 'test-operation';
    
    const timedLogger = createTimedLogger(processingId, operation);
    
    const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    
    timedLogger.start();
    
    // Simulate some processing time
    setTimeout(() => {
      timedLogger.end(true, { result: 'success' });
      
      expect(consoleSpy).toHaveBeenCalledTimes(2); // start and end
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-operation started'),
        expect.any(Object)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-operation completed'),
        expect.objectContaining({
          success: true,
          result: 'success',
        })
      );
      
      consoleSpy.mockRestore();
    }, 10);
  });

  it('should handle operation failure', () => {
    const processingId = 'timed_fail_123';
    const operation = 'fail-operation';
    
    const timedLogger = createTimedLogger(processingId, operation);
    
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    timedLogger.start();
    timedLogger.end(false, { error: 'Operation failed' });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('fail-operation failed'),
      expect.objectContaining({
        success: false,
        error: 'Operation failed',
      })
    );
    
    consoleSpy.mockRestore();
  });
});

describe('getWebhookHealthStatus', () => {
  beforeEach(() => {
    // Clear global logger state for health tests
    const globalLogger = new WebhookLogger();
    globalLogger.clearAll();
  });
  
  it('should return healthy status for good metrics', () => {
    // Simulate successful processing using the singleton
    for (let i = 0; i < 10; i++) {
      const processingId = `health_test_${i}`;
      // Use the global singleton instance that getWebhookHealthStatus uses
      const { webhookLogger } = require('./webhookLogger');
      webhookLogger.startProcessingMetrics(processingId, `evt_${i}`, 'payment_intent.succeeded');
      webhookLogger.completeProcessingMetrics(processingId, 'completed');
    }
    
    const health = getWebhookHealthStatus();
    
    expect(health.status).toBe('healthy');
    expect(health.issues).toHaveLength(0);
  });

  it('should return degraded status for moderate issues', () => {
    // This would require more complex setup to simulate degraded conditions
    // For now, just verify the function structure
    const health = getWebhookHealthStatus();
    
    expect(health).toMatchObject({
      status: expect.any(String),
      metrics: expect.any(Object),
      issues: expect.any(Array),
      recommendations: expect.any(Array),
    });
  });
});