/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';

    // Base CSP directives
    const cspDirectives = {
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
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
    };

    // Environment-specific CSP adjustments
    if (isDevelopment) {
      cspDirectives['script-src'].push("'unsafe-inline'", "'unsafe-eval'");
      cspDirectives['style-src'].push("'unsafe-inline'");
      // Relax image sources in development to avoid devtool beacons being blocked
      if (Array.isArray(cspDirectives['img-src'])) {
        cspDirectives['img-src'].push('*');
      }
      cspDirectives['connect-src'].push('ws:', 'wss:'); // HMR support
    } else {
      // Production: Allow inline styles for Tailwind but restrict scripts
      cspDirectives['style-src'].push("'unsafe-inline'");
      cspDirectives['script-src'].push("'unsafe-inline'"); // Minimal for Next.js
    }

    const csp = Object.entries(cspDirectives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');

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
          // Control referrer information (stricter)
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Prevent XSS attacks in older browsers
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // CSP is handled by middleware.ts for better dynamic control
          // {
          //   key: 'Content-Security-Policy',
          //   value: csp,
          // },
          // Enhanced Permissions Policy
          {
            key: 'Permissions-Policy',
            value: [
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
              'payment=(self "https://js.stripe.com" "https://*.stripe.com")',
              'picture-in-picture=()',
              'publickey-credentials-get=()',
              'screen-wake-lock=()',
              'sync-xhr=()',
              'usb=()',
              'web-share=()',
              'xr-spatial-tracking=()',
            ].join(', '),
          },
          // Cross-Origin Embedder Policy (COEP)
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none', // Required for compatibility
          },
          // Cross-Origin Opener Policy (COOP)
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          // Cross-Origin Resource Policy (CORP)
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          // Strict Transport Security (production only)
          ...(isProduction ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          }] : []),
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
