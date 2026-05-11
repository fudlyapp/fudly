// src/lib/i18n/useT.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DICT, type Dict, type Lang } from "@/lib/i18n/dict";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const COOKIE = "fudly_lang";

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

type Ctx = {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
};

const I18nCtx = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [lang, setLangState] = useState<Lang>("sk");

  // Language switcher is currently disabled in the UI, so keep Slovak as the
  // app language and clear any stale language cookie from older versions.
  useEffect(() => {
    deleteCookie(COOKIE);
    setLangState("sk");
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    setCookie(COOKIE, l);

    // ak je user prihlásený, ulož aj do profiles.language
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) return;
  }, [supabase]);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      t: DICT[lang],
      setLang: (l: Lang) => void setLang(l),
    }),
    [lang, setLang]
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const ctx = useContext(I18nCtx);
  if (!ctx) return { lang: "sk" as Lang, t: DICT.sk, setLang: (_: Lang) => {} };
  return ctx;
}
