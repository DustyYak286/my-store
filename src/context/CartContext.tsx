"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Define the CartItem type
interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

// Define the shape of the cart context
interface CartContextType {
  cartItems: CartItem[];
  cartCount: number;
  totalPrice: number;
  addToCart: (item: CartItem, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  updateItemQuantity: (itemId: string, newQuantity: number) => void;
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

  // localStorage key for cart data
  const CART_STORAGE_KEY = 'analenn_cart';

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

  // Calculate cart count from items
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  // Calculate total price from items
  const totalPrice = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

  // Add items to cart - adds new item or updates quantity if it already exists
  const addToCart = (item: CartItem, quantity: number) => {
    setCartItems((prevItems) => {
      // Check if item already exists in cart
      const existingItemIndex = prevItems.findIndex(cartItem => cartItem.id === item.id);
      
      if (existingItemIndex >= 0) {
        // Item exists, update quantity
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity
        };
        return updatedItems;
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
  };

  // Remove item completely from cart
  const removeFromCart = (itemId: string) => {
    setCartItems((prevItems) => prevItems.filter(item => item.id !== itemId));
  };

  // Update quantity of a specific item
  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      // If quantity is 0 or negative, remove the item
      removeFromCart(itemId);
      return;
    }
    
    setCartItems((prevItems) => {
      const updatedItems = [...prevItems];
      const itemIndex = updatedItems.findIndex(item => item.id === itemId);
      
      if (itemIndex >= 0) {
        updatedItems[itemIndex] = {
          ...updatedItems[itemIndex],
          quantity: newQuantity
        };
      }
      
      return updatedItems;
    });
  };

  // Clear all items from cart
  const clearCart = () => {
    setCartItems([]);
  };

  // Provide all cart functions and state to consumers
  return (
    <CartContext.Provider value={{ 
      cartItems, 
      cartCount, 
      totalPrice,
      addToCart, 
      removeFromCart, 
      updateItemQuantity, 
      clearCart 
    }}>
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
