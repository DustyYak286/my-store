"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";

const ProductDetails = ({ productId }) => {
  const [quantity, setQuantity] = useState(1);
  const { addToCart, cartItems } = useCart();
  const [productData, setProductData] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products?id=${productId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Product not found");
        return res.json();
      })
      .then((data) => setProductData(data))
      .catch((err) => setProductData({ error: err.message }));
  }, [productId]);

  const handleBuyNow = () => {
    if (!productData || productData.error) return;
    
    // If cart is empty, add the selected quantity first
    if (cartItems.length === 0) {
      const cartItem = {
        id: productData.id,
        name: productData.name,
        price: productData.price,
        image: productData.image,
        quantity: quantity
      };
      addToCart(cartItem, quantity);
    }
    
    // Redirect to checkout page
    router.push('/checkout');
  };

  // Loading and error handling
  if (!productData) {
    return (
      <section
        id="product"
        className="bg-white pt-4 pb-28 px-6 max-w-6xl mx-auto rounded-2xl shadow-sm"
      >
        <h2 className="text-3xl font-extrabold text-analenn-primary text-center mb-12">
          Product Details
        </h2>
        <div className="text-center text-analenn-primary">
          Loading product...
        </div>
      </section>
    );
  }
  if (productData.error) {
    return (
      <section
        id="product"
        className="bg-white pt-4 pb-28 px-6 max-w-6xl mx-auto rounded-2xl shadow-sm"
      >
        <h2 className="text-3xl font-extrabold text-analenn-primary text-center mb-12">
          Product Details
        </h2>
        <div className="text-center text-red-600">{productData.error}</div>
      </section>
    );
  }
  const product = productData;

  return (
    <section
      id="product"
      className="bg-white pt-4 pb-28 px-6 max-w-6xl mx-auto rounded-2xl shadow-sm"
    >
      <h2 className="text-3xl font-extrabold text-analenn-primary text-center mb-12">
        Product Details
      </h2>
      <div className="flex flex-col items-center lg:flex-row gap-8 justify-center">
        {/* Left: Product Image */}
        <div className="w-full lg:w-1/2 flex items-center justify-center">
          <Image
            src={product.image}
            alt={product.name}
            width={350}
            height={350}
            className="w-full max-w-sm rounded-2xl object-contain"
            priority
          />
        </div>
        {/* Right: Product Info and Controls */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6 items-start">
          <h3 className="text-2xl font-bold text-analenn-primary">
            {product.name}
          </h3>
          {/* Star Rating and Reviews */}
          <div className="flex items-center gap-2 text-analenn-primary font-semibold">
            {Array.from({
              length: Math.round(
                product.reviews && product.reviews.length > 0
                  ? product.reviews.reduce((acc, r) => acc + r.rating, 0) /
                      product.reviews.length
                  : 5,
              ),
            }).map((_, i) => (
              <Star
                key={i}
                className="w-5 h-5 fill-analenn-primary text-analenn-primary"
                fill="currentColor"
              />
            ))}
            <span className="ml-2 text-base font-normal">
              {product.reviews && product.reviews.length > 0
                ? `${(
                    product.reviews.reduce((acc, r) => acc + r.rating, 0) /
                    product.reviews.length
                  ).toFixed(1)} (${product.reviews.length} reviews)`
                : "No reviews"}
            </span>
          </div>
          {/* Price and Discount */}
          <div className="flex items-center gap-4">
            <span className="text-3xl font-extrabold text-analenn-primary">
              ${product.price.discount ?? product.price.original}
            </span>
            {product.price.discount && (
              <span className="text-xl text-analenn-secondary line-through">
                ${product.price.original}
              </span>
            )}
            {product.price.discount && (
              <span className="bg-analenn-accent/20 text-analenn-primary text-xs font-bold px-3 py-1 rounded-md">
                {Math.round(
                  100 - (product.price.discount / product.price.original) * 100,
                )}
                % OFF
              </span>
            )}
          </div>
          {/* Description */}
          <p className="text-base text-analenn-primary">
            {product.description}
          </p>
          {/* Quantity Selector */}
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <label className="text-analenn-primary font-semibold mb-1">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <button
                className="bg-gray-100 text-analenn-primary px-3 py-1 rounded-md text-lg font-bold"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                -
              </button>
              <span className="px-4 py-1 border rounded-md bg-white text-analenn-primary">
                {quantity}
              </span>
              <button
                className="bg-gray-100 text-analenn-primary px-3 py-1 rounded-md text-lg font-bold"
                onClick={() => setQuantity((q) => q + 1)}
              >
                +
              </button>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs mt-2">
            <button
              className="bg-analenn-primary text-white font-semibold py-3 px-8 rounded-lg shadow-sm hover:bg-analenn-secondary transition text-base flex items-center justify-center w-full"
              onClick={() => {
                const cartItem = {
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image: product.image,
                  quantity: quantity
                };
                addToCart(cartItem, quantity);
              }}
            >
              + Add to Cart
            </button>
            <button 
              className="border-2 border-analenn-primary text-analenn-primary font-semibold py-3 px-8 rounded-lg shadow-sm hover:bg-analenn-primary hover:text-white transition text-base flex items-center justify-center w-full"
              onClick={handleBuyNow}
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDetails;
