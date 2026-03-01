// src/app/login/LoginClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const sp = useSearchParams();

  const mode = (sp.get("mode") === "signup" ? "signup" : "login") as Mode;
  const next = sp.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // ak je už prihlásený, urob rovnaký redirect flow
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        await redirectAfterAuth(data.session.access_token);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redirectAfterAuth(token: string) {
    // ak nemá aktívny trial/subscription -> vždy /pricing
    try {
      const res = await fetch("/api/entitlements", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ent = await res.json().catch(() => null);

      if (res.ok && ent && ent.can_generate === true) {
        window.location.href = next;
        return;
      }
      // paywall
      window.location.href = "/pricing";
    } catch {
      // keď sa nepodarí overiť, radšej na pricing (bezpečné)
      window.location.href = "/pricing";
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // user môže byť hneď logged-in, alebo pending confirm
        const token = data.session?.access_token;
        if (token) {
          await redirectAfterAuth(token);
          return;
        }

        setMsg("Účet je vytvorený. Skontroluj email, ak je potrebné potvrdenie, a potom sa prihlás.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const token = data.session?.access_token;
        if (!token) throw new Error("Missing session token");
        await redirectAfterAuth(token);
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Nepodarilo sa prihlásiť.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-md rounded-3xl p-6 surface-same-as-nav surface-border">
        <h1 className="text-2xl font-bold">{mode === "signup" ? "Registrácia" : "Prihlásenie"}</h1>
        <p className="mt-2 text-sm muted">
          {mode === "signup"
            ? "Vytvor si účet. Po prihlásení ťa to presmeruje na členstvá."
            : "Prihlás sa. Bez členstva ťa to presmeruje na členstvá."}
        </p>

        {msg ? (
          <div className="mt-4 rounded-2xl p-3 surface-same-as-nav surface-border text-sm">
            {msg}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block">
            <div className="mb-1 text-sm muted">Email</div>
            <input
              className="input-surface w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm muted">Heslo</div>
            <input
              className="input-surface w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>

          <button className="btn-primary w-full" disabled={busy} type="submit">
            {busy ? "Spracúvam…" : mode === "signup" ? "Vytvoriť účet" : "Prihlásiť sa"}
          </button>

          <div className="text-xs muted-2">
            {mode === "signup" ? (
              <a className="underline" href={`/login?mode=login&next=${encodeURIComponent(next)}`}>
                Už mám účet → Prihlásiť sa
              </a>
            ) : (
              <a className="underline" href={`/login?mode=signup&next=${encodeURIComponent(next)}`}>
                Nemám účet → Registrovať sa
              </a>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}