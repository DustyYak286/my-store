"use client";

import React, { memo, useMemo, useCallback } from "react";
import { useCart, CartItem } from "@/context/CartContext";
import { useCartTotals, getPercentageOff } from "@/hooks/useCartTotals";
import { formatPrice } from "@/utils/formatPrice";
import { Plus, Minus, Trash2 } from "lucide-react";

// Memoized order item component for optimal performance
interface OrderItemProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

const OrderItem = memo<OrderItemProps>(({ item, onUpdateQuantity, onRemove }) => {
  // Memoize price calculations
  const priceDetails = useMemo(() => {
    const hasDiscount = item.price.discount && item.price.discount < item.price.original;
    const discountedPrice = item.price.discount ?? item.price.original;
    const percentOff = hasDiscount ? getPercentageOff(item.price.original, item.price.discount!) : 0;
    
    return { hasDiscount, discountedPrice, percentOff };
  }, [item.price.discount, item.price.original]);

  // Memoize event handlers
  const handleIncrement = useCallback(() => {
    onUpdateQuantity(item.id, item.quantity + 1);
  }, [item.id, item.quantity, onUpdateQuantity]);

  const handleDecrement = useCallback(() => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
    }
  }, [item.id, item.quantity, onUpdateQuantity]);

  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [item.id, onRemove]);

  const { hasDiscount, discountedPrice, percentOff } = priceDetails;

  return (
    <div className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg">
      <img 
        src={item.image} 
        alt={item.name}
        className="w-16 h-16 object-cover rounded-md flex-shrink-0"
      />
      
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-analenn-primary truncate">{item.name}</h3>
        
        {/* Price Display */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className="text-analenn-primary font-semibold">
            ${formatPrice(discountedPrice)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-gray-500 text-sm line-through">
                ${formatPrice(item.price.original)}
              </span>
              <span className="bg-analenn-accent/20 text-analenn-primary text-xs px-2 py-1 rounded-md font-medium">
                {percentOff}% OFF
              </span>
            </>
          )}
        </div>
        
        {/* Quantity Controls */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleDecrement}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus size={14} />
          </button>
          
          <span className="text-analenn-primary font-medium text-sm min-w-[20px] text-center">
            {item.quantity}
          </span>
          
          <button
            onClick={handleIncrement}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Increase quantity"
          >
            <Plus size={14} />
          </button>
          
          <button
            onClick={handleRemove}
            className="ml-2 w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 rounded-full text-red-600 transition-colors"
            aria-label="Remove item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      
      {/* Item Total */}
      <div className="text-right">
        <p className="text-analenn-primary font-semibold">
          ${formatPrice(discountedPrice * item.quantity)}
        </p>
      </div>
    </div>
  );
});

OrderItem.displayName = 'OrderItem';

export default function OrderSummary() {
  const { cartItems, cartCount, updateItemQuantity, removeFromCart } = useCart();
  const { original: originalTotal, discounted: discountedTotal, savings } = useCartTotals();

  if (cartItems.length === 0) {
    return (
      <div className="text-center py-8" role="status" aria-live="polite">
        <svg 
          className="w-16 h-16 mx-auto text-gray-300 mb-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <div className="text-gray-500 text-lg font-medium">Your cart is empty</div>
        <div className="text-gray-400 text-sm mt-2">Add some items to proceed with checkout</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-analenn-primary mb-4">
        Order Summary ({cartCount} items)
      </h2>
      
      {/* Cart Items */}
      <div className="space-y-4 mb-6">
        {cartItems.map((item) => (
          <OrderItem
            key={item.id}
            item={item}
            onUpdateQuantity={updateItemQuantity}
            onRemove={removeFromCart}
          />
        ))}
      </div>
      
      {/* Order Totals */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal ({cartCount} items):</span>
          <span>${formatPrice(originalTotal)}</span>
        </div>
        
        {savings > 0 && (
          <div className="flex justify-between text-rose-500">
            <span>Discount savings:</span>
            <span>−${formatPrice(savings)}</span>
          </div>
        )}
        
        <div className="flex justify-between text-lg font-bold text-analenn-primary border-t border-gray-200 pt-2 mt-4">
          <span>Total:</span>
          <span>${formatPrice(discountedTotal)}</span>
        </div>
      </div>
    </div>
  );
} 