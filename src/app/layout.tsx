import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Fudly",
  description: "Intelingentný jedálniček, ktorý šetrí čas aj peniaze",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body className="bg-black text-white">
        <Header />
        {children}
      </body>
    </html>
  );
}