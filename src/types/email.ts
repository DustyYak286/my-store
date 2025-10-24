/**
 * Email-related TypeScript interfaces and types
 */

import { EmailTemplate, EmailPriority, EmailResult } from '@/utils/emailHelpers';

/**
 * Email template data for Order Confirmed emails
 */
export interface OrderConfirmedTemplateData {
  orderNumber: string;
  customerName: string;
  orderTotal: number;
  currency: string;
  orderDate: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    state?: string;
    zipCode: string;
    country: string;
  };
  billingAddress: {
    street: string;
    city: string;
    state?: string;
    zipCode: string;
    country: string;
  };
  paymentMethod: string;
  orderStatus: string;
}

/**
 * Email template data for Payment Failed emails
 */
export interface PaymentFailedTemplateData {
  orderNumber: string;
  customerName: string;
  orderTotal: number;
  currency: string;
  failureReason: string;
  retryUrl: string;
}

/**
 * Email template data for Order Shipped emails
 */
export interface OrderShippedTemplateData {
  orderNumber: string;
  customerName: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  estimatedDelivery?: string;
  trackingUrl?: string;
}

/**
 * Email template data for Order Delivered emails
 */
export interface OrderDeliveredTemplateData {
  orderNumber: string;
  customerName: string;
  deliveredDate: string;
  deliveredLocation?: string;
  feedbackUrl?: string;
}

/**
 * Email template data for Refund Processed emails
 */
export interface RefundProcessedTemplateData {
  orderNumber: string;
  customerName: string;
  refundAmount: number;
  currency: string;
  refundReason?: string;
  processingTime: string;
}

/**
 * Union type for all template data
 */
export type EmailTemplateData = 
  | OrderConfirmedTemplateData
  | PaymentFailedTemplateData
  | OrderShippedTemplateData
  | OrderDeliveredTemplateData
  | RefundProcessedTemplateData;

/**
 * Email statistics for monitoring
 */
export interface EmailStats {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  templateStats: {
    [key in EmailTemplate]?: {
      sent: number;
      failed: number;
      successRate: number;
    };
  };
  providerStats: {
    [provider: string]: {
      sent: number;
      failed: number;
      successRate: number;
    };
  };
}

/**
 * Email audit log entry
 */
export interface EmailAuditEntry {
  id: string;
  timestamp: string;
  template: EmailTemplate;
  recipient: string;
  subject: string;
  status: 'sent' | 'failed' | 'queued' | 'cancelled';
  provider: string;
  emailId?: string;
  error?: string;
  orderId?: string;
  retryCount?: number;
  metadata?: Record<string, any>;
}

/**
 * Email provider configuration interface
 */
export interface EmailProviderConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  webhookEndpoint?: string;
  customConfig?: Record<string, any>;
}

/**
 * Supported email providers
 */
export enum EmailProviders {
  CONSOLE = 'console',
  SENDGRID = 'sendgrid',
  AWS_SES = 'aws_ses',
  RESEND = 'resend',
  NODEMAILER = 'nodemailer',
  POSTMARK = 'postmark',
}

/**
 * Email webhook event types
 */
export enum EmailWebhookEvent {
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  SPAM = 'spam',
  UNSUBSCRIBED = 'unsubscribed',
  FAILED = 'failed',
}

/**
 * Email webhook payload
 */
export interface EmailWebhookPayload {
  emailId: string;
  event: EmailWebhookEvent;
  timestamp: string;
  recipient: string;
  provider: string;
  metadata?: Record<string, any>;
  errorMessage?: string;
  bounceReason?: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Email template renderer interface
 */
export interface EmailTemplateRenderer {
  renderSubject(template: EmailTemplate, data: EmailTemplateData): string;
  renderHtml(template: EmailTemplate, data: EmailTemplateData): string;
  renderText(template: EmailTemplate, data: EmailTemplateData): string;
}

/**
 * Email delivery options
 */
export interface EmailDeliveryOptions {
  sendAt?: Date; // Schedule for future delivery
  timezone?: string;
  tags?: string[];
  customHeaders?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  replyTo?: string;
  priority?: EmailPriority;
}

/**
 * Bulk email request for batch operations
 */
export interface BulkEmailRequest {
  template: EmailTemplate;
  recipients: Array<{
    email: string;
    templateData: EmailTemplateData;
    orderId?: string;
  }>;
  options?: EmailDeliveryOptions;
  batchSize?: number;
  delayBetweenBatches?: number; // milliseconds
}

/**
 * Email A/B testing configuration
 */
export interface EmailABTest {
  id: string;
  name: string;
  template: EmailTemplate;
  variants: Array<{
    id: string;
    name: string;
    weight: number; // percentage
    subjectLine?: string;
    customData?: Record<string, any>;
  }>;
  startDate: Date;
  endDate?: Date;
  enabled: boolean;
}