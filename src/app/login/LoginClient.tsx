// src/app/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/useT";

type Mode = "login" | "signup" | "forgot" | "reset";

export default function LoginClient() {
  const { t } = useT();
  const searchParams = useSearchParams();

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // nové
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const m = (searchParams?.get("mode") || "").toLowerCase();
    if (m === "signup") setMode("signup");
    else if (m === "forgot") setMode("forgot");
    else if (m === "reset") setMode("reset");
    else setMode("login");
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage(t.auth.signupSuccess);
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // ak používaš ?next=... redirect, môžeš to tu rešpektovať
        const next = searchParams?.get("next");
        window.location.href = next ? decodeURIComponent(next) : "/generate";
        return;
      }

      if (mode === "forgot") {
        // pošle reset email
        const origin = window.location.origin;
        const redirectTo = `${origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;

        setMessage("📩 Poslal som ti email na reset hesla. Skontroluj aj spam.");
        return;
      }

      if (mode === "reset") {
        if (!newPassword || newPassword.length < 6) {
          setMessage("Heslo musí mať aspoň 6 znakov.");
          return;
        }
        if (newPassword !== newPassword2) {
          setMessage("Heslá sa nezhodujú.");
          return;
        }

        // Supabase pri návrate z emailu založí session, potom sa dá update
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        setMessage("✅ Heslo bolo zmenené. Teraz sa môžeš prihlásiť.");
        setMode("login");
        setPassword("");
        setShowPassword(false);
        setNewPassword("");
        setNewPassword2("");
        return;
      }
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

  const inputBase =
    "input-surface outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10";

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

        {/* Tab-y len pre login/signup (forgot/reset sú samostatné módy) */}
        {(mode === "login" || mode === "signup") && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`${tabBase} ${mode === "login" ? tabActive : tabInactive}`}
            >
              {t.auth.loginTab}
            </button>

            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`${tabBase} ${mode === "signup" ? tabActive : tabInactive}`}
            >
              {t.auth.signupTab}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* FORGOT */}
          {mode === "forgot" ? (
            <>
              <div className="text-sm muted">
                Zadaj email. Pošleme ti link na nastavenie nového hesla.
              </div>

              <div>
                <label className="block text-xs muted mb-1">{t.auth.emailLabel}</label>
                <input
                  className={inputBase}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  type="email"
                  required
                />
              </div>

              <button disabled={loading} className="w-full btn-primary" type="submit">
                {loading ? t.common.loading : "Poslať reset email"}
              </button>

              <button
                type="button"
                className="w-full rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900 transition"
                onClick={() => setMode("login")}
              >
                Späť na prihlásenie
              </button>
            </>
          ) : null}

          {/* RESET */}
          {mode === "reset" ? (
            <>
              <div className="text-sm muted">
                Nastav si nové heslo.
              </div>

              <div>
                <label className="block text-xs muted mb-1">Nové heslo</label>
                <div className="relative">
                  <input
                    className={inputBase + " pr-12"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    required
                  />
                  <button
  type="button"
  onClick={() => setShowPassword((v) => !v)}
  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold border border-gray-300 dark:border-gray-700 bg-white dark:bg-white text-black hover:bg-gray-100 transition"
  aria-label={showPassword ? "Skryť heslo" : "Zobraziť heslo"}
>
  {showPassword ? "Skryť" : "Zobraziť"}
</button>
                </div>
              </div>

              <div>
                <label className="block text-xs muted mb-1">Zopakuj nové heslo</label>
                <input
                  className={inputBase}
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  required
                />
              </div>

              <button disabled={loading} className="w-full btn-primary" type="submit">
                {loading ? t.common.loading : "Zmeniť heslo"}
              </button>

              <button
                type="button"
                className="w-full rounded-2xl px-5 py-3 text-sm font-semibold border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900 transition"
                onClick={() => setMode("login")}
              >
                Späť na prihlásenie
              </button>
            </>
          ) : null}

          {/* LOGIN / SIGNUP */}
          {(mode === "login" || mode === "signup") ? (
            <>
              <div>
                <label className="block text-xs muted mb-1">{t.auth.emailLabel}</label>
                <input
                  className={inputBase}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.auth.emailPlaceholder}
                  type="email"
                  required
                />
              </div>

              <div>
                <label className="block text-xs muted mb-1">{t.auth.passwordLabel}</label>
                <div className="relative">
                  <input
                    className={inputBase + " pr-12"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.auth.passwordPlaceholder}
                    type={showPassword ? "text" : "password"}
                    required
                  />
                  <button
  type="button"
  onClick={() => setShowPassword((v) => !v)}
  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold border border-gray-300 dark:border-gray-700 bg-white dark:bg-white text-black hover:bg-gray-100 transition"
  aria-label={showPassword ? "Skryť heslo" : "Zobraziť heslo"}
>
  {showPassword ? "Skryť" : "Zobraziť"}
</button>
                </div>

                {mode === "login" ? (
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      className="text-xs underline muted-2 hover:opacity-80 transition"
                      onClick={() => setMode("forgot")}
                    >
                      Zabudnuté heslo?
                    </button>
                  </div>
                ) : null}
              </div>

              <button disabled={loading} className="w-full btn-primary" type="submit">
                {loading ? t.common.loading : mode === "signup" ? t.auth.signupCta : t.auth.loginCta}
              </button>
            </>
          ) : null}
        </form>

        {message && (
          <div className="mt-4 rounded-2xl p-3 page-invert-bg border border-gray-200 dark:border-gray-800 text-sm">
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