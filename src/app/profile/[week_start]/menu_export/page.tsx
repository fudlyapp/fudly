//src/app/profile/[week_start]/menu_export/page.tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PlanDay = {
  day: number;
  day_name?: string;
  date?: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  note?: string;
  breakfast_kcal?: number;
  lunch_kcal?: number;
  dinner_kcal?: number;
  total_kcal?: number;
};

type PlanJSON = {
  summary: any;
  days: PlanDay[];
};

type MealPlanRow = {
  week_start: string;
  week_end: string | null;
  plan: any;
  plan_generated: any;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysISO(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  return toISODate(d);
}

function formatDateSK(iso?: string) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  return `${dd}.${mm}.${y}`;
}

function roundInt(n: number) {
  return Math.round(n);
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function recalcCaloriesSummary(plan: PlanJSON): PlanJSON {
  const next = deepClone(plan);
  next.summary = next.summary ?? {};
  next.days = Array.isArray(next.days) ? next.days : [];

  let weeklyTotal = 0;
  let anyCalories = false;

  for (const day of next.days) {
    const breakfast =
      typeof day.breakfast_kcal === "number" && Number.isFinite(day.breakfast_kcal)
        ? day.breakfast_kcal
        : 0;
    const lunch =
      typeof day.lunch_kcal === "number" && Number.isFinite(day.lunch_kcal)
        ? day.lunch_kcal
        : 0;
    const dinner =
      typeof day.dinner_kcal === "number" && Number.isFinite(day.dinner_kcal)
        ? day.dinner_kcal
        : 0;

    const hasAnyMealKcal =
      (typeof day.breakfast_kcal === "number" && Number.isFinite(day.breakfast_kcal)) ||
      (typeof day.lunch_kcal === "number" && Number.isFinite(day.lunch_kcal)) ||
      (typeof day.dinner_kcal === "number" && Number.isFinite(day.dinner_kcal));

    if (hasAnyMealKcal) {
      day.total_kcal = roundInt(breakfast + lunch + dinner);
      weeklyTotal += day.total_kcal;
      anyCalories = true;
    } else {
      day.total_kcal = undefined;
    }
  }

  if (anyCalories) {
    const daysCount = next.days.length || 7;
    next.summary.weekly_total_kcal = roundInt(weeklyTotal);
    next.summary.avg_daily_kcal = roundInt(weeklyTotal / daysCount);
  }

  return next;
}

function normalizeLoadedPlan(input: PlanJSON): PlanJSON {
  const next = deepClone(input);
  next.summary = next.summary ?? {};
  next.days = Array.isArray(next.days) ? next.days : [];
  return recalcCaloriesSummary(next);
}

export default function MenuExportPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const params = useParams<{ week_start: string }>();
  const weekStart = (params?.week_start || "").toString();

  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [row, setRow] = useState<MealPlanRow | null>(null);
  const [plan, setPlan] = useState<PlanJSON | null>(null);

  useEffect(() => {
    let alive = true;

    async function initAuth() {
      setAuthLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        setSession(data.session ?? null);
      } catch {
        if (!alive) return;
        setSession(null);
      } finally {
        if (!alive) return;
        setAuthLoading(false);
      }
    }

    initAuth();

    const { data } = supabase.auth.onAuthStateChange((_e: AuthChangeEvent, next: Session | null) => {
      if (!alive) return;
      setSession(next);
      setAuthLoading(false);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const user = session?.user;
      if (!user) {
        if (!authLoading) window.location.href = "/login";
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("plan, plan_generated, week_start, week_end")
        .eq("user_id", user.id)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (error) {
        setMsg("Chyba pri načítaní: " + error.message);
        setRow(null);
        setPlan(null);
        setLoading(false);
        return;
      }

      if (!data) {
        setMsg("Pre tento týždeň zatiaľ nemáš uložený plán.");
        setRow(null);
        setPlan(null);
        setLoading(false);
        return;
      }

      const r = data as MealPlanRow;
      const normalized = normalizeLoadedPlan((r.plan ?? r.plan_generated) as PlanJSON);

      setRow(r);
      setPlan(normalized);
      setLoading(false);
    })();
  }, [supabase, session?.user?.id, authLoading, weekStart]);

  const weekEnd = useMemo(() => {
    if (row?.week_end) return row.week_end;
    if (/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return addDaysISO(weekStart, 6);
    return "";
  }, [row?.week_end, weekStart]);

  useEffect(() => {
    if (!loading && plan?.days?.length) {
      const timer = window.setTimeout(() => {
        window.print();
      }, 400);
      return () => window.clearTimeout(timer);
    }
  }, [loading, plan]);

  if (loading) {
    return (
      <main className="min-h-screen page-invert-bg px-4 py-6">
        <div className="mx-auto max-w-4xl text-sm muted">
          {authLoading ? "Kontrolujem prihlásenie…" : "Načítavam export jedálnička…"}
        </div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="min-h-screen page-invert-bg px-4 py-6">
        <div className="mx-auto max-w-4xl rounded-2xl p-6 surface-same-as-nav surface-border">
          <div className="text-lg font-semibold">Export jedálnička</div>
          <div className="mt-2 text-sm text-red-500">{msg || "Niečo sa pokazilo."}</div>
          <Link
            href={`/profile/${weekStart}`}
            className="mt-4 inline-block rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold"
          >
            Späť na detail
          </Link>
        </div>
      </main>
    );
  }

  const summary = plan.summary ?? {};
  const weeklyTotal =
    typeof summary.weekly_total_kcal === "number" ? summary.weekly_total_kcal : null;

  return (
    <>
      <main className="min-h-screen page-invert-bg px-4 py-6 print:bg-white print:px-0 print:py-0">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
            <div>
              <div className="text-xl font-bold">Export jedálnička</div>
              <div className="mt-1 text-sm muted">
                Otvorí sa systémové okno tlače. Vyber „Uložiť ako PDF“.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary px-4 py-2 text-sm"
              >
                Uložiť ako PDF
              </button>
              <Link
                href={`/profile/${weekStart}`}
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold"
              >
                Späť
              </Link>
            </div>
          </div>

          <section className="menu-print-sheet bg-white text-black print:shadow-none">
            <header className="menu-print-header">
              <div>
                <div className="menu-brand">Fudly</div>
                <h1>Týždenný jedálniček</h1>
                <div className="menu-range">
                  {formatDateSK(weekStart)} – {formatDateSK(weekEnd || "")}
                </div>
              </div>

              <div className="menu-summary">
                <div>
                  <span>Týždeň spolu:</span>
                  <strong>{weeklyTotal != null ? `${weeklyTotal} kcal` : "—"}</strong>
                </div>
                <div>
                  <span>Počet dní:</span>
                  <strong>{plan.days.length}</strong>
                </div>
              </div>
            </header>

            <div className="menu-grid menu-grid-head">
              <div>Deň</div>
              <div>Raňajky</div>
              <div>Obed</div>
              <div>Večera</div>
              <div>Poznámka</div>
              <div>Spolu kcal</div>
            </div>

            {plan.days.map((d) => (
              <div key={d.day} className="menu-grid menu-grid-row">
                <div className="menu-day">
                  <div className="menu-day-name">{d.day_name ?? `Deň ${d.day}`}</div>
                  <div className="menu-day-date">{d.date ? formatDateSK(d.date) : ""}</div>
                </div>

                <div className="menu-cell">
                  <div className="menu-meal-title">{d.breakfast || "—"}</div>
                  <div className="menu-meal-kcal">
                    {typeof d.breakfast_kcal === "number" ? `${d.breakfast_kcal} kcal` : "—"}
                  </div>
                </div>

                <div className="menu-cell">
                  <div className="menu-meal-title">{d.lunch || "—"}</div>
                  <div className="menu-meal-kcal">
                    {typeof d.lunch_kcal === "number" ? `${d.lunch_kcal} kcal` : "—"}
                  </div>
                </div>

                <div className="menu-cell">
                  <div className="menu-meal-title">{d.dinner || "—"}</div>
                  <div className="menu-meal-kcal">
                    {typeof d.dinner_kcal === "number" ? `${d.dinner_kcal} kcal` : "—"}
                  </div>
                </div>

                <div className="menu-note">{d.note?.trim() ? d.note : "—"}</div>

                <div className="menu-total">
                  {typeof d.total_kcal === "number" ? `${d.total_kcal} kcal` : "—"}
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>

      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        .menu-print-sheet {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
        }

        .menu-print-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .menu-brand {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b7280;
        }

        .menu-print-header h1 {
          margin: 2px 0 0;
          font-size: 24px;
          line-height: 1.1;
          font-weight: 800;
        }

        .menu-range {
          margin-top: 4px;
          font-size: 13px;
          color: #4b5563;
        }

        .menu-summary {
          display: grid;
          gap: 6px;
          min-width: 180px;
          font-size: 12px;
        }

        .menu-summary div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 7px 10px;
        }

        .menu-grid {
          display: grid;
          grid-template-columns: 110px 1.3fr 1.3fr 1.3fr 1fr 90px;
          gap: 8px;
          align-items: stretch;
        }

        .menu-grid-head {
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #374151;
        }

        .menu-grid-head > div {
          border-bottom: 1px solid #d1d5db;
          padding: 0 4px 6px;
        }

        .menu-grid-row {
          margin-bottom: 6px;
        }

        .menu-grid-row > div {
          border: 1px solid #d1d5db;
          border-radius: 10px;
          padding: 7px 8px;
          min-height: 66px;
          background: #fff;
        }

        .menu-day {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .menu-day-name {
          font-size: 12px;
          font-weight: 800;
          line-height: 1.15;
        }

        .menu-day-date {
          margin-top: 3px;
          font-size: 10px;
          color: #6b7280;
        }

        .menu-cell {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 6px;
        }

        .menu-meal-title {
          font-size: 12px;
          font-weight: 600;
          line-height: 1.22;
          word-break: break-word;
        }

        .menu-meal-kcal {
          font-size: 10px;
          color: #6b7280;
        }

        .menu-note {
          font-size: 11px;
          line-height: 1.25;
          color: #374151;
          word-break: break-word;
        }

        .menu-total {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        @media print {
          html,
          body {
            background: #fff !important;
          }

          .menu-print-sheet {
            border: none;
            border-radius: 0;
            padding: 0;
            box-shadow: none;
          }
        }
      `}</style>
    </>
  );
}