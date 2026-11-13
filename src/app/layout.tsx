import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = { title: "VendFrens", description: "VendFrens: vending machines and a crew that keeps them stocked, a Pac's Arcade project" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<Footer /></body>
    </html>
  );
}
