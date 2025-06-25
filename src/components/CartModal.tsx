import { useState } from 'react';
import { ShoppingCart, X } from 'lucide-react';

interface CartModalProps {
  open: boolean;
  onClose: () => void;
}

const CartModal = ({ open, onClose }: CartModalProps) => {
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
        {/* Title */}
        <h2 className="text-[#7C4D59] text-xl font-bold mb-4">Your Cart</h2>
        {/* Cart icon */}
        <div className="flex flex-col items-center justify-center my-8">
          <ShoppingCart size={64} className="text-[#bfa6ad] mb-4" />
          <div className="text-[#7C4D59] text-md text-center mb-6">Your cart is empty</div>
        </div>
        {/* Continue Shopping button */}
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="bg-[#7C4D59] text-white px-6 py-3 rounded font-semibold focus:outline-none hover:bg-[#633a48] transition"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartModal; 