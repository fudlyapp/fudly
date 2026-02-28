//src/components/ThemeToggle.tsx
"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
    setReady(true);
  }, []);

  function apply(next: Theme) {
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", next);
    setTheme(next);
  }

  if (!ready) return null;

  return (
    <button
      type="button"
      onClick={() => apply(theme === "dark" ? "light" : "dark")}
      className="rounded-full border px-3 py-2 text-xs font-semibold transition
                 border-gray-300 bg-white text-black hover:bg-gray-100
                 dark:border-gray-700 dark:bg-black dark:text-white dark:hover:bg-zinc-900"
      aria-label="Prepnúť tému"
      title="Prepnúť tému"
    >
      {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}