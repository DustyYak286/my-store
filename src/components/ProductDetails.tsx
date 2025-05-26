'use client';

import Image from 'next/image';
import { Star } from 'lucide-react';

const ProductDetails = () => {
  return (
    // The heading is now outside and above the two-column layout for proper centering
    <section className="bg-white py-16 px-6 max-w-6xl mx-auto rounded-2xl shadow-sm">
      {/* Centered Section Title above the product content */}
      <h2 className="text-3xl font-extrabold text-analenn-primary text-center mb-12">Product Details</h2>
      {/* Two-column responsive layout for product image and info */}
      <div className="flex flex-col items-center lg:flex-row gap-8 justify-center">
        {/* Left: Product Image (no gray background) */}
        <div className="w-full lg:w-1/2 flex items-center justify-center">
          <Image
            src="/capybara-product-section.png"
            alt="Capybara Clap Bracelet"
            width={350}
            height={350}
            className="w-full max-w-sm rounded-2xl object-contain"
            priority
          />
        </div>
        {/* Right: Product Info and Controls */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6 items-start">
          <h3 className="text-2xl font-bold text-analenn-primary">Capybara Clap Bracelet</h3>
          {/* Star Rating and Reviews */}
          <div className="flex items-center gap-2 text-analenn-primary font-semibold">
            {/* 5 filled stars */}
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-analenn-primary text-analenn-primary" fill="currentColor" />
            ))}
            <span className="ml-2 text-base font-normal">4.9 (128 reviews)</span>
          </div>
          {/* Price and Discount */}
          <div className="flex items-center gap-4">
            <span className="text-3xl font-extrabold text-analenn-primary">$9.99</span>
            <span className="text-xl text-analenn-secondary line-through">$14.99</span>
            <span className="bg-analenn-accent/20 text-analenn-primary text-xs font-bold px-3 py-1 rounded-md">33% OFF</span>
          </div>
          {/* Description */}
          <p className="text-base text-analenn-primary">
            Cappy is a premium quality plush toy designed to bring joy and comfort. Made with eco-friendly materials and stuffed with hypoallergenic filling, it's safe for children and adults alike.
          </p>
          {/* Quantity Selector */}
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <label className="text-analenn-primary font-semibold mb-1">Quantity</label>
            <div className="flex items-center gap-2">
              <button className="bg-gray-100 text-analenn-primary px-3 py-1 rounded-md text-lg font-bold">-</button>
              <span className="px-4 py-1 border rounded-md bg-white text-analenn-primary">1</span>
              <button className="bg-gray-100 text-analenn-primary px-3 py-1 rounded-md text-lg font-bold">+</button>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs mt-2">
            <button className="bg-analenn-primary text-white font-semibold py-3 px-8 rounded-lg shadow-sm hover:bg-analenn-secondary transition text-base flex items-center justify-center w-full">
              + Add to Cart
            </button>
            <button className="border-2 border-analenn-primary text-analenn-primary font-semibold py-3 px-8 rounded-lg shadow-sm hover:bg-analenn-primary hover:text-white transition text-base flex items-center justify-center w-full">
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDetails; 