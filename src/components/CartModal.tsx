import { useState, useMemo } from "react";
import { ShoppingCart, X, Plus, Minus, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/utils/formatPrice";

interface CartModalProps {
  open: boolean;
  onClose: () => void;
}

const CartModal = ({ open, onClose }: CartModalProps) => {
  // Connect to CartContext to access cart items and totals
  const { cartItems, cartCount, totalPrice, updateItemQuantity, removeFromCart } = useCart();

  // Calculate comprehensive totals with memoization
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 transition-all duration-300">
      {/* Modal container */}
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-8 relative animate-fade-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#7C4D59] hover:text-[#633a48] text-2xl focus:outline-none"
          aria-label="Close cart"
        >
          <X size={28} />
        </button>
        
        {/* Title with cart count */}
        <h2 className="text-[#7C4D59] text-xl font-bold mb-4">
          Your Cart {cartCount > 0 && `(${cartCount} items)`}
        </h2>

        {/* Cart content */}
        {cartItems.length === 0 ? (
          // Empty cart display
          <div className="flex flex-col items-center justify-center my-8">
            <ShoppingCart size={64} className="text-[#bfa6ad] mb-4" />
            <div className="text-[#7C4D59] text-md text-center mb-6">
              Your cart is empty
            </div>
          </div>
        ) : (
          // Cart items display
          <div className="mb-6">
            {/* Cart items list */}
            <div className="max-h-64 overflow-y-auto mb-4">
              {cartItems.map((item) => {
                const hasDiscount = item.price.discount && item.price.discount < item.price.original;
                const discountedPrice = item.price.discount ?? item.price.original;
                const percentOff = hasDiscount ? getPercentageOff(item.price.original, item.price.discount!) : 0;
                
                return (
                  <div key={item.id} className="flex items-center gap-3 py-3 border-b border-gray-200 last:border-b-0">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[#7C4D59] font-medium text-sm truncate">
                        {item.name}
                      </h3>
                      
                      {/* Enhanced Price Display */}
                      <div className="flex items-center gap-2 flex-wrap">
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
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2">
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
                    </div>
                    
                    {/* Item Total */}
                    <div className="text-right">
                      <p className="text-[#7C4D59] font-semibold text-sm">
                        ${formatPrice(discountedPrice * item.quantity)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Enhanced Cart Total Section */}
            <div className="border-t border-gray-300 pt-4 mt-4">
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
              <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                <span className="text-[#7C4D59] font-bold text-lg">Total:</span>
                <span className="text-[#7C4D59] font-bold text-xl">
                  ${formatPrice(totals.discounted)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mt-6">
          {cartItems.length > 0 ? (
            // Buttons for cart with items
            <>
              <button
                key="checkout-button"
                disabled
                className="w-full bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold cursor-not-allowed text-center"
                title="Checkout functionality coming soon"
              >
                Checkout (Coming Soon)
              </button>
              <button
                key="continue-shopping-button"
                onClick={onClose}
                className="w-full bg-[#7C4D59] text-white px-6 py-3 rounded-lg font-semibold focus:outline-none hover:bg-[#633a48] transition-colors text-center"
              >
                Continue Shopping
              </button>
            </>
          ) : (
            // Button for empty cart
            <button
              key="empty-cart-button"
              onClick={onClose}
              className="w-full bg-[#7C4D59] text-white px-6 py-3 rounded-lg font-semibold focus:outline-none hover:bg-[#633a48] transition-colors text-center"
            >
              Continue Shopping
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartModal;
