# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development
```bash
npm run dev              # Start development server with Turbopack
npm run build            # Build with environment validation (recommended)
npm run build:unsafe     # Build without environment validation (emergency use)
npm start               # Start production server
```

### Testing & Quality
```bash
npm run test                     # Run unit tests (default, fast)
npm run test:watch               # Run unit tests in watch mode
npm run test:unit                # Run unit tests only
npm run test:integration         # Run mocked integration tests
npm run test:contract            # Run contract tests (requires Stripe keys)
npm run test:api-integration     # Run comprehensive API integration tests
npm run test:e2e                 # Run browser E2E tests with Playwright
npm run test:all                 # Run all test suites
npm run test:ci                  # Fast tests for CI/PRs (unit + mocked integration)
npm run test:ci:full             # Full test suite for main branch
npm run lint                     # Run ESLint
npm run validate:stripe          # Validate Stripe environment keys
npm run validate:stripe:strict   # Strict Stripe validation (warnings as errors)
npm run validate:stripe-domains  # Validate Stripe domain verification
npm run check:console-unicode    # Check for Unicode characters in console statements
npm run setup:hooks              # Setup Git hooks for development
```

### Environment Management
```bash
npm run validate:env         # Validate environment variables
npm run validate:env:strict  # Strict validation (treats warnings as errors)
npm run generate:env         # Generate example .env file
```

## Architecture Overview

### Core Technology Stack
- **Next.js 15** with App Router architecture
- **React 19** with strict TypeScript mode
- **Tailwind CSS** for styling with custom color palette
- **Jest + Testing Library** for testing
- **Custom environment validation system** for production reliability

### Key Architectural Patterns

#### State Management (React Context)
- `CartContext` - Shopping cart state, persisted to localStorage
- `CartModalContext` - Modal visibility
- `ToastContext` - Notifications

#### Configuration
- **Environment Variables**: `src/utils/envValidation.ts` - Type-safe validation with schema
- **Checkout Config**: `src/config/checkout.ts` - Validation rules, UI, feature flags, i18n

#### Component Organization
```
src/components/
├── forms/          # Reusable form inputs
├── checkout/       # Checkout sections (CardPaymentForm, ExpressCheckoutSection, PaymentSection)
└── [root]         # Main UI components
```

#### Custom Hooks
- `useCart()` - Cart operations
- `useCheckoutForm()` - Form validation and submission
- `useToastContext()` - Notifications

#### API Routes
```
src/app/api/
├── products/
│   ├── route.ts        # GET /api/products
│   ├── [id]/route.ts   # GET /api/products/[id]
│   └── data.ts         # Product data source
├── payments/
│   ├── create-intent/  # PaymentIntent creation
│   ├── initialize-intent/ # PaymentIntent initialization
│   └── update-intent/  # PaymentIntent updates
├── orders/[id]/        # Order management and persistence
├── webhooks/
│   ├── stripe/         # Stripe webhook handling
│   └── monitoring/     # Webhook monitoring
└── cart/check-clearing/ # Cart clearing verification
```

### Environment Validation
Type-safe validation system (`src/utils/envValidation.ts`):
- **Build-time validation** - Prevents deployment with invalid config
- **Runtime validation** - Graceful fallbacks in production
- **Schema-based** - TypeScript integration with Zod-style validation
- Validates: checkout behavior, validation rules, UI customization, feature flags

### Testing Architecture
5 test types with comprehensive coverage:

#### Test Types
- **Unit Tests** (`npm run test`) - Fast, mocked, no secrets required (< 30s)
- **Integration Tests** (`npm run test:integration`) - Mocked Stripe, centralized config (< 60s)
- **Contract Tests** (`npm run test:contract`) - Real Stripe test API validation (< 90s)
- **API Integration** (`npm run test:api-integration`) - Comprehensive server-side testing (< 5m)
- **Browser E2E** (`npm run test:e2e`) - Playwright browser tests with E2E monitoring infrastructure (< 3m)

#### Key Infrastructure
- **Centralized Environment** (`tests/config/test-environment.ts`) - Type-safe Zod validation
- **E2E Test Monitoring** (`src/components/CheckoutForm.tsx:229-912`) - Multi-layer payment detection for E2E tests only (activates when `navigator.webdriver` detected)
- **Cross-Process Persistence** (`src/lib/orderStore.ts`) - File-based storage for E2E, in-memory for development
- **Enhanced Assertions** (`tests/helpers/monitoringAssertions.ts`) - Validation beyond basic Jest
- **Async Test Utilities** (`tests/setup/async-utils.ts`) - `flushAsync()` prevents act() warnings
- **Mock Architecture** (`tests/mocks/shared/mockEnvConfig.ts`) - Single source of truth for all test environments

#### Quality Management
- **Warning Budget** - Max 10 React `act()` warnings per run, tests fail if exceeded
- **Resource Leak Detection** - Node.js handle monitoring with diagnostics
- **Clean Test Exits** - Expected behavior varies by test type (unit: clean, API integration: 2 TLS socket leaks safe to ignore)
- **ADR-003 Strategy** - 3DS E2E test quarantined, mock-based coverage maintained

IMPORTANT: For actions requiring testing details, ALWAYS CHECK `docs/TESTING.md` for comprehensive guidance. NEVER MAKE UNFOUNDED ASSUMPTIONS about testing strategy. Check `tests/setup/README.md` for implementation details.

### File Import Patterns
- Use `@/` path alias for all src imports
- Context imports: `import { useCart } from "@/context/CartContext"`
- Component imports: `import ComponentName from "@/components/ComponentName"`
- Utility imports: `import { formatPrice } from "@/utils/formatPrice"`

### Error Handling Strategy
- **Error boundaries** wrap the entire application
- **Try-catch blocks** around localStorage operations
- **Graceful degradation** for missing environment variables
- **Production-friendly error messages** with development details when appropriate

### Build Validation
Always run environment validation before build. The system will:
- Validate all environment variables against schema
- Show helpful error messages for invalid values
- Generate example .env files
- Allow emergency builds with `build:unsafe` if needed

IMPORTANT: For Stripe payment implementation, ALWAYS refer to `docs/STRIPE_IMPLEMENTATION_GUIDE.md` for current implementation status, best practices, and implementation roadmap. This is the single source of truth for Stripe integration.

