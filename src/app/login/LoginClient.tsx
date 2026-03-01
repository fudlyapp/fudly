// src/app/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/useT";

type Mode = "login" | "signup";

export default function LoginClient() {
  const { t } = useT();
  const searchParams = useSearchParams();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // pamätáme si, či práve prebehol signup (aby sme po prvom prihlásení vedeli poslať usera na /pricing)
  const [signedUpNow, setSignedUpNow] = useState(false);

  const nextUrl = useMemo(() => {
    const raw = searchParams?.get("next");
    // bezpečný fallback
    if (!raw) return null;

    // nepustíme externé URL
    if (raw.startsWith("http://") || raw.startsWith("https://")) return null;

    // musí byť interná cesta
    if (!raw.startsWith("/")) return null;

    return raw;
  }, [searchParams]);

  useEffect(() => {
    const m = (searchParams?.get("mode") || "").toLowerCase();
    if (m === "signup") setMode("signup");
    else setMode("login");
  }, [searchParams]);

  // Redirect po prihlásení (funguje aj po signup-e, keď session nabehne až neskôr)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) return;

      // 1) keď máme next=..., vždy rešpektuj
      if (nextUrl) {
        window.location.href = nextUrl;
        return;
      }

      // 2) ak práve prebehol signup (prvé prihlásenie po registrácii)
      if (signedUpNow) {
        window.location.href = "/pricing";
        return;
      }

      // 3) inak default po login-e
      window.location.href = "/generate";
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase, nextUrl, signedUpNow]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        setSignedUpNow(true);

        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Ak máš email-confirm ON, user sa neprihlási hneď → zobrazíme hlášku.
        // Ak je OFF, onAuthStateChange sa spustí a presmeruje.
        setMessage(t.auth.signupSuccess);
        return;
      }

      // login
      setSignedUpNow(false);

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // redirect vyrieši onAuthStateChange
      return;
    } catch (err: any) {
      setMessage(err?.message ?? t.common.genericError);
    } finally {
      setLoading(false);
    }
  }

  const tabBase = "rounded-xl px-3 py-2 text-sm border font-semibold transition";
  const tabActive =
    "bg-black text-white border-black hover:bg-gray-800 dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-200";
  const tabInactive =
    "bg-transparent border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-zinc-900";

  return (
    <main className="min-h-screen page-invert-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl p-6 surface-same-as-nav surface-border">
        <div className="mb-6">
          <Link href="/" className="text-sm muted hover:opacity-80 transition">
            ← {t.common.back}
          </Link>

          <h1 className="mt-3 text-2xl font-semibold">{t.auth.title}</h1>
          <p className="mt-1 text-sm muted">{t.auth.subtitle}</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setSignedUpNow(false);
              setMessage(null);
            }}
            className={`${tabBase} ${mode === "login" ? tabActive : tabInactive}`}
          >
            {t.auth.loginTab}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage(null);
            }}
            className={`${tabBase} ${mode === "signup" ? tabActive : tabInactive}`}
          >
            {t.auth.signupTab}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs muted mb-1">{t.auth.emailLabel}</label>
            <input
              className="input-surface outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              type="email"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs muted mb-1">{t.auth.passwordLabel}</label>
            <input
              className="input-surface outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.auth.passwordPlaceholder}
              type="password"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <button disabled={loading} className="w-full btn-primary" type="submit">
            {loading ? t.common.loading : mode === "signup" ? t.auth.signupCta : t.auth.loginCta}
          </button>
        </form>

        {message && (
          <div className="mt-4 rounded-2xl p-3 page-invert-bg border border-gray-200 dark:border-gray-800 text-sm whitespace-pre-wrap">
            {message}
          </div>
        )}

        <div className="mt-6 text-xs muted-2">
          Tip: môžeš otvoriť priamo{" "}
          <Link className="underline" href="/login?mode=signup">
            registráciu
          </Link>{" "}
          alebo{" "}
          <Link className="underline" href="/login?mode=login">
            prihlásenie
          </Link>
          .
        </div>
      </div>
    </main>
  );
}