import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { STORE_NAME, STORE_DESCRIPTION } from "@/constants/store";
import { ClientProviders } from "@/components/ClientProviders";

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
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}