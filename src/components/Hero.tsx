"use client";

import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const Hero = () => {
  const { addToCart, cartItems } = useCart();
  const [productData, setProductData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Fetch the Capybara Bracelet product (ID: 1) from the API
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/products?id=1');
        if (!response.ok) {
          throw new Error('Failed to fetch product');
        }
        const data = await response.json();
        setProductData(data);
      } catch (error) {
        console.error('Error fetching hero product:', error);
        setProductData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, []);

  const handleAddToCart = () => {
    if (!productData) return;
    
    const cartItem = {
      id: productData.id,
      name: productData.name,
      price: productData.price,
      image: productData.image,
      quantity: 1
    };
    addToCart(cartItem, 1);
  };

  const handleBuyNow = () => {
    if (!productData) return;
    
    // If cart is empty, add one item first
    if (cartItems.length === 0) {
      const cartItem = {
        id: productData.id,
        name: productData.name,
        price: productData.price,
        image: productData.image,
        quantity: 1
      };
      addToCart(cartItem, 1);
    }
    
    // Redirect to checkout page
    router.push('/checkout');
  };

  return (
    // Hero section that accounts for navbar height (4rem = 64px) and centers content with slight upward shift
    <section
      id="hero"
      className="bg-white min-h-[calc(100vh-4rem)] flex flex-col justify-center px-6 lg:px-20 mb-0 -mb-20"
    >
      {/* Main content container with upward shift (-mt-10) and responsive gap */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-10 -mt-10">
        {/* Left: Text Content */}
        <div className="w-full lg:w-1/2 flex flex-col items-start text-left space-y-6">
          {/* Heading */}
          <h1 className="text-4xl md:text-5xl font-extrabold text-analenn-primary">
            Meet Cappy
          </h1>
          {/* Subheading */}
          <h2 className="text-2xl md:text-3xl font-bold text-analenn-secondary">
            The Perfect Capybara Companion
          </h2>
          {/* Description */}
          <p className="text-lg text-analenn-primary">
            Analenn's signature capybara plush is handcrafted with premium
            materials for endless hugs and adventures. A timeless companion for
            the young and young at heart.
          </p>
          {/* Price Display - only show if product data is loaded */}
          {productData && (
            <div className="flex items-center gap-4">
              <span className="text-3xl font-extrabold text-analenn-primary">
                ${productData.price.discount ?? productData.price.original}
              </span>
              {productData.price.discount && (
                <>
                  <span className="text-xl text-analenn-secondary line-through">
                    ${productData.price.original}
                  </span>
                  <span className="bg-analenn-accent/20 text-analenn-primary text-xs font-bold px-3 py-1 rounded-md">
                    {Math.round(
                      100 - (productData.price.discount / productData.price.original) * 100,
                    )}
                    % OFF
                  </span>
                </>
              )}
            </div>
          )}
          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button
              className="bg-analenn-primary text-white font-semibold py-3 px-8 rounded-lg shadow-sm hover:bg-analenn-secondary transition text-base flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleAddToCart}
              disabled={isLoading || !productData}
            >
              {isLoading ? 'Loading...' : '+ Add to Cart'}
            </button>
            <button 
              className="border-2 border-analenn-primary text-analenn-primary font-semibold py-3 px-8 rounded-lg shadow-sm hover:bg-analenn-primary hover:text-white transition text-base flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleBuyNow}
              disabled={isLoading || !productData}
            >
              {isLoading ? 'Loading...' : 'Buy Now'}
            </button>
          </div>
        </div>
        {/* Right: Image Content */}
        <div className="w-full lg:w-1/2 flex items-center justify-center">
          {/* Responsive image with fixed width and rounded edges - using original hero image */}
          <Image
            src="/images/capybara.png"
            alt="Capybara Plush"
            width={350}
            height={350}
            className="w-[350px] max-w-sm rounded-lg object-contain"
            priority
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;
