/**
 * Environment Validation Mock Factory
 * 
 * Creates fresh, isolated environment validation mock instances.
 * Uses shared configuration to eliminate duplication.
 */

import { MOCK_ENV_CONFIG, MOCK_VALIDATION_RESULT, MOCK_ENV_INFO, MOCK_STRIPE_KEYS } from './shared/mockEnvConfig';

export interface EnvValidationInterface {
  env: any;
  validateEnvironment(): { isValid: boolean; errors: string[] };
  validateEnvironmentVariables(env: any, strict?: boolean): { valid: boolean; errors: string[] };
  validateEnvironmentSafe(env?: any, strict?: boolean): { 
    valid: boolean; 
    errors: string[]; 
    warnings: string[]; 
    summary: { totalChecked: number; passed: number; failed: number; warnings: number } 
  };
  isDevelopment(): boolean;
  parseCountries(value?: string): string[];
  getEnvironmentInfo(): {
    nodeEnv: string;
    isProduction: boolean;
    isDevelopment: boolean;
    isTest: boolean;
  };
  getTypedEnvironment(): {
    NODE_ENV: string;
    STRIPE_SECRET_KEY: string;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
  };
}

export function createMockEnvValidation(): EnvValidationInterface {
  return {
    env: MOCK_ENV_CONFIG,
    validateEnvironment: jest.fn(() => ({ isValid: true, errors: [] })),
    validateEnvironmentVariables: jest.fn(() => ({ valid: true, errors: [] })),
    validateEnvironmentSafe: jest.fn(() => MOCK_VALIDATION_RESULT),
    isDevelopment: jest.fn(() => false),
    parseCountries: jest.fn((value?: string) => {
      if (!value) {
        return MOCK_ENV_CONFIG.checkout.countries;
      }
      return value.split(',').map(country => country.trim());
    }),
    getEnvironmentInfo: jest.fn(() => MOCK_ENV_INFO),
    getTypedEnvironment: jest.fn(() => MOCK_STRIPE_KEYS),
  };
}