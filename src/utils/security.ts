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
    'script-src': [
      "'self'",
      'https://js.stripe.com',
      'https://*.stripe.com',
      'https://stripe.com',
      'https://checkout.stripe.com',
      'https://js.hcaptcha.com',
      'https://*.hcaptcha.com',
      'https://hcaptcha.com',
      'https://newassets.hcaptcha.com'
    ],
    'style-src': [
      "'self'",
      'fonts.googleapis.com',
      'https://*.stripe.com',
      'https://stripe.com',
      'https://*.hcaptcha.com',
      'https://hcaptcha.com'
    ],
    'font-src': ["'self'", 'fonts.gstatic.com'],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      // Stripe image sources
      'https://js.stripe.com',
      'https://*.stripe.com',
      'https://stripe.com',
      'https://q.stripe.com',
      'https://m.stripe.network',
      'https://m.stripe.com',
      'https://*.stripecdn.com',
      'https://stripecdn.com',
      'https://b.stripecdn.com',
      'https://files.stripe.com',
      'https://checkout.stripe.com',
      // hCaptcha image sources
      'https://assets.hcaptcha.com',
      'https://*.hcaptcha.com',
      'https://hcaptcha.com',
      'https://imgs.hcaptcha.com',
      'https://newassets.hcaptcha.com',
      // Google/reCAPTCHA fallback
      'https://www.gstatic.com',
      'https://www.google.com',
      'https://www.recaptcha.net',
      // Payment method logos
      'https://js.stripe.com/v3/',
      'https://hooks.stripe.com'
    ],
    'connect-src': [
      "'self'",
      'https://api.stripe.com',
      'https://*.stripe.com',
      'https://stripe.com',
      'https://checkout.stripe.com',
      'https://q.stripe.com',
      'https://m.stripe.network',
      'https://m.stripe.com',
      'https://hooks.stripe.com',
      'https://js.stripe.com',
      'https://*.hcaptcha.com',
      'https://hcaptcha.com'
    ],
    'frame-src': [
      "'self'",
      'https://js.stripe.com',
      'https://*.stripe.com',
      'https://stripe.com',
      'https://checkout.stripe.com',
      'https://hooks.stripe.com',
      'https://*.hcaptcha.com',
      'https://hcaptcha.com',
      'https://newassets.hcaptcha.com'
    ],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
    'media-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };

  // Development-specific CSP (more permissive for HMR)
  if (isDevelopment) {
    baseCSP['script-src'].push("'unsafe-inline'", "'unsafe-eval'");
    baseCSP['style-src'].push("'unsafe-inline'");
    // Loosen image sources in development to avoid noisy CSP blocks from devtools and beacons
    baseCSP['img-src'].push('*');
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
  const cspString = Object.entries(baseCSP)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
    
  // Debug logging in development
  if (isDevelopment) {
    console.log('[SECURITY] Generated CSP for checkout:', {
      imgSrc: baseCSP['img-src'],
      scriptSrc: baseCSP['script-src'],
      connectSrc: baseCSP['connect-src'],
      frameSrc: baseCSP['frame-src'],
      cspLength: cspString.length
    });
    
    // Verify data: and blob: are included
    if (!cspString.includes('data:')) {
      console.error('[ERROR] CSP ERROR: data: not included in img-src!');
    }
    if (!cspString.includes('blob:')) {
      console.error('[ERROR] CSP ERROR: blob: not included in img-src!');
    }
    
    // Log the full CSP for debugging
    console.log('[INFO] Full CSP string:', cspString);
  }
  
  return cspString;
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
    'payment=(self "https://js.stripe.com" "https://*.stripe.com")', // Allow for Stripe payments
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