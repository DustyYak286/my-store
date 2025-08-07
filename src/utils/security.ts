import { headers } from "next/headers";

/**
 * Security utilities for enhanced protection
 */

/**
 * Generate cryptographically secure nonce for CSP
 * Compatible with Next.js edge runtime
 */
export function generateNonce(): string {
  // Use Web Crypto API when available (edge runtime)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for Node.js environments
  try {
    const cryptoNode = require('crypto');
    return cryptoNode.randomBytes(16).toString('base64');
  } catch {
    // Ultimate fallback (should not happen in production)
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

/**
 * Generate unique request ID for tracking and monitoring
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function getEnvironmentConfig() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  return { isDevelopment, isProduction };
}

/**
 * Generate Content Security Policy with environment-specific rules
 */
export function generateCSP(nonce?: string): string {
  const { isDevelopment, isProduction } = getEnvironmentConfig();
  
  const baseCSP = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", 'fonts.googleapis.com'],
    'font-src': ["'self'", 'fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
  };

  // Development-specific CSP (more permissive for HMR)
  if (isDevelopment) {
    baseCSP['script-src'].push("'unsafe-inline'", "'unsafe-eval'");
    baseCSP['style-src'].push("'unsafe-inline'");
    baseCSP['connect-src'].push('ws:', 'wss:'); // For HMR
  }

  // Production-specific CSP (stricter)
  if (isProduction && nonce) {
    baseCSP['script-src'].push(`'nonce-${nonce}'`);
    baseCSP['style-src'].push(`'nonce-${nonce}'`);
  } else if (isProduction) {
    // Fallback for production without nonce
    baseCSP['script-src'].push("'unsafe-inline'");
    baseCSP['style-src'].push("'unsafe-inline'");
  }

  // Convert to CSP string
  return Object.entries(baseCSP)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Generate Permissions Policy for enhanced privacy
 */
export function generatePermissionsPolicy(): string {
  return [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'navigation-override=()',
    'payment=(self)', // Allow for e-commerce
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()',
  ].join(', ');
}

/**
 * Security headers for API routes
 */
export function getAPISecurityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      "script-src 'none'",
      "style-src 'none'",
      "img-src 'none'",
      "font-src 'none'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };
}

/**
 * Get current nonce from headers (for RSC)
 */
export async function getCurrentNonce(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get('x-nonce') || undefined;
  } catch {
    return undefined;
  }
}