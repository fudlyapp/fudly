"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/useT";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Plan = "basic" | "plus" | null;
type Status = "inactive" | "trialing" | "active" | "past_due" | "canceled" | null;

export default function PricingPage() {
  const { t } = useT();
  const supabase = createSupabaseBrowserClient();

  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [plan, setPlan] = useState<Plan>(null);
  const [status, setStatus] = useState<Status>(null);

  // =========================
  // LOAD SUBSCRIPTION
  // =========================
  useEffect(() => {
  (async () => {
    await loadSubscription();
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  async function loadSubscription() {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) return;

    const { data } = await supabase
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setPlan(data.plan);
      setStatus(data.status);
    }
  }

  const hasActive =
    status === "active" ||
    status === "trialing";

  // =========================
  // CHECKOUT
  // =========================
  async function subscribe(p: "basic" | "plus") {
    try {
      setMsg("");
      setLoading(p);

      const r = await fetch("/api/stripe/create_checkout_session", {
        method: "POST",
        body: JSON.stringify({ plan: p }),
      });

      const data = await r.json();

      if (!r.ok) {
        setMsg(data?.error ?? "Stripe chyba");
        setLoading(null);
        return;
      }

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e.message);
      setLoading(null);
    }
  }

  // =========================
  // PORTAL
  // =========================
  async function manage() {
    try {
      setMsg("");
      setLoading("portal");

      const r = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await r.json();

      if (!r.ok) {
        setMsg(data?.error ?? "Portal chyba");
        setLoading(null);
        return;
      }

      window.location.href = data.url;
    } catch (e: any) {
      setMsg(e.message);
      setLoading(null);
    }
  }

  // =========================
  // UI
  // =========================
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">

        <header className="mb-8 flex items-start justify-between">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">{t.pricing.title}</h1>
            <p className="mt-2 text-gray-300">{t.pricing.subtitle}</p>

            {hasActive && (
              <div className="mt-3 text-green-400 text-sm">
                Aktívne členstvo: {plan?.toUpperCase()} ({status})
              </div>
            )}

            {msg && (
              <div className="mt-3 text-red-400 text-sm">{msg}</div>
            )}
          </div>

          <div className="flex gap-2">
            <Link href="/generate" className="px-4 py-2 border border-gray-700 rounded-xl text-sm">
              {t.nav.generator}
            </Link>
            <Link href="/profile" className="px-4 py-2 border border-gray-700 rounded-xl text-sm">
              {t.nav.profile}
            </Link>
          </div>
        </header>

        <section className="grid md:grid-cols-2 gap-6">

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

            <div className="mt-6">
              {hasActive ? (
                <button
                  onClick={manage}
                  disabled={loading !== null}
                  className="w-full rounded-xl bg-white text-black py-3 font-semibold"
                >
                  {loading === "portal" ? "..." : t.pricing.manage}
                </button>
              ) : (
                <button
                  onClick={() => subscribe("basic")}
                  disabled={loading !== null}
                  className="w-full rounded-xl bg-white text-black py-3 font-semibold"
                >
                  {loading === "basic" ? "..." : `${t.pricing.subscribe} Basic`}
                </button>
              )}
            </div>
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

            <div className="mt-6">
              {hasActive ? (
                <button
                  onClick={manage}
                  disabled={loading !== null}
                  className="w-full rounded-xl bg-white text-black py-3 font-semibold"
                >
                  {loading === "portal" ? "..." : t.pricing.manage}
                </button>
              ) : (
                <button
                  onClick={() => subscribe("plus")}
                  disabled={loading !== null}
                  className="w-full rounded-xl bg-white text-black py-3 font-semibold"
                >
                  {loading === "plus" ? "..." : `${t.pricing.subscribe} Plus`}
                </button>
              )}
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}