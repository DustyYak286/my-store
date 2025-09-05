/**
 * Comprehensive Mock for environment validation in tests
 * Provides consistent test values without actual validation
 * Supports all functions used across unit and integration tests
 */

import { MOCK_ENV_CONFIG, MOCK_VALIDATION_RESULT, MOCK_ENV_INFO } from '../tests/mocks/shared/mockEnvConfig';

// TypedEnvironment mock that matches the real interface
export const env = MOCK_ENV_CONFIG;

// Standard validation result format
const createValidationResult = (valid = true, errors = [], warnings = []) => ({
  valid,
  errors,
  warnings,
  summary: { 
    totalChecked: errors.length + warnings.length + (valid ? 1 : 0), 
    passed: valid ? 1 : 0, 
    failed: errors.length, 
    warnings: warnings.length 
  }
});

// Core validation functions used by the real module
export function validateEnvironmentVariables() {
  return createValidationResult();
}

export function validateEnvironmentSafe() {
  return MOCK_VALIDATION_RESULT;
}

export function validateEnvironmentOrThrow() {
  const result = createValidationResult();
  if (!result.valid) {
    throw new Error('Environment validation failed');
  }
}

export function logValidationResults() {
  // Mock implementation - does nothing
}

// Legacy validation functions for backward compatibility
export function validateEnv() {
  return { isValid: true, errors: [], warnings: [] };
}

export function validateEnvironment() {
  return { isValid: true, errors: [] };
}

// Environment access functions
export function getEnvironmentInfo() {
  return MOCK_ENV_INFO;
}

export function getTypedEnvironment() {
  return env;
}

export function createTypedEnvironment() {
  return env;
}

// Utility functions
export function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function parseCountries(value: string | undefined): string[] {
  if (!value) {
    return MOCK_ENV_CONFIG.checkout.countries;
  }
  return value.split(',').map(country => country.trim());
}

export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function createRegex(value: string | undefined, defaultPattern: string): RegExp {
  if (!value) return new RegExp(defaultPattern);
  try {
    return new RegExp(value);
  } catch {
    return new RegExp(defaultPattern);
  }
}

export function generateEnvExample(): string {
  return '# Mock environment example\nNEXT_PUBLIC_EXAMPLE=value';
}