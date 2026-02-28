// src/app/layout.tsx
import "./globals.css";
import { LangProvider } from "@/lib/i18n/useT";
import TopNav from "@/components/TopNav";

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-white text-black dark:bg-black dark:text-white">
        <LangProvider>
          <TopNav />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}