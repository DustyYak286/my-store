
# PRD: Floating Cart Icon

## 1. Introduction/Overview

This document outlines the requirements for a floating cart icon feature. The purpose of this feature is to improve cart accessibility by ensuring that users can always access their shopping cart, even after scrolling past the main navigation bar. When the Navbar is no longer in the viewport, a small, floating cart button will appear. This button will provide the same functionality as the cart icon in the Navbar.

## 2. Goals

- Ensure users can access the cart from anywhere on the page without needing to scroll back to the top.
- Provide a seamless and intuitive user experience.
- Implement a solution that is visually unobtrusive and consistent with the existing site design.
- Ensure the feature is functional across both desktop and mobile devices.

## 3. User Stories

- **As a user browsing on a desktop or mobile device,** when I scroll down the page and the main navigation bar is no longer visible, I want a floating cart icon to appear so that I can easily open my cart.
- **As a user,** when I scroll back to the top of the page and the navigation bar becomes visible again, I want the floating cart icon to disappear to avoid visual clutter.

## 4. Functional Requirements

1.  The system must display a floating cart button when the main Navbar is scrolled out of the viewport.
2.  The floating cart button must be hidden when the main Navbar is visible in the viewport.
3.  The button must display a badge with the current number of items in the cart, consistent with the Navbar's cart icon.
4.  Clicking the floating cart button must open the existing cart modal.
5.  The button's appearance and disappearance must be animated with a simple fade-in/fade-out effect over a medium duration (300ms).
6.  The button must be positioned in the top-right corner on desktop screens and the bottom-right corner on mobile screens.

## 5. Non-Goals (Out of Scope)

- This feature will not introduce any new cart functionality (e.g., a different cart modal or a mini-cart view). It will only trigger the existing cart modal.
- The floating button's appearance or position will not be user-configurable.
- The feature will not include any other floating elements besides the cart icon.

## 6. Design Considerations

- **Icon:** Use the same cart icon as the one in the main Navbar.
- **Button Style:** A simple circular button with a solid background color that matches the site's primary color scheme.
- **Positioning (Desktop):** `position: fixed; top: 24px; right: 24px;`
- **Positioning (Mobile):** `position: fixed; bottom: 16px; right: 16px;`
- **Animation:** Use Tailwind CSS transitions for a fade-in/fade-out effect with a 300ms duration.
- **Layering:** The button must have a `z-index` high enough to ensure it appears above all other page content without being obstructed.

## 7. Technical Considerations

- **Viewport Detection:** Use the `IntersectionObserver` API to efficiently detect when the Navbar component enters or exits the viewport. This is preferred over scroll event listeners for performance reasons.
- **Component Structure:** Create a self-contained React component named `FloatingCartButton.tsx` located in the `src/components` directory.
- **Integration:** The `FloatingCartButton` component should be integrated into the main application layout (e.g., `src/app/layout.js` or a relevant layout file) so it is available across all pages.
- **State Management:** The component should hook into the existing `CartContext` to get the cart item count and to trigger the cart modal.

## 8. Success Metrics

- The floating cart button appears if and only if the Navbar is not visible in the viewport.
- The item count on the button's badge is always synchronized with the actual number of items in the cart.
- Clicking the button successfully and reliably opens the cart modal.
- The feature is verified to work correctly on popular desktop and mobile browsers (e.g., Chrome, Firefox, Safari).
- The animations are smooth and do not negatively impact page performance.

## 9. Open Questions

- None at this time.
