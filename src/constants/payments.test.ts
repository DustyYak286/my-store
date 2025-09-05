/**
 * Tests for Enhanced Payment Constants and Validation Functions
 */

import {
  PAYMENT_LIMITS,
  CURRENCY_CONFIG,
  PAYMENT_CURRENCY,
  validatePaymentAmount,
  validateCurrency,
  toStripeAmount,
  fromStripeAmount,
  formatCurrency,
} from './payments';

describe('Enhanced Payment Validation', () => {
  describe('validatePaymentAmount', () => {
    it('should validate amounts within limits', () => {
      const validAmounts = [2.50, 10.00, 100.00, 1000.00, 840336.13];
      
      validAmounts.forEach(amount => {
        const result = validatePaymentAmount(amount);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject amounts below minimum (2.50 RON)', () => {
      const invalidAmounts = [0, 0.01, 1.00, 2.49];
      
      invalidAmounts.forEach(amount => {
        const result = validatePaymentAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject amounts above maximum (840,336.13 RON)', () => {
      const invalidAmounts = [840336.14, 1000000, 5000000, Number.MAX_VALUE];
      
      invalidAmounts.forEach(amount => {
        const result = validatePaymentAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject invalid number types', () => {
      const invalidInputs = [NaN, Infinity, -Infinity, 'not a number' as any, null as any, undefined as any];
      
      invalidInputs.forEach(input => {
        const result = validatePaymentAmount(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Invalid payment amount');
      });
    });

    it('should reject negative amounts', () => {
      const negativeAmounts = [-1, -10.50, -0.01];
      
      negativeAmounts.forEach(amount => {
        const result = validatePaymentAmount(amount);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('must be greater than zero');
      });
    });

    it('should validate decimal places for RON currency', () => {
      const testCases = [
        { amount: 10.50, valid: true, description: '2 decimal places' },
        { amount: 10.5, valid: true, description: '1 decimal place' },
        { amount: 10, valid: true, description: 'no decimals' },
        { amount: 10.123, valid: false, description: '3 decimal places' },
        { amount: 10.5567, valid: false, description: '4 decimal places' },
      ];

      testCases.forEach(testCase => {
        const result = validatePaymentAmount(testCase.amount);
        expect(result.isValid).toBe(testCase.valid);
        
        if (!testCase.valid) {
          expect(result.error).toContain('decimal places');
        }
      });
    });
  });

  describe('validateCurrency', () => {
    it('should accept RON currency', () => {
      const ronVariations = ['ron', 'RON', 'Ron', ' ron ', 'leu', 'lei', 'LEI', 'romanian leu', 'rl'];
      
      ronVariations.forEach(currency => {
        const result = validateCurrency(currency);
        expect(result.isValid).toBe(true);
        expect(result.normalizedCurrency).toBe('ron');
      });
    });

    it('should default to RON when no currency provided', () => {
      const result = validateCurrency();
      expect(result.isValid).toBe(true);
      expect(result.normalizedCurrency).toBe('ron');
    });

    it('should handle empty string currency', () => {
      const result = validateCurrency('');
      expect(result.isValid).toBe(true);
      expect(result.normalizedCurrency).toBe('ron');
    });

    it('should reject unsupported currencies', () => {
      const unsupportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'invalid'];
      
      unsupportedCurrencies.forEach(currency => {
        const result = validateCurrency(currency);
        expect(result.isValid).toBe(false);
        expect(result.normalizedCurrency).toBe('ron'); // Always fallback to RON
        expect(result.error).toContain('Unsupported currency');
        expect(result.error).toContain('Only RON');
      });
    });

    it('should provide warning for normalized currencies', () => {
      const currenciesToNormalize = ['LEU', 'Lei', 'ROMANIAN LEU'];
      
      currenciesToNormalize.forEach(currency => {
        const result = validateCurrency(currency);
        expect(result.isValid).toBe(true);
        expect(result.normalizedCurrency).toBe('ron');
        expect(result.warning).toContain('normalized');
      });
    });
  });

  describe('Currency conversion functions', () => {
    it('should convert RON to bani correctly', () => {
      const testCases = [
        { ron: 1.00, bani: 100 },
        { ron: 2.50, bani: 250 },
        { ron: 10.75, bani: 1075 },
        { ron: 100.00, bani: 10000 },
        { ron: 4999999.99, bani: 499999999 },
      ];

      testCases.forEach(testCase => {
        const result = toStripeAmount(testCase.ron);
        expect(result).toBe(testCase.bani);
      });
    });

    it('should convert bani to RON correctly', () => {
      const testCases = [
        { bani: 100, ron: 1.00 },
        { bani: 250, ron: 2.50 },
        { bani: 1075, ron: 10.75 },
        { bani: 10000, ron: 100.00 },
        { bani: 499999999, ron: 4999999.99 },
      ];

      testCases.forEach(testCase => {
        const result = fromStripeAmount(testCase.bani);
        expect(result).toBe(testCase.ron);
      });
    });

    it('should handle rounding correctly in conversion', () => {
      // Test edge cases with rounding
      const testCases = [
        { ron: 1.234, expectedBani: 123 }, // Rounds down
        { ron: 1.235, expectedBani: 124 }, // Rounds up (banker's rounding)
        { ron: 1.236, expectedBani: 124 }, // Rounds up
      ];

      testCases.forEach(testCase => {
        const result = toStripeAmount(testCase.ron);
        expect(result).toBe(testCase.expectedBani);
      });
    });
  });

  describe('Currency formatting', () => {
    it('should format currency correctly for RON locale', () => {
      const testCases = [
        { amount: 1.00, expectedFormat: /1[.,]00.*lei|RON/i },
        { amount: 10.50, expectedFormat: /10[.,]50.*lei|RON/i },
        { amount: 1000.00, expectedFormat: /1[.,]000[.,]00.*lei|RON/i },
      ];

      testCases.forEach(testCase => {
        const result = formatCurrency(testCase.amount);
        expect(result).toMatch(testCase.expectedFormat);
      });
    });
  });

  describe('Payment limits configuration', () => {
    it('should have correct minimum and maximum limits', () => {
      expect(PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY).toBe(2.50);
      expect(PAYMENT_LIMITS.MAX_AMOUNT_DISPLAY).toBe(840336.13);
      expect(PAYMENT_LIMITS.MIN_AMOUNT).toBe(250); // 2.50 RON in bani
      expect(PAYMENT_LIMITS.MAX_AMOUNT).toBe(84033613); // 840,336.13 RON in bani (tax-adjusted for Stripe limits)
    });

    it('should have consistent currency configuration', () => {
      expect(PAYMENT_CURRENCY).toBe('ron');
      expect(CURRENCY_CONFIG.code).toBe('RON');
      expect(CURRENCY_CONFIG.symbol).toBe('lei');
      expect(CURRENCY_CONFIG.locale).toBe('ro-RO');
      expect(CURRENCY_CONFIG.decimalPlaces).toBe(2);
    });
  });

  describe('Integration with limits validation', () => {
    it('should validate exactly at minimum limit', () => {
      const result = validatePaymentAmount(PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY);
      expect(result.isValid).toBe(true);
    });

    it('should validate exactly at maximum limit', () => {
      const result = validatePaymentAmount(PAYMENT_LIMITS.MAX_AMOUNT_DISPLAY);
      expect(result.isValid).toBe(true);
    });

    it('should reject one bani below minimum', () => {
      const justBelow = PAYMENT_LIMITS.MIN_AMOUNT_DISPLAY - 0.01;
      const result = validatePaymentAmount(justBelow);
      expect(result.isValid).toBe(false);
    });

    it('should reject one RON above maximum', () => {
      const justAbove = PAYMENT_LIMITS.MAX_AMOUNT_DISPLAY + 1;
      const result = validatePaymentAmount(justAbove);
      expect(result.isValid).toBe(false);
    });
  });
});