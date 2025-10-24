## Relevant Files

- `src/components/FloatingCartButton.tsx` - The new component for the floating cart button.
- `src/components/FloatingCartButton.test.tsx` - Unit tests for the `FloatingCartButton` component.
- `src/app/layout.js` - The root layout file where the `FloatingCartButton` is integrated globally.
- `src/context/CartContext.tsx` - The context to be used for cart data and actions.
- `src/context/CartModalContext.tsx` - The context for managing cart modal state globally.
- `src/components/Navbar.tsx` - Updated to use the shared cart modal context.
- `src/hooks/useIntersectionObserver.ts` - A custom hook to detect when an element is visible in the viewport.
- `src/hooks/useFloatingCartVisibility.ts` - A custom hook that encapsulates the visibility logic for the floating cart button.
- `src/hooks/useCartTotals.ts` - A reusable hook for calculating cart totals and savings with memoization.
- `src/context/CartContext.tsx` - Updated to export CartItem and Price interfaces for better type safety.
- `src/constants/storage.ts` - Centralized storage keys to eliminate magic strings and improve maintainability.
- `src/context/CartContext.tsx` - Refactored state updates to use functional programming patterns with .map() for better code clarity.

### Notes

- Unit tests should be placed alongside the code files they are testing.
- Use `npm test` to run tests.

## Tasks

- [x] 1.0 Create the `FloatingCartButton` component
  - [x] 1.1 Create the file `src/components/FloatingCartButton.tsx`.
  - [x] 1.2 Set up a basic functional component that returns a button element.
  - [x] 1.3 Import and use the `useCart` hook from `CartContext` to access cart data and functions.
  - [x] 1.4 Display the number of items in the cart within a badge on the button.
  - [x] 1.5 Connect the button's `onClick` event to the `openCart` function from the cart context.

- [x] 2.0 Implement the logic to show/hide the button based on Navbar visibility
  - [x] 2.1 Create a new custom hook file `src/hooks/useIntersectionObserver.ts`.
  - [x] 2.2 Implement the `useIntersectionObserver` hook to track the visibility of a referenced element.
  - [x] 2.3 In the `FloatingCartButton` component, use the `useIntersectionObserver` hook to monitor the Navbar.
  - [x] 2.4 Use a state variable (e.g., `showButton`) in `FloatingCartButton` to control its visibility based on the observer's status.

- [x] 3.0 Integrate the `FloatingCartButton` into the main layout
  - [x] 3.1 In `src/app/(with-branding)/layout.tsx`, add a `ref` to the `Navbar` component.
  - [x] 3.2 Import and render the `FloatingCartButton` component within the layout.
  - [x] 3.3 Pass the `Navbar` ref to the `FloatingCartButton` as a prop.

- [x] 4.0 Style the `FloatingCartButton` component
  - [x] 4.1 Apply `fixed` positioning and a high `z-index` to the button.
  - [x] 4.2 Implement responsive positioning: top-right for desktop (`md:` screens and up) and bottom-right for mobile.
  - [x] 4.3 Style the button as a circle using the primary brand color for its background.
  - [x] 4.4 Style the item count badge to be clearly visible on the button.
  - [x] 4.5 Add Tailwind CSS classes for a smooth fade-in/fade-out transition based on its visibility state.

- [x] 5.0 Write unit tests for the `FloatingCartButton` component
  - [x] 5.1 Create the test file `src/components/FloatingCartButton.test.tsx`.
  - [x] 5.2 Mock the `IntersectionObserver` API and the `useCart` hook for testing purposes.
  - [x] 5.3 Write a test to ensure the button is hidden when the Navbar is visible.
  - [x] 5.4 Write a test to ensure the button is visible when the Navbar is not.
  - [x] 5.5 Write a test to confirm that clicking the button triggers the `openCart` function from the context.
  - [x] 5.6 Write a test to verify that the correct cart item count is displayed in the badge.