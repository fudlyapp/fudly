import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fudly",
  description: "AI jedálniček, ktorý šetrí čas aj peniaze",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <body>{children}</body>
    </html>
  );
}