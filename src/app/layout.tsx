import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = { title: "Vend Scout", description: "Scouting vending-machine spots in Illinois and beyond" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<Footer /></body>
    </html>
  );
}
