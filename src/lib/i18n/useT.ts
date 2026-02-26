"use client";

import { useEffect, useMemo, useState } from "react";
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

type UseTReturn = {
  t: Dict;
  lang: Lang;
  setLang: (next: Lang) => void;
};

export function useT(initialLang?: Lang): UseTReturn {
  const [lang, setLangState] = useState<Lang>(() => {
    if (initialLang === "sk" || initialLang === "en" || initialLang === "uk") return initialLang;
    return getLangCookie() ?? "sk";
  });

  // ak parent posiela initialLang (napr. useT(uiLang)), synchronizuj
  useEffect(() => {
    if (initialLang === "sk" || initialLang === "en" || initialLang === "uk") {
      setLangState(initialLang);
    }
  }, [initialLang]);

  const t = useMemo(() => DICT[lang], [lang]);

  function setLang(next: Lang) {
    setLangState(next);
    setLangCookie(next);
  }

  return { t, lang, setLang };
}