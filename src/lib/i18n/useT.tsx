// src/lib/i18n/useT.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DICT, type Dict, type Lang } from "@/lib/i18n/dict";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const COOKIE = "fudly_lang";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
}

type Ctx = {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
};

const I18nCtx = createContext<Ctx | null>(null);

function isLang(x: string | null | undefined): x is Lang {
  return x === "sk" || x === "en" || x === "ua";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [lang, setLangState] = useState<Lang>("sk");

  // init z cookie (+ migrácia uk -> ua)
  useEffect(() => {
    const c = getCookie(COOKIE);

    if (c === "uk") {
      setLangState("ua");
      setCookie(COOKIE, "ua");
      return;
    }

    if (isLang(c)) setLangState(c);
  }, []);

  const setLang = async (l: Lang) => {
    setLangState(l);
    setCookie(COOKIE, l);

    // ak je user prihlásený, ulož aj do profiles.language
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) return;

    
  };

  const value = useMemo<Ctx>(
    () => ({
      lang,
      t: DICT[lang],
      setLang: (l: Lang) => void setLang(l),
    }),
    [lang] // supabase je stabilný cez useMemo vyššie
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const ctx = useContext(I18nCtx);
  if (!ctx) return { lang: "sk" as Lang, t: DICT.sk, setLang: (_: Lang) => {} };
  return ctx;
}