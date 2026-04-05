// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/i18n/useT";
import TopNav from "@/components/TopNav";

export const metadata: Metadata = {
  title: {
    default: "Fudly",
    template: "%s | Fudly",
  },
  description: "Inteligentný týždenný jedálniček na jedno kliknutie",
  icons: {
    icon: "/logo_black.png",
    shortcut: "/logo_black.png",
    apple: "/logo_black.png",
  },
};

const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = (t === 'dark') || (t === null && systemDark);
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <body className="bg-white text-black dark:bg-black dark:text-white">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <LangProvider>
          <TopNav />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}