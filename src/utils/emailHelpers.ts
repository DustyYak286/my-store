/**
 * Email Notification Utilities
 * 
 * Provides foundational infrastructure for Order Confirmed emails and other
 * transactional email notifications. Designed to be extended with email
 * service providers (SendGrid, AWS SES, Resend, etc.) in the future.
 */

import { Order, OrderStatus } from '@/types/order';
import { monitoring } from '@/utils/monitoring';

/**
 * Email template types
 */
export enum EmailTemplate {
  ORDER_CONFIRMED = 'order_confirmed',
  ORDER_SHIPPED = 'order_shipped',
  ORDER_DELIVERED = 'order_delivered',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_PROCESSED = 'refund_processed',
}

/**
 * Email priority levels
 */
export enum EmailPriority {
  HIGH = 'high',       // Immediate delivery (payment confirmations)
  NORMAL = 'normal',   // Standard delivery (order updates)
  LOW = 'low',         // Batch delivery (marketing emails)
}

/**
 * Email sending result
 */
export interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
  provider?: string;
  timestamp: string;
  retryCount?: number;
}

/**
 * Email request interface
 */
export interface EmailRequest {
  to: string;
  subject: string;
  template: EmailTemplate;
  templateData: Record<string, any>;
  priority?: EmailPriority;
  orderId?: string;
  metadata?: Record<string, any>;
}

/**
 * Email provider interface
 */
export interface EmailProvider {
  name: string;
  sendEmail: (request: EmailRequest) => Promise<EmailResult>;
  validateConfig: () => boolean;
}

/**
 * Email queue entry for batch processing
 */
export interface EmailQueueEntry {
  id: string;
  request: EmailRequest;
  scheduledAt: string;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: string;
  lastError?: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
}

/**
 * Email configuration
 */
export interface EmailConfig {
  enabled: boolean;
  provider: string;
  retryAttempts: number;
  retryDelay: number; // seconds
  batchSize: number;
  queueProcessInterval: number; // seconds
  templates: {
    [key in EmailTemplate]: {
      subject: string;
      enabled: boolean;
    };
  };
}

/**
 * Default email configuration
 */
export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  enabled: false, // Disabled by default until configured
  provider: 'console', // Console provider for development
  retryAttempts: 3,
  retryDelay: 60,
  batchSize: 10,
  queueProcessInterval: 30,
  templates: {
    [EmailTemplate.ORDER_CONFIRMED]: {
      subject: 'Order Confirmation - {{orderNumber}}',
      enabled: true,
    },
    [EmailTemplate.ORDER_SHIPPED]: {
      subject: 'Order Shipped - {{orderNumber}}',
      enabled: true,
    },
    [EmailTemplate.ORDER_DELIVERED]: {
      subject: 'Order Delivered - {{orderNumber}}',
      enabled: true,
    },
    [EmailTemplate.PAYMENT_FAILED]: {
      subject: 'Payment Failed - {{orderNumber}}',
      enabled: true,
    },
    [EmailTemplate.REFUND_PROCESSED]: {
      subject: 'Refund Processed - {{orderNumber}}',
      enabled: true,
    },
  },
};

/**
 * Console email provider for development and testing
 */
export class ConsoleEmailProvider implements EmailProvider {
  name = 'console';

  async sendEmail(request: EmailRequest): Promise<EmailResult> {
    const timestamp = new Date().toISOString();
    
    try {
      console.log('[EMAIL] Email would be sent:', {
        to: request.to,
        subject: request.subject,
        template: request.template,
        priority: request.priority || EmailPriority.NORMAL,
        orderId: request.orderId,
        timestamp,
      });
      
      console.log('[TEMPLATE] Template data:', request.templateData);
      
      return {
        success: true,
        emailId: `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        provider: this.name,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        error: errorMessage,
        provider: this.name,
        timestamp,
      };
    }
  }

  validateConfig(): boolean {
    return true; // Console provider is always available
  }
}

/**
 * Email service class for managing email operations
 */
export class EmailService {
  private config: EmailConfig;
  private provider: EmailProvider;
  private queue: Map<string, EmailQueueEntry> = new Map();

  constructor(config: Partial<EmailConfig> = {}) {
    this.config = { ...DEFAULT_EMAIL_CONFIG, ...config };
    this.provider = new ConsoleEmailProvider(); // Default to console provider
  }

  /**
   * Set email provider
   */
  setProvider(provider: EmailProvider): void {
    if (!provider.validateConfig()) {
      throw new Error(`Email provider ${provider.name} configuration is invalid`);
    }
    this.provider = provider;
  }

  /**
   * Send email immediately
   */
  async sendEmail(request: EmailRequest): Promise<EmailResult> {
    const timestamp = new Date().toISOString();
    
    try {
      // Check if emails are enabled
      if (!this.config.enabled) {
        console.log('[EMAIL] Email sending disabled, would send:', request.subject);
        return {
          success: true,
          emailId: 'disabled',
          provider: 'disabled',
          timestamp,
        };
      }

      // Check if template is enabled
      const templateConfig = this.config.templates[request.template];
      if (!templateConfig?.enabled) {
        console.log(`[EMAIL] Email template ${request.template} disabled, would send:`, request.subject);
        return {
          success: true,
          emailId: 'template_disabled',
          provider: 'disabled',
          timestamp,
        };
      }

      // Process subject template
      const processedSubject = this.processTemplate(templateConfig.subject, request.templateData);
      const processedRequest = {
        ...request,
        subject: processedSubject,
      };

      // Record email attempt
      monitoring.recordEvent('email_send_attempted', {
        template: request.template,
        priority: request.priority || EmailPriority.NORMAL,
        orderId: request.orderId || 'none',
        provider: this.provider.name,
      });

      // Send email
      const result = await this.provider.sendEmail(processedRequest);

      // Record result
      if (result.success) {
        monitoring.recordEvent('email_send_success', {
          template: request.template,
          provider: this.provider.name,
          emailId: result.emailId || 'unknown',
          orderId: request.orderId || 'none',
        });
      } else {
        monitoring.recordEvent('email_send_failed', {
          template: request.template,
          provider: this.provider.name,
          error: result.error || 'unknown',
          orderId: request.orderId || 'none',
        });
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      monitoring.recordEvent('email_send_error', {
        template: request.template,
        error: errorMessage,
        orderId: request.orderId || 'none',
      });

      return {
        success: false,
        error: `Email sending failed: ${errorMessage}`,
        provider: this.provider.name,
        timestamp,
      };
    }
  }

  /**
   * Queue email for batch processing
   */
  queueEmail(request: EmailRequest): string {
    const queueId = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const queueEntry: EmailQueueEntry = {
      id: queueId,
      request,
      scheduledAt: timestamp,
      attempts: 0,
      maxAttempts: this.config.retryAttempts,
      status: 'pending',
    };

    this.queue.set(queueId, queueEntry);

    console.log(`[EMAIL] Email queued: ${queueId} (${request.template})`);

    return queueId;
  }

  /**
   * Process template strings with data
   */
  private processTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key]?.toString() || match;
    });
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    cancelled: number;
  } {
    const entries = Array.from(this.queue.values());
    
    return {
      total: entries.length,
      pending: entries.filter(e => e.status === 'pending').length,
      sending: entries.filter(e => e.status === 'sending').length,
      sent: entries.filter(e => e.status === 'sent').length,
      failed: entries.filter(e => e.status === 'failed').length,
      cancelled: entries.filter(e => e.status === 'cancelled').length,
    };
  }

  /**
   * Clear completed queue entries
   */
  clearCompletedQueue(): number {
    const sizeBefore = this.queue.size;
    
    for (const [id, entry] of this.queue.entries()) {
      if (entry.status === 'sent' || entry.status === 'failed' || entry.status === 'cancelled') {
        this.queue.delete(id);
      }
    }

    const cleared = sizeBefore - this.queue.size;
    if (cleared > 0) {
      console.log(`[EMAIL] Cleared ${cleared} completed email queue entries`);
    }

    return cleared;
  }
}

/**
 * Create Order Confirmed email request
 */
export function createOrderConfirmedEmail(order: Order): EmailRequest {
  return {
    to: order.customer.email,
    subject: `Order Confirmation - ${order.orderNumber}`,
    template: EmailTemplate.ORDER_CONFIRMED,
    priority: EmailPriority.HIGH,
    orderId: order.id,
    templateData: {
      orderNumber: order.orderNumber,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      orderTotal: order.totals.total,
      currency: order.currency.toUpperCase(),
      orderDate: new Date(order.createdAt).toLocaleDateString(),
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      shippingAddress: order.shipping.address,
      billingAddress: order.billing.address,
      paymentMethod: order.payment.method,
      orderStatus: order.status,
    },
    metadata: {
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      source: 'webhook',
    },
  };
}

/**
 * Create Payment Failed email request
 */
export function createPaymentFailedEmail(order: Order, failureReason?: string): EmailRequest {
  return {
    to: order.customer.email,
    subject: `Payment Issue - ${order.orderNumber}`,
    template: EmailTemplate.PAYMENT_FAILED,
    priority: EmailPriority.HIGH,
    orderId: order.id,
    templateData: {
      orderNumber: order.orderNumber,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`,
      orderTotal: order.totals.total,
      currency: order.currency.toUpperCase(),
      failureReason: failureReason || 'Payment could not be processed',
      retryUrl: `/checkout?retry=true&order_id=${order.id}`,
    },
    metadata: {
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      failureReason,
      source: 'webhook',
    },
  };
}

/**
 * Default email service instance
 */
export const emailService = new EmailService();

/**
 * Send Order Confirmed email
 */
export async function sendOrderConfirmedEmail(order: Order): Promise<EmailResult> {
  if (order.status !== OrderStatus.PAID) {
    return {
      success: false,
      error: 'Order is not in PAID status',
      provider: 'validation',
      timestamp: new Date().toISOString(),
    };
  }

  const emailRequest = createOrderConfirmedEmail(order);
  return await emailService.sendEmail(emailRequest);
}

/**
 * Send Payment Failed email
 */
export async function sendPaymentFailedEmail(order: Order, failureReason?: string): Promise<EmailResult> {
  const emailRequest = createPaymentFailedEmail(order, failureReason);
  return await emailService.sendEmail(emailRequest);
}

/**
 * Initialize email service with configuration
 */
export function initializeEmailService(config: Partial<EmailConfig>): void {
  const newService = new EmailService(config);
  
  // Replace the default service
  Object.assign(emailService, newService);
  
  console.log('[EMAIL] Email service initialized with config:', {
    enabled: config.enabled ?? DEFAULT_EMAIL_CONFIG.enabled,
    provider: config.provider ?? DEFAULT_EMAIL_CONFIG.provider,
  });
}