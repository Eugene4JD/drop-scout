import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeBench — Gemini Commerce Benchmark",
  description: "Static TradeBench viewer for model commerce timing benchmark results.",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
