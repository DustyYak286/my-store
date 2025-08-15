"use client";
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import { CART_STORAGE_KEY } from "@/constants/storage";
import type { CartItem } from "@/types/cart";
import type { ID } from "@/types/common";

// Local cart context interface (different from types/cart.ts)
interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  totalPrice: number;
  addToCart: (item: CartItem, quantity: number) => void;
  removeFromCart: (itemId: ID) => void;
  updateItemQuantity: (itemId: ID, newQuantity: number) => void;
  clearCart: () => void;
}

// Create the context
const CartContext = createContext<CartContextType | undefined>(undefined);

// Define cart storage structure for localStorage
interface CartStorage {
  cartId: string;
  items: CartItem[];
}

// CartProvider to wrap the app and provide cart state
export const CartProvider = ({ children }: { children: ReactNode }) => {
  // Cart items state - array of CartItem objects
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on component mount
  useEffect(() => {
    const loadCartFromStorage = () => {
      try {
        const storedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (storedCart) {
          const cartData: CartStorage = JSON.parse(storedCart);
          setCartItems(cartData.items || []);
        }
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
        // If there's an error, start with empty cart
        setCartItems([]);
      } finally {
        setIsLoaded(true);
      }
    };

    loadCartFromStorage();
  }, []);

  // Check for cart clearing instructions after cart is loaded
  useEffect(() => {
    if (!isLoaded) return;

    const checkCartClearingInstructions = async () => {
      try {
        // Get session ID from sessionStorage if available
        const sessionId = sessionStorage.getItem('checkout_session_id');
        
        // Get order ID from URL parameters if on success/error pages
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order_id');

        // Only check if we have cart items and identifiers
        if (cartItems.length > 0 && (sessionId || orderId)) {
          const params = new URLSearchParams();
          if (sessionId) params.set('sessionId', sessionId);
          if (orderId) params.set('orderId', orderId);

          const response = await fetch(`/api/cart/check-clearing?${params.toString()}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.shouldClear) {
              console.log(`🧹 Cart cleared automatically: ${data.reason}`);
              setCartItems([]);
            }
          }
        }
      } catch (error) {
        // Silently handle errors - cart clearing is not critical
        console.warn('Cart clearing check failed:', error);
      }
    };

    // Small delay to ensure page navigation is complete
    const timer = setTimeout(checkCartClearingInstructions, 1000);
    return () => clearTimeout(timer);
  }, [isLoaded, cartItems.length]);

  // Save cart to localStorage whenever cartItems changes
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load is complete

    try {
      const cartData: CartStorage = {
        cartId: 'guest_session_id', // As specified in PRD for future user association
        items: cartItems
      };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }
  }, [cartItems, isLoaded]);

  // Memoized cart count calculation
  const cartCount = useMemo(() => 
    cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );

  // Memoized total price calculation (using discounted price)
  const totalPrice = useMemo(() => 
    cartItems.reduce((total, item) => {
      const itemPrice = item.price.discount ?? item.price.original;
      const itemQuantity = typeof item.quantity === 'number' ? item.quantity : 0;
      return total + (itemPrice * itemQuantity);
    }, 0),
    [cartItems]
  );

  // Add items to cart - adds new item or updates quantity if it already exists
  const addToCart = useCallback((item: CartItem, quantity: number) => {
    // Validate item data
    if (!item || !item.price || typeof item.price.original !== 'number' || item.price.original < 0) {
      console.error('Invalid item data:', item);
      return;
    }
    
    setCartItems((prevItems) => {
      // Check if item already exists in cart
      const existingItem = prevItems.find(cartItem => cartItem.id === item.id);
      
      if (existingItem) {
        // Item exists, update quantity using map
        return prevItems.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem
        );
      } else {
        // Item doesn't exist, add new item
        const newItem: CartItem = {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          quantity: quantity
        };
        return [...prevItems, newItem];
      }
    });
  }, []); // No dependencies needed since we use functional updates

  // Remove item completely from cart
  const removeFromCart = useCallback((itemId: ID) => {
    setCartItems((prevItems) => prevItems.filter(item => item.id !== itemId));
  }, []);

  // Update quantity of a specific item
  const updateItemQuantity = useCallback((itemId: ID, newQuantity: number) => {
    if (newQuantity <= 0) {
      // If quantity is 0 or negative, remove the item
      removeFromCart(itemId);
      return;
    }
    
    setCartItems((prevItems) =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  }, [removeFromCart]);

  // Clear all items from cart
  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  // Functions are stable due to useCallback, but included for explicit dependencies
  const contextValue = useMemo(() => ({
    cartItems, 
    cartCount, 
    totalPrice,
    addToCart, 
    removeFromCart, 
    updateItemQuantity, 
    clearCart 
  }), [cartItems, cartCount, totalPrice, addToCart, removeFromCart, updateItemQuantity, clearCart]);

  // Provide all cart functions and state to consumers
  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

// Custom hook for easy access
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
