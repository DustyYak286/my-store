# Test Setup Configuration

Production-grade test configuration files for the payment processing system.

## Files

### Environment Configuration
- **`test-environment.ts`** - Production-grade centralized environment loader
- **`test-env.ts`** - Legacy compatibility wrapper  
- **`contract-env.ts`** - Contract test environment setup
- **`e2e.setup.ts`** - API integration test setup with real Stripe
- **`contract.setup.ts`** - Contract test setup with real Stripe

### Mock Configuration
- **`integration-mocks.setup.ts`** - Clean mock setup for mocked integration tests (factory pattern)

### Test Utilities
- **`async-utils.ts`** - Async testing utilities with proper cleanup patterns
- **`unit.setup.ts`** - Unit test configuration with warning budget system

## Key Features

### Warning Budget System
- **Budget**: Maximum 10 React act() warnings per test run
- **Tracking**: Automatic counting and reporting
- **Enforcement**: Tests fail if budget exceeded

### Production-Grade Resource Management  
- Controlled HTTP agents for external API calls
- Clean test exits without hanging
- Proper async cleanup patterns

For detailed information, see [Testing Guide](../../docs/TESTING.md).