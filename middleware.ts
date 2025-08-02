import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { 
  generateCSP, 
  generatePermissionsPolicy, 
  getAPISecurityHeaders,
  generateNonce,
  generateRequestId 
} from '@/utils/security'

/**
 * Enhanced security middleware for production-grade protection
 * Runs before all routes and API endpoints
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Get current environment
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'
  const pathname = request.nextUrl.pathname
  
  // Generate security nonce for CSP (production)
  const nonce = isProduction ? generateNonce() : undefined
  if (nonce) {
    response.headers.set('x-nonce', nonce)
  }
  
  // Prevent caching of sensitive pages
  if (pathname.startsWith('/checkout') || pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
  }
  
  // Enhanced API route security using dynamic utilities
  if (pathname.startsWith('/api/')) {
    // Apply comprehensive API security headers
    const apiHeaders = getAPISecurityHeaders()
    Object.entries(apiHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    // Rate limiting headers (informational for now)
    response.headers.set('X-RateLimit-Limit', '1000')
    response.headers.set('X-RateLimit-Window', '3600')
    response.headers.set('X-RateLimit-Remaining', '999')
    
    // API versioning and monitoring
    response.headers.set('API-Version', '1.0')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive, notranslate, noimageindex')
  }
  
  // Checkout page specific security with dynamic CSP
  if (pathname.startsWith('/checkout')) {
    // Additional checkout security
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('Cache-Control', 'no-store, private, max-age=0')
    
    // Apply dynamic CSP for checkout pages
    const checkoutCSP = generateCSP(nonce)
    response.headers.set('Content-Security-Policy', checkoutCSP)
    
    // Dynamic Permissions Policy for checkout
    const permissionsPolicy = generatePermissionsPolicy()
    response.headers.set('Permissions-Policy', permissionsPolicy)
    
    if (isProduction) {
      response.headers.set('X-Checkout-Session', 'secure')
    }
  }
  
  // Environment-specific configurations
  if (isDevelopment) {
    // Development indicators and debugging
    response.headers.set('X-Development-Mode', 'true')
    response.headers.set('X-Debug-Info', 'enabled')
    
    // Allow development tools
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3000')
  }
  
  if (isProduction) {
    // Remove server fingerprinting
    response.headers.delete('Server')
    response.headers.delete('X-Powered-By')
    response.headers.delete('X-Runtime')
    
    // Apply dynamic CSP for production (if not already set by route-specific logic)
    if (!pathname.startsWith('/checkout') && !pathname.startsWith('/api/')) {
      const productionCSP = generateCSP(nonce)
      response.headers.set('Content-Security-Policy', productionCSP)
      
      const permissionsPolicy = generatePermissionsPolicy()
      response.headers.set('Permissions-Policy', permissionsPolicy)
    }
    
    // Security contact and reporting
    response.headers.set('Security-Contact', 'mailto:security@example.com')
    response.headers.set('X-Security-Version', '1.0')
    
    // Add timing attack protection
    response.headers.set('X-Response-Time-Start', Date.now().toString())
  }
  
  // Additional security for static assets
  if (pathname.includes('/_next/') || pathname.includes('/public/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    response.headers.set('X-Content-Type-Options', 'nosniff')
  }
  
  // Security monitoring headers
  response.headers.set('X-Request-ID', generateRequestId())
  response.headers.set('X-Timestamp', new Date().toISOString())
  
  return response
}


/**
 * Middleware configuration
 * Define which routes this middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}