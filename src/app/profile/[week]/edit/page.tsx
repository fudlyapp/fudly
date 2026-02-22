"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PlanJSON = {
  summary?: any;
  days: Array<{
    day: number;
    day_name?: string;
    date?: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    note: string;
  }>;
  shopping?: any;
  recipes?: any;
};

function formatDateSK(iso?: string) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  return `${dd}.${mm}.${y}`;
}

function addDaysISO(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function EditWeekPage() {
  const params = useParams<{ week: string }>();
  const week = params.week;

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [plan, setPlan] = useState<PlanJSON | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        setPlan(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan, plan_generated")
        .eq("user_id", user.id)
        .eq("week_start", week)
        .maybeSingle();

      if (error) {
        setMsg("Chyba: " + error.message);
        setPlan(null);
        setLoading(false);
        return;
      }

      const p = (data as any)?.plan ?? (data as any)?.plan_generated ?? null;
      setPlan(p);
      setLoading(false);
    })();
  }, [supabase, week]);

  if (!week || typeof week !== "string") {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto w-full max-w-5xl">Neplatný týždeň.</div>
      </main>
    );
  }

  const weekEnd = addDaysISO(week, 6);

  function updateDay(dayIndex: number, field: "breakfast" | "lunch" | "dinner", value: string) {
    setPlan((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d, idx) => (idx === dayIndex ? { ...d, [field]: value } : d));
      return { ...prev, days };
    });
  }

  async function save() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    if (!plan) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("meal_plans")
        .update({
          plan,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("week_start", week);

      if (error) setMsg("Chyba pri ukladaní: " + error.message);
      else setMsg("✅ Uložené. Recepty ostávajú dostupné iba pre nezmenené jedlá.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">
              Upraviť jedlá • {formatDateSK(week)} – {formatDateSK(weekEnd)}
            </h1>
            <p className="mt-2 text-gray-300">
              Úprava mení len názvy jedál. Nákupný zoznam zatiaľ zostáva z pôvodného plánu.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/profile/${week}`}
              className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
            >
              Späť
            </Link>
            <button
              onClick={save}
              disabled={saving || !plan}
              className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200 disabled:opacity-50"
            >
              {saving ? "Ukladám…" : "Uložiť"}
            </button>
          </div>
        </header>

        {loading ? <div className="text-sm text-gray-400">Načítavam…</div> : null}
        {msg ? <div className="mb-4 text-sm text-gray-200">{msg}</div> : null}

        {!loading && !plan ? (
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            Nenašiel som plán na edit.
          </div>
        ) : null}

        {plan ? (
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Jedlá</h2>

            <div className="mt-4 space-y-4">
              {plan.days.map((d, idx) => {
                const label = d.day_name ? d.day_name : `Deň ${d.day}`;
                const date = d.date ? `(${formatDateSK(d.date)})` : "";

                return (
                  <div key={d.day} className="rounded-2xl border border-gray-800 bg-black p-4">
                    <div className="text-sm text-gray-300 font-semibold">
                      {label} <span className="text-gray-500 font-normal">{date}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Field label="Raňajky">
                        <input
                          value={d.breakfast}
                          onChange={(e) => updateDay(idx, "breakfast", e.target.value)}
                          className="w-full rounded-xl border border-gray-700 bg-zinc-950 px-3 py-2 text-white"
                        />
                      </Field>
                      <Field label="Obed">
                        <input
                          value={d.lunch}
                          onChange={(e) => updateDay(idx, "lunch", e.target.value)}
                          className="w-full rounded-xl border border-gray-700 bg-zinc-950 px-3 py-2 text-white"
                        />
                      </Field>
                      <Field label="Večera">
                        <input
                          value={d.dinner}
                          onChange={(e) => updateDay(idx, "dinner", e.target.value)}
                          className="w-full rounded-xl border border-gray-700 bg-zinc-950 px-3 py-2 text-white"
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-gray-400">{label}</div>
      {children}
    </label>
  );
}