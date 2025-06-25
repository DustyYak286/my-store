'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of the cart context
interface CartContextType {
  cartCount: number;
  addToCart: (quantity: number) => void;
}

// Create the context
const CartContext = createContext<CartContextType | undefined>(undefined);

// CartProvider to wrap the app and provide cart state
export const CartProvider = ({ children }: { children: ReactNode }) => {
  // Cart count state
  const [cartCount, setCartCount] = useState(0);

  // Add items to cart (increments count)
  const addToCart = (quantity: number) => {
    setCartCount((prev) => prev + quantity);
  };

  // Provide cartCount and addToCart to consumers
  return (
    <CartContext.Provider value={{ cartCount, addToCart }}>
      {children}
    </CartContext.Provider>
  );
};

// Custom hook for easy access
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}; 