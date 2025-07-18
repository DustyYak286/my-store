import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { STORE_NAME, STORE_DESCRIPTION } from "@/constants/store";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: STORE_NAME,
  description: STORE_DESCRIPTION,
  keywords: ["capybara", "bracelet", "jewelry", "accessories", "handmade"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" id="top">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-analenn-white text-analenn-primary scroll-smooth`}
      >
        <CartProvider>
          <ToastProvider>
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}
