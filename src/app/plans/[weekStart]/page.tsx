// src/app/plans/[weekStart]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PlanJSON = {
  summary: any;
  days: Array<{
    day: number;
    day_name?: string;
    date?: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    note: string;
  }>;
  shopping: any[];
};

function formatDateSK(iso?: string) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  return `${dd}.${mm}.${y}`;
}

export default function PlanDetailPage({ params }: { params: { weekStart: string } }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const weekStart = params.weekStart;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [plan, setPlan] = useState<PlanJSON | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan, week_start")
        .eq("user_id", user.id)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (error) {
        setMsg("Chyba: " + error.message);
        setPlan(null);
      } else {
        setPlan((data as any)?.plan ?? null);
      }

      setLoading(false);
    })();
  }, [supabase, weekStart]);

  function updateDay(dayIndex: number, field: "breakfast" | "lunch" | "dinner" | "note", value: string) {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.days[dayIndex][field] = value;
      return next;
    });
  }

  async function save() {
    if (!plan) return;
    setSaving(true);
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("meal_plans")
      .update({
        plan,
        is_edited: true,
        edited_at: new Date().toISOString(),
      } as any)
      .eq("user_id", user.id)
      .eq("week_start", weekStart);

    if (error) setMsg("Chyba pri ukladaní: " + error.message);
    else setMsg("✅ Uložené. Jedálniček je upravený.");

    setSaving(false);
  }

  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-2xl p-6 surface-same-as-nav surface-border flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="text-sm muted-2">Plán</div>
            <div className="text-2xl font-bold">Týždeň od {formatDateSK(weekStart)}</div>
            <div className="mt-2 text-sm muted">Táto stránka je staršia route – detail máš aj v /profile.</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/profile/${weekStart}`}
              className="btn-primary px-4 py-2 text-sm"
            >
              Otvoriť v profile
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition"
            >
              {saving ? "Ukladám…" : "Uložiť"}
            </button>
          </div>
        </div>

        {loading ? <div className="text-sm muted">Načítavam…</div> : null}
        {msg ? (
          <div className={`text-sm ${msg.startsWith("✅") ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {msg}
          </div>
        ) : null}

        {!loading && plan ? (
          <section className="rounded-2xl p-6 surface-same-as-nav surface-border">
            <h2 className="text-xl font-semibold">Jedálniček</h2>

            <div className="mt-4 space-y-4">
              {plan.days.map((d, i) => (
                <div key={d.day} className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
                  <div className="font-semibold">
                    {d.day_name ?? `Deň ${d.day}`}{" "}
                    {d.date ? <span className="text-xs muted-2">({formatDateSK(d.date)})</span> : null}
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs muted-2 mb-1">Raňajky</div>
                      <textarea
                        className="input-surface h-24 resize-none"
                        value={d.breakfast}
                        onChange={(e) => updateDay(i, "breakfast", e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-xs muted-2 mb-1">Obed</div>
                      <textarea
                        className="input-surface h-24 resize-none"
                        value={d.lunch}
                        onChange={(e) => updateDay(i, "lunch", e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="text-xs muted-2 mb-1">Večera</div>
                      <textarea
                        className="input-surface h-24 resize-none"
                        value={d.dinner}
                        onChange={(e) => updateDay(i, "dinner", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs muted-2 mb-1">Poznámka</div>
                    <input
                      className="input-surface"
                      value={d.note}
                      onChange={(e) => updateDay(i, "note", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}