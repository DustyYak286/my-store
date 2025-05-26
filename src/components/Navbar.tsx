'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart } from 'lucide-react';

// Example: cart count could come from props or context
const cartCount = 1;

const Navbar = () => {
  return (
    <nav className="w-full bg-analenn-primary px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo and Brand Name */}
        <Link href="/" className="flex items-center">
          <Image
            src="/analenn-logo.png"
            alt="Analenn Logo"
            width={48}
            height={48}
            className="w-12 h-12 rounded-lg object-contain mr-3"
            priority
          />
          <span className="text-2xl font-extrabold text-white tracking-wide">Analenn</span>
        </Link>

        {/* Right: Navigation Links and Cart */}
        <div className="flex items-center gap-8">
          <Link
            href="/product"
            className="text-white text-lg font-medium transition hover:underline hover:decoration-2 hover:decoration-analenn-accent"
          >
            Product
          </Link>
          <Link
            href="#features"
            className="text-white text-lg font-medium transition hover:underline hover:decoration-2 hover:decoration-analenn-accent"
          >
            Features
          </Link>
          <Link
            href="#reviews"
            className="text-white text-lg font-medium transition hover:underline hover:decoration-2 hover:decoration-analenn-accent"
          >
            Reviews
          </Link>
          <Link href="/cart" className="relative ml-4">
            <ShoppingCart className="w-7 h-7 text-white" />
            <span className="absolute -top-2 -right-2 bg-analenn-accent text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] flex items-center justify-center">
              {cartCount}
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 