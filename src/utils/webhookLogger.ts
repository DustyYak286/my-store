/**
 * Comprehensive Webhook Logger
 * 
 * Advanced logging system for webhook processing with structured logging,
 * error tracking, performance monitoring, and audit trails.
 */

import { monitoring } from './monitoring';

// ====== TYPES AND INTERFACES ======

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface WebhookLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  eventId?: string;
  orderId?: string;
  processingId?: string;
  source?: string;
  duration?: number;
  metadata?: Record<string, any>;
  tags?: string[];
  traceId?: string;
  spanId?: string;
}

export interface WebhookProcessingMetrics {
  processingId: string;
  eventId: string;
  eventType: string;
  orderId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'processing' | 'completed' | 'failed' | 'timeout';
  securityChecks: {
    signatureValidation: { passed: boolean; duration: number };
    timestampValidation: { passed: boolean; duration: number };
    deduplicationCheck: { passed: boolean; duration: number };
    rateLimitCheck: { passed: boolean; duration: number };
    payloadSizeCheck: { passed: boolean; duration: number };
  };
  businessLogic: {
    orderLookup: { duration: number; found: boolean };
    statusUpdate: { duration: number; success: boolean };
    cartClearing: { duration: number; success: boolean };
    emailNotification: { duration: number; success: boolean };
  };
  errors: Array<{
    stage: string;
    error: string;
    timestamp: number;
    recoverable: boolean;
  }>;
  warnings: Array<{
    stage: string;
    warning: string;
    timestamp: number;
  }>;
}

export interface WebhookAuditLog {
  id: string;
  timestamp: string;
  eventId: string;
  eventType: string;
  orderId?: string;
  processingId: string;
  sourceIp: string;
  userAgent?: string;
  signature: string;
  payloadHash: string;
  securityValidation: {
    passed: boolean;
    violations: string[];
    riskScore: number;
  };
  processing: {
    status: 'success' | 'failure' | 'partial';
    duration: number;
    stages: Record<string, { status: string; duration: number }>;
  };
  outcome: {
    orderStatusChanged: boolean;
    cartCleared: boolean;
    emailSent: boolean;
    errorsEncountered: number;
    warningsEncountered: number;
  };
  metadata: Record<string, any>;
}

// ====== CONFIGURATION ======

export interface LoggerConfig {
  logLevel: LogLevel;
  enableStructuredLogging: boolean;
  enablePerformanceLogging: boolean;
  enableAuditTrail: boolean;
  retentionDays: number;
  maxLogEntries: number;
  enableAsync: boolean;
  enableFiltering: boolean;
  sensitiveFields: string[];
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  logLevel: LogLevel.INFO,
  enableStructuredLogging: true,
  enablePerformanceLogging: true,
  enableAuditTrail: true,
  retentionDays: 30,
  maxLogEntries: 10000,
  enableAsync: true,
  enableFiltering: true,
  sensitiveFields: ['signature', 'secret', 'key', 'token'],
};

// ====== IN-MEMORY STORAGE ======

const logEntries: WebhookLogEntry[] = [];
const processingMetrics = new Map<string, WebhookProcessingMetrics>();
const auditLogs: WebhookAuditLog[] = [];

// Performance tracking
const performanceData = {
  totalWebhooks: 0,
  successfulWebhooks: 0,
  failedWebhooks: 0,
  averageProcessingTime: 0,
  p95ProcessingTime: 0,
  p99ProcessingTime: 0,
  securityViolations: 0,
  errorsByStage: {} as Record<string, number>,
  slowProcessingThreshold: 2000, // 2 seconds
  slowProcessingCount: 0,
};

// ====== LOGGER CLASS ======

export class WebhookLogger {
  private config: LoggerConfig;
  private logBuffer: WebhookLogEntry[] = [];
  private maintenanceInterval: NodeJS.Timeout | null = null;

  constructor(config: LoggerConfig = DEFAULT_LOGGER_CONFIG) {
    this.config = config;
    
    // Start periodic cleanup and metrics calculation only in non-test environments
    if (process.env.NODE_ENV !== 'test' && typeof setInterval === 'function') {
      this.maintenanceInterval = setInterval(() => this.performMaintenance(), 60000); // Every minute
    }
  }

  /**
   * Clear all logs and metrics (for testing)
   */
  clearAll(): void {
    logEntries.splice(0, logEntries.length);
    auditLogs.splice(0, auditLogs.length);
    processingMetrics.clear();
    
    // Reset performance data to initial state
    performanceData.totalWebhooks = 0;
    performanceData.successfulWebhooks = 0;
    performanceData.failedWebhooks = 0;
    performanceData.averageProcessingTime = 0;
    performanceData.p95ProcessingTime = 0;
    performanceData.p99ProcessingTime = 0;
    performanceData.securityViolations = 0;
    performanceData.errorsByStage = {};
    performanceData.slowProcessingCount = 0;
  }

  /**
   * Stop maintenance interval and cleanup (for testing)
   */
  destroy(): void {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
  }

  /**
   * Log a webhook processing event
   */
  log(
    level: LogLevel,
    message: string,
    context: {
      eventId?: string;
      orderId?: string;
      processingId?: string;
      source?: string;
      duration?: number;
      metadata?: Record<string, any>;
      tags?: string[];
      error?: Error;
    } = {}
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: WebhookLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      eventId: context.eventId,
      orderId: context.orderId,
      processingId: context.processingId,
      source: context.source,
      duration: context.duration,
      metadata: this.sanitizeMetadata(context.metadata || {}),
      tags: context.tags || [],
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
    };

    // Add error details if present
    if (context.error) {
      logEntry.metadata = {
        ...logEntry.metadata,
        error: {
          name: context.error.name,
          message: context.error.message,
          stack: context.error.stack,
        },
      };
    }

    if (this.config.enableAsync) {
      this.logBuffer.push(logEntry);
      this.flushLogsAsync();
    } else {
      this.addLogEntry(logEntry);
    }

    // Console output for development
    this.outputToConsole(logEntry);
  }

  /**
   * Start tracking webhook processing metrics
   */
  startProcessingMetrics(
    processingId: string,
    eventId: string,
    eventType: string,
    orderId?: string
  ): void {
    const metrics: WebhookProcessingMetrics = {
      processingId,
      eventId,
      eventType,
      orderId,
      startTime: Date.now(),
      status: 'started',
      securityChecks: {
        signatureValidation: { passed: false, duration: 0 },
        timestampValidation: { passed: false, duration: 0 },
        deduplicationCheck: { passed: false, duration: 0 },
        rateLimitCheck: { passed: false, duration: 0 },
        payloadSizeCheck: { passed: false, duration: 0 },
      },
      businessLogic: {
        orderLookup: { duration: 0, found: false },
        statusUpdate: { duration: 0, success: false },
        cartClearing: { duration: 0, success: false },
        emailNotification: { duration: 0, success: false },
      },
      errors: [],
      warnings: [],
    };

    processingMetrics.set(processingId, metrics);
    performanceData.totalWebhooks++;

    this.log(LogLevel.INFO, 'Webhook processing started', {
      processingId,
      eventId,
      eventType,
      orderId,
      tags: ['webhook', 'processing', 'started'],
    });
  }

  /**
   * Record security check result
   */
  recordSecurityCheck(
    processingId: string,
    checkType: keyof WebhookProcessingMetrics['securityChecks'],
    passed: boolean,
    duration: number
  ): void {
    const metrics = processingMetrics.get(processingId);
    if (metrics) {
      metrics.securityChecks[checkType] = { passed, duration };
      
      if (!passed) {
        performanceData.securityViolations++;
        this.log(LogLevel.WARN, `Security check failed: ${checkType}`, {
          processingId,
          duration,
          tags: ['webhook', 'security', 'violation', checkType],
        });
      }
    }
  }

  /**
   * Record business logic step
   */
  recordBusinessLogic(
    processingId: string,
    step: keyof WebhookProcessingMetrics['businessLogic'],
    success: boolean,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const metrics = processingMetrics.get(processingId);
    if (metrics) {
      if (step === 'orderLookup') {
        metrics.businessLogic.orderLookup = { duration, found: success };
      } else {
        (metrics.businessLogic as any)[step] = { duration, success };
      }

      this.log(LogLevel.DEBUG, `Business logic step: ${step}`, {
        processingId,
        duration,
        metadata: { ...metadata, success },
        tags: ['webhook', 'business-logic', step],
      });
    }
  }

  /**
   * Record processing error
   */
  recordError(
    processingId: string,
    stage: string,
    error: Error | string,
    recoverable: boolean = false
  ): void {
    const metrics = processingMetrics.get(processingId);
    if (metrics) {
      const errorMessage = error instanceof Error ? error.message : error;
      metrics.errors.push({
        stage,
        error: errorMessage,
        timestamp: Date.now(),
        recoverable,
      });

      // Track error by stage
      performanceData.errorsByStage[stage] = (performanceData.errorsByStage[stage] || 0) + 1;

      this.log(LogLevel.ERROR, `Processing error in ${stage}: ${errorMessage}`, {
        processingId,
        metadata: { stage, recoverable },
        tags: ['webhook', 'error', stage],
        error: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Record processing warning
   */
  recordWarning(
    processingId: string,
    stage: string,
    warning: string
  ): void {
    const metrics = processingMetrics.get(processingId);
    if (metrics) {
      metrics.warnings.push({
        stage,
        warning,
        timestamp: Date.now(),
      });

      this.log(LogLevel.WARN, `Processing warning in ${stage}: ${warning}`, {
        processingId,
        metadata: { stage },
        tags: ['webhook', 'warning', stage],
      });
    }
  }

  /**
   * Complete processing metrics
   */
  completeProcessingMetrics(
    processingId: string,
    status: 'completed' | 'failed' | 'timeout'
  ): void {
    const metrics = processingMetrics.get(processingId);
    if (metrics) {
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.status = status;

      // Update performance statistics
      this.updatePerformanceStats(metrics);

      // Create audit log entry
      if (this.config.enableAuditTrail) {
        this.createAuditLogEntry(metrics);
      }

      this.log(LogLevel.INFO, `Webhook processing ${status}`, {
        processingId,
        duration: metrics.duration,
        metadata: {
          status,
          errorCount: metrics.errors.length,
          warningCount: metrics.warnings.length,
        },
        tags: ['webhook', 'processing', status],
      });

      // Clean up metrics after logging
      processingMetrics.delete(processingId);
    }
  }

  /**
   * Get webhook processing statistics
   */
  getProcessingStats(): {
    summary: typeof performanceData;
    activeProcessing: number;
    recentErrors: Array<{ stage: string; count: number }>;
    performanceBreakdown: {
      fast: number; // < 500ms
      medium: number; // 500ms - 2s
      slow: number; // > 2s
    };
  } {
    const recentErrors = Object.entries(performanceData.errorsByStage)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const performanceBreakdown = this.calculatePerformanceBreakdown();

    return {
      summary: { ...performanceData },
      activeProcessing: processingMetrics.size,
      recentErrors,
      performanceBreakdown,
    };
  }

  /**
   * Get filtered log entries
   */
  getLogEntries(filter?: {
    level?: LogLevel;
    eventId?: string;
    orderId?: string;
    processingId?: string;
    tags?: string[];
    since?: Date;
    limit?: number;
  }): WebhookLogEntry[] {
    let filtered = [...logEntries];

    if (filter) {
      if (filter.level) {
        const levelPriority = this.getLevelPriority(filter.level);
        filtered = filtered.filter(entry => 
          this.getLevelPriority(entry.level) >= levelPriority
        );
      }

      if (filter.eventId) {
        filtered = filtered.filter(entry => entry.eventId === filter.eventId);
      }

      if (filter.orderId) {
        filtered = filtered.filter(entry => entry.orderId === filter.orderId);
      }

      if (filter.processingId) {
        filtered = filtered.filter(entry => entry.processingId === filter.processingId);
      }

      if (filter.tags && filter.tags.length > 0) {
        filtered = filtered.filter(entry => 
          filter.tags!.some(tag => entry.tags?.includes(tag))
        );
      }

      if (filter.since) {
        filtered = filtered.filter(entry => 
          new Date(entry.timestamp) >= filter.since!
        );
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get audit log entries
   */
  getAuditLogs(filter?: {
    eventId?: string;
    orderId?: string;
    since?: Date;
    securityViolations?: boolean;
    limit?: number;
  }): WebhookAuditLog[] {
    let filtered = [...auditLogs];

    if (filter) {
      if (filter.eventId) {
        filtered = filtered.filter(log => log.eventId === filter.eventId);
      }

      if (filter.orderId) {
        filtered = filtered.filter(log => log.orderId === filter.orderId);
      }

      if (filter.since) {
        filtered = filtered.filter(log => 
          new Date(log.timestamp) >= filter.since!
        );
      }

      if (filter.securityViolations) {
        filtered = filtered.filter(log => !log.securityValidation.passed);
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // ====== PRIVATE METHODS ======

  private shouldLog(level: LogLevel): boolean {
    const configPriority = this.getLevelPriority(this.config.logLevel);
    const messagePriority = this.getLevelPriority(level);
    return messagePriority >= configPriority;
  }

  private getLevelPriority(level: LogLevel): number {
    const priorities = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.CRITICAL]: 4,
    };
    return priorities[level] || 0;
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    if (!this.config.enableFiltering) {
      return metadata;
    }

    const sanitized = { ...metadata };
    for (const field of this.config.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private generateSpanId(): string {
    return `span_${Math.random().toString(36).slice(2, 10)}`;
  }

  private addLogEntry(entry: WebhookLogEntry): void {
    logEntries.push(entry);
    
    // Maintain size limit
    if (logEntries.length > this.config.maxLogEntries) {
      logEntries.splice(0, logEntries.length - this.config.maxLogEntries);
    }
  }

  private flushLogsAsync(): void {
    if (this.logBuffer.length > 0) {
      setTimeout(() => {
        const toFlush = [...this.logBuffer];
        this.logBuffer = [];
        toFlush.forEach(entry => this.addLogEntry(entry));
      }, 0);
    }
  }

  private outputToConsole(entry: WebhookLogEntry): void {
    const emoji = {
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.CRITICAL]: '🚨',
    };

    const prefix = `${emoji[entry.level]} [${entry.timestamp}]`;
    const context = entry.processingId ? ` [${entry.processingId}]` : '';
    const duration = entry.duration ? ` (${entry.duration}ms)` : '';
    
    const message = `${prefix}${context} ${entry.message}${duration}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message, entry.metadata);
        break;
      case LogLevel.INFO:
        console.log(message, entry.metadata);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.metadata);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message, entry.metadata);
        break;
    }
  }

  private updatePerformanceStats(metrics: WebhookProcessingMetrics): void {
    if (metrics.status === 'completed') {
      performanceData.successfulWebhooks++;
    } else {
      performanceData.failedWebhooks++;
    }

    if (metrics.duration) {
      // Update average processing time
      const totalProcessed = performanceData.successfulWebhooks + performanceData.failedWebhooks;
      performanceData.averageProcessingTime = (
        (performanceData.averageProcessingTime * (totalProcessed - 1) + metrics.duration) / totalProcessed
      );

      // Track slow processing
      if (metrics.duration > performanceData.slowProcessingThreshold) {
        performanceData.slowProcessingCount++;
      }

      // Update percentiles (simplified calculation)
      this.updatePercentiles(metrics.duration);
    }
  }

  private updatePercentiles(duration: number): void {
    // Simplified percentile calculation - in production, use proper histogram
    performanceData.p95ProcessingTime = Math.max(performanceData.p95ProcessingTime, duration * 0.95);
    performanceData.p99ProcessingTime = Math.max(performanceData.p99ProcessingTime, duration * 0.99);
  }

  private calculatePerformanceBreakdown(): { fast: number; medium: number; slow: number } {
    // This would be calculated from stored durations in a real implementation
    const total = performanceData.successfulWebhooks + performanceData.failedWebhooks;
    const slow = performanceData.slowProcessingCount;
    const fast = Math.floor(total * 0.7); // Estimate
    const medium = total - fast - slow;

    return { fast, medium, slow };
  }

  private createAuditLogEntry(metrics: WebhookProcessingMetrics): void {
    const auditLog: WebhookAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      eventId: metrics.eventId,
      eventType: metrics.eventType,
      orderId: metrics.orderId,
      processingId: metrics.processingId,
      sourceIp: 'unknown', // Would be captured from request
      signature: '[REDACTED]',
      payloadHash: '[REDACTED]',
      securityValidation: {
        passed: Object.values(metrics.securityChecks).every(check => check.passed),
        violations: Object.entries(metrics.securityChecks)
          .filter(([_, check]) => !check.passed)
          .map(([type, _]) => type),
        riskScore: this.calculateRiskScore(metrics),
      },
      processing: {
        status: metrics.status === 'completed' ? 'success' : 'failure',
        duration: metrics.duration || 0,
        stages: {
          security: { 
            status: 'completed', 
            duration: Object.values(metrics.securityChecks).reduce((sum, check) => sum + check.duration, 0)
          },
          business: { 
            status: 'completed',
            duration: Object.values(metrics.businessLogic).reduce((sum, logic) => sum + logic.duration, 0)
          },
        },
      },
      outcome: {
        orderStatusChanged: metrics.businessLogic.statusUpdate.success,
        cartCleared: metrics.businessLogic.cartClearing.success,
        emailSent: metrics.businessLogic.emailNotification.success,
        errorsEncountered: metrics.errors.length,
        warningsEncountered: metrics.warnings.length,
      },
      metadata: {
        securityChecks: metrics.securityChecks,
        businessLogic: metrics.businessLogic,
        errors: metrics.errors,
        warnings: metrics.warnings,
      },
    };

    auditLogs.push(auditLog);
    
    // Maintain size limit
    if (auditLogs.length > this.config.maxLogEntries) {
      auditLogs.splice(0, auditLogs.length - this.config.maxLogEntries);
    }
  }

  private calculateRiskScore(metrics: WebhookProcessingMetrics): number {
    let score = 0;
    
    // Security violations increase risk
    Object.values(metrics.securityChecks).forEach(check => {
      if (!check.passed) score += 20;
    });
    
    // Errors increase risk
    score += metrics.errors.length * 10;
    
    // Warnings slightly increase risk
    score += metrics.warnings.length * 5;
    
    // Slow processing increases risk
    if (metrics.duration && metrics.duration > performanceData.slowProcessingThreshold) {
      score += 10;
    }
    
    return Math.min(score, 100); // Cap at 100
  }

  private performMaintenance(): void {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    
    // Clean old log entries
    const cutoffDate = new Date(cutoffTime).toISOString();
    const logsToKeep = logEntries.filter(entry => entry.timestamp > cutoffDate);
    logEntries.splice(0, logEntries.length, ...logsToKeep);
    
    // Clean old audit logs
    const auditLogsToKeep = auditLogs.filter(log => log.timestamp > cutoffDate);
    auditLogs.splice(0, auditLogs.length, ...auditLogsToKeep);
    
    // Clean up orphaned processing metrics (shouldn't happen, but safety)
    const activeTimeout = 10 * 60 * 1000; // 10 minutes
    for (const [processingId, metrics] of processingMetrics.entries()) {
      if (Date.now() - metrics.startTime > activeTimeout) {
        this.completeProcessingMetrics(processingId, 'timeout');
      }
    }
  }
}

// ====== SINGLETON INSTANCE ======

export const webhookLogger = new WebhookLogger();

// ====== UTILITY FUNCTIONS ======

/**
 * Create a timed logger function for measuring operation duration
 */
export function createTimedLogger(
  processingId: string,
  operation: string,
  logLevel?: LogLevel
): { start: () => void; end: (success: boolean, metadata?: Record<string, any>) => void } {
  let startTime: number;
  
  // Create a logger instance with the specified log level for testing
  const logger = logLevel !== undefined ? 
    new WebhookLogger({ ...DEFAULT_LOGGER_CONFIG, logLevel }) : 
    webhookLogger;
  
  return {
    start: () => {
      startTime = Date.now();
      logger.log(LogLevel.DEBUG, `${operation} started`, {
        processingId,
        tags: ['timing', operation, 'start'],
      });
    },
    end: (success: boolean, metadata?: Record<string, any>) => {
      const duration = Date.now() - startTime;
      const level = success ? LogLevel.DEBUG : LogLevel.WARN;
      
      logger.log(level, `${operation} ${success ? 'completed' : 'failed'}`, {
        processingId,
        duration,
        metadata: { ...metadata, success },
        tags: ['timing', operation, success ? 'success' : 'failure'],
      });
    },
  };
}

/**
 * Get comprehensive webhook health status
 */
export function getWebhookHealthStatus(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: ReturnType<WebhookLogger['getProcessingStats']>;
  issues: string[];
  recommendations: string[];
} {
  const stats = webhookLogger.getProcessingStats();
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Calculate health metrics
  const successRate = stats.summary.totalWebhooks > 0 
    ? stats.summary.successfulWebhooks / stats.summary.totalWebhooks 
    : 1;
  
  const slowProcessingRate = stats.summary.totalWebhooks > 0
    ? stats.summary.slowProcessingCount / stats.summary.totalWebhooks
    : 0;
  
  // Determine health status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (successRate < 0.95) {
    status = 'unhealthy';
    issues.push(`Low success rate: ${(successRate * 100).toFixed(1)}%`);
    recommendations.push('Investigate recent webhook failures');
  } else if (successRate < 0.98) {
    status = 'degraded';
    issues.push(`Moderate success rate: ${(successRate * 100).toFixed(1)}%`);
  }
  
  if (slowProcessingRate > 0.1) {
    status = status === 'healthy' ? 'degraded' : status;
    issues.push(`High slow processing rate: ${(slowProcessingRate * 100).toFixed(1)}%`);
    recommendations.push('Optimize webhook processing performance');
  }
  
  if (stats.summary.securityViolations > 10) {
    status = 'degraded';
    issues.push(`Multiple security violations: ${stats.summary.securityViolations}`);
    recommendations.push('Review security monitoring and alerting');
  }
  
  if (stats.activeProcessing > 50) {
    issues.push(`Many active processing sessions: ${stats.activeProcessing}`);
    recommendations.push('Monitor for processing bottlenecks');
  }
  
  return {
    status,
    metrics: stats,
    issues,
    recommendations,
  };
}