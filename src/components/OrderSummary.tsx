"use client";

import { useCart, CartItem } from "@/context/CartContext";
import { useCartTotals, getPercentageOff } from "@/hooks/useCartTotals";
import { formatPrice } from "@/utils/formatPrice";
import { Plus, Minus, Trash2 } from "lucide-react";

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
        {cartItems.map((item) => {
          const hasDiscount = item.price.discount && item.price.discount < item.price.original;
          const discountedPrice = item.price.discount ?? item.price.original;
          const percentOff = hasDiscount ? getPercentageOff(item.price.original, item.price.discount!) : 0;
          
          return (
            <div key={item.id} className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg">
              <img 
                src={item.image} 
                alt={item.name}
                className="w-16 h-16 object-cover rounded-md flex-shrink-0"
              />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-analenn-primary truncate">
                  {item.name}
                </h3>
                
                {/* Price Information */}
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="text-analenn-primary font-semibold">
                    ${formatPrice(discountedPrice)}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-gray-500 text-sm line-through">
                        ${formatPrice(item.price.original)}
                      </span>
                      <span className="bg-neutral-100 text-analenn-primary text-xs px-2 py-1 rounded-md font-medium">
                        {percentOff}% OFF
                      </span>
                    </>
                  )}
                </div>
                
                {/* Quantity Controls */}
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-gray-600 text-sm">Qty:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-analenn-primary transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={14} />
                    </button>
                    
                    <span className="text-analenn-primary font-medium text-sm min-w-[24px] text-center">
                      {item.quantity}
                    </span>
                    
                    <button
                      onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-analenn-primary transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus size={14} />
                    </button>
                    
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="ml-2 w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 rounded-full text-red-600 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Item Total */}
              <div className="text-right">
                <div className="text-analenn-primary font-semibold">
                  ${formatPrice(discountedPrice * item.quantity)}
                </div>
              </div>
            </div>
          );
        })}
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