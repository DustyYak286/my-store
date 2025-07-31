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
npm run test            # Run all Jest tests
npm run test:watch      # Run tests in watch mode
npm run lint            # Run ESLint
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

### Testing Strategy
- **Unit tests** for hooks and utilities using Jest
- **Component tests** using React Testing Library
- **Integration tests** for complex user flows
- All tests configured with jsdom environment and Next.js test setup

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