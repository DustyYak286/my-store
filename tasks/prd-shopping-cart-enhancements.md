# PRD: Shopping Cart Enhancements

## 1. Introduction/Overview

This document outlines the requirements for enhancing the shopping cart functionality for the Analenn e-commerce store. The current implementation has a basic structure but lacks true functionality. This feature will introduce a persistent, client-side cart where users can add, view, modify, and remove products seamlessly.

The primary goal is to provide an intuitive and reliable cart management experience that serves as a solid foundation for a future full checkout process.

## 2. Goals

- **Implement a fully functional client-side cart:** Utilize React Context and browser `localStorage` to manage and persist cart state.
- **Enable complete cart manipulation:** Allow users to add items, update item quantities, and remove items from their cart.
- **Provide clear user feedback:** Offer non-intrusive notifications when items are added to the cart and ensure the cart icon is always up-to-date.
- **Design for the future:** Structure the code and data in a way that simplifies a future transition to server-side, user-account-based cart persistence.

## 3. User Stories

- **As a user,** I want to add a product to my cart so I can save it for a later purchase.
- **As a user,** I want to view all the items in my cart, including their names, images, prices, and quantities, so I can review my selections.
- **As a user,** I want to change the quantity of an item in my cart so I can easily buy more or fewer of it.
- **As a user,** I want to remove an item from my cart if I no longer wish to purchase it.
- **As a user,** I want my cart to be saved if I reload the page or close my browser so that my selected items are not lost.

## 4. Functional Requirements

### 4.1. Cart State Management (`CartContext.tsx`)

1.  The cart state must store a list of items, where each item is an object containing: `{ id, name, price, image, quantity }`.
2.  The `CartContext` must provide the following functions:
    - `addToCart(item, quantity)`: Adds a new item or updates the quantity if it already exists.
    - `removeFromCart(itemId)`: Removes an item completely.
    - `updateItemQuantity(itemId, newQuantity)`: Updates the quantity of a specific item.
    - `clearCart()`: Empties the entire cart.
3.  The context must calculate and expose the total number of items (`cartCount`) and the total price of all items in the cart (`totalPrice`).
4.  The entire cart state must be synchronized with the browser's `localStorage` on every modification (add, remove, update).
5.  On initial application load, the cart state must be rehydrated from `localStorage` if data exists.
6.  The data structure for the stored cart should be an object like `{ cartId: 'guest_session_id', items: [...] }` to pave the way for associating carts with user IDs in the future.

### 4.2. User Feedback & Notifications

1.  When a user successfully adds an item to the cart, a non-intrusive toast notification must appear briefly to confirm the action (e.g., "Item added to cart").
2.  The cart icon in the main navigation bar must always display the correct total number of items in the cart.

### 4.3. Cart Viewing and Interaction (`CartModal.tsx`)

1.  The modal must display a list of all items currently in the cart.
2.  For each item, the following must be clearly visible:
    - Product Image
    - Product Name
    - Product Price
    - Quantity (with controls to increase/decrease)
3.  Users must be able to remove an item directly from the cart modal.
4.  The modal must display a subtotal, which is the sum of the prices of all items and their quantities.
5.  If the cart is empty, a message "Your cart is empty" should be displayed prominently.
6.  The modal must contain a "Checkout" button. For this version, this button will be present but disabled.
7.  The modal must contain a "Continue Shopping" button that closes the modal.

## 5. Non-Goals (Out of Scope)

- The complete checkout process, including payment processing and shipping information.
- User authentication and account systems.
- Server-side persistence of the shopping cart. Carts will not be shared across different devices.

## 6. Design Considerations

- The `CartModal` UI should be a modal overlay that is consistent with the existing site's aesthetic (e.g., colors, fonts, button styles).
- Quantity controls should be intuitive, such as using "+" and "-" buttons next to the quantity display.
- A simple, custom-built toast notification component should be created to avoid adding external dependencies. It should appear, for instance, in the top-right corner and fade out automatically.

## 7. Technical Considerations

- State management will be handled via React Context (`createContext`, `useContext`).
- Persistence will be handled using the `window.localStorage` API.
- All cart logic should be encapsulated within `CartContext.tsx`.
- The UI components will primarily be `CartModal.tsx` and a new `Toast.tsx`.

## 8. Success Metrics

- A user can successfully add, view, update the quantity of, and remove items from the cart.
- The cart's state correctly persists across page reloads and browser sessions for a single user on the same device.
- The user interface provides clear, immediate feedback for all cart-related actions.

## 9. Open Questions

- What is the desired behavior for the "Checkout" button? (Assumption: It will be styled as a disabled button for this iteration).
