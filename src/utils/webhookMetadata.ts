/**
 * Webhook Metadata Utilities
 * 
 * Helper functions for extracting and validating metadata from Stripe webhook events
 * containing Payment Intent data for webhook processing.
 */

export interface WebhookMetadata {
  // Core identifiers
  orderId: string;
  orderNumber: string;
  requestId: string;
  
  // Customer information
  customerEmail: string;
  customerName: string;
  
  // Order details
  itemCount: string;
  orderTotal: string; // Amount in bani (smallest currency unit)
  currency: string;
  
  // Session tracking
  clientRequestId?: string;
  sessionId?: string;
  
  // Processing flags
  webhookVersion: string;
  requiresFulfillment: string; // 'true' | 'false'
  orderSource: string;
  
  // Additional context
  userAgent?: string;
  clientIp?: string;
  hasGiftMessage?: string; // 'true' if present
  hasSpecialInstructions?: string; // 'true' if present
  
  // Environment
  environment: string;
  timestamp: string;
}

/**
 * Extract webhook metadata from Stripe Payment Intent object
 * @param paymentIntent Stripe Payment Intent object from webhook
 * @returns Parsed webhook metadata or null if invalid
 */
export function extractWebhookMetadata(paymentIntent: any): WebhookMetadata | null {
  try {
    const metadata = paymentIntent?.metadata;
    
    if (!metadata || typeof metadata !== 'object') {
      console.error('❌ Webhook metadata missing or invalid');
      return null;
    }
    
    // Validate required fields
    const requiredFields = ['orderId', 'orderNumber', 'customerEmail', 'webhookVersion'];
    const missingFields = requiredFields.filter(field => !metadata[field]);
    
    if (missingFields.length > 0) {
      console.error(`❌ Webhook metadata missing required fields: ${missingFields.join(', ')}`);
      return null;
    }
    
    return metadata as WebhookMetadata;
  } catch (error) {
    console.error('❌ Error extracting webhook metadata:', error);
    return null;
  }
}

/**
 * Validate webhook metadata version compatibility
 * @param metadata Webhook metadata object
 * @returns True if version is compatible
 */
export function isWebhookVersionCompatible(metadata: WebhookMetadata): boolean {
  const supportedVersions = ['1.0'];
  return supportedVersions.includes(metadata.webhookVersion);
}

/**
 * Check if order requires fulfillment based on metadata
 * @param metadata Webhook metadata object
 * @returns True if order needs fulfillment
 */
export function requiresFulfillment(metadata: WebhookMetadata): boolean {
  return metadata.requiresFulfillment === 'true';
}

/**
 * Get order preferences from webhook metadata
 * @param metadata Webhook metadata object
 * @returns Order preferences object
 */
export function getOrderPreferences(metadata: WebhookMetadata): {
  hasGiftMessage: boolean;
  hasSpecialInstructions: boolean;
} {
  return {
    hasGiftMessage: metadata.hasGiftMessage === 'true',
    hasSpecialInstructions: metadata.hasSpecialInstructions === 'true',
  };
}

/**
 * Format order total from metadata (converts bani to RON)
 * @param metadata Webhook metadata object
 * @returns Order total in RON as number
 */
export function getOrderTotalInRON(metadata: WebhookMetadata): number {
  const totalInBani = parseInt(metadata.orderTotal, 10);
  return totalInBani / 100; // Convert bani to RON
}

/**
 * Log webhook processing information for debugging
 * @param metadata Webhook metadata object
 * @param eventType Stripe event type
 * @param eventId Stripe event ID
 */
export function logWebhookProcessing(
  metadata: WebhookMetadata, 
  eventType: string, 
  eventId: string
): void {
  console.log(`🪝 Processing webhook: ${eventType}`);
  console.log(`   Event ID: ${eventId}`);
  console.log(`   Order ID: ${metadata.orderId}`);
  console.log(`   Order Number: ${metadata.orderNumber}`);
  console.log(`   Customer: ${metadata.customerEmail}`);
  console.log(`   Amount: ${getOrderTotalInRON(metadata)} RON`);
  console.log(`   Requires Fulfillment: ${requiresFulfillment(metadata)}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`   Full Metadata:`, JSON.stringify(metadata, null, 2));
  }
}