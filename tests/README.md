# Tests Directory

This directory contains the test suites and configuration for the payment system.

## Structure

```
tests/
├── contract/              # Contract tests (real Stripe API)
├── e2e/                  # End-to-end tests (real Stripe API)
├── integration-mocked/   # Integration tests (mocked Stripe)
├── config/               # Test environment configuration
│   └── test-environment.ts  # Centralized environment loader
├── setup/                # Test setup and configuration files
└── utils/                # Test utilities and helpers
```

## Quick Reference

### Test Commands
```bash
npm run test              # Unit tests (fast)
npm run test:integration  # Integration tests (mocked)  
npm run test:contract     # Contract tests (real Stripe API)
npm run test:e2e          # E2E tests (real Stripe API)
npm run test:all          # All test suites
```

### Environment Setup
Contract and E2E tests require Stripe test keys in `.env.test`:
```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Key Features

- **Production-Grade Environment Management**: Centralized configuration with `tests/config/test-environment.ts`
- **Resource Management**: Clean test exits with proper HTTP agent lifecycle
- **Test Quality Monitoring**: Warning budget system prevents test degradation

For detailed testing information, see the main [Testing Guide](../docs/TESTING.md).