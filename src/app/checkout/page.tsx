"use client";

import { useState } from "react";

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
            {/* Placeholder for OrderSummary component */}
            <div className="text-gray-500 italic">OrderSummary component will be added here</div>
          </div>
          
          {/* Checkout Form Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Checkout Information</h2>
            {/* Placeholder for CheckoutForm component */}
            <div className="text-gray-500 italic">CheckoutForm component will be added here</div>
          </div>
        </div>
      </div>
    </div>
  );
} 