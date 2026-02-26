"use client";

import { useMemo } from "react";
import { DICT, type Lang, type Dict } from "@/lib/i18n/dict";

const COOKIE_NAME = "lang";

export function getLangCookie(): Lang | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const v = m ? decodeURIComponent(m[1]) : null;
  return v === "sk" || v === "en" || v === "uk" ? v : null;
}

export function setLangCookie(lang: Lang) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(lang)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function useT(lang?: Lang): { t: Dict; lang: Lang } {
  const resolved = useMemo<Lang>(() => {
    if (lang === "sk" || lang === "en" || lang === "uk") return lang;
    const c = getLangCookie();
    return c ?? "sk";
  }, [lang]);

  const t = useMemo(() => DICT[resolved], [resolved]);

  return { t, lang: resolved };
}