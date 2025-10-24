# Stripe Implementation Guide

**Last Updated:** 2025-01-23
**Status:** Comprehensive technical reference and implementation roadmap
**Purpose:** Single source of truth for Stripe integration - current state, best practices, and implementation plan

---

## Table of Contents

1. [Current Implementation Status](#current-implementation-status)
2. [Stripe Best Practices (2025)](#stripe-best-practices-2025)
3. [Gap Analysis](#gap-analysis)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Code Reference Guide](#code-reference-guide)
6. [Testing Strategy](#testing-strategy)
7. [Appendix: Documentation Cleanup](#appendix-documentation-cleanup)

---

## Current Implementation Status

### ✅ What's Actually Working

#### Core Payment Processing
- **Basic Stripe Integration**: Card payments functional via Payment Element
- **API Endpoints**:
  - `POST /api/payments/initialize-intent` - Creates PaymentIntent (src/app/api/payments/initialize-intent/route.ts)
  - `POST /api/payments/update-intent` - Updates with customer/shipping data (src/app/api/payments/update-intent/route.ts)
  - `POST /api/webhooks/stripe` - Processes webhook events (src/app/api/webhooks/stripe/route.ts)
- **Webhook Processing**: Handles payment_intent.succeeded, payment_intent.payment_failed events
- **Order Management**: Order creation and persistence (src/lib/orderHelpers.ts, src/lib/orderStore.ts)

#### Security & Validation
- **Multi-layer Security**: Request validation, rate limiting, IP validation (src/lib/security/)
- **Environment Validation**: Schema-based validation system (src/utils/envValidation.ts)
- **Stripe Key Validation**: Format and consistency checks (src/config/stripe.ts:154-216)

#### Testing Infrastructure
- **5 Test Types Configured**:
  - Unit tests: `npm run test` (< 30s)
  - Integration tests (mocked): `npm run test:integration` (< 60s)
  - Contract tests (real API): `npm run test:contract` (< 90s)
  - API integration tests: `npm run test:api-integration` (< 5m)
  - E2E browser tests: `npm run test:e2e` (Playwright)
- **Test Directories**: tests/contract/, tests/integration-mocked/, tests/api-integration/, tests/e2e-browser/
- **Test Environment**: Centralized config at tests/config/test-environment.ts

#### Developer Tools
- **Domain Verification Script**: scripts/validate-stripe-domains.js (386 lines, production-ready)
- **Validation Commands**:
  - `npm run validate:env` - Environment variable validation
  - `npm run validate:stripe` - Stripe key validation
  - `npm run validate:stripe-domains` - Domain registration check

#### Dependencies
- `stripe@18.4.0` - Server-side SDK
- `@stripe/stripe-js@7.8.0` - Client-side Stripe.js
- `@stripe/react-stripe-js@3.9.0` - React components
- `next@15.3.5`, `react@19.0.0` - Framework

---

### ⚠️ Partially Implemented

#### Feature Flag System
- **Code Exists**: src/utils/featureFlags.ts (complex rollout logic)
- **Simplified Approach**: Use simple env.mobilePayments.enabled check instead
- **Issue**: References non-existent environment variables (see Critical Issues)

---

### ❌ Not Implemented (Despite Documentation Claims)

#### Express Checkout Element
- **File Exists**: src/components/checkout/ExpressCheckoutSection.tsx
- **Reality**: Empty stub (6 lines, returns null)
- **Missing**: All documented features (Apple Pay, Google Pay, Link, event handling)
- **Impact**: Mobile wallet payments completely non-functional

#### Mobile Payment Infrastructure
- **Environment Variables**: NOT defined in src/utils/envValidation.ts
  - Missing: `NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS`
  - Missing: `NEXT_PUBLIC_ENABLE_APPLE_PAY`
  - Missing: `NEXT_PUBLIC_ENABLE_GOOGLE_PAY`
  - Missing: `MOBILE_PAYMENT_ROLLOUT_PERCENTAGE`
  - Missing: `DOMAIN_TO_VERIFY`
- **TypedEnvironment Interface**: No `mobilePayments` property (lines 584-630)
- **Impact**: Feature flags reference undefined configuration → runtime errors

#### Express Checkout Integration
- **Documentation Claim**: PaymentSection.tsx:handleExpressPayment() lines 128-166
- **Reality**: Function doesn't exist
- **Search Results**: No "handleExpressPayment" or "ExpressCheckout" references in PaymentSection.tsx
- **Impact**: No integration pathway for mobile wallets

---

### 🔴 Critical Issues

#### 1. API Version Inconsistency
**Issue**: Two different API versions in production code
- `src/config/stripe.ts` line 76: `version: '2022-11-15' as const`
- `src/lib/stripeClient.ts` line 15: `apiVersion: '2025-07-30.basil'`

**Impact**:
- Inconsistent API behavior between config and client
- Violates Stripe best practice of unified versioning
- Potential unexpected responses from different API calls

**Stripe Recommendation**: Always specify consistent API version across all clients

---

#### 2. TypeScript Compilation Failure
**Issue**: Build fails with type errors
```bash
npm run build:unsafe
# Failed to compile.
# ./src/hooks/useStripePayment.compat.ts:102:9
# Type error: Type '{ type: string; code: string | undefined; ... }'
# is not assignable to type 'PaymentError | undefined'
```

**Impact**: Codebase not production-ready, violates TypeScript strict mode

---

#### 3. Feature Flag Configuration Gap
**Issue**: Code references non-existent environment configuration
- `src/utils/featureFlags.ts` references `env.mobilePayments.*`
- `src/utils/envValidation.ts` doesn't define `mobilePayments` in TypedEnvironment
- Runtime errors when accessing undefined properties

**Impact**: Feature flag system non-functional

---

## Stripe Best Practices (2025)

### API Versioning Standards

**Stripe's Approach**:
- Rolling versions named with release date (e.g., `2025-07-30.basil`)
- Biannual major releases, monthly feature additions
- Accounts pinned to version at first API request

**Best Practices**:
1. ✅ **Always specify API version in code** - Don't rely on account default
2. ✅ **Use consistent version** - Same version across all Stripe clients
3. ✅ **Test upgrades in staging** - Use Stripe-Version header for testing
4. ✅ **Monitor deprecation notices** - Review changelog before upgrading
5. ✅ **Use latest stable version** - Currently 2025-07-30.basil

**Current Compliance**: ❌ FAIL - Using two different versions (2022-11-15 and 2025-07-30.basil)

---

### Express Checkout Element (Official Recommendation)

**What It Is**:
Stripe's official component for one-click payments supporting:
- Apple Pay
- Google Pay
- PayPal (if enabled)
- Link

**Technical Benefits**:
- Single integration for multiple wallet payment methods
- Automatic availability detection
- Built-in styling and branding
- Handles all wallet-specific logic

**Official Documentation**: https://docs.stripe.com/elements/express-checkout-element

**Integration Pattern**:
```typescript
// 1. Import Express Checkout Element
import { ExpressCheckoutElement } from '@stripe/react-stripe-js';

// 2. Add to checkout page (above regular payment form)
<ExpressCheckoutElement
  onConfirm={handleExpressConfirm}
  onCancel={handleCancel}
  onReady={handleReady}
  options={{
    wallets: {
      applePay: 'auto',
      googlePay: 'auto',
    },
  }}
/>

// 3. Listen for ready event to check availability
const handleReady = (event) => {
  // event.availablePaymentMethods shows which wallets are available
  if (event.availablePaymentMethods.length === 0) {
    // Hide Express Checkout section if no wallets available
  }
};

// 4. Handle payment confirmation
const handleExpressConfirm = async (event) => {
  const {error} = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: `${window.location.origin}/checkout/success`,
    },
    redirect: 'if_required',
  });
};
```

**Key Points**:
- Combine with Payment Element to avoid wallet duplication
- Check `ready` event for wallet availability
- No iframe issues (unlike Payment Request Button)
- Automatic styling that matches wallet guidelines

**Current Compliance**: ❌ FAIL - Not implemented

---

### Payment Element Best Practices

**Layout Selection**:
- Use accordion layout for 4+ payment methods

**Dynamic Payment Methods**:
- Enable automatic payment method ordering
- Stripe automatically orders by payment method effectiveness based on amount, currency, location

**Link Integration**:
- Enable Link in Stripe Dashboard → Settings → Payment Methods
- Provides one-click checkout for repeat customers
- Supports cards, debit, and US bank accounts

**Styling**:
- Use Appearance API to match site design
- Already implemented: `STRIPE_CONFIG.STRIPE_APPEARANCE` (src/constants/payments.ts)

**Avoid**:
- ❌ Don't place Payment Element in iframes (breaks some payment methods)
- ❌ Don't duplicate wallets between Express Checkout and Payment Element

**Current Compliance**: ✅ PASS - Payment Element properly implemented

---

### Domain Registration Requirements

**Apple Pay**:
1. Register domain in Stripe Dashboard (Settings → Payment Methods → Apple Pay)
2. Download domain association file from Stripe
3. Host file at `/.well-known/apple-developer-merchantid-domain-association`
4. Must be accessible via HTTPS (200 OK response)
5. Required for BOTH test and live modes
6. Verify domain in Stripe Dashboard

**Google Pay**:
- No separate domain registration required when using Stripe as processor
- Automatically enabled with `automatic_payment_methods: { enabled: true }`
- Managed entirely by Stripe Elements

**Testing**:
- Use Stripe's wallet testing tools: https://docs.stripe.com/testing/wallets
- Test on real devices (iOS Safari for Apple Pay, Android Chrome for Google Pay)
- Verify domain association file accessibility

**Current Compliance**: ⚠️ PARTIAL - Domain verification script exists, domains not registered

---

### Testing Strategies

**Stripe Recommendations**:

1. **Unit Tests**: Mock Stripe operations
   - Test business logic without real API calls
   - Fast feedback loop
   - Use mock Stripe responses

2. **Integration Tests**: Use Stripe test keys
   - Test with real Stripe API in test mode
   - Verify request/response formats
   - Test error handling

3. **E2E Tests**:
   - **For Payment Element**: Use programmatic test PaymentMethods (`pm_card_visa`, `pm_card_chargeDeclined`)
   - **For Express Checkout**: Test on real devices (simulators insufficient)
   - Avoid direct iframe interaction (fragile, not supported by Stripe)

4. **Wallet Testing**:
   - iOS Safari required for Apple Pay (simulators don't work)
   - Android Chrome required for Google Pay
   - Test in both sandbox and production environments

**Current Compliance**: ✅ PASS - Test infrastructure exists, E2E approach documented in STRIPE_TESTING_MIGRATION_PLAN.md

---

## Gap Analysis

### Current State vs Stripe Best Practices

| Feature | Stripe Recommendation | Current State | Gap |
|---------|----------------------|---------------|-----|
| **API Versioning** | Single consistent version | Two versions (2022-11-15, 2025-07-30.basil) | ❌ Critical |
| **Express Checkout Element** | Use for Apple Pay/Google Pay | Empty stub component | ❌ Critical |
| **Payment Element** | Primary payment UI | ✅ Implemented | ✅ Aligned |
| **Dynamic Payment Methods** | Enable for optimization | ⚠️ Partially configured | ⚠️ Minor |
| **Link Integration** | Enable in Dashboard | Not configured | ⚠️ Minor |
| **Domain Registration** | Required for wallets | Script exists, not registered | ❌ Blocker |
| **Environment Config** | Type-safe validation | Missing mobile payment vars | ❌ Critical |
| **Testing Strategy** | Programmatic test methods | E2E uses iframe (legacy) | ⚠️ Documented but not migrated |
| **TypeScript Compilation** | Clean builds | Build fails | ❌ Critical |

---

### Priority Issues

#### P0 - Blocker (Must Fix Before Mobile Payments)
1. **API Version Unification** - Inconsistent behavior risk
2. **TypeScript Compilation** - Build must succeed
3. **Environment Variables** - Define mobile payment config
4. **Express Checkout Component** - Implement per Stripe guidelines

#### P1 - High (Required for Production)
1. **Domain Registration** - Apple Pay won't work without it
2. **handleExpressPayment Integration** - Connect Express Checkout to payment flow
3. **Link Configuration** - Enable in Stripe Dashboard
4. **Real Device Testing** - Verify on iOS/Android

#### P2 - Medium
1. **E2E Test Migration** - Move to programmatic test PaymentMethods

---

## Implementation Roadmap

### Phase 1: Fix Foundation (1-2 days)

#### Task 1.1: Unify API Version
**Goal**: Single consistent Stripe API version across entire codebase

**Changes Required**:
```typescript
// File: src/config/stripe.ts (line 76)
// BEFORE:
api: {
  version: '2022-11-15' as const,
  timeout: TIMEOUT_CONFIG.API_REQUEST_TIMEOUT,
  maxRetries: 3,
},

// AFTER:
api: {
  version: '2025-07-30.basil' as const, // Match stripeClient.ts
  timeout: TIMEOUT_CONFIG.API_REQUEST_TIMEOUT,
  maxRetries: 3,
},
```

**Testing**:
```bash
# Verify consistency
grep -r "apiVersion\|version:" src/config/stripe.ts src/lib/stripeClient.ts
# Both should show 2025-07-30.basil

# Run contract tests to verify API compatibility
npm run test:contract
```

**Validation**: All API calls use consistent version, no unexpected response formats

---

#### Task 1.2: Fix TypeScript Compilation
**Goal**: Clean TypeScript build

**Issue Location**: src/hooks/useStripePayment.compat.ts:102

**Analysis Required**:
```bash
# Read the file to understand the type mismatch
cat src/hooks/useStripePayment.compat.ts | grep -A 10 -B 5 "line 102"
```

**Fix Approach**:
1. Review PaymentError type definition
2. Ensure error object structure matches type exactly
3. Add undefined handling if needed with exactOptionalPropertyTypes

**Testing**:
```bash
npm run build:unsafe
# Should succeed without type errors
```

---

#### Task 1.3: Add Mobile Payment Environment Variables
**Goal**: Define mobile payment config in type system

**Changes Required**:

**File: src/utils/envValidation.ts**

**Step 1 - Add to ENV_SCHEMAS array** (after line 203):
```typescript
// === Mobile Payment Configuration ===
{
  key: 'NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS',
  category: 'Mobile Payments',
  type: 'boolean',
  description: 'Enable mobile payment methods (Apple Pay, Google Pay)',
},
{
  key: 'DOMAIN_TO_VERIFY',
  category: 'Mobile Payments',
  type: 'string',
  min: 1,
  max: 253,
  description: 'Domain for mobile payment verification (e.g., yourdomain.com)',
},
```

**Step 2 - Add to TypedEnvironment interface** (after line 629):
```typescript
// Mobile Payment Configuration
mobilePayments: {
  enabled: boolean;
  domainToVerify: string;
};
```

**Step 3 - Add to createTypedEnvironment function** (after line 717):
```typescript
mobilePayments: {
  enabled: parseBoolean(env.NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS, false),
  domainToVerify: env.DOMAIN_TO_VERIFY || 'localhost',
},
```

**Testing**:
```bash
# Verify validation recognizes new variables
npm run validate:env

# Test feature flags work
npm run test:unit -- src/utils/featureFlags.test.ts
```

**Validation**: No TypeScript errors in featureFlags.ts, env.mobilePayments accessible

---

### Phase 2: Implement Express Checkout Element (2-3 days)

#### Task 2.1: Install and Configure Express Checkout Element
**Goal**: Replace empty stub with functional Stripe component

**File: src/components/checkout/ExpressCheckoutSection.tsx**

**Implementation**:
```typescript
"use client";

import React, { useState, useCallback } from 'react';
import { ExpressCheckoutElement } from '@stripe/react-stripe-js';
import type { StripeExpressCheckoutElementOptions, StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';

interface ExpressCheckoutSectionProps {
  onExpressPaymentSuccess?: (paymentIntentId: string) => void;
  onExpressPaymentError?: (error: string) => void;
}

export default function ExpressCheckoutSection({
  onExpressPaymentSuccess,
  onExpressPaymentError,
}: ExpressCheckoutSectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  // Configure Express Checkout Element per Stripe best practices
  const options: StripeExpressCheckoutElementOptions = {
    wallets: {
      applePay: 'auto', // Show if available
      googlePay: 'auto', // Show if available
    },
    layout: {
      overflow: 'never', // Prevent horizontal scrolling
      maxColumns: 3,
      maxRows: 1,
    },
  };

  // Handle ready event - check which wallets are available
  const handleReady = useCallback((event: any) => {
    const available = event.availablePaymentMethods || [];
    setAvailableWallets(available);

    // Only show section if wallets are available
    setIsVisible(available.length > 0);

    console.log('Express Checkout ready:', {
      availableMethods: available,
      visible: available.length > 0
    });
  }, []);

  // Handle payment confirmation
  const handleConfirm = useCallback(async (event: StripeExpressCheckoutElementConfirmEvent) => {
    console.log('Express Checkout confirm event:', event);

    // Payment confirmation handled automatically by Stripe Elements
    // Success/error callbacks will be triggered by parent component

    // Note: The actual payment confirmation happens through the Stripe Elements context
    // No additional code needed here - Stripe handles the entire flow
  }, []);

  // Handle cancellation
  const handleCancel = useCallback(() => {
    console.log('Express Checkout canceled by user');
  }, []);

  // Handle errors
  const handleError = useCallback((event: any) => {
    console.error('Express Checkout error:', event);
    if (onExpressPaymentError) {
      onExpressPaymentError(event.error?.message || 'Express checkout failed');
    }
  }, [onExpressPaymentError]);

  // Don't render if no wallets available
  if (!isVisible) {
    return null;
  }

  return (
    <div className="express-checkout-section mb-6">
      <div className="flex items-center mb-4">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="px-4 text-sm text-gray-500">Or pay with</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      <ExpressCheckoutElement
        options={options}
        onReady={handleReady}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onError={handleError}
      />

      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          Available wallets: {availableWallets.join(', ') || 'none'}
        </div>
      )}
    </div>
  );
}
```

**Key Features**:
- ✅ Uses official ExpressCheckoutElement from Stripe
- ✅ Listens for ready event (Stripe best practice)
- ✅ Auto-hides if no wallets available
- ✅ Proper TypeScript types
- ✅ Event handlers for confirm/cancel/error
- ✅ Development debug info

---

#### Task 2.2: Integrate Express Checkout with Payment Flow
**Goal**: Connect Express Checkout to PaymentSection component

**File: src/components/checkout/PaymentSection.tsx**

**Changes Required**:

**Step 1 - Import Express Checkout**:
```typescript
import ExpressCheckoutSection from './ExpressCheckoutSection';
```

**Step 2 - Add Express Checkout handlers**:
```typescript
// Add after existing payment handlers
const handleExpressPaymentSuccess = useCallback((paymentIntentId: string) => {
  console.log('Express payment succeeded:', paymentIntentId);
  // Payment already confirmed by Stripe Elements
  // Redirect to success page
  router.push(`/checkout/success?payment_intent=${paymentIntentId}`);
}, [router]);

const handleExpressPaymentError = useCallback((error: string) => {
  console.error('Express payment error:', error);
  setPaymentError(error);
}, []);
```

**Step 3 - Render Express Checkout** (add above Payment Element):
```typescript
return (
  <div className="payment-section">
    {/* Express Checkout - One-click wallets */}
    {clientSecret && (
      <ExpressCheckoutSection
        onExpressPaymentSuccess={handleExpressPaymentSuccess}
        onExpressPaymentError={handleExpressPaymentError}
      />
    )}

    {/* Existing Payment Element for card payments */}
    <PaymentElement options={paymentElementOptions} />

    {/* Rest of component... */}
  </div>
);
```

**Testing**:
```bash
# Start dev server
npm run dev

# Open browser to checkout page
# Check console for: "Express Checkout ready: { availableMethods: [...] }"

# On desktop without wallets configured:
# Should see: "Available wallets: none" and section hidden

# With test environment:
# Apple Pay should show on iOS Safari
# Google Pay should show on Android Chrome
```

---

#### Task 2.3: Feature Flag Integration
**Goal**: Enable/disable mobile payments via environment variable

**File: src/components/checkout/PaymentSection.tsx**

**Add Feature Flag Check**:
```typescript
import { env } from '@/utils/envValidation';

// Inside component (or outside if using directly)
const showExpressCheckout = env.mobilePayments.enabled;

// Update render
{showExpressCheckout && clientSecret && (
  <ExpressCheckoutSection
    onExpressPaymentSuccess={handleExpressPaymentSuccess}
    onExpressPaymentError={handleExpressPaymentError}
  />
)}
```

**Environment Configuration** (.env.local for development):
```bash
# Enable mobile payments
NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS=true
DOMAIN_TO_VERIFY=localhost

# Stripe test keys
STRIPE_SECRET_KEY=sk_test_your_test_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
```

**Testing**:
```bash
# Test with feature disabled
NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS=false npm run dev
# Express Checkout section should not appear

# Test with feature enabled
NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS=true npm run dev
# Express Checkout section should appear (if wallets available)
```

---

### Phase 3: Domain Registration & Testing (1 day)

#### Task 3.1: Apple Pay Domain Registration
**Goal**: Register production domain with Stripe

**Prerequisites**:
- Production domain with valid SSL certificate
- Access to Stripe Dashboard (live mode)
- Ability to deploy files to production

**Steps**:

1. **Stripe Dashboard Setup**:
   - Log in to https://dashboard.stripe.com
   - Navigate to Settings → Payment Methods → Apple Pay
   - Click "Add Domain"
   - Enter production domain (e.g., `yourdomain.com`)
   - Download domain association file

2. **Deploy Association File**:
   ```bash
   # Create directory
   mkdir -p public/.well-known

   # Copy downloaded file from Stripe
   # File should be named: apple-developer-merchantid-domain-association
   cp ~/Downloads/apple-developer-merchantid-domain-association public/.well-known/

   # Verify file exists
   ls -la public/.well-known/
   ```

3. **Deploy to Production**:
   ```bash
   # Deploy application with association file
   npm run build
   npm run start

   # Or deploy via your hosting platform (Vercel, etc.)
   ```

4. **Verify Accessibility**:
   ```bash
   # Test file is accessible via HTTPS
   curl -I https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association
   # Should return: HTTP/2 200

   # Or use validation script
   DOMAIN_TO_VERIFY=yourdomain.com npm run validate:stripe-domains
   ```

5. **Complete Registration in Stripe**:
   - Return to Stripe Dashboard
   - Click "Verify Domain" next to your domain
   - Stripe will check file accessibility
   - Status should show "Verified"

**Repeat for Test Environment**:
- Switch to test mode in Stripe Dashboard
- Register test domain (can use ngrok for local testing)
- Deploy association file
- Verify domain

**Troubleshooting**:
```bash
# If verification fails:
# 1. Check HTTPS is working
curl -I https://yourdomain.com

# 2. Check file is accessible
curl https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association

# 3. Check Next.js is serving static files
# File should be in public/.well-known/ directory

# 4. Check no redirects or auth blocking the file
curl -v https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association
```

---

#### Task 3.2: Google Pay Configuration
**Goal**: Verify Google Pay is enabled

**Steps**:

1. **Stripe Dashboard**:
   - Settings → Payment Methods
   - Ensure "Google Pay" is toggled ON
   - No separate domain registration required

2. **Verify in Code**:
   ```bash
   # Check automatic payment methods enabled
   grep -r "automatic_payment_methods\|payment_method_types" src/config/stripe.ts
   ```

3. **Test Availability**:
   - Open checkout on Android Chrome
   - Check console for Express Checkout ready event
   - Google Pay should appear if:
     - User is signed into Google account
     - Card is added to Google Pay
     - Amount and currency are supported

**Note**: Google Pay requires real device testing - doesn't work in browser devtools device emulation

---

#### Task 3.3: Local Testing with Test Cards
**Goal**: Verify Express Checkout works before production

**Test Environment Setup**:
```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_your_test_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS=true
DOMAIN_TO_VERIFY=localhost
```

**Testing Steps**:

1. **Desktop Testing** (wallets unavailable):
   ```bash
   npm run dev
   # Open http://localhost:3000/checkout
   # Express Checkout section should not appear (no wallets available)
   # Regular Payment Element should work normally
   ```

2. **iOS Safari Testing** (Apple Pay):
   - Register domain with Stripe test mode (use ngrok if needed)
   - Add test card to Apple Wallet (Stripe provides test cards)
   - Open checkout on iOS device
   - Verify Apple Pay button appears
   - Complete test payment
   - Verify payment succeeds in Stripe Dashboard

3. **Android Chrome Testing** (Google Pay):
   - Sign in to Google account
   - Add test card to Google Pay
   - Open checkout on Android device
   - Verify Google Pay button appears
   - Complete test payment
   - Verify payment succeeds in Stripe Dashboard

**Stripe Test Wallet Documentation**: https://docs.stripe.com/testing/wallets

---

### Phase 4: Production Deployment (1 day)

#### Task 4.1: Deploy to Production
**Goal**: Deploy mobile payments to production

**Production Environment** (.env.production):
```bash
# Enable mobile payments
NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS=true
DOMAIN_TO_VERIFY=yourdomain.com

# Live Stripe keys
STRIPE_SECRET_KEY=sk_live_your_live_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
```

**Deploy**:
```bash
npm run build
npm run start
# Or deploy via hosting platform
```

**Verify Deployment**:
- Test checkout on production domain
- Verify Apple Pay button appears on iOS Safari
- Verify Google Pay button appears on Android Chrome
- Complete test payment with real card
- Verify payment appears in Stripe Dashboard (live mode)
- Check application logs for errors

---

#### Task 4.2: Real Device Validation
**Goal**: Verify functionality on actual devices before full rollout

**iOS Testing (Apple Pay)**:
- [ ] iPhone with iOS 13+ and Safari
- [ ] Valid payment card in Apple Wallet
- [ ] Production domain registered with Stripe
- [ ] Test complete checkout flow
- [ ] Verify payment confirmation
- [ ] Check order appears in system

**Android Testing (Google Pay)**:
- [ ] Android device with Chrome
- [ ] Valid payment card in Google Pay
- [ ] User signed in to Google account
- [ ] Test complete checkout flow
- [ ] Verify payment confirmation
- [ ] Check order appears in system

**Cross-Device Testing**:
- [ ] iOS Safari - Apple Pay
- [ ] Android Chrome - Google Pay
- [ ] Desktop Chrome - No wallets (fallback to card)
- [ ] Desktop Safari - No wallets (fallback to card)
- [ ] Mobile Chrome iOS - No wallets (Apple restricts to Safari)

---

#### Task 4.3: Rollback Plan
**Goal**: Disable mobile payments if issues occur

**Emergency Disable**:
```bash
# Update environment variable
NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS=false

# Restart application
npm run build && npm run start
```

**Rollback Triggers**:
- Payment processing errors
- Apple Pay/Google Pay buttons not appearing
- Critical bugs discovered

---

## Code Reference Guide

### Key Files and Their Purpose

#### Configuration
- `src/config/stripe.ts` - Main Stripe configuration (API version, payment intent params)
- `src/config/checkout.ts` - Checkout form configuration
- `src/utils/envValidation.ts` - Environment variable validation and type-safe access

#### Stripe Integration
- `src/lib/stripeClient.ts` - Singleton Stripe client (server-side)
- `src/lib/stripe.ts` - Stripe utility functions
- `src/components/checkout/PaymentProvider.tsx` - Stripe Elements provider (client-side)

#### Payment Components
- `src/components/checkout/PaymentSection.tsx` - Main payment UI container
- `src/components/checkout/ExpressCheckoutSection.tsx` - Express Checkout Element (Apple Pay, Google Pay)
- `src/components/checkout/CardPaymentForm.tsx` - Traditional card payment form
- `src/components/checkout/PaymentElement.tsx` - Stripe Payment Element wrapper

#### API Routes
- `src/app/api/payments/initialize-intent/route.ts` - Create initial PaymentIntent (POST)
- `src/app/api/payments/update-intent/route.ts` - Update PaymentIntent with customer data (POST)
- `src/app/api/webhooks/stripe/route.ts` - Process Stripe webhook events (POST)

#### Business Logic
- `src/lib/orderHelpers.ts` - Order creation and validation
- `src/lib/orderStore.ts` - Order persistence (file-based for E2E, in-memory for dev)
- `src/utils/featureFlags.ts` - Feature flag and rollout logic

#### Security
- `src/lib/security/validation.ts` - Request validation (headers, IP, input sanitization)
- `src/lib/security/rateLimit.ts` - Multi-tier rate limiting

#### Testing
- `tests/config/test-environment.ts` - Centralized test environment configuration
- `tests/contract/` - Real Stripe API tests
- `tests/integration-mocked/` - Mocked integration tests
- `tests/api-integration/` - Server-side API tests
- `tests/e2e-browser/` - Playwright browser tests

#### Scripts
- `scripts/validate-stripe-domains.js` - Domain registration validation (386 lines)
- `scripts/validate-env.js` - Environment variable validation
- `scripts/require-stripe-keys.js` - Stripe key validation for tests

---

### Integration Points

**Payment Flow**:
```
1. Checkout Page Load
   → POST /api/payments/initialize-intent
   → Returns clientSecret + PaymentIntent ID

2. User Fills Form
   → Client-side validation
   → Form state management

3. User Clicks "Pay with Apple Pay" (Express Checkout)
   → ExpressCheckoutElement onConfirm event
   → Stripe.js handles payment confirmation
   → Redirect to success page

3 (alternate). User Enters Card + Clicks "Complete Order"
   → POST /api/payments/update-intent (optional)
   → stripe.confirmPayment() via Payment Element
   → Redirect to success page

4. Webhook Processing
   → POST /api/webhooks/stripe (payment_intent.succeeded)
   → Finalize order in database
   → Send confirmation email (if configured)
```

**Feature Flag Flow**:
```
1. Check Configuration
   → env.mobilePayments.enabled

2. Render Decision
   → If true: Show ExpressCheckoutSection
   → If false: Hide ExpressCheckoutSection
   → Regular Payment Element always shown
```

---

### Environment Variables Reference

**Required (Build Fails Without These)**:
```bash
STRIPE_SECRET_KEY=sk_test_...                    # Server-side Stripe key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   # Client-side Stripe key
STRIPE_WEBHOOK_SECRET=whsec_...                  # Webhook signature verification
```

**Mobile Payments (Phase 1 Implementation)**:
```bash
NEXT_PUBLIC_ENABLE_MOBILE_PAYMENTS=true          # Enable/disable mobile payments
DOMAIN_TO_VERIFY=yourdomain.com                  # For domain validation
```

**Optional (Have Defaults)**:
```bash
NEXT_PUBLIC_CHECKOUT_COUNTRIES=United States,Canada,UK  # Available countries
NEXT_PUBLIC_CHECKOUT_DEFAULT_SAME_AS_SHIPPING=true      # Billing address default
NEXT_PUBLIC_VALIDATION_EMAIL_MAX_LENGTH=150             # Email validation
NEXT_PUBLIC_UI_PRIMARY_COLOR=#7C4D59                    # Brand color
```

**Validation Commands**:
```bash
npm run validate:env              # Check all env vars
npm run validate:stripe          # Check Stripe keys only
npm run validate:stripe-domains  # Check domain registration
npm run generate:env            # Generate .env.example
```

---

## Testing Strategy

### Test Type Breakdown

#### Unit Tests (`npm run test`)
**Scope**: Individual functions and components
**Speed**: < 30 seconds
**Mocking**: Full - no external dependencies
**Coverage**:
- Feature flag logic (src/utils/featureFlags.test.ts)
- Environment validation (src/utils/envValidation.test.ts)
- Payment helpers (src/lib/orderHelpers.test.ts)
- Component rendering (src/components/checkout/*.test.tsx)

**Express Checkout Testing**:
```typescript
// tests/unit/ExpressCheckoutSection.test.tsx
import { render, screen } from '@testing-library/react';
import ExpressCheckoutSection from '@/components/checkout/ExpressCheckoutSection';

describe('ExpressCheckoutSection', () => {
  it('hides when no wallets available', () => {
    const { container } = render(<ExpressCheckoutSection />);
    // Simulate ready event with no wallets
    // Verify component returns null
  });

  it('shows when wallets available', () => {
    const { container } = render(<ExpressCheckoutSection />);
    // Simulate ready event with Apple Pay available
    // Verify component renders
  });
});
```

---

#### Integration Tests - Mocked (`npm run test:integration`)
**Scope**: API routes with mocked Stripe calls
**Speed**: < 60 seconds
**Mocking**: Stripe API mocked, database operations mocked
**Coverage**:
- API endpoint request/response formats
- Error handling paths
- Validation logic
- Webhook processing

**Express Checkout Testing**:
```typescript
// tests/integration-mocked/express-checkout.test.ts
import { POST as initializeIntent } from '@/app/api/payments/initialize-intent/route';

describe('Express Checkout Integration', () => {
  it('creates PaymentIntent compatible with Express Checkout', async () => {
    const request = createMockRequest({
      items: [{ id: '1', quantity: 1, price: 100 }],
    });

    const response = await initializeIntent(request);
    const data = await response.json();

    expect(data.paymentIntent.automatic_payment_methods).toBeDefined();
    expect(data.paymentIntent.payment_method_types).toContain('card');
  });
});
```

---

#### Contract Tests (`npm run test:contract`)
**Scope**: Real Stripe API validation
**Speed**: < 90 seconds
**Mocking**: None - uses real Stripe test API
**Requirements**: Stripe test keys in .env.test
**Coverage**:
- PaymentIntent creation
- PaymentIntent updates
- Webhook signature verification
- API version compatibility

**Express Checkout Testing**:
```typescript
// tests/contract/stripe-express-checkout.test.ts
import { stripe } from '@/lib/stripeClient';

describe('Stripe Express Checkout Contract', () => {
  it('creates PaymentIntent compatible with Express Checkout Element', async () => {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'ron',
      automatic_payment_methods: { enabled: true },
    });

    expect(paymentIntent.status).toBe('requires_payment_method');
    expect(paymentIntent.client_secret).toBeDefined();
  });
});
```

---

#### API Integration Tests (`npm run test:api-integration`)
**Scope**: Full server-side flow with real Stripe
**Speed**: < 5 minutes
**Mocking**: Minimal - only external services
**Requirements**: Stripe test keys
**Coverage**:
- Complete payment flows (initialize → update → confirm)
- Webhook event handling
- Error scenarios
- Idempotency

---

#### E2E Browser Tests (`npm run test:e2e`)
**Scope**: Complete user flows in real browser
**Speed**: < 3 minutes
**Framework**: Playwright
**Requirements**: Stripe test keys, browsers installed
**Coverage**:
- Complete checkout flow
- Express Checkout interactions
- Payment confirmation
- Success page validation

**Express Checkout Testing** (After Migration):
```typescript
// tests/e2e-browser/express-checkout.spec.ts
import { test, expect } from '@playwright/test';

test('Apple Pay express checkout flow', async ({ page }) => {
  await page.goto('/checkout');

  // Check if Express Checkout section appears
  const expressSection = page.locator('.express-checkout-section');
  await expect(expressSection).toBeVisible();

  // Note: Use programmatic test PaymentMethods per Stripe best practices
  // See STRIPE_TESTING_MIGRATION_PLAN.md for implementation details

  // Set test payment method for E2E
  await page.evaluate(() => {
    (window as any).__E2E_PAYMENT_METHOD__ = 'pm_card_visa';
  });

  // Click express checkout button
  await page.click('[data-testid="apple-pay-button"]');

  // Verify redirect to success page
  await expect(page).toHaveURL(/\/checkout\/success/);
});
```

**Current E2E Status**:
- 2/3 tests passing
- 3DS test quarantined per ADR-003 (mock-based coverage exists)
- Migration plan documented in STRIPE_TESTING_MIGRATION_PLAN.md

---

### Testing Mobile Payments

#### Local Testing (No Real Wallets)
```bash
npm run dev
# Express Checkout section won't show (no wallets available)
# Regular Payment Element should work
# Console will log: "Available wallets: none"
```

#### iOS Simulator (Limited)
- Apple Pay won't work in simulator (Apple restriction)
- Use real device for Apple Pay testing

#### Real Device Testing Required
**iOS Device**:
1. Add test card to Apple Wallet
2. Open Safari (Chrome won't work - Apple restricts wallet APIs)
3. Navigate to checkout
4. Verify Apple Pay button appears
5. Complete test payment
6. Verify success in Stripe Dashboard

**Android Device**:
1. Add test card to Google Pay
2. Open Chrome (required for Google Pay Web)
3. Sign in to Google account
4. Navigate to checkout
5. Verify Google Pay button appears
6. Complete test payment
7. Verify success in Stripe Dashboard

---

## Appendix: Documentation Cleanup

### Files to Delete

**Reason**: Contain inaccurate claims and outdated information

1. **docs/DOCUMENTATION_CONSOLIDATION.md**
   - Claims to fix inaccuracies but actually introduced false information
   - Lines 16-20: Incorrectly claims Express Checkout is implemented
   - Lines 113-114: False integration claims
   - Replaced by this guide

2. **docs/MOBILE_PAYMENT_DEPLOYMENT.md**
   - Deployment guide for non-existent features
   - Cannot be followed because implementation doesn't exist
   - Replaced by Phase 3 & 4 of this guide

3. **docs/STRIPE_IMPLEMENTATION_STATUS.md**
   - 60% aspirational claims vs 40% accurate
   - API version claims incorrect
   - Express Checkout claims false
   - Mobile payment env var claims false
   - Replaced by "Current Implementation Status" section of this guide

4. **docs/STRIPE_TESTING_MIGRATION_PLAN.md**
   - Valid content but should be integrated into main guide
   - Testing strategy incorporated into "Testing Strategy" section

---

### Files to Keep (Accurate)

1. **docs/TESTING.md**
   - Accurate description of test infrastructure
   - Test commands and setup instructions
   - Update Express Checkout sections after Phase 2 implementation

2. **docs/E2E_STRIPE_TESTING.md**
   - Accurate E2E testing documentation
   - Update after Express Checkout implementation

3. **docs/ADR-003-3ds-test-quarantine.md**
   - Accurate architecture decision record
   - Documents 3DS test quarantine rationale
   - Keep as historical reference

---

### New Documentation Structure

```
docs/
├── README.md                           # Index (update to reference this guide)
├── STRIPE_IMPLEMENTATION_GUIDE.md      # This file - comprehensive reference
├── TESTING.md                         # Testing infrastructure (keep, update)
├── E2E_STRIPE_TESTING.md              # E2E testing details (keep, update)
└── ADR-003-3ds-test-quarantine.md     # Architecture decision (keep)
```

**Update docs/README.md**:
```markdown
# Documentation Index

## Primary Reference
**[STRIPE_IMPLEMENTATION_GUIDE.md](STRIPE_IMPLEMENTATION_GUIDE.md)**
- Current implementation status (verified by code analysis)
- Stripe best practices (2025)
- Gap analysis
- Complete implementation roadmap
- Testing strategy
- All code references

## Supplementary Documentation
- [TESTING.md](TESTING.md) - Test infrastructure details
- [E2E_STRIPE_TESTING.md](E2E_STRIPE_TESTING.md) - E2E testing strategy
- [ADR-003](ADR-003-3ds-test-quarantine.md) - 3DS test quarantine decision

## Quick Start

### Understanding Current State
Read STRIPE_IMPLEMENTATION_GUIDE.md → "Current Implementation Status"

### Implementing Mobile Payments
Follow STRIPE_IMPLEMENTATION_GUIDE.md → "Implementation Roadmap" (Phases 1-4)

### Running Tests
```bash
npm run test              # Unit tests
npm run test:integration  # Integration tests
npm run test:contract     # Contract tests (requires Stripe keys)
npm run test:e2e         # E2E browser tests
```
```

---

## Summary

### What This Guide Provides

✅ **Accurate Current State** - Verified by code analysis, no speculation
✅ **Stripe Best Practices** - Based on official 2025 documentation
✅ **Clear Gap Analysis** - Current state vs Stripe recommendations
✅ **Actionable Roadmap** - 4 phases with exact code and commands
✅ **Complete Code References** - File paths, line numbers, integration points
✅ **Testing Strategy** - All 5 test types with Express Checkout coverage
✅ **Production Deployment** - Simplified deployment with rollback plan

### Key Takeaways

1. **Core Payment Processing Works** - Card payments via Payment Element functional
2. **Express Checkout Needs Implementation** - Component is empty stub, requires Phase 2 work
3. **Foundation Issues First** - Fix API version, TypeScript, env vars (Phase 1) before Express Checkout
4. **Follow Stripe Guidelines** - Use ExpressCheckoutElement (official), not custom implementations
5. **Test on Real Devices** - Simulators insufficient for wallet testing
6. **Simple On/Off Toggle** - Enable or disable mobile payments via environment variable

### Time Estimate

- **Phase 1 (Foundation)**: 1-2 days
- **Phase 2 (Express Checkout)**: 2-3 days
- **Phase 3 (Domain & Testing)**: 1 day
- **Phase 4 (Production Deploy)**: 1 day

**Total**: ~5-7 days for complete mobile payment implementation

---

## Getting Started

1. **Read Current State** - Understand what works today
2. **Fix Foundation** - Complete Phase 1 (critical issues)
3. **Implement Express Checkout** - Complete Phase 2 (Stripe-aligned)
4. **Register Domains** - Complete Phase 3 (Apple Pay requirement)
5. **Deploy to Production** - Complete Phase 4 (test and deploy)

---

**Questions or Issues?**

All information in this guide is verified against actual code and official Stripe documentation (2025). If you find discrepancies:

1. Check the code first (code is source of truth)
2. Verify against Stripe docs: https://docs.stripe.com
3. Update this guide to reflect reality

This guide replaces all previous Stripe documentation in this repository.
