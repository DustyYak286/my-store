import { useMemo } from "react";
import { useCart, CartItem } from "@/context/CartContext";

interface CartTotals {
  original: number;
  discounted: number;
  savings: number;
}

export const useCartTotals = (): CartTotals => {
  const { cartItems } = useCart();

  const totals = useMemo(() => {
    const calculated = cartItems.reduce((acc, item) => {
      const original = item.price.original;
      const discount = item.price.discount ?? original;
      const qty = item.quantity;
      
      acc.original += original * qty;
      acc.discounted += discount * qty;
      
      return acc;
    }, { original: 0, discounted: 0 });

    return {
      ...calculated,
      savings: calculated.original - calculated.discounted,
    };
  }, [cartItems]);

  return totals;
};

// Helper function to calculate percentage off
export const getPercentageOff = (original: number, discount: number): number => {
  if (original <= 0) return 0;
  return Math.round((1 - discount / original) * 100);
}; 