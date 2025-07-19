# Gemini Context

This file provides context for the Gemini CLI to understand the project better.

## Technology Stack

- **Framework:** Next.js (React)
- **Language:** JavaScript & TypeScript
- **Styling:** Tailwind CSS
- **Package Manager:** npm
- **Testing:** Jest, React Testing Library

## Project Structure

- **Pages:** Located in `src/app`. The main page is `src/app/page.js`. Dynamic routes are in `src/app/products/[id]`.
- **Components:** Reusable components are in `src/components`.
- **Static Assets:** Public assets are in the `public` directory.
- **Constants:** Application constants are stored in `src/constants`.
- **Context:** React context providers are in `src/context`.
- **Hooks:** Custom React hooks are in `src/hooks`.
- **Utils:** Utility functions are in `src/utils`.
- **API Routes:** API endpoints are defined in `src/app/api`.

## Important Commands

- **Run development server:** `npm run dev`
- **Create a production build:** `npm run build`
- **Start production server:** `npm run start`
- **Run linter:** `npm run lint`
- **Run tests:** `npm test`
- **Run tests in watch mode:** `npm test:watch`

## Conventions

- Follow existing code style and file structure.
- Use TypeScript (`.tsx`) for new React components where applicable.
- Components should be self-contained and placed in the `src/components` directory.
- Tests are co-located with the files they test (e.g., `CartModal.tsx` and `CartModal.test.tsx`).