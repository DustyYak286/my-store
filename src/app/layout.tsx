"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import FloatingCartButton from "@/components/FloatingCartButton";
import { STORE_NAME, STORE_DESCRIPTION } from "@/constants/store";
import { CartProvider } from "@/context/CartContext";
import { CartModalProvider } from "@/context/CartModalContext";
import { ToastProvider } from "@/context/ToastContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useRef, ReactNode } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const navbarRef = useRef<HTMLElement>(null);
  
  return (
    <html lang="en" id="top">
      <head>
        <title>{STORE_NAME}</title>
        <meta name="description" content={STORE_DESCRIPTION} />
        <meta name="keywords" content="capybara, bracelet, jewelry, accessories, handmade" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-analenn-white text-analenn-primary scroll-smooth`}
      >
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
      </body>
    </html>
  );
}