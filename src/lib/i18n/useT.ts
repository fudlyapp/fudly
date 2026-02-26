"use client";

import { useEffect, useMemo, useState } from "react";
import { DICT, type Dict, type Lang } from "./dict";

const COOKIE_NAME = "fudly_lang";

export function getLangCookie(): Lang {
  if (typeof document === "undefined") return "sk";
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  const v = m?.[1] ? decodeURIComponent(m[1]) : "";
  return v === "en" || v === "uk" || v === "sk" ? v : "sk";
}

export function setLangCookie(lang: Lang) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(lang)}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export function useT() {
  const [lang, setLang] = useState<Lang>("sk");

  useEffect(() => {
    setLang(getLangCookie());
  }, []);

  const t: Dict = useMemo(() => DICT[lang] ?? DICT.sk, [lang]);

  function changeLang(next: Lang) {
    setLang(next);
    setLangCookie(next);
  }

  return { lang, t, setLang: changeLang };
}