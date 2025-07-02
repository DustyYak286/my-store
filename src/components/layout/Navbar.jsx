"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import Image from "next/image";
import { STORE_NAME } from "@/constants/store";
import { useCart } from "@/context/CartContext";

const Navbar = () => {
  const { cartCount } = useCart();
  return (
    <nav className="bg-analenn-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo/Brand */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/analenn-logo.png"
              alt="Analenn Logo"
              width={48}
              height={48}
            />
            <span className="text-2xl font-bold text-analenn-primary tracking-wide">
              {STORE_NAME}
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden sm:flex sm:space-x-8">
            <Link
              href="/"
              className="text-analenn-secondary hover:text-analenn-primary px-3 py-2 rounded-md text-sm font-medium"
            >
              Home
            </Link>
            <Link
              href="/product"
              className="text-analenn-secondary hover:text-analenn-primary px-3 py-2 rounded-md text-sm font-medium"
            >
              Product
            </Link>
          </div>

          {/* Cart Icon */}
          <button
            className="relative p-2 text-analenn-secondary hover:text-analenn-primary"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-6 w-6" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-analenn-primary rounded-full">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
