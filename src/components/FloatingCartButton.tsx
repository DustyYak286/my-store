"use client";

import React from "react";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCartModal } from "@/context/CartModalContext";
import { useFloatingCartVisibility } from "@/hooks/useFloatingCartVisibility";

interface FloatingCartButtonProps {
  navbarRef: React.RefObject<HTMLElement>;
}

const FloatingCartButton = ({ navbarRef }: FloatingCartButtonProps) => {
  const { cartCount } = useCart();
  const { openCart } = useCartModal();
  const { shouldShowButton } = useFloatingCartVisibility({ navbarRef });
  
  return (
    <button
      onClick={openCart}
      className={`fixed z-50 bottom-4 right-4 md:top-6 md:right-6 md:bottom-auto w-12 h-12 bg-analenn-primary rounded-full flex items-center justify-center shadow-lg hover:bg-analenn-secondary focus:bg-analenn-secondary focus:ring-2 focus:ring-analenn-accent focus:ring-offset-2 transition-all duration-300 outline-none ${
        shouldShowButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
      aria-label="Open cart"
    >
      <ShoppingCart className="w-6 h-6 text-white" />
      {cartCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-analenn-accent text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
          {cartCount}
        </span>
      )}
    </button>
  );
};

export default FloatingCartButton; 