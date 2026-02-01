import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EJSCREEN Explorer",
  description: "Explore environmental justice indicators by census tract",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
