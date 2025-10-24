"use client";
import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from "react";

interface CartModalContextType {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartModalContext = createContext<CartModalContextType | undefined>(undefined);

export const CartModalProvider = ({ children }: { children: ReactNode }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const contextValue = useMemo(() => ({
    isCartOpen,
    openCart,
    closeCart
  }), [isCartOpen, openCart, closeCart]);

  return (
    <CartModalContext.Provider value={contextValue}>
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