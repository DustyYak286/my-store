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
      <div className="text-center py-8">
        <div className="text-gray-500 text-lg">Your cart is empty</div>
        <div className="text-gray-400 text-sm mt-2">Add some items to proceed with checkout</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cart Items */}
      <div className="space-y-4">
        {cartItems.map((item) => {
          const hasDiscount = item.price.discount && item.price.discount < item.price.original;
          const discountedPrice = item.price.discount ?? item.price.original;
          const percentOff = hasDiscount ? getPercentageOff(item.price.original, item.price.discount!) : 0;
          const itemTotal = discountedPrice * item.quantity;

          return (
            <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              {/* Product Image */}
              <div className="flex-shrink-0">
                <img 
                  src={item.image} 
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-md"
                />
              </div>
              
              {/* Product Details */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[#7C4D59] font-medium text-base mb-1">
                  {item.name}
                </h3>
                
                {/* Price Display */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[#7C4D59] text-sm font-semibold">
                    ${formatPrice(discountedPrice)}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-gray-500 text-xs line-through">
                        ${formatPrice(item.price.original)}
                      </span>
                      <span className="bg-neutral-100 text-[#7C4D59] text-xs px-2 py-0.5 rounded-md font-medium">
                        {percentOff}% OFF
                      </span>
                    </>
                  )}
                </div>
                
                {/* Quantity and Item Total */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-sm">
                    Quantity: {item.quantity}
                  </span>
                  <span className="text-[#7C4D59] font-semibold">
                    ${formatPrice(itemTotal)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Total */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center">
          <span className="text-xl font-semibold text-[#7C4D59]">
            Order Total:
          </span>
          <span className="text-2xl font-bold text-[#7C4D59]">
            ${formatPrice(totalPrice)}
          </span>
        </div>
      </div>
    </div>
  );
} 