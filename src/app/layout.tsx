import "./globals.css";
import type { Metadata } from "next";
import { LangProvider } from "@/lib/i18n/useT";
import TopNavGate from "@/components/TopNavGate";

export const metadata: Metadata = {
  title: {
    default: "Fudly",
    template: "%s • Fudly",
  },
  description: "Fudly – AI jedálničky a nákupy",

  icons: {
    icon: "/favicon.ico",          // hlavná ikonka
    shortcut: "/favicon.ico",
    apple: "/logo_white.png",      // apple touch
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <body className="bg-black text-white">
        <LangProvider>
          <TopNavGate />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}