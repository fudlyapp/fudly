"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/useT";

type Mode = "login" | "signup";

export default function LoginClient() {
  const { t } = useT();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const m = (searchParams?.get("mode") || "").toLowerCase();
    if (m === "signup") setMode("signup");
    else setMode("login");
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        setMessage(t.auth.signupSuccess);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        window.location.href = "/generate";
      }
    } catch (err: any) {
      setMessage(err?.message ?? t.common.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <div className="mb-6">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
            ← {t.common.back}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">{t.auth.title}</h1>
          <p className="text-zinc-400 text-sm mt-1">{t.auth.subtitle}</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-xl px-3 py-2 text-sm border ${
              mode === "login"
                ? "bg-zinc-100 text-zinc-950 border-zinc-100"
                : "bg-transparent text-zinc-200 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {t.auth.loginTab}
          </button>

          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-xl px-3 py-2 text-sm border ${
              mode === "signup"
                ? "bg-zinc-100 text-zinc-950 border-zinc-100"
                : "bg-transparent text-zinc-200 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {t.auth.signupTab}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t.auth.emailLabel}</label>
            <input
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              type="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">{t.auth.passwordLabel}</label>
            <input
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.auth.passwordPlaceholder}
              type="password"
              required
            />
          </div>

          <button
            disabled={loading}
            className="w-full rounded-xl bg-zinc-100 text-zinc-950 px-4 py-2 font-medium hover:bg-white disabled:opacity-60"
            type="submit"
          >
            {loading ? t.common.loading : mode === "signup" ? t.auth.signupCta : t.auth.loginCta}
          </button>
        </form>

        {message && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
            {message}
          </div>
        )}
      </div>
    </main>
  );
}