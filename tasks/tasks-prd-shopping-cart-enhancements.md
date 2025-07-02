## Relevant Files

- `src/context/CartContext.tsx` - To be updated with full cart state management logic.
- `src/components/CartModal.tsx` - To be updated to display cart items and totals.
- `src/components/Toast.tsx` - A new component for user feedback notifications.
- `src/components/Hero.tsx` - To be updated to use the new `addToCart` function.
- `src/components/ProductDetails.tsx` - To be updated to use the new `addToCart` function.
- `src/context/CartContext.test.tsx` - Unit tests for the cart logic.
- `src/components/CartModal.test.tsx` - Unit tests for the cart modal UI.

### Notes

- Unit tests should be placed alongside the code files they are testing.
- Use `npm test` to run all tests.

## Tasks

- [x] 1.0 Enhance `CartContext` for Full Cart Management
  - [x] 1.1 Define the `CartItem` type and update the context's state to manage an array of `CartItem` objects.
  - [x] 1.2 Implement the `addToCart` function to add items or update quantities.
  - [x] 1.3 Implement `removeFromCart`, `updateItemQuantity`, and `clearCart` functions.
  - [x] 1.4 Add logic to calculate `cartCount` and `totalPrice`.
  - [x] 1.5 Integrate `localStorage` to persist and rehydrate the cart state.
- [ ] 2.0 Implement User Feedback Notifications
  - [x] 2.1 Create a new `Toast.tsx` component for displaying notifications.
  - [x] 2.2 Create a `useToast` hook to manage toast visibility and content.
  - [x] 2.3 Add a `ToastProvider` to the main layout to render the toast container.
- [ ] 3.0 Update `CartModal` to Display and Manage Cart Items
  - [ ] 3.1 Connect the modal to the `CartContext` to access cart items and totals.
  - [ ] 3.2 Render the list of cart items, including image, name, price, and quantity.
  - [ ] 3.3 Implement quantity controls (+/- buttons) and a remove button for each item.
  - [ ] 3.4 Display the calculated `totalPrice`.
  - [ ] 3.5 Add a disabled "Checkout" button and a functional "Continue Shopping" button.
- [ ] 4.0 Integrate Existing Components with the New Cart Context
  - [ ] 4.1 Update the `addToCart` calls in `Hero.tsx` and `ProductDetails.tsx` to pass the full product object.
  - [ ] 4.2 Ensure the `Navbar` cart icon correctly reflects the `cartCount` from the context.
- [ ] 5.0 Write and Run Tests for Cart Functionality
  - [ ] 5.1 Write unit tests for all functions in `CartContext`.
  - [ ] 5.2 Write unit tests for the `CartModal` component to verify it displays items correctly.
  - [ ] 5.3 Run all tests using `npm test` and ensure they pass.
