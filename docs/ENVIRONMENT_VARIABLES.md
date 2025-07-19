# Environment Variables Configuration

This document describes the environment variables available for configuring the checkout form behavior.

## Overview

The checkout form uses environment variables to allow flexible configuration without code changes. All variables are prefixed with `NEXT_PUBLIC_` to make them available in the browser.

## Configuration Categories

### 🛍️ Checkout Form Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_CHECKOUT_COUNTRIES` | `"United States,Canada,..."` | Comma-separated list of available countries |
| `NEXT_PUBLIC_CHECKOUT_DEFAULT_SAME_AS_SHIPPING` | `"true"` | Default state for "Same as shipping" checkbox |
| `NEXT_PUBLIC_CHECKOUT_PROCESSING_DELAY` | `"1000"` | Processing delay in milliseconds |
| `NEXT_PUBLIC_CHECKOUT_REDIRECT_DELAY` | `"2000"` | Redirect delay after successful order |

### ✅ Validation Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_VALIDATION_EMAIL_REGEX` | `"^[^\s@]+@[^\s@]+\.[^\s@]+$"` | Email validation regex pattern |
| `NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX` | `"^[A-Za-z0-9\s-]{3,10}$"` | Postal code validation regex |
| `NEXT_PUBLIC_VALIDATION_NAME_MIN_LENGTH` | `"2"` | Minimum length for name fields |
| `NEXT_PUBLIC_VALIDATION_NAME_MAX_LENGTH` | `"50"` | Maximum length for name fields |
| `NEXT_PUBLIC_VALIDATION_ADDRESS_MIN_LENGTH` | `"5"` | Minimum length for address fields |
| `NEXT_PUBLIC_VALIDATION_CITY_MIN_LENGTH` | `"2"` | Minimum length for city fields |

### 🎨 UI Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_UI_PRIMARY_COLOR` | `"#7C4D59"` | Primary brand color (hex) |
| `NEXT_PUBLIC_UI_PRIMARY_HOVER_COLOR` | `"#633a48"` | Primary color on hover (hex) |

### 🚀 Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_FEATURE_REAL_TIME_VALIDATION` | `"true"` | Enable real-time validation |
| `NEXT_PUBLIC_FEATURE_AUTO_FILL_BILLING` | `"true"` | Auto-fill billing from shipping |
| `NEXT_PUBLIC_FEATURE_BILLING_ADDRESS_SECTION` | `"true"` | Show billing address section |

### 💬 Messages

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_MESSAGE_ORDER_SUCCESS` | `"Thank you for your order!"` | Success message |
| `NEXT_PUBLIC_MESSAGE_ORDER_ERROR` | `"Something went wrong. Please try again."` | Error message |
| `NEXT_PUBLIC_MESSAGE_FORM_INCOMPLETE` | `"Please fill in all required fields to place your order"` | Form validation message |

## Usage Examples

### Development (.env.local)
```bash
# Custom country list for European market
NEXT_PUBLIC_CHECKOUT_COUNTRIES="Germany,France,Italy,Spain,Netherlands,Belgium,Austria,Switzerland"

# Stricter validation for European addresses
NEXT_PUBLIC_VALIDATION_POSTAL_CODE_REGEX="^[0-9]{4,5}$"

# Custom branding
NEXT_PUBLIC_UI_PRIMARY_COLOR="#2563eb"
NEXT_PUBLIC_UI_PRIMARY_HOVER_COLOR="#1d4ed8"

# Feature flags
NEXT_PUBLIC_FEATURE_REAL_TIME_VALIDATION="false"
NEXT_PUBLIC_FEATURE_BILLING_ADDRESS_SECTION="false"
```

### Production
```bash
# Production optimizations
NEXT_PUBLIC_CHECKOUT_PROCESSING_DELAY="2000"
NEXT_PUBLIC_CHECKOUT_REDIRECT_DELAY="3000"

# Localized messages
NEXT_PUBLIC_MESSAGE_ORDER_SUCCESS="¡Gracias por tu pedido!"
NEXT_PUBLIC_MESSAGE_ORDER_ERROR="Algo salió mal. Por favor, inténtalo de nuevo."
```

## Configuration Benefits

### 🔧 **Flexibility**
- Change behavior without code deployment
- A/B test different configurations
- Environment-specific settings

### 🌍 **Internationalization**
- Different countries per region
- Localized validation patterns
- Custom messages per locale

### 🎨 **Brand Customization**
- White-label the checkout form
- Match your brand colors
- Customize user experience

### 🚀 **Feature Management**
- Enable/disable features per environment
- Gradual rollout of new features
- Performance optimizations

## Implementation Details

The configuration is centralized in `src/config/checkout.ts` which:
- Reads environment variables with fallbacks
- Provides type safety with TypeScript interfaces
- Handles parsing and validation
- Exports structured configuration objects

## Best Practices

1. **Always provide fallbacks** - The system works even without environment variables
2. **Use feature flags** - Enable/disable features without code changes
3. **Validate regex patterns** - Invalid patterns fall back to defaults
4. **Test configurations** - Verify behavior in different environments
5. **Document changes** - Keep this file updated when adding new variables

## Migration Guide

If you're migrating from hardcoded values:

1. Copy your current values to environment variables
2. Test thoroughly in development
3. Deploy configuration to staging/production
4. Monitor for any issues

The system is designed to be backward compatible, so existing installations will continue to work with default values. 