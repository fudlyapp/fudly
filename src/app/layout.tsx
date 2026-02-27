// src/app/layout.tsx
import "./globals.css";
import { LangProvider } from "@/lib/i18n/useT";
import TopNav from "@/components/TopNav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <body className="bg-black text-white">
        <LangProvider>
          <TopNav />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}