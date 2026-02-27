// src/app/pricing/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Plan = "basic" | "plus";
type SubRow = {
  plan: Plan | null;
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

  async function loadSubscription() {
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
  }

  useEffect(() => {
    loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function withToken<T>(fn: (token: string) => Promise<T>) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fn(token);
  }

  async function startCheckout(plan: Plan) {
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
      setMsg(e?.message ?? "Error");
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
      setMsg(e?.message ?? "Error");
    }
  }

  const active = isActiveLike(sub?.status);
  const currentPlan = (sub?.plan ?? null) as Plan | null;

  const canManage = active && !!sub?.stripe_customer_id;
  const isBasicActive = active && currentPlan === "basic";
  const isPlusActive = active && currentPlan === "plus";

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">{t.pricing.title}</h1>
            <p className="mt-2 text-gray-300">{t.pricing.subtitle}</p>

            {loading ? (
              <div className="mt-3 text-sm text-gray-400">{t.common.loading}</div>
            ) : email ? (
              <div className="mt-3 text-sm text-gray-300">
                {t.pricing.ui.loggedAs} <span className="text-white font-semibold">{email}</span>
                {sub?.status ? (
                  <>
                    {" • "}
                    {t.pricing.ui.status}: <span className="text-white font-semibold">{sub.status}</span>
                    {currentPlan ? (
                      <>
                        {" • "}
                        {t.pricing.ui.plan}: <span className="text-white font-semibold">{currentPlan}</span>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-300">
                {t.pricing.ui.mustLogin}{" "}
                <Link href="/login" className="underline">
                  {t.nav.login}
                </Link>
                .
              </div>
            )}

            {msg ? (
              <div className="mt-3 text-sm text-red-300">
                {t.common.errorPrefix} {msg}
              </div>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Link href="/generate" className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900">
              {t.nav.generator}
            </Link>
            <Link href="/profile" className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900">
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
              {!active ? (
                <button
                  type="button"
                  disabled={!email || loading}
                  onClick={() => startCheckout("basic")}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
                >
                  {t.pricing.subscribe} Basic
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black opacity-40"
                    title={t.pricing.ui.activePlanHint}
                  >
                    {isPlusActive ? t.pricing.ui.lowerPlan : t.pricing.ui.active}
                  </button>

                  {canManage ? (
                    <button
                      type="button"
                      disabled={!email || loading}
                      onClick={openPortal}
                      className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm font-semibold hover:bg-zinc-900 disabled:opacity-40"
                    >
                      {t.pricing.manage}
                    </button>
                  ) : null}
                </>
              )}
            </div>

            {isBasicActive ? <div className="mt-2 text-xs text-gray-400">{t.pricing.ui.youHaveActiveBasic}</div> : null}
            {isPlusActive ? <div className="mt-2 text-xs text-gray-400">{t.pricing.ui.youHaveActivePlus}</div> : null}
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
              {!active ? (
                <button
                  type="button"
                  disabled={!email || loading}
                  onClick={() => startCheckout("plus")}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
                >
                  {t.pricing.subscribe} Plus
                </button>
              ) : (
                <>
                  {isBasicActive ? (
                    <button
                      type="button"
                      disabled={!email || loading}
                      onClick={() => startCheckout("plus")}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
                    >
                      {t.pricing.ui.upgradeToPlus}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black opacity-40"
                      title={t.pricing.ui.activePlanHint}
                    >
                      {t.pricing.ui.active}
                    </button>
                  )}

                  {canManage ? (
                    <button
                      type="button"
                      disabled={!email || loading}
                      onClick={openPortal}
                      className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm font-semibold hover:bg-zinc-900 disabled:opacity-40"
                    >
                      {t.pricing.manage}
                    </button>
                  ) : null}
                </>
              )}
            </div>

            {isPlusActive ? <div className="mt-2 text-xs text-gray-400">{t.pricing.ui.youHaveActivePlus}</div> : null}
            {isBasicActive ? <div className="mt-2 text-xs text-gray-400">{t.pricing.ui.plusViaUpgrade}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}