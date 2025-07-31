/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Control referrer information
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // Prevent XSS attacks in older browsers
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Content Security Policy for e-commerce security
          // Allows Google Fonts, self-hosted content, and inline styles (needed for Tailwind)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval in dev
              "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
              "font-src 'self' fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-ancestors 'none'", // Same as X-Frame-Options but for modern browsers
            ].join('; '),
          },
          // Permissions Policy (formerly Feature Policy)
          // Restrict access to sensitive browser features
          {
            key: 'Permissions-Policy',
            value: [
              'geolocation=()',
              'microphone=()',
              'camera=()',
              'payment=(self)', // Allow payment APIs for e-commerce
              'fullscreen=(self)',
              'display-capture=()',
            ].join(', '),
          },
        ],
      },
      {
        // Stricter CSP for API routes (no inline scripts needed)
        source: '/api/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'none'",
              "script-src 'none'",
              "style-src 'none'",
              "img-src 'none'",
              "font-src 'none'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          // Additional API security headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },
  
  // Security-related experimental features  
  experimental: {
    // Enable security headers in middleware
    middlewarePrefetch: 'strict',
  },
};

export default nextConfig;
