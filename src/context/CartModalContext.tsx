"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

interface CartModalContextType {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartModalContext = createContext<CartModalContextType | undefined>(undefined);

export const CartModalProvider = ({ children }: { children: ReactNode }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  return (
    <CartModalContext.Provider value={{ isCartOpen, openCart, closeCart }}>
      {children}
    </CartModalContext.Provider>
  );
};

export const useCartModal = () => {
  const context = useContext(CartModalContext);
  if (!context) {
    throw new Error("useCartModal must be used within a CartModalProvider");
  }
  return context;
}; 