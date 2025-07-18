"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import CartModal from "./CartModal";
import { useCart } from "@/context/CartContext";

const Navbar = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const { cartCount } = useCart();
  const pathname = usePathname();
  
  // Hide navigation buttons on checkout page
  const isCheckoutPage = pathname === '/checkout';

  return (
    <nav className="w-full bg-analenn-primary px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo and Brand Name */}
        <Link href="/" className="flex items-center">
          <Image
            src="/images/analenn-logo.png"
            alt="Analenn Logo"
            width={48}
            height={48}
            className="w-12 h-12 rounded-lg object-contain mr-3"
          />
          <span className="text-2xl font-extrabold text-white tracking-wide">
            Analenn
          </span>
        </Link>

        {/* Right: Navigation Links and Cart - Hidden on checkout page */}
        {!isCheckoutPage && (
          <div className="flex items-center gap-8">
            <a
              href="#product"
              className="text-white text-lg font-medium transition hover:underline hover:decoration-2 hover:decoration-analenn-accent"
            >
              Product
            </a>
            <a
              href="#features"
              className="text-white text-lg font-medium transition hover:underline hover:decoration-2 hover:decoration-analenn-accent"
            >
              Features
            </a>
            <a
              href="#reviews"
              className="text-white text-lg font-medium transition hover:underline hover:decoration-2 hover:decoration-analenn-accent"
            >
              Reviews
            </a>
            <button
              onClick={() => setCartOpen(true)}
              className="relative ml-4 focus:outline-none"
              aria-label="Open cart"
            >
              <ShoppingCart className="w-7 h-7 text-white" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-analenn-accent text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
      <CartModal open={cartOpen} onClose={() => setCartOpen(false)} />
    </nav>
  );
};

export default Navbar;
