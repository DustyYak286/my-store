"use client";

import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/utils/formatPrice";

export default function OrderSummary() {
  const { cartItems, totalPrice } = useCart();

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
                
                {/* Quantity and Item Total */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-600 text-xs lg:text-sm">
                    Qty: {item.quantity}
                  </span>
                  <span className="text-[#7C4D59] font-semibold text-sm lg:text-base" aria-label={`Item total: $${formatPrice(itemTotal)}`}>
                    ${formatPrice(itemTotal)}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Order Total */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between items-center">
          <span className="text-lg lg:text-xl font-semibold text-[#7C4D59]">
            Order Total:
          </span>
          <span className="text-xl lg:text-2xl font-bold text-[#7C4D59]" aria-label={`Order total: $${formatPrice(totalPrice)}`}>
            ${formatPrice(totalPrice)}
          </span>
        </div>
        <div className="text-xs lg:text-sm text-gray-500 mt-1">
          {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your order
        </div>
      </div>
    </div>
  );
} 