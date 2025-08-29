import type { Metadata } from "next";
import { Inter, Contrail_One, Alkatra } from "next/font/google";
import "./globals.css";
import Footer from '../components/Footer';
import Header from '../components/Header';

import { CartProvider } from '../lib/cartContext';
import { ModalStateProvider } from '../lib/modalState';
import { ToastProvider } from '../lib/toastContext';
import ChunkErrorBoundary from '../components/ChunkErrorBoundary';
import MobileErrorHandler from '../components/MobileErrorHandler';
import React from 'react';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const contrailOne = Contrail_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-contrail-one",
});

const alkatra = Alkatra({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-alkatra",
});

export const metadata: Metadata = {
  title: "DistriNaranjos - Tu Distribuidor Confiable",
  description: "DistriNaranjos ofrece una amplia gama de productos de calidad para satisfacer todas tus necesidades comerciales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} ${contrailOne.variable} ${alkatra.variable} antialiased`} suppressHydrationWarning={true}>
        <ChunkErrorBoundary>
          <MobileErrorHandler>
            <CartProvider>
              <ModalStateProvider>
                <ToastProvider>
                  <Header />
                  {children}
                  <Footer />
                </ToastProvider>
              </ModalStateProvider>
            </CartProvider>
          </MobileErrorHandler>
        </ChunkErrorBoundary>
      </body>
    </html>
  );
}
