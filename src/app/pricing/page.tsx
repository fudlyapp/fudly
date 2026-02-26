// src/app/pricing/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SubRow = {
  plan: "basic" | "plus" | null;
  status: string | null;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  trial_end: string | null;
};

function isActiveLike(status?: string | null) {
  return status === "active" || status === "trialing" || status === "past_due";
}

export default function PricingPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { t } = useT();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user ?? null;
      setEmail(user?.email ?? null);

      if (!user) {
        setSub(null);
        setLoading(false);
        return;
      }

      const { data: row } = await supabase
        .from("subscriptions")
        .select("plan,status,stripe_customer_id,current_period_end,trial_end")
        .eq("user_id", user.id)
        .maybeSingle();

      setSub((row as any) ?? null);
      setLoading(false);
    })();
  }, [supabase]);

  async function withToken<T>(fn: (token: string) => Promise<T>) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fn(token);
  }

  async function startCheckout(plan: "basic" | "plus") {
    try {
      setMsg("");
      const res = await withToken(async (token) => {
        const r = await fetch("/api/stripe/create_checkout_session", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? "Checkout failed");
        return j as { url: string };
      });

      if (res?.url) window.location.href = res.url;
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba");
    }
  }

  async function openPortal() {
    try {
      setMsg("");
      const res = await withToken(async (token) => {
        const r = await fetch("/api/stripe/portal", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error ?? "Portal failed");
        return j as { url: string };
      });

      if (res?.url) window.location.href = res.url;
    } catch (e: any) {
      setMsg(e?.message ?? "Chyba");
    }
  }

  const active = isActiveLike(sub?.status);
  const showPortal = !!sub?.stripe_customer_id;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">{t.pricing.title}</h1>
            <p className="mt-2 text-gray-300">{t.pricing.subtitle}</p>

            {loading ? (
              <div className="mt-3 text-sm text-gray-400">Načítavam…</div>
            ) : email ? (
              <div className="mt-3 text-sm text-gray-300">
                Prihlásený ako <span className="text-white font-semibold">{email}</span>
                {sub?.status ? (
                  <>
                    {" • "}status: <span className="text-white font-semibold">{sub.status}</span>
                    {sub.plan ? (
                      <>
                        {" • "}plan: <span className="text-white font-semibold">{sub.plan}</span>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-300">
                Pre predplatné sa musíš{" "}
                <Link href="/login" className="underline">
                  prihlásiť
                </Link>
                .
              </div>
            )}

            {msg ? <div className="mt-3 text-sm text-red-300">Chyba: {msg}</div> : null}
          </div>

          <div className="flex gap-2">
            <Link
              href="/generate"
              className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
            >
              {t.nav.generator}
            </Link>
            <Link
              href="/profile"
              className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
            >
              {t.nav.profile}
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* BASIC */}
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="text-lg font-semibold">{t.pricing.basic.title}</div>
            <div className="mt-1 text-sm text-gray-300">{t.pricing.basic.subtitle}</div>

            <ul className="mt-4 space-y-2 text-sm text-gray-200">
              {t.pricing.basic.features.map((x: string, i: number) => (
                <li key={i}>• {x}</li>
              ))}
            </ul>

            <div className="mt-6 text-xs text-gray-500">{t.pricing.basic.note}</div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={!email || loading || active}
                onClick={() => startCheckout("basic")}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
              >
                {t.pricing.subscribe}
              </button>

              {showPortal ? (
                <button
                  type="button"
                  disabled={!email || loading}
                  onClick={openPortal}
                  className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm font-semibold hover:bg-zinc-900 disabled:opacity-40"
                >
                  {t.pricing.manage}
                </button>
              ) : null}
            </div>

            {active ? <div className="mt-2 text-xs text-gray-400">Už máš aktívne predplatné.</div> : null}
          </div>

          {/* PLUS */}
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="text-lg font-semibold">{t.pricing.plus.title}</div>
            <div className="mt-1 text-sm text-gray-300">{t.pricing.plus.subtitle}</div>

            <ul className="mt-4 space-y-2 text-sm text-gray-200">
              {t.pricing.plus.features.map((x: string, i: number) => (
                <li key={i}>• {x}</li>
              ))}
            </ul>

            <div className="mt-6 text-xs text-gray-500">{t.pricing.plus.note}</div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={!email || loading || active}
                onClick={() => startCheckout("plus")}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
              >
                {t.pricing.subscribe}
              </button>

              {showPortal ? (
                <button
                  type="button"
                  disabled={!email || loading}
                  onClick={openPortal}
                  className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm font-semibold hover:bg-zinc-900 disabled:opacity-40"
                >
                  {t.pricing.manage}
                </button>
              ) : null}
            </div>

            {active ? <div className="mt-2 text-xs text-gray-400">Už máš aktívne predplatné.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}