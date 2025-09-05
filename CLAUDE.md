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
npm run test:e2e                 # Run browser E2E tests with revolutionary monitoring
npm run test:all                 # Run all test suites
npm run test:ci                  # Fast tests for CI/PRs (unit + mocked integration)
npm run test:ci:full             # Full test suite for main branch
npm run lint                     # Run ESLint
npm run validate:stripe          # Validate Stripe environment keys
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

#### 1. Context-Based State Management
The application uses React Context for global state management:
- `CartContext` - Shopping cart state (items, quantities, totals)
- `CartModalContext` - Modal visibility and interactions
- `ToastContext` - Notification system

State is persisted to localStorage with error handling and validation.

#### 2. Environment-Driven Configuration
Centralized configuration in `src/config/checkout.ts` driven by type-safe environment variables:
- Validation rules (email regex, field lengths)
- UI customization (colors, delays)
- Feature flags (real-time validation, billing section)
- Internationalization (countries, messages)

#### 3. Component Organization
```
src/components/
├── forms/          # Reusable form inputs (InputField, SelectField)
├── checkout/       # Checkout-specific sections
└── [root]         # Main UI components
```

#### 4. Custom Hooks Pattern
Business logic extracted into custom hooks:
- `useCart()` - Cart operations and state
- `useCartTotals()` - Price calculations
- `useCheckoutForm()` - Form validation and submission
- `useFloatingCartVisibility()` - UI behavior
- `useToast()` - Notifications

#### 5. Type-Safe API Structure
```
src/app/api/products/
├── route.ts        # GET /api/products
├── [id]/route.ts   # GET /api/products/[id]
└── data.ts         # Product data source
```

### Environment Validation System
Production-grade environment validation with:
- **Build-time validation** - Prevents deployment with invalid config
- **Runtime validation** - Graceful fallbacks in production
- **Type safety** - Schema-based validation with TypeScript integration
- **Error boundaries** - Production error handling

Configuration validated includes checkout behavior, validation rules, UI customization, and feature flags.

### Revolutionary Testing Architecture
Production-grade testing system with industry-leading 5-layer monitoring architecture:

- **Unit Tests** (`npm run test`) - Fast, mocked, no secrets required
- **Integration Tests** (`npm run test:integration`) - Mocked Stripe, centralized config
- **Contract Tests** (`npm run test:contract`) - Real Stripe test API validation
- **API Integration** (`npm run test:api-integration`) - Comprehensive server-side testing
- **Browser E2E** (`npm run test:e2e`) - Revolutionary 5-layer monitoring system

**Key Technical Features**:
- **Centralized environment loader** (`tests/config/test-environment.ts`) - Type-safe configuration
- **Production-grade resource management** - Clean test exits with comprehensive diagnostics
- **Warning budget system** - Prevents test quality degradation (max 10 React `act()` warnings)
- **Type-safe configuration** - Zod validation with TypeScript integration
- **Cross-process communication** - File-based order persistence for E2E reliability

**Revolutionary Innovations**:
- **5-Layer Monitoring System** - Unprecedented payment completion detection
- **Cross-Process Order Persistence** - Architectural breakthrough for E2E testing
- **Environment-Driven Configuration** - Scales to 25+ countries dynamically
- **ADR-003 3DS Strategy** - Evidence-based test quarantine with comprehensive coverage

**Clean Architecture**: Production-grade test organization with zero redundancies, zero mock conflicts, and single source of truth for configurations

**Mock Architecture Excellence**:
- **Shared Configuration** (`tests/mocks/shared/mockEnvConfig.ts`) - Single source of truth for all environment objects
- **Factory Pattern** - Fresh mock instances per test for perfect isolation
- **Clean Separation** - Unit tests use `__mocks__/`, integration tests use factory pattern
- **DRY Principle** - All mocks inherit from shared configuration, one place to update

### Test Quality Management
Production-grade test monitoring with warning budget system:
- **Warning Budget**: Max 10 React `act()` warnings per test run
- **Async Cleanup**: Global cleanup utilities prevent timing issues
- **Resource Management**: Proper AbortController + mounted flag patterns
- **CI Integration**: Tests fail if quality thresholds exceeded

For actions that require more details related to TESTING, ALWAYS CHECK `docs/TESTING.md` for comprehensive testing guidance and THOROUGHLY understand our testing strategy. NEVER MAKE UNFOUNDED ASSUMPTIONS. Check `tests/setup/README.md` if you need implementation details.

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

