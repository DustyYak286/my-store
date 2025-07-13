## Relevant Files

- `src/app/checkout/page.tsx` - ✅ Created - The new page component for the checkout flow.
- `src/components/CheckoutForm.tsx` - ✅ Created - A new component to handle the checkout form logic and UI.
- `src/components/OrderSummary.tsx` - ✅ Created - A new component to display the cart contents on the checkout page.
- `src/components/CartModal.tsx` - ✅ Modified - Enabled the checkout button with navigation.

### Notes

- Unit tests should be created for the new components.
- Use `npm test` to run tests.

## Tasks

- [x] 1.0 Create the basic structure for the checkout page.
  - [x] 1.1 Create a new directory `src/app/checkout`.
  - [x] 1.2 Create a new file `src/app/checkout/page.tsx`.
  - [x] 1.3 Add the basic layout to the `page.tsx` file, including a main container and placeholders for the `OrderSummary` and `CheckoutForm` components.
- [x] 2.0 Implement the Order Summary component.
  - [x] 2.1 Create a new file `src/components/OrderSummary.tsx`.
  - [x] 2.2 In `OrderSummary.tsx`, fetch cart data (`cartItems`, `totalPrice`) from `useCart` context.
  - [x] 2.3 Display the cart items, including product image, name, quantity, and price for each item.
  - [x] 2.4 Display the total price of the order.
  - [x] 2.5 Add styling to match the website's design.
- [x] 3.0 Implement the Checkout Form component.
  - [x] 3.1 Create a new file `src/components/CheckoutForm.tsx`.
  - [x] 3.2 Create state variables using `useState` to manage the form inputs (Contact, Shipping, Billing).
  - [x] 3.3 Build the form with input fields for all the required information as per the PRD.
  - [x] 3.4 Implement the "Same as shipping address" checkbox logic to auto-fill billing address fields.
  - [x] 3.5 Add a "Place Order" button.
  - [x] 3.6 Add styling for the form and its inputs to match the website's design.
- [x] 4.0 Enable the checkout button and connect the components.
  - [x] 4.1 In `src/components/CartModal.tsx`, remove the `disabled` attribute from the "Checkout" button and add an `onClick` handler to navigate to `/checkout`.
  - [x] 4.2 In `src/app/checkout/page.tsx`, import and render the `OrderSummary` and `CheckoutForm` components.
  - [x] 4.3 In `CheckoutForm.tsx`, implement the `handlePlaceOrder` function. This function should perform basic validation, call `clearCart()` from the context, show a toast notification, and redirect to the home page.
  - [x] 4.4 Ensure the `ToastProvider` is correctly set up to display the order confirmation message.