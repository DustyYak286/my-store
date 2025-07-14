"use client";

import OrderSummary from "@/components/OrderSummary";
import CheckoutForm from "@/components/CheckoutForm";

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 lg:py-8">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="text-gray-600 mt-2 text-sm lg:text-base">
            Complete your order information below
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Order Summary Section - Shows first on mobile */}
          <div className="lg:order-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 lg:p-6 border-b border-gray-200">
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900 flex items-center">
                <svg 
                  className="w-5 h-5 mr-2 text-[#7C4D59]" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Order Summary
              </h2>
            </div>
            <div className="p-4 lg:p-6">
              <OrderSummary />
            </div>
          </div>
          
          {/* Checkout Form Section */}
          <div className="lg:order-1 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 lg:p-6 border-b border-gray-200">
              <h2 className="text-lg lg:text-xl font-semibold text-gray-900 flex items-center">
                <svg 
                  className="w-5 h-5 mr-2 text-[#7C4D59]" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Checkout Information
              </h2>
            </div>
            <div className="p-4 lg:p-6">
              <CheckoutForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 