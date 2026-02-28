//src/app/plans/[weekStart]/page.tsx
"use client";

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
  const [planGenerated, setPlanGenerated] = useState<PlanJSON | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan,plan_generated,week_start")
        .eq("week_start", weekStart)
        .single();

      if (error) {
        setMsg("Chyba: " + error.message);
        setPlan(null);
        setPlanGenerated(null);
      } else {
        setPlan((data as any)?.plan ?? null);
        setPlanGenerated((data as any)?.plan_generated ?? null);
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

    const { error } = await supabase
      .from("meal_plans")
      .update({
        plan,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq("week_start", weekStart);

    if (error) setMsg("Chyba pri ukladaní: " + error.message);
    else setMsg("✅ Uložené. Jedálniček je upravený.");

    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Upraviť jedálniček</h1>
            <p className="mt-2 text-gray-300">
              Týždeň od <b>{formatDateSK(weekStart)}</b>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => (window.location.href = "/profile")}
              className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
            >
              Späť do profilu
            </button>
            <button
              onClick={save}
              disabled={saving || !plan}
              className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200 disabled:opacity-40"
            >
              {saving ? "Ukladám..." : "Uložiť zmeny"}
            </button>
          </div>
        </header>

        {msg ? (
          <div className="mb-4 rounded-2xl border border-gray-800 bg-zinc-900 p-4 text-gray-200">{msg}</div>
        ) : null}

        {loading ? (
          <div className="text-gray-400">Načítavam…</div>
        ) : !plan ? (
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6 text-gray-300">
            Nenašiel som jedálniček pre tento týždeň.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Jedálniček (editovateľné)</h2>

              <div className="mt-4 overflow-auto rounded-xl border border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black text-gray-300">
                    <tr>
                      <th className="px-3 py-2">Deň</th>
                      <th className="px-3 py-2">Raňajky</th>
                      <th className="px-3 py-2">Obed</th>
                      <th className="px-3 py-2">Večera</th>
                      <th className="px-3 py-2">Poznámka</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.days.map((d, idx) => {
                      const label = d.day_name ? d.day_name : `Deň ${d.day}`;
                      const date = d.date ? formatDateSK(d.date) : "";
                      return (
                        <tr key={d.day} className="border-t border-gray-800 align-top">
                          <td className="px-3 py-2 font-semibold text-gray-200 whitespace-nowrap">
                            {label}
                            {date ? <span className="text-gray-400 font-normal"> ({date})</span> : null}
                          </td>

                          <td className="px-3 py-2">
                            <textarea
                              value={d.breakfast}
                              onChange={(e) => updateDay(idx, "breakfast", e.target.value)}
                              className="min-h-[70px] w-full rounded-xl border border-gray-700 bg-black p-2 text-gray-100"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <textarea
                              value={d.lunch}
                              onChange={(e) => updateDay(idx, "lunch", e.target.value)}
                              className="min-h-[70px] w-full rounded-xl border border-gray-700 bg-black p-2 text-gray-100"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <textarea
                              value={d.dinner}
                              onChange={(e) => updateDay(idx, "dinner", e.target.value)}
                              className="min-h-[70px] w-full rounded-xl border border-gray-700 bg-black p-2 text-gray-100"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <textarea
                              value={d.note}
                              onChange={(e) => updateDay(idx, "note", e.target.value)}
                              className="min-h-[70px] w-full rounded-xl border border-gray-700 bg-black p-2 text-gray-100"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Nákupy</h2>
              <p className="mt-2 text-sm text-gray-400">
                Zatiaľ ich držíme podľa pôvodného AI plánu. Ak si vyššie zmenil jedlá, tento zoznam nemusí sedieť.
                Neskôr sem pridáme tlačidlo „Prepočítať nákupný zoznam“.
              </p>

              <div className="mt-4 overflow-auto rounded-xl border border-gray-800">
                <pre className="bg-black p-4 text-sm text-gray-200 whitespace-pre-wrap">
                  {JSON.stringify((planGenerated ?? plan)?.shopping ?? [], null, 2)}
                </pre>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}