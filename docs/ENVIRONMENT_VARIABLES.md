# Environment Variables Guide

## Overview

The application uses a comprehensive environment variable system with production-grade validation and type safety. This guide covers all environment variables, their usage, and the clear distinction between test and application environments.

## Environment Files Structure

### Clear File Distinctions

#### `.env.test` - **TESTING ONLY** 🧪
- **Purpose**: Exclusively for test environments (unit, integration, contract, E2E tests)
- **Contains**: Test-specific configuration with Stripe **test keys only**
- **Usage**: Loaded automatically by test environment system (`tests/config/test-environment.ts`)
- **Safety**: All Stripe keys validated to ensure they start with `sk_test_`, `pk_test_`, `whsec_`
- **When used**: Only when running `npm run test:*` commands
- **Git tracking**: Included in repository (contains safe test keys)

#### `.env.local` - **DEVELOPMENT & PRODUCTION** 🚀
- **Purpose**: Local development and production environments  
- **Contains**: Real application configuration (can use live Stripe keys for production)
- **Usage**: Loaded by Next.js for the running application
- **Flexibility**: Can contain either test keys (development) or live keys (production)
- **When used**: When running `npm run dev`, `npm run build`, `npm start`
- **Git tracking**: Gitignored (contains sensitive keys)

### File Precedence

#### For Tests (`npm run test:*`)
1. `.env.test.local` - Local test overrides (gitignored, create if needed)
2. **`.env.test`** - **Main test configuration** ← Primary for testing
3. `.env.local` - Fallback for backward compatibility

#### For Application (`npm run dev`, `npm run build`)
1. **`.env.local`** - **Main development/production config** ← Primary for app
2. `.env` - Base environment configuration

### Practical Usage Examples

#### Development Setup
```bash
# .env.local (for running the app locally - npm run dev)
STRIPE_SECRET_KEY=sk_test_...        # Test keys for development
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# .env.test (for running tests - npm run test:*)
STRIPE_SECRET_KEY=sk_test_...        # Same test keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=test
TEST_MODE=true
```

#### Production Setup
```bash
# .env.local (or environment variables for production)
STRIPE_SECRET_KEY=sk_live_...        # LIVE keys for production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# .env.test (unchanged - always test keys for CI/CD)
STRIPE_SECRET_KEY=sk_test_...        # Test keys for CI/CD
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=test
TEST_MODE=true
```

## Required Variables

### Stripe Configuration (Required for all environments)
```bash
STRIPE_SECRET_KEY=sk_test_...                          # Server-side secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...         # Client-side publishable key
STRIPE_WEBHOOK_SECRET=whsec_...                        # Webhook signature validation
```

**Security Requirements:**
- **Development**: Use test keys (`sk_test_`, `pk_test_`, `whsec_`)
- **Production**: Use live keys (`sk_live_`, `pk_live_`, `whsec_`) 
- **Testing**: Always test keys only (enforced by validation)

### Core Environment (Test-specific)
```bash
NODE_ENV=test                                          # Environment mode for tests
TEST_MODE=true                                         # Enable test-specific features
TEST_VERBOSE=false                                     # Enable verbose test logging
TEST_INTEGRATION=false                                 # Integration test mode flag
```

## Application Configuration Variables

### Checkout Configuration
```bash
NEXT_PUBLIC_CHECKOUT_COUNTRIES=US,CA,GB,EU,RO         # Supported countries
NEXT_PUBLIC_CHECKOUT_DEFAULT_SAME_AS_SHIPPING=true    # Default billing same as shipping
NEXT_PUBLIC_CHECKOUT_PROCESSING_DELAY=100             # Processing delay (ms)
NEXT_PUBLIC_CHECKOUT_REDIRECT_DELAY=100               # Redirect delay (ms)
NEXT_PUBLIC_CHECKOUT_ENABLE_BILLING_ADDRESS=true     # Enable billing address section
NEXT_PUBLIC_CHECKOUT_ENABLE_REALTIME_VALIDATION=true # Enable real-time validation
```

### Validation Rules
```bash
NEXT_PUBLIC_VALIDATION_EMAIL_REGEX=^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$  # Email validation regex
NEXT_PUBLIC_VALIDATION_EMAIL_MAX_LENGTH=150                        # Max email length
NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX=^[A-Za-z0-9\\s-]{3,10}$  # Postal code regex
NEXT_PUBLIC_VALIDATION_NAME_MIN_LENGTH=1                          # Min name length
NEXT_PUBLIC_VALIDATION_NAME_MAX_LENGTH=100                        # Max name length
NEXT_PUBLIC_VALIDATION_ADDRESS_MIN_LENGTH=1                       # Min address length
NEXT_PUBLIC_VALIDATION_CITY_MIN_LENGTH=1                          # Min city length
```

### UI Customization
```bash
NEXT_PUBLIC_UI_PRIMARY_COLOR="#7C4D59"                # Primary theme color (must be quoted!)
NEXT_PUBLIC_UI_PRIMARY_HOVER_COLOR="#6A3E49"          # Primary hover color (must be quoted!)
```

**Important**: Color values with `#` must be quoted to prevent shell interpretation as comments.

### Feature Flags
```bash
NEXT_PUBLIC_FEATURE_REAL_TIME_VALIDATION=true         # Enable real-time form validation
NEXT_PUBLIC_FEATURE_AUTO_FILL_BILLING=true           # Enable auto-fill billing from shipping
NEXT_PUBLIC_FEATURE_BILLING_ADDRESS_SECTION=true     # Show billing address section
```

### User Messages
```bash
NEXT_PUBLIC_MESSAGE_ORDER_SUCCESS="Order placed successfully! You will receive a confirmation email shortly."
NEXT_PUBLIC_MESSAGE_ORDER_ERROR="There was an error processing your order. Please try again."
NEXT_PUBLIC_MESSAGE_FORM_INCOMPLETE="Please fill in all required fields before proceeding."
```

## Environment Validation

### Production-Grade Validation System
- **Location**: `tests/config/test-environment.ts` (for tests) & `src/utils/envValidation.ts` (for app)
- **Schema**: Zod-based validation with type coercion
- **Modes**: Unit tests (fail-fast) vs Integration tests (warn-continue)  
- **Type Safety**: Full TypeScript integration

### Validation Commands
```bash
# Application environment validation
npm run validate:env         # Validate all environment variables
npm run validate:env:strict  # Strict mode (warnings as errors)

# Test environment validation  
npm run validate:stripe      # Validate Stripe keys for testing
```

### Pre-Test Validation
Contract and E2E tests automatically validate Stripe keys before execution using `scripts/require-stripe-keys.js`.

## Setup Instructions

### For New Development
1. **Create `.env.local`** with your development configuration:
   ```bash
   cp .env.example .env.local  # If example exists
   # Add your Stripe test keys and custom configuration
   ```

2. **Verify `.env.test`** contains test configuration:
   ```bash
   # Should already exist with test keys and test-specific settings
   # Modify only if you need different test settings
   ```

### For Testing Setup
1. **Use existing `.env.test`** - already configured with test keys
2. **Override locally** if needed with `.env.test.local`:
   ```bash
   # Create .env.test.local for local test overrides (optional)
   TEST_VERBOSE=true           # Enable verbose logging for debugging
   ```

### For Production Deployment
1. **Set environment variables** via your deployment platform:
   ```bash
   STRIPE_SECRET_KEY=sk_live_...        # LIVE keys for production
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
2. **Keep `.env.test`** unchanged for CI/CD testing

## Validation Features

### Type Safety & Coercion
- **Boolean coercion**: `z.coerce.boolean()` for string-to-boolean conversion
- **Number coercion**: `z.coerce.number()` for numeric values with range validation
- **String validation**: Regex patterns for specific formats (email, postal codes)
- **Color validation**: Hex color code validation for UI variables

### Security Features  
- **Test key enforcement**: Test environments only accept test keys
- **Format validation**: Stripe keys must match expected prefixes
- **Environment isolation**: Test variables don't leak to production
- **Key prefix validation**: Automatic validation of `sk_test_`, `pk_test_`, `whsec_` patterns

### Error Handling
- **Clear error messages**: Specific guidance for missing/invalid variables
- **Environment-specific behavior**: Fail-fast vs warn-continue based on context
- **Precedence documentation**: Clear file loading order
- **Troubleshooting guidance**: Common issues and solutions

## Environment Variable Types

### Public Variables (`NEXT_PUBLIC_`)
- **Availability**: Both server and client code
- **Usage**: Client-side configuration, feature flags, UI customization
- **Security**: Safe for browser exposure (no secrets)

### Server Variables (No prefix)
- **Availability**: Server-side code only  
- **Usage**: API keys, sensitive configuration, server secrets
- **Security**: Never exposed to the client

### Test Variables (`TEST_`)
- **Availability**: Test environments only
- **Usage**: Test configuration, debugging options, test behavior control
- **Security**: Safe test-specific settings

## Common Issues & Solutions

### Missing Environment Variables
```
Error: Missing required Stripe keys for contract/integration tests
```
**Solution**: Add Stripe test keys to `.env.test` or `.env.local`

### Invalid Stripe Keys
```
Error: STRIPE_SECRET_KEY must start with "sk_test_" for test environment
```
**Solution**: Ensure you're using Stripe test keys, not live keys in test environments

### Color Value Parsing Issues
```
Error: UI color variables loading as empty strings
```
**Solution**: Quote color values with `#` characters:
```bash
NEXT_PUBLIC_UI_PRIMARY_COLOR="#7C4D59"  # Correct - quoted
NEXT_PUBLIC_UI_PRIMARY_COLOR=#7C4D59    # Incorrect - shell treats # as comment
```

### Environment File Not Loading
**Check file precedence and ensure variables are in the correct file:**

For application issues:
1. Check `.env.local` first (highest precedence for app)
2. Verify with `npm run validate:env`

For test issues:  
1. Check `.env.test` first (highest precedence for tests)
2. Verify with `npm run validate:stripe`

### Mixed Test/Live Keys
**Solution**: Keep environments separate:
- `.env.test` → Always test keys
- `.env.local` → Test keys for development, live keys for production

## Key Takeaways

### ✅ File Usage Rules
- **`.env.test`** → Testing only (`npm run test:*`)
- **`.env.local`** → Development & production (`npm run dev`, `npm run build`)
- Never mix test and live keys in the same environment

### ✅ Security Best Practices
- Test keys in `.env.test` are safe to commit
- Live keys in `.env.local` must never be committed (gitignored)
- Always validate keys before deployment

### ✅ Troubleshooting Priority  
1. Check correct file for your use case
2. Verify key formats and prefixes
3. Use validation commands to diagnose issues
4. Check file precedence if values aren't loading

For comprehensive validation and testing information, see the [Testing Guide](./TESTING.md).