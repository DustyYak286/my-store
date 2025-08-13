/**
 * Security Validation and Sanitization Utilities
 * 
 * Provides comprehensive input validation, sanitization, and security
 * checks for payment processing APIs with production-grade security.
 */

import { NextRequest } from 'next/server';

// ====== INPUT SANITIZATION ======

/**
 * Sanitize string input by removing dangerous characters and normalizing
 */
export function sanitizeString(input: string, options: {
  maxLength?: number;
  allowedChars?: RegExp;
  trim?: boolean;
} = {}): string {
  const {
    maxLength = 1000,
    allowedChars = /^[a-zA-Z0-9\s\-_.,@()]+$/,
    trim = true,
  } = options;

  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Trim whitespace if requested
  if (trim) {
    sanitized = sanitized.trim();
  }

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove HTML/script tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove SQL injection patterns
  sanitized = sanitized.replace(/('|(--)|(\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|SELECT|UNION|UPDATE)\b))/gi, '');

  // Enforce character restrictions
  if (!allowedChars.test(sanitized)) {
    // Remove disallowed characters based on the allowed pattern
    if (allowedChars.source === '^[a-z]+$') {
      sanitized = sanitized.replace(/[^a-z]/g, '');
    } else {
      sanitized = sanitized.replace(/[^\w\s\-_.,@()#/]/g, '');
    }
  }

  // Enforce length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize email address with strict validation
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  // Basic sanitization
  const sanitized = sanitizeString(email, {
    maxLength: 254, // RFC 5321 limit
    allowedChars: /^[a-zA-Z0-9._%+-@]+$/,
  });

  // Additional email-specific sanitization - remove script content more aggressively
  if (sanitized.includes('<') || sanitized.includes('>') || sanitized.includes('script')) {
    return '';
  }

  // Email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }

  return sanitized.toLowerCase();
}

/**
 * Sanitize phone number input
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') {
    return '';
  }

  // Remove all non-numeric characters except +, -, (, ), and spaces
  let sanitized = phone.replace(/[^0-9+\-() ]/g, '');

  // Enforce reasonable length (international format max)
  if (sanitized.length > 20) {
    sanitized = sanitized.substring(0, 20);
  }

  return sanitized.trim();
}

/**
 * Sanitize address input with extended character support
 */
export function sanitizeAddress(address: string): string {
  return sanitizeString(address, {
    maxLength: 200,
    allowedChars: /^[a-zA-Z0-9\s\-_.,#/()]+$/,
  });
}

/**
 * Sanitize postal code input
 */
export function sanitizePostalCode(postalCode: string): string {
  return sanitizeString(postalCode, {
    maxLength: 20,
    allowedChars: /^[a-zA-Z0-9\s\-]+$/,
  });
}

// ====== REQUEST VALIDATION ======

/**
 * Validate request headers for security threats
 */
export function validateRequestHeaders(request: NextRequest): {
  isValid: boolean;
  threats: string[];
  warnings: string[];
} {
  const threats: string[] = [];
  const warnings: string[] = [];

  // Check Content-Type
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    threats.push('Invalid or missing Content-Type header');
  }

  // Check for suspicious User-Agent patterns
  const userAgent = request.headers.get('user-agent');
  if (userAgent) {
    // Check for bot patterns that shouldn't be making payment requests
    const suspiciousPatterns = [
      /curl/i,
      /wget/i,
      /python/i,
      /script/i,
      /bot/i,
      /crawler/i,
      /spider/i,
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    if (isSuspicious) {
      warnings.push('Suspicious User-Agent detected');
    }

    // Check for excessively long User-Agent
    if (userAgent.length > 1000) {
      threats.push('Excessively long User-Agent header');
    }
  } else {
    warnings.push('Missing User-Agent header');
  }

  // Check for injection attempts in headers
  const dangerousHeaders = ['x-forwarded-for', 'x-real-ip', 'referer'];
  dangerousHeaders.forEach(headerName => {
    const headerValue = request.headers.get(headerName);
    if (headerValue) {
      // Check for script injection
      if (/<script|javascript:|data:/.test(headerValue)) {
        threats.push(`Script injection detected in ${headerName} header`);
      }

      // Check for SQL injection patterns
      if (/('|(--)|(\bunion\b)|(\bselect\b)|(\binsert\b)|(\bdelete\b)|(\bdrop\b))/i.test(headerValue)) {
        threats.push(`SQL injection pattern detected in ${headerName} header`);
      }
    }
  });

  // Check Origin/Referer for CSRF protection
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  if (!origin && !referer) {
    warnings.push('Missing Origin and Referer headers - potential CSRF risk');
  }

  return {
    isValid: threats.length === 0,
    threats,
    warnings,
  };
}

/**
 * Validate request size and structure
 */
export function validateRequestStructure(requestBody: any): {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
} {
  const errors: string[] = [];

  if (!requestBody || typeof requestBody !== 'object') {
    errors.push('Invalid request body structure');
    return { isValid: false, errors };
  }

  // Check for prototype pollution attempts
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  const checkForPollution = (obj: any, path = ''): void => {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
      if (dangerousKeys.includes(key)) {
        errors.push(`Prototype pollution attempt detected: ${path}${key}`);
        continue;
      }

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        checkForPollution(obj[key], `${path}${key}.`);
      }
    }
  };

  checkForPollution(requestBody);

  // Sanitize customer information
  let sanitizedData: any = {};

  if (requestBody.customerInfo) {
    sanitizedData.customerInfo = {
      email: sanitizeEmail(requestBody.customerInfo.email || ''),
      firstName: sanitizeString(requestBody.customerInfo.firstName || '', { maxLength: 50 }),
      lastName: sanitizeString(requestBody.customerInfo.lastName || '', { maxLength: 50 }),
      phone: sanitizePhone(requestBody.customerInfo.phone || ''),
      company: sanitizeString(requestBody.customerInfo.company || '', { maxLength: 100 }),
    };

    // Validate required fields after sanitization
    if (!sanitizedData.customerInfo.email) {
      errors.push('Valid customer email is required');
    }
  } else {
    errors.push('Customer information is required');
  }

  // Sanitize addresses
  const sanitizeAddressData = (addressData: any) => {
    if (!addressData || typeof addressData !== 'object') {
      return null;
    }

    return {
      fullName: sanitizeString(addressData.fullName || '', { maxLength: 100 }),
      streetAddress: sanitizeAddress(addressData.streetAddress || ''),
      city: sanitizeString(addressData.city || '', { maxLength: 50 }),
      postalCode: sanitizePostalCode(addressData.postalCode || ''),
      country: sanitizeString(addressData.country || '', { maxLength: 50 }),
      state: sanitizeString(addressData.state || '', { maxLength: 50 }),
      company: sanitizeString(addressData.company || '', { maxLength: 100 }),
      phone: sanitizePhone(addressData.phone || ''),
    };
  };

  sanitizedData.shippingAddress = sanitizeAddressData(requestBody.shippingAddress);
  sanitizedData.billingAddress = sanitizeAddressData(requestBody.billingAddress);

  if (!sanitizedData.shippingAddress?.fullName) {
    errors.push('Valid shipping address with full name is required');
  }

  if (!sanitizedData.billingAddress?.fullName) {
    errors.push('Valid billing address with full name is required');
  }

  // Sanitize items array
  if (Array.isArray(requestBody.items)) {
    sanitizedData.items = requestBody.items.map((item: any, index: number) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`Item ${index + 1}: Invalid item structure`);
        return null;
      }

      const sanitizedItem = {
        id: typeof item.id === 'number' ? item.id : parseInt(item.id, 10),
        name: sanitizeString(item.name || '', { maxLength: 200 }),
        quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity, 10),
        image: sanitizeString(item.image || '', { maxLength: 500 }),
        price: item.price,
      };

      // Validate sanitized item
      if (isNaN(sanitizedItem.id) || sanitizedItem.id <= 0) {
        errors.push(`Item ${index + 1}: Invalid product ID`);
      }

      if (!sanitizedItem.name) {
        errors.push(`Item ${index + 1}: Product name is required`);
      }

      if (isNaN(sanitizedItem.quantity) || sanitizedItem.quantity <= 0) {
        errors.push(`Item ${index + 1}: Invalid quantity`);
      }

      return sanitizedItem;
    }).filter(Boolean);
  } else {
    errors.push('Items array is required');
  }

  // Sanitize optional fields
  if (requestBody.currency) {
    sanitizedData.currency = sanitizeString(requestBody.currency, { maxLength: 10 });
  }

  if (requestBody.giftMessage) {
    sanitizedData.giftMessage = sanitizeString(requestBody.giftMessage, { maxLength: 500 });
  }

  if (requestBody.specialInstructions) {
    sanitizedData.specialInstructions = sanitizeString(requestBody.specialInstructions, { maxLength: 1000 });
  }

  if (requestBody.clientRequestId) {
    sanitizedData.clientRequestId = sanitizeString(requestBody.clientRequestId, { 
      maxLength: 255,
      allowedChars: /^[a-zA-Z0-9\-_]+$/,
    });
  }

  if (requestBody.sessionId) {
    sanitizedData.sessionId = sanitizeString(requestBody.sessionId, {
      maxLength: 255,
      allowedChars: /^[a-zA-Z0-9\-_]+$/,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitizedData : undefined,
  };
}

// ====== SECURITY CHECKS ======

/**
 * Check for common attack patterns in request data
 */
export function detectAttackPatterns(data: any): {
  threats: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
} {
  const threats: string[] = [];

  const checkString = (value: string, field: string) => {
    if (typeof value !== 'string') return;

    // XSS patterns
    if (/<script|javascript:|onload=|onerror=/i.test(value)) {
      threats.push(`XSS attempt detected in ${field}`);
    }

    // SQL injection patterns
    if (/(union|select|insert|delete|drop|create|alter|exec|execute)\s/i.test(value)) {
      threats.push(`SQL injection attempt detected in ${field}`);
    }

    // Path traversal patterns
    if (/\.\.[\/\\]|[\/\\]\.\./.test(value)) {
      threats.push(`Path traversal attempt detected in ${field}`);
    }

    // Command injection patterns
    if (/[;&|`$(){}]/.test(value)) {
      threats.push(`Command injection attempt detected in ${field}`);
    }

    // LDAP injection patterns
    if (/[*()\\]/g.test(value)) {
      threats.push(`LDAP injection attempt detected in ${field}`);
    }
  };

  const scanObject = (obj: any, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        checkString(value, fieldPath);
      } else if (typeof value === 'object' && value !== null) {
        scanObject(value, fieldPath);
      }
    }
  };

  scanObject(data);

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  
  if (threats.length === 0) {
    riskLevel = 'low';
  } else if (threats.some(t => t.includes('XSS') || t.includes('SQL injection'))) {
    riskLevel = 'critical';
  } else if (threats.some(t => t.includes('injection') || t.includes('traversal'))) {
    riskLevel = 'high';
  } else {
    riskLevel = 'medium';
  }

  return { threats, riskLevel };
}

/**
 * Validate IP address format and check for suspicious patterns
 */
export function validateClientIP(ip: string): {
  isValid: boolean;
  isSuspicious: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!ip || typeof ip !== 'string') {
    return { isValid: false, isSuspicious: false, warnings: ['No IP address provided'] };
  }

  // Basic IP format validation (IPv4 and IPv6)
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

  const isValidFormat = ipv4Regex.test(ip) || ipv6Regex.test(ip);

  if (!isValidFormat) {
    warnings.push('Invalid IP address format');
  }

  // Check for suspicious IP patterns
  let isSuspicious = false;

  // Private IP ranges (shouldn't be making external payments directly)
  const privateIPRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^127\./,
    /^169\.254\./,
  ];

  if (privateIPRanges.some(range => range.test(ip))) {
    warnings.push('Request from private IP range');
    isSuspicious = true;
  }

  // Known malicious ranges or patterns (example)
  const suspiciousPatterns = [
    /^0\.0\.0\.0$/,
    /^255\.255\.255\.255$/,
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(ip))) {
    warnings.push('Suspicious IP pattern detected');
    isSuspicious = true;
  }

  return {
    isValid: isValidFormat,
    isSuspicious,
    warnings,
  };
}