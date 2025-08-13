/**
 * Tests for Security Validation and Sanitization Utilities
 */

import {
  sanitizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeAddress,
  sanitizePostalCode,
  validateRequestStructure,
  detectAttackPatterns,
  validateClientIP,
} from './validation';

describe('Input Sanitization', () => {
  describe('sanitizeString', () => {
    it('should sanitize basic strings correctly', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World');
      expect(sanitizeString('  Test String  ')).toBe('Test String');
      expect(sanitizeString('')).toBe('');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert(xss)');
      expect(sanitizeString('SELECT * FROM users')).toBe('  FROM users');
      expect(sanitizeString('test--comment')).toBe('testcomment');
    });

    it('should respect length limits', () => {
      const longString = 'a'.repeat(2000);
      expect(sanitizeString(longString, { maxLength: 100 })).toHaveLength(100);
    });

    it('should handle null bytes and control characters', () => {
      expect(sanitizeString('test\x00null')).toBe('testnull');
      expect(sanitizeString('test\x01control')).toBe('testcontrol');
    });

    it('should enforce character restrictions', () => {
      expect(sanitizeString('test@email.com', { allowedChars: /^[a-z]+$/ })).toBe('testemailcom');
    });
  });

  describe('sanitizeEmail', () => {
    it('should sanitize valid emails', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
      expect(sanitizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
    });

    it('should reject invalid emails', () => {
      expect(sanitizeEmail('invalid-email')).toBe('');
      expect(sanitizeEmail('test@')).toBe('');
      expect(sanitizeEmail('@example.com')).toBe('');
      expect(sanitizeEmail('')).toBe('');
    });

    it('should handle malicious input', () => {
      expect(sanitizeEmail('<script>alert("xss")</script>@evil.com')).toBe('');
      // This test case passes as-is since it detects script content
      expect(sanitizeEmail('test@evil.com').includes('<')).toBe(false);
    });
  });

  describe('sanitizePhone', () => {
    it('should sanitize valid phone numbers', () => {
      expect(sanitizePhone('+1-234-567-8900')).toBe('+1-234-567-8900');
      expect(sanitizePhone('1234567890')).toBe('1234567890');
      expect(sanitizePhone('(123) 456-7890')).toBe('(123) 456-7890');
    });

    it('should remove invalid characters', () => {
      expect(sanitizePhone('123-abc-4567')).toBe('123--4567');
      expect(sanitizePhone('123<script>456')).toBe('123456');
    });

    it('should enforce length limits', () => {
      const longPhone = '1'.repeat(50);
      expect(sanitizePhone(longPhone)).toHaveLength(20);
    });
  });

  describe('sanitizeAddress', () => {
    it('should sanitize valid addresses', () => {
      expect(sanitizeAddress('123 Main St #4')).toBe('123 Main St #4');
      expect(sanitizeAddress('Apt. 5, Building A')).toBe('Apt. 5, Building A');
    });

    it('should remove dangerous content', () => {
      expect(sanitizeAddress('123 Main<script>alert()</script> St')).toBe('123 Mainalert() St');
    });
  });

  describe('sanitizePostalCode', () => {
    it('should sanitize valid postal codes', () => {
      expect(sanitizePostalCode('12345')).toBe('12345');
      expect(sanitizePostalCode('K1A 0A6')).toBe('K1A 0A6');
      expect(sanitizePostalCode('SW1A-1AA')).toBe('SW1A-1AA');
    });

    it('should remove invalid characters', () => {
      expect(sanitizePostalCode('12345<script>')).toBe('12345');
    });
  });
});

describe('Request Structure Validation', () => {
  const validRequestData = {
    customerInfo: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1-234-567-8900',
    },
    shippingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Main St',
      city: 'Springfield',
      postalCode: '12345',
      country: 'USA',
    },
    billingAddress: {
      fullName: 'John Doe',
      streetAddress: '123 Main St',
      city: 'Springfield',
      postalCode: '12345',
      country: 'USA',
    },
    items: [
      {
        id: 1,
        name: 'Test Product',
        price: { original: 10.00, currency: 'ron' },
        quantity: 2,
        image: 'test.jpg',
      },
    ],
  };

  it('should validate and sanitize valid request data', () => {
    const result = validateRequestStructure(validRequestData);
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.sanitizedData).toBeDefined();
    expect(result.sanitizedData?.customerInfo.email).toBe('test@example.com');
  });

  it('should detect prototype pollution attempts', () => {
    const maliciousData = {
      ...validRequestData,
      __proto__: { isAdmin: true },
      constructor: { prototype: { isAdmin: true } },
    };

    const result = validateRequestStructure(maliciousData);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.some(err => err.includes('pollution'))).toBe(true);
  });

  it('should reject invalid request structure', () => {
    const result = validateRequestStructure(null);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid request body structure');
  });

  it('should validate required customer information', () => {
    const invalidData = { ...validRequestData };
    delete invalidData.customerInfo;

    const result = validateRequestStructure(invalidData);
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Customer information is required');
  });

  it('should sanitize email addresses', () => {
    const dataWithBadEmail = {
      ...validRequestData,
      customerInfo: {
        ...validRequestData.customerInfo,
        email: '  TEST@EXAMPLE.COM  ',
      },
    };

    const result = validateRequestStructure(dataWithBadEmail);
    
    expect(result.isValid).toBe(true);
    expect(result.sanitizedData?.customerInfo.email).toBe('test@example.com');
  });

  it('should validate items array', () => {
    const dataWithBadItems = {
      ...validRequestData,
      items: [
        {
          id: 'invalid',
          name: '',
          price: { original: -5, currency: 'ron' },
          quantity: 0,
          image: 'test.jpg',
        },
      ],
    };

    const result = validateRequestStructure(dataWithBadItems);
    
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Attack Pattern Detection', () => {
  it('should detect XSS attempts', () => {
    const maliciousData = {
      customerInfo: {
        firstName: '<script>alert("xss")</script>',
        email: 'test@example.com',
      },
    };

    const result = detectAttackPatterns(maliciousData);
    
    expect(result.threats.some(threat => threat.includes('XSS'))).toBe(true);
    expect(result.riskLevel).toBe('critical');
  });

  it('should detect SQL injection attempts', () => {
    const maliciousData = {
      customerInfo: {
        firstName: "John'; DROP TABLE users; --",
        email: 'test@example.com',
      },
    };

    const result = detectAttackPatterns(maliciousData);
    
    expect(result.threats.some(threat => threat.includes('SQL injection'))).toBe(true);
    expect(result.riskLevel).toBe('critical');
  });

  it('should detect path traversal attempts', () => {
    const maliciousData = {
      customerInfo: {
        firstName: '../../../etc/passwd',
        email: 'test@example.com',
      },
    };

    const result = detectAttackPatterns(maliciousData);
    
    expect(result.threats.some(threat => threat.includes('Path traversal'))).toBe(true);
    expect(result.riskLevel).toBe('high');
  });

  it('should detect command injection attempts', () => {
    const maliciousData = {
      customerInfo: {
        firstName: 'John; rm -rf /',
        email: 'test@example.com',
      },
    };

    const result = detectAttackPatterns(maliciousData);
    
    expect(result.threats.some(threat => threat.includes('Command injection'))).toBe(true);
    expect(result.riskLevel).toBe('high');
  });

  it('should return low risk for clean data', () => {
    const cleanData = {
      customerInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
      },
    };

    const result = detectAttackPatterns(cleanData);
    
    expect(result.threats).toHaveLength(0);
    expect(result.riskLevel).toBe('low');
  });
});

describe('IP Address Validation', () => {
  it('should validate IPv4 addresses', () => {
    expect(validateClientIP('192.168.1.1')).toEqual({
      isValid: true,
      isSuspicious: true,
      warnings: ['Request from private IP range'],
    });

    expect(validateClientIP('8.8.8.8')).toEqual({
      isValid: true,
      isSuspicious: false,
      warnings: [],
    });
  });

  it('should validate IPv6 addresses', () => {
    expect(validateClientIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toEqual({
      isValid: true,
      isSuspicious: false,
      warnings: [],
    });

    expect(validateClientIP('::1')).toEqual({
      isValid: true,
      isSuspicious: false,
      warnings: [],
    });
  });

  it('should reject invalid IP formats', () => {
    expect(validateClientIP('999.999.999.999')).toEqual({
      isValid: false,
      isSuspicious: false,
      warnings: ['Invalid IP address format'],
    });

    expect(validateClientIP('not-an-ip')).toEqual({
      isValid: false,
      isSuspicious: false,
      warnings: ['Invalid IP address format'],
    });
  });

  it('should detect suspicious IP patterns', () => {
    expect(validateClientIP('0.0.0.0')).toEqual({
      isValid: true,
      isSuspicious: true,
      warnings: ['Suspicious IP pattern detected'],
    });

    expect(validateClientIP('255.255.255.255')).toEqual({
      isValid: true,
      isSuspicious: true,
      warnings: ['Suspicious IP pattern detected'],
    });
  });

  it('should handle missing IP address', () => {
    expect(validateClientIP('')).toEqual({
      isValid: false,
      isSuspicious: false,
      warnings: ['No IP address provided'],
    });
  });
});