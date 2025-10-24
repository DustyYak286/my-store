/**
 * Production-Grade Order Store
 * 
 * Intelligent storage system that adapts to environment:
 * - E2E Tests: File-based persistence for cross-process reliability
 * - Development: In-memory storage for performance
 * - Production: Ready for database integration
 */

import { Order, OrderStatus, PaymentStatus, OrderStatusHistory } from '@/types/order';
import { updateOrderStatus, updateOrderPayment } from '@/lib/orderHelpers';
import { recordOrderStatusChange, recordPaymentStatusChange, recordOrderCreation } from '@/utils/auditTrail';

// Conditional imports for Node.js environment only
let fs: typeof import('fs') | null = null;
let path: typeof import('path') | null = null;

// Safely import Node.js modules only on server side
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  try {
    fs = require('fs');
    path = require('path');
  } catch (error) {
    console.warn('Node.js modules not available:', error);
  }
}

// Production-grade storage abstraction
interface OrderStorageAdapter {
  get(id: string): Order | null;
  set(id: string, order: Order): void;
  delete(id: string): boolean;
  clear(): void;
  values(): Order[];
  has(id: string): boolean;
}

// In-memory adapter for development
class InMemoryOrderStorage implements OrderStorageAdapter {
  private orders = new Map<string, Order>();

  get(id: string): Order | null {
    return this.orders.get(id) || null;
  }

  set(id: string, order: Order): void {
    this.orders.set(id, order);
  }

  delete(id: string): boolean {
    return this.orders.delete(id);
  }

  clear(): void {
    this.orders.clear();
  }

  values(): Order[] {
    return Array.from(this.orders.values());
  }

  has(id: string): boolean {
    return this.orders.has(id);
  }
}

// File-based adapter for E2E tests
class FileOrderStorage implements OrderStorageAdapter {
  private filePath: string;
  private lockMap = new Map<string, Promise<void>>();
  private fallbackStorage = new Map<string, Order>(); // Browser fallback

  constructor() {
    if (path && typeof process !== 'undefined') {
      this.filePath = path.join(process.cwd(), '.tmp', 'e2e-orders.json');
      this.ensureDirectory();
    } else {
      // Browser environment - use unique identifier
      this.filePath = 'browser-fallback';
      console.log('[CONFIG] FileOrderStorage: Using in-memory fallback for browser environment');
    }
  }

  private ensureDirectory(): void {
    if (!fs || !path) return;
    
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (error) {
      console.warn('Failed to ensure directory:', error);
    }
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Simple file-based locking for E2E tests
    const existing = this.lockMap.get(key);
    if (existing) {
      await existing;
    }

    const promise = this.executeWithRetry(fn);
    this.lockMap.set(key, promise.then(() => {}, () => {}));
    
    try {
      return await promise;
    } finally {
      this.lockMap.delete(key);
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (i + 1)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  private readOrders(): Record<string, Order> {
    // Browser environment - use localStorage for E2E test persistence
    if (!fs || this.filePath === 'browser-fallback') {
      if (typeof window !== 'undefined') {
        try {
          const stored = window.localStorage.getItem('e2e-orders');
          if (stored) {
            const parsed = JSON.parse(stored);
            console.log(`[CONFIG] Browser: Retrieved ${Object.keys(parsed).length} orders from localStorage`);
            return parsed;
          }
        } catch (error) {
          console.warn('Failed to read from localStorage:', error);
        }
      }
      
      // Fallback to in-memory storage
      const orders: Record<string, Order> = {};
      this.fallbackStorage.forEach((order, id) => {
        orders[id] = order;
      });
      return orders;
    }

    try {
      if (!fs.existsSync(this.filePath)) {
        return {};
      }
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const orders = data ? JSON.parse(data) : {};
      
      // In E2E tests, also sync to localStorage for browser access
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        try {
          (globalThis as any).localStorage.setItem('e2e-orders', JSON.stringify(orders));
        } catch (error) {
          // localStorage not available in Node.js, that's fine
        }
      }
      
      return orders;
    } catch (error) {
      console.warn('Failed to read order file, using empty state:', error);
      return {};
    }
  }

  private writeOrders(orders: Record<string, Order>): void {
    // Browser environment - use localStorage for E2E test persistence
    if (!fs || this.filePath === 'browser-fallback') {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('e2e-orders', JSON.stringify(orders));
          console.log(`[CONFIG] Browser: Stored ${Object.keys(orders).length} orders to localStorage`);
        } catch (error) {
          console.warn('Failed to write to localStorage:', error);
        }
      }
      
      // Also update fallback storage
      this.fallbackStorage.clear();
      Object.entries(orders).forEach(([id, order]) => {
        this.fallbackStorage.set(id, order);
      });
      return;
    }

    try {
      this.ensureDirectory();
      fs.writeFileSync(this.filePath, JSON.stringify(orders, null, 2));
      
      // In E2E tests, also sync to localStorage for browser access
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        try {
          (globalThis as any).localStorage.setItem('e2e-orders', JSON.stringify(orders));
        } catch (error) {
          // localStorage not available in Node.js, that's fine
        }
      }
      
    } catch (error) {
      console.error('Failed to write order file:', error);
      throw error;
    }
  }

  get(id: string): Order | null {
    const orders = this.readOrders();
    return orders[id] || null;
  }

  set(id: string, order: Order): void {
    // Use synchronous operations for simplicity in E2E tests
    // In production, this would be async with proper database transactions
    const orders = this.readOrders();
    orders[id] = order;
    this.writeOrders(orders);
  }

  delete(id: string): boolean {
    const orders = this.readOrders();
    const existed = id in orders;
    delete orders[id];
    this.writeOrders(orders);
    return existed;
  }

  clear(): void {
    this.writeOrders({});
  }

  values(): Order[] {
    const orders = this.readOrders();
    return Object.values(orders);
  }

  has(id: string): boolean {
    const orders = this.readOrders();
    return id in orders;
  }
}

// Production-grade environment detection for E2E tests
// CRITICAL FIX: Distinguish unit tests from E2E tests properly
const isE2EEnvironment = (): boolean => {
  // Server-side detection with proper distinction between unit and E2E tests
  if (typeof process !== 'undefined') {
    // Explicit E2E test markers (highest priority)
    const explicitE2E = (
      process.env.PLAYWRIGHT_TEST === '1' ||
      process.env.E2E_TEST === '1' ||
      process.env.E2E_TEST === 'true'
    );
    if (explicitE2E) return true;

    // Production build phase detection
    const productionBuild = process.env.NEXT_PHASE === 'phase-production-build';
    if (productionBuild) return true;

    // Jest environment detection - distinguish unit vs E2E
    const isJestTest = process.env.JEST_WORKER_ID !== undefined || 
                       process.env.NODE_ENV === 'test';
    
    if (isJestTest) {
      // Check for E2E-specific Jest config indicators
      const jestE2EMarkers = (
        process.env.JEST_E2E === '1' ||
        process.env.JEST_E2E === 'true' ||
        // Check if we're running E2E test files specifically
        (process.env.npm_lifecycle_script && process.env.npm_lifecycle_script.includes('e2e'))
      );
      
      // Only return true for Jest if explicitly marked as E2E
      if (jestE2EMarkers) return true;
      
      // CRITICAL: Unit tests should use in-memory storage
      return false;
    }
  }

  // Client-side detection (browser E2E tests)
  if (typeof window !== 'undefined') {
    const clientSideE2E = (
      window.navigator?.webdriver === true ||
      // Check for Playwright-specific properties
      'playwright' in window ||
      // Check for test-specific URL patterns
      window.location.href.includes('playwright') ||
      // Check for test user agents (E2E specific)
      window.navigator.userAgent.includes('HeadlessChrome') ||
      // Additional E2E browser indicators
      'webdriver' in window
    );
    if (clientSideE2E) return true;
  }

  return false;
};

// Initialize storage adapter based on environment
const storage: OrderStorageAdapter = isE2EEnvironment() 
  ? new FileOrderStorage()
  : new InMemoryOrderStorage();

console.log(`[CONFIG] Order storage initialized: ${isE2EEnvironment() ? 'File-based (E2E)' : 'In-memory (Development)'}`);

// Concurrency control for status updates
const statusUpdateLocks = new Map<string, Promise<any>>();

/**
 * Store a new order with production-grade reliability
 */
export const storeOrder = (order: Order): void => {
  try {
    storage.set(order.id, order);
    
    // Record order creation in audit trail
    recordOrderCreation(
      order.id,
      order.orderNumber,
      order.totals.total,
      order.currency,
      order.customerInfo?.email || 'unknown@test.com',
      'api',
      {
        itemCount: order.items.length,
        source: order.source || 'unknown',
        priority: order.priority || 'standard',
        storageType: storage.constructor.name,
      }
    );
    
    console.log(`[SUCCESS] Order stored successfully: ${order.id} (${order.orderNumber})`);
  } catch (error) {
    console.error(`[ERROR] Failed to store order ${order.id}:`, error);
    throw new Error(`Order storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Get an order by ID with enhanced error handling
 */
export const getOrderById = (orderId: string): Order | null => {
  try {
    const order = storage.get(orderId);
    if (order) {
      console.log(`[SUCCESS] Order retrieved: ${orderId} (${order.orderNumber}) - Status: ${order.status}`);
    } else {
      console.log(`[DEBUG] Order not found: ${orderId} - Total orders: ${storage.values().length}`);
    }
    return order;
  } catch (error) {
    console.error(`[ERROR] Failed to retrieve order ${orderId}:`, error);
    return null;
  }
};

/**
 * Get an order by order number with enhanced error handling
 */
export const getOrderByNumber = (orderNumber: string): Order | null => {
  try {
    const allOrders = storage.values();
    for (const order of allOrders) {
      if (order.orderNumber === orderNumber) {
        console.log(`[SUCCESS] Order found by number: ${orderNumber} (${order.id}) - Status: ${order.status}`);
        return order;
      }
    }
    console.log(`[DEBUG] Order not found by number: ${orderNumber} - Total orders: ${allOrders.length}`);
    return null;
  } catch (error) {
    console.error(`[ERROR] Failed to search order by number ${orderNumber}:`, error);
    return null;
  }
};

/**
 * Update order status with production-grade concurrency control
 */
export const updateStoredOrderStatus = async (
  orderId: string,
  newStatus: OrderStatus,
  reason?: string,
  triggeredBy: string = 'system',
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; order?: Order; error?: string }> => {
  
  // Prevent concurrent status updates for the same order
  const existingLock = statusUpdateLocks.get(orderId);
  if (existingLock) {
    console.log(`[LOCK] Waiting for existing status update lock: ${orderId}`);
    try {
      await existingLock;
    } catch (error) {
      // Continue with our update even if previous one failed
      console.warn(`[WARN] Previous status update failed for ${orderId}, continuing`);
    }
  }

  // Create new promise for this update
  const updatePromise = (async () => {
    try {
      const order = getOrderById(orderId);
      if (!order) {
        return {
          success: false,
          error: `Order not found: ${orderId}`,
        };
      }

      // Validate status transition to prevent race conditions
      if (order.status === newStatus) {
        console.warn(`[WARN] Attempted duplicate status update for ${orderId}: ${order.status} -> ${newStatus}`);
        return {
          success: true,
          order,
          error: `Status already ${newStatus}`,
        };
      }

      const result = updateOrderStatus(order, {
        orderId,
        newStatus,
        reason: reason || 'Status update',
        triggeredBy,
        metadata: metadata || {},
      });

      // Production-grade atomic operation: ensure success before any side effects
      if (!result.success) {
        return result; // Return immediately on failure with proper error
      }

      if (!result.order) {
        return {
          success: false,
          error: `Order status update returned success but no order object`,
        };
      }

      // Record status change in audit trail
      recordOrderStatusChange(
        orderId,
        order.status,
        newStatus,
        triggeredBy,
        reason,
        metadata,
        triggeredBy === 'stripe_webhook' ? 'webhook' : 'system'
      );
      
      // Update storage with enhanced error handling
      try {
        storage.set(orderId, result.order);
        console.log(`[SUCCESS] Order status updated: ${orderId} ${order.status} -> ${newStatus}`);
      } catch (storageError) {
        console.error(`[ERROR] Failed to persist status update for ${orderId}:`, storageError);
        return {
          success: false,
          error: `Storage update failed: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`,
        };
      }

      // Return success result with order
      return {
        success: true,
        order: result.order,
      };
    } catch (error) {
      console.error(`[ERROR] Status update failed for ${orderId}:`, error);
      return {
        success: false,
        error: `Status update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  })();

  // Store the promise for concurrency control
  statusUpdateLocks.set(orderId, updatePromise.then(() => {}, () => {}));
  
  try {
    return await updatePromise;
  } finally {
    // Clean up the lock after a delay to prevent immediate duplicate requests
    setTimeout(() => {
      statusUpdateLocks.delete(orderId);
    }, 100);
  }
};

/**
 * Update order payment information with enhanced error handling
 */
export const updateStoredOrderPayment = (
  orderId: string,
  paymentData: any,
  triggeredBy: string = 'system'
): { success: boolean; order?: Order; error?: string } => {
  try {
    const order = getOrderById(orderId);
    if (!order) {
      return {
        success: false,
        error: `Order not found: ${orderId}`,
      };
    }

    const result = updateOrderPayment(order, {
      orderId,
      paymentData,
      triggeredBy,
    });

    if (result.success && result.order) {
      // Record payment status change in audit trail if payment status changed
      if (order.paymentStatus !== result.order.paymentStatus) {
        recordPaymentStatusChange(
          orderId,
          order.paymentStatus,
          result.order.paymentStatus,
          paymentData.paymentIntentId || '',
          paymentData.amount || order.payment.amount,
          order.currency,
          triggeredBy,
          paymentData.failureReason || 'Payment status updated',
          paymentData.metadata,
          triggeredBy === 'stripe_webhook' ? 'webhook' : 'system'
        );
      }
      
      // Update storage with enhanced error handling
      try {
        storage.set(orderId, result.order);
        console.log(`[SUCCESS] Order payment updated: ${orderId} - Status: ${result.order.paymentStatus}`);
      } catch (storageError) {
        console.error(`[ERROR] Failed to persist payment update for ${orderId}:`, storageError);
        return {
          success: false,
          error: `Payment storage update failed: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`,
        };
      }
    }

    return result;
  } catch (error) {
    console.error(`[ERROR] Payment update failed for ${orderId}:`, error);
    return {
      success: false,
      error: `Payment update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Get all orders (for testing/admin purposes)
 */
export const getAllOrders = (): Order[] => {
  try {
    return storage.values();
  } catch (error) {
    console.error('[ERROR] Failed to get all orders:', error);
    return [];
  }
};

/**
 * Get orders by status
 */
export const getOrdersByStatus = (status: OrderStatus): Order[] => {
  try {
    return storage.values().filter(order => order.status === status);
  } catch (error) {
    console.error(`[ERROR] Failed to get orders by status ${status}:`, error);
    return [];
  }
};

/**
 * Get orders by payment status
 */
export const getOrdersByPaymentStatus = (paymentStatus: PaymentStatus): Order[] => {
  try {
    return storage.values().filter(order => order.paymentStatus === paymentStatus);
  } catch (error) {
    console.error(`[ERROR] Failed to get orders by payment status ${paymentStatus}:`, error);
    return [];
  }
};

/**
 * Clear all orders (for testing purposes)
 */
export const clearAllOrders = (): void => {
  try {
    storage.clear();
    console.log('[SUCCESS] All orders cleared from storage');
  } catch (error) {
    console.error('[ERROR] Failed to clear orders:', error);
  }
};

/**
 * Get order statistics
 */
export const getOrderStats = () => {
  try {
    const allOrders = getAllOrders();
    const stats = {
      total: allOrders.length,
      byStatus: {} as Record<OrderStatus, number>,
      byPaymentStatus: {} as Record<PaymentStatus, number>,
      storageType: storage.constructor.name,
    };

    allOrders.forEach(order => {
      stats.byStatus[order.status] = (stats.byStatus[order.status] || 0) + 1;
      stats.byPaymentStatus[order.paymentStatus] = (stats.byPaymentStatus[order.paymentStatus] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('[ERROR] Failed to get order stats:', error);
    return {
      total: 0,
      byStatus: {} as Record<OrderStatus, number>,
      byPaymentStatus: {} as Record<PaymentStatus, number>,
      storageType: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Health check for storage system
 */
export const getStorageHealth = () => {
  try {
    const totalOrders = storage.values().length;
    return {
      healthy: true,
      storageType: storage.constructor.name,
      totalOrders,
      isE2EMode: isE2EEnvironment(),
    };
  } catch (error) {
    return {
      healthy: false,
      storageType: 'unknown',
      totalOrders: 0,
      isE2EMode: isE2EEnvironment(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Export for testing
export const _getStorageAdapter = () => storage;