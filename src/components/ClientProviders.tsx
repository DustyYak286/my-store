"use client";

import { ReactNode, useRef } from "react";
import Navbar from "@/components/Navbar";
import FloatingCartButton from "@/components/FloatingCartButton";
import { CartProvider } from "@/context/CartContext";
import { CartModalProvider } from "@/context/CartModalContext";
import { ToastProvider } from "@/context/ToastContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  const navbarRef = useRef<HTMLElement>(null);
  
  return (
    <ErrorBoundary>
      <CartProvider>
        <CartModalProvider>
          <ToastProvider>
            <Navbar ref={navbarRef} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <FloatingCartButton navbarRef={navbarRef} />
          </ToastProvider>
        </CartModalProvider>
      </CartProvider>
    </ErrorBoundary>
  );
}