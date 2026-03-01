//src/app/reset-password/ResetPasswordClient.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Po kliknutí v emaile Supabase často vytvorí session automaticky.
  // Ak by session nebola, UI povie, že link je neplatný/expirnutý.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
    })();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!p1 || p1.length < 6) {
      setMsg("Heslo musí mať aspoň 6 znakov.");
      return;
    }
    if (p1 !== p2) {
      setMsg("Heslá sa nezhodujú.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;

      setMsg("✅ Heslo bolo zmenené. Teraz sa môžeš prihlásiť.");
      // voliteľné: odhlásiť, aby sa user prihlásil novým heslom “normálne”
      await supabase.auth.signOut();
    } catch (err: any) {
      setMsg(err?.message ?? "Niečo sa pokazilo.");
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    "input-surface outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10";

  return (
    <main className="min-h-screen page-invert-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl p-6 surface-same-as-nav surface-border">
        <div className="mb-4">
          <Link href="/login" className="text-sm muted hover:opacity-80 transition">
            ← Späť na prihlásenie
          </Link>
          <h1 className="mt-3 text-2xl font-semibold">Reset hesla</h1>
          <p className="mt-1 text-sm muted">Nastav si nové heslo.</p>
        </div>

        {hasSession === false ? (
          <div className="rounded-2xl p-3 border border-gray-200 dark:border-gray-800 text-sm">
            Tento link je neplatný alebo expirovaný. Skús poslať reset znova.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs muted mb-1">Nové heslo</label>
            <div className="relative">
              <input
                className={inputBase + " pr-12"}
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                type={show ? "text" : "password"}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900 transition text-black dark:text-black"
              >
                {show ? "Skryť" : "Zobraziť"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs muted mb-1">Zopakuj nové heslo</label>
            <input
              className={inputBase}
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              type={show ? "text" : "password"}
              placeholder="••••••••"
              required
            />
          </div>

          <button disabled={loading || hasSession === false} className="w-full btn-primary" type="submit">
            {loading ? "Ukladám…" : "Zmeniť heslo"}
          </button>
        </form>

        {msg ? (
          <div className="mt-4 rounded-2xl p-3 page-invert-bg border border-gray-200 dark:border-gray-800 text-sm">
            {msg}
          </div>
        ) : null}
      </div>
    </main>
  );
}