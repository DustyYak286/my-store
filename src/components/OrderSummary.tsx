"use client";

import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/utils/formatPrice";
import { useMemo } from "react";
import { Plus, Minus, Trash2 } from "lucide-react";

export default function OrderSummary() {
  const { cartItems, cartCount, updateItemQuantity, removeFromCart } = useCart();

  // Calculate comprehensive totals with memoization (same logic as CartModal)
  const totals = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const original = item.price.original;
      const discount = item.price.discount ?? original;
      const qty = item.quantity;
      
      acc.original += original * qty;
      acc.discounted += discount * qty;
      
      return acc;
    }, { original: 0, discounted: 0 });
  }, [cartItems]);

  const savings = totals.original - totals.discounted;

  // Helper function to calculate percentage off
  const getPercentageOff = (original: number, discount: number) => {
    if (original <= 0) return 0;
    return Math.round((1 - discount / original) * 100);
  };

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
    <div className="space-y-4" role="region" aria-label="Order summary">
      {/* Cart Items */}
      <div className="space-y-3">
        {cartItems.map((item, index) => {
          const hasDiscount = item.price.discount && item.price.discount < item.price.original;
          const discountedPrice = item.price.discount ?? item.price.original;
          const percentOff = hasDiscount ? getPercentageOff(item.price.original, item.price.discount!) : 0;
          const itemTotal = discountedPrice * item.quantity;

          return (
            <article 
              key={item.id} 
              className="flex items-start gap-3 p-3 lg:p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              aria-label={`${item.name}, quantity ${item.quantity}`}
            >
              {/* Product Image */}
              <div className="flex-shrink-0">
                <img 
                  src={item.image} 
                  alt=""
                  className="w-16 h-16 lg:w-20 lg:h-20 object-cover rounded-md"
                  loading="lazy"
                />
              </div>
              
              {/* Product Details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[#7C4D59] font-medium text-sm lg:text-base mb-1 line-clamp-2">
                  {item.name}
                </h3>
                
                {/* Price Display */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[#7C4D59] text-sm font-semibold" aria-label={`Price: $${formatPrice(discountedPrice)}`}>
                    ${formatPrice(discountedPrice)}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-gray-500 text-xs line-through" aria-label={`Original price: $${formatPrice(item.price.original)}`}>
                        ${formatPrice(item.price.original)}
                      </span>
                      <span className="bg-neutral-100 text-[#7C4D59] text-xs px-2 py-0.5 rounded-md font-medium" aria-label={`${percentOff} percent off`}>
                        {percentOff}% OFF
                      </span>
                    </>
                  )}
                </div>
                
                {/* Quantity Controls */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                    className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full text-[#7C4D59] transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={12} />
                  </button>
                  
                  <span className="text-[#7C4D59] font-medium text-sm min-w-[20px] text-center">
                    {item.quantity}
                  </span>
                  
                  <button
                    onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                    className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full text-[#7C4D59] transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus size={12} />
                  </button>
                  
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="ml-2 w-6 h-6 flex items-center justify-center bg-red-100 hover:bg-red-200 rounded-full text-red-600 transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                
                {/* Item Total */}
                <div className="flex items-center justify-end">
                  <span className="text-[#7C4D59] font-semibold text-sm lg:text-base" aria-label={`Item total: $${formatPrice(itemTotal)}`}>
                    ${formatPrice(itemTotal)}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Enhanced Order Total Section (matching CartModal format) */}
      <div className="border-t border-gray-200 pt-4">
        {/* Subtotal (original prices) */}
        <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
          <span>Subtotal ({cartCount} items):</span>
          <span>${formatPrice(totals.original)}</span>
        </div>
        
        {/* Discount Savings */}
        {savings > 0 && (
          <div className="flex justify-between items-center text-sm text-rose-500 mb-2">
            <span>Discount savings:</span>
            <span>−${formatPrice(savings)}</span>
          </div>
        )}
        
        {/* Total */}
        <div className="flex justify-between items-center border-t border-gray-200 pt-3 mt-3">
          <span className="text-[#7C4D59] font-bold text-lg lg:text-xl">Order Total:</span>
          <span className="text-[#7C4D59] font-bold text-xl lg:text-2xl" aria-label={`Order total: $${formatPrice(totals.discounted)}`}>
            ${formatPrice(totals.discounted)}
          </span>
        </div>
        
        {/* Item count text for tests */}
        <div className="text-xs lg:text-sm text-gray-500 mt-2">
          {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your order
        </div>
      </div>
    </div>
  );
} 