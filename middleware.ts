import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Security middleware for additional protection
 * Runs before all routes and API endpoints
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Get current environment
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Security headers that should be set by middleware
  // (These complement the headers in next.config.mjs)
  
  // Strict Transport Security (HTTPS only) - only in production
  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security', 
      'max-age=31536000; includeSubDomains; preload'
    )
  }
  
  // Prevent caching of sensitive pages
  if (request.nextUrl.pathname.startsWith('/checkout') || 
      request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    )
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }
  
  // Add security headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Prevent API responses from being cached
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive')
    
    // Rate limiting headers (informational)
    response.headers.set('X-RateLimit-Limit', '100')
    response.headers.set('X-RateLimit-Remaining', '99')
  }
  
  // Development-specific headers
  if (isDevelopment) {
    // Add development indicator
    response.headers.set('X-Development-Mode', 'true')
  }
  
  // Production-specific security
  if (isProduction) {
    // Remove server information
    response.headers.delete('Server')
    response.headers.delete('X-Powered-By')
    
    // Add security contact (optional - replace with your contact)
    response.headers.set(
      'Security-Contact', 
      'security@your-domain.com'
    )
  }
  
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