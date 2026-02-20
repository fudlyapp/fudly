"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        setMessage("Účet vytvorený. Skús sa prihlásiť (alebo potvrď e-mail, ak to vyžaduje nastavenie).");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setMessage("Prihlásenie OK ✅ (teraz môžeme pridať presmerovanie / profil).");
      }
    } catch (err: any) {
      setMessage(err?.message ?? "Nastala chyba.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <div className="mb-6">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200 text-sm">
            ← Späť
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">Fudly účet</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Prihlásenie / registrácia
          </p>
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
            Prihlásiť
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
            Vytvoriť účet
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">E-mail</label>
            <input
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="napr. fudly@fudly.sk"
              type="email"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Heslo</label>
            <input
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              required
            />
          </div>

          <button
            disabled={loading}
            className="w-full rounded-xl bg-zinc-100 text-zinc-950 px-4 py-2 font-medium hover:bg-white disabled:opacity-60"
            type="submit"
          >
            {loading ? "Spracúvam…" : mode === "signup" ? "Vytvoriť účet" : "Prihlásiť"}
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
