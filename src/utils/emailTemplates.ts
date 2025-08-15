/**
 * Email Template Renderer
 * 
 * Handles loading and rendering of email templates with data substitution.
 * Supports both HTML and text templates with Handlebars-like syntax.
 */

import { EmailTemplate } from '@/utils/emailHelpers';
import { EmailTemplateData } from '@/types/email';

/**
 * Template cache to avoid repeated file reads
 */
const templateCache = new Map<string, string>();

/**
 * Simple template engine for email templates
 * Supports {{variable}} substitution and basic {{#each}} loops
 */
export class EmailTemplateRenderer {
  /**
   * Render template with data
   */
  static render(template: string, data: Record<string, any>): string {
    let rendered = template;

    // Handle {{#each}} blocks
    rendered = rendered.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
      const array = data[arrayName];
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map(item => {
        return this.render(content, { ...data, ...item });
      }).join('');
    });

    // Handle simple {{variable}} substitution
    rendered = rendered.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value !== undefined && value !== null ? String(value) : match;
    });

    return rendered;
  }

  /**
   * Get nested object value by path (e.g., "user.name" -> data.user.name)
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Render email subject
   */
  static renderSubject(template: EmailTemplate, data: EmailTemplateData): string {
    const templates = {
      [EmailTemplate.ORDER_CONFIRMED]: 'Order Confirmation - {{orderNumber}}',
      [EmailTemplate.ORDER_SHIPPED]: 'Order Shipped - {{orderNumber}}',
      [EmailTemplate.ORDER_DELIVERED]: 'Order Delivered - {{orderNumber}}',
      [EmailTemplate.PAYMENT_FAILED]: 'Payment Issue - {{orderNumber}}',
      [EmailTemplate.REFUND_PROCESSED]: 'Refund Processed - {{orderNumber}}',
    };

    const subjectTemplate = templates[template];
    if (!subjectTemplate) {
      throw new Error(`No subject template found for ${template}`);
    }

    return this.render(subjectTemplate, data as Record<string, any>);
  }

  /**
   * Render HTML email template
   */
  static renderHtml(template: EmailTemplate, data: EmailTemplateData): string {
    const htmlTemplate = this.getHtmlTemplate(template);
    return this.render(htmlTemplate, data as Record<string, any>);
  }

  /**
   * Render text email template
   */
  static renderText(template: EmailTemplate, data: EmailTemplateData): string {
    // For now, create a simple text version from HTML
    // In production, you'd want dedicated text templates
    const html = this.renderHtml(template, data);
    
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Get HTML template content
   */
  private static getHtmlTemplate(template: EmailTemplate): string {
    const cacheKey = `html_${template}`;
    
    if (templateCache.has(cacheKey)) {
      return templateCache.get(cacheKey)!;
    }

    // In a real implementation, you'd read from files or a template service
    // For now, return inline templates
    const templates = {
      [EmailTemplate.ORDER_CONFIRMED]: this.getOrderConfirmedHtml(),
      [EmailTemplate.PAYMENT_FAILED]: this.getPaymentFailedHtml(),
      [EmailTemplate.ORDER_SHIPPED]: this.getOrderShippedHtml(),
      [EmailTemplate.ORDER_DELIVERED]: this.getOrderDeliveredHtml(),
      [EmailTemplate.REFUND_PROCESSED]: this.getRefundProcessedHtml(),
    };

    const htmlTemplate = templates[template];
    if (!htmlTemplate) {
      throw new Error(`No HTML template found for ${template}`);
    }

    templateCache.set(cacheKey, htmlTemplate);
    return htmlTemplate;
  }

  /**
   * Get Order Confirmed HTML template
   */
  private static getOrderConfirmedHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Order Confirmation - {{orderNumber}}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">✅ Order Confirmed!</h1>
        <p style="margin: 10px 0 0 0;">Thank you for your order, {{customerName}}</p>
    </div>
    
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #1e40af;">Order #{{orderNumber}}</h2>
            <p style="margin: 0;"><strong>Order Date:</strong> {{orderDate}}</p>
            <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #059669;">Total: {{orderTotal}} {{currency}}</p>
        </div>
        
        <h3>Order Items:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background-color: #f9fafb;">
                    <th style="text-align: left; padding: 10px; border: 1px solid #e5e7eb;">Item</th>
                    <th style="text-align: left; padding: 10px; border: 1px solid #e5e7eb;">Qty</th>
                    <th style="text-align: left; padding: 10px; border: 1px solid #e5e7eb;">Price</th>
                </tr>
            </thead>
            <tbody>
                {{#each items}}
                <tr>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{name}}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{quantity}}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">{{price}}</td>
                </tr>
                {{/each}}
            </tbody>
        </table>
        
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #065f46;">What's Next?</h4>
            <ul style="margin: 0; color: #047857;">
                <li>We'll process your order within 1-2 business days</li>
                <li>You'll receive shipping updates via email</li>
                <li>Track your order anytime with the order number above</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{trackOrderUrl}}" style="background-color: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold;">Track Your Order</a>
        </div>
    </div>
    
    <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
        <p>Need help? Contact us at <a href="mailto:support@mystore.com">support@mystore.com</a></p>
        <p>© 2024 My Store. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Get Payment Failed HTML template
   */
  private static getPaymentFailedHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Payment Issue - {{orderNumber}}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">⚠️ Payment Issue</h1>
        <p style="margin: 10px 0 0 0;">Hi {{customerName}}, we had trouble processing your payment</p>
    </div>
    
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #b91c1c;">Order #{{orderNumber}}</h2>
            <p style="margin: 0;"><strong>Amount:</strong> {{orderTotal}} {{currency}}</p>
            <p style="margin: 10px 0 0 0; color: #7f1d1d;"><strong>Issue:</strong> {{failureReason}}</p>
        </div>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #065f46;">Ready to Complete Your Order?</h3>
            <p style="margin: 0 0 20px 0; color: #047857;">Don't worry! Your items are still reserved.</p>
            <a href="{{retryUrl}}" style="background-color: #059669; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">Complete Payment</a>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">Common Solutions:</h4>
            <ul style="margin: 0; color: #6b7280;">
                <li>Check that your card details are entered correctly</li>
                <li>Ensure you have sufficient funds available</li>
                <li>Try a different payment method</li>
                <li>Contact your bank if the issue persists</li>
            </ul>
        </div>
    </div>
    
    <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
        <p>Need help? Email <a href="mailto:support@mystore.com">support@mystore.com</a> or call <strong>1-800-SUPPORT</strong></p>
        <p>© 2024 My Store. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Get Order Shipped HTML template
   */
  private static getOrderShippedHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Order Shipped - {{orderNumber}}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #0891b2; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">📦 Order Shipped!</h1>
        <p style="margin: 10px 0 0 0;">Your order is on its way, {{customerName}}</p>
    </div>
    
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #0c4a6e;">Order #{{orderNumber}}</h2>
            {{#if trackingNumber}}<p style="margin: 0;"><strong>Tracking Number:</strong> {{trackingNumber}}</p>{{/if}}
            {{#if shippingCarrier}}<p style="margin: 5px 0 0 0;"><strong>Carrier:</strong> {{shippingCarrier}}</p>{{/if}}
            {{#if estimatedDelivery}}<p style="margin: 5px 0 0 0;"><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>{{/if}}
        </div>
        
        {{#if trackingUrl}}
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{trackingUrl}}" style="background-color: #0891b2; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold;">Track Package</a>
        </div>
        {{/if}}
    </div>
    
    <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
        <p>Questions? Contact us at <a href="mailto:support@mystore.com">support@mystore.com</a></p>
        <p>© 2024 My Store. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Get Order Delivered HTML template
   */
  private static getOrderDeliveredHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Order Delivered - {{orderNumber}}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #059669; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">🎉 Order Delivered!</h1>
        <p style="margin: 10px 0 0 0;">Your order has been delivered, {{customerName}}</p>
    </div>
    
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #065f46;">Order #{{orderNumber}}</h2>
            <p style="margin: 0;"><strong>Delivered:</strong> {{deliveredDate}}</p>
            {{#if deliveredLocation}}<p style="margin: 5px 0 0 0;"><strong>Location:</strong> {{deliveredLocation}}</p>{{/if}}
        </div>
        
        {{#if feedbackUrl}}
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{feedbackUrl}}" style="background-color: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: bold;">Leave Feedback</a>
        </div>
        {{/if}}
    </div>
    
    <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
        <p>Thank you for shopping with us!</p>
        <p>© 2024 My Store. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Get Refund Processed HTML template
   */
  private static getRefundProcessedHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Refund Processed - {{orderNumber}}</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #7c3aed; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0;">💰 Refund Processed</h1>
        <p style="margin: 10px 0 0 0;">Your refund has been processed, {{customerName}}</p>
    </div>
    
    <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">
        <div style="background-color: #faf5ff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; color: #6b21a8;">Order #{{orderNumber}}</h2>
            <p style="margin: 0;"><strong>Refund Amount:</strong> {{refundAmount}} {{currency}}</p>
            {{#if refundReason}}<p style="margin: 5px 0 0 0;"><strong>Reason:</strong> {{refundReason}}</p>{{/if}}
            <p style="margin: 5px 0 0 0;"><strong>Processing Time:</strong> {{processingTime}}</p>
        </div>
        
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #0c4a6e;">What's Next?</h4>
            <p style="margin: 0; color: #075985;">The refund will appear in your original payment method within 3-5 business days.</p>
        </div>
    </div>
    
    <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
        <p>Questions? Contact us at <a href="mailto:support@mystore.com">support@mystore.com</a></p>
        <p>© 2024 My Store. All rights reserved.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Clear template cache
   */
  static clearCache(): void {
    templateCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: templateCache.size,
      keys: Array.from(templateCache.keys()),
    };
  }
}