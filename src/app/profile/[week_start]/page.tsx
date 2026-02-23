"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PlanDay = {
  day: number;
  day_name?: string;
  date?: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  note: string;

  breakfast_kcal?: number;
  lunch_kcal?: number;
  dinner_kcal?: number;
  total_kcal?: number;
};

type ShoppingItem = { name: string; quantity: string };

type ShoppingTrip = {
  trip: number;
  covers_days: string;
  estimated_cost_eur?: number;
  actual_cost_eur?: number | null; // ✅ reálna cena per trip
  items: ShoppingItem[];
};

type PlanJSON = {
  summary?: any;
  days: PlanDay[];
  shopping?: ShoppingTrip[];
  recipes?: Record<string, any>;
};

type MealPlanRow = {
  id: string;
  week_start: string;
  week_end: string | null;
  plan: PlanJSON;
  plan_generated: PlanJSON | null;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string | null;
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

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function shoppingToTXT(weekStart: string, shopping: ShoppingTrip[]) {
  const lines: string[] = [];
  lines.push(`Fudly – Nákupný zoznam`);
  lines.push(`Týždeň: ${weekStart}`);
  lines.push("");

  for (const t of shopping) {
    lines.push(
      `Nákup ${t.trip} (dni ${t.covers_days}) – odhad: ${t.estimated_cost_eur ?? "—"} € – reálna: ${
        t.actual_cost_eur ?? "—"
      } €`
    );
    for (const it of t.items || []) lines.push(`- ${it.name} — ${it.quantity}`);
    lines.push("");
  }
  return lines.join("\n");
}

type CategoryKey = "zelenina" | "ovocie" | "maso_ryby" | "vajcia" | "mliecne" | "obilniny" | "ostatne";

function normalizeItemName(raw: string) {
  const s = (raw || "").toLowerCase();
  const inParens = s.match(/\(([^)]+)\)/);
  if (inParens?.[1]) {
    const firstInside = inParens[1].split(",")[0]?.trim();
    if (firstInside) return firstInside;
  }
  const first = s.split(",")[0]?.trim() ?? s.trim();
  return first
    .replace(/\([^)]*\)/g, "")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCategoryKey(name: string): CategoryKey {
  const n = normalizeItemName(name);

  if (/(zelenin|paradaj|tomat|uhork|cibu|cesnak|mrkv|paprik|zemiak|spenat|špenát)/.test(n)) return "zelenina";
  if (/(ovoc|banan|banán|jablk|citron|citrón|pomaran|mandar|jahod)/.test(n)) return "ovocie";
  if (/(kura|kuracie|hydina|hovad|hoväd|slanina|bravc|bravč|ryb|losos|tuna|tuniak)/.test(n)) return "maso_ryby";
  if (/(vajc)/.test(n)) return "vajcia";
  if (/(mliek|jogurt|kefir|smot|syr|mozarella|mozzarella|parmez|eidam|bryndz|maslo)/.test(n)) return "mliecne";
  if (/(chlieb|rožok|rozok|zeml|ryza|ryž|cestovin|spaget|špaget|vlo(č|c)k|ovsen|muka|múka)/.test(n)) return "obilniny";

  return "ostatne";
}

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  zelenina: "Zelenina",
  ovocie: "Ovocie",
  maso_ryby: "Mäso a ryby",
  vajcia: "Vajcia",
  mliecne: "Mliečne",
  obilniny: "Prílohy a obilniny",
  ostatne: "Ostatné",
};

export default function MealPlanDetailPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const params = useParams<{ week_start: string }>();
  const weekStart = (params?.week_start || "").toString();

  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<MealPlanRow | null>(null);
  const [plan, setPlan] = useState<PlanJSON | null>(null);

  const [msg, setMsg] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
      setAuthLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      setAuthLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setMsg("");
      setLoading(true);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;

      if (!user) {
        setRow(null);
        setPlan(null);
        setLoading(false);
        return;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        setRow(null);
        setPlan(null);
        setMsg("Neplatný formát týždňa.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, week_start, week_end, plan, plan_generated, is_edited, edited_at, created_at")
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
        setMsg("Pre tento týždeň nemáš uložený plán.");
        setRow(null);
        setPlan(null);
        setLoading(false);
        return;
      }

      const r = data as unknown as MealPlanRow;
      setRow(r);
      setPlan(deepClone(r.plan));
      setLoading(false);
    })();
  }, [supabase, weekStart, email]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function updateDay(idx: number, patch: Partial<PlanDay>) {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      if (!Array.isArray(next.days) || !next.days[idx]) return prev;
      next.days[idx] = { ...next.days[idx], ...patch };
      return next;
    });
  }

  function updateTripActualCost(tripIndex: number, v: string) {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.shopping = Array.isArray(next.shopping) ? next.shopping : [];

      if (!next.shopping[tripIndex]) return prev;

      const t = v.trim();
      let num: number | null = null;
      if (t) {
        const parsed = Number(t.replace(",", "."));
        if (!Number.isFinite(parsed) || parsed < 0) return prev; // necháme bez zmeny, validáciu ukážeme pri save
        num = parsed;
      }

      next.shopping[tripIndex].actual_cost_eur = num;

      // prepočet sumy vyplnených tripov do summary.actual_total_cost_eur
      next.summary = next.summary ?? {};
      const sum = (next.shopping || [])
        .map((x) => (typeof x.actual_cost_eur === "number" ? x.actual_cost_eur : 0))
        .reduce((a, b) => a + b, 0);

      // ak nie je vyplnený ani jeden trip, nechaj null
      const anyFilled = (next.shopping || []).some((x) => typeof x.actual_cost_eur === "number");
      next.summary.actual_total_cost_eur = anyFilled ? Number(sum.toFixed(2)) : null;

      return next;
    });
  }

  async function saveEdits() {
    setMsg("");
    if (!plan || !row) return;

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!Array.isArray(plan.days) || plan.days.length !== 7) {
      setMsg("Plán vyzerá poškodený (days nie je 7).");
      return;
    }

    // validácia reálnych cien
    const trips = Array.isArray(plan.shopping) ? plan.shopping : [];
    for (const t of trips) {
      if (t.actual_cost_eur == null) continue;
      if (typeof t.actual_cost_eur !== "number" || !Number.isFinite(t.actual_cost_eur) || t.actual_cost_eur < 0) {
        setMsg(`Neplatná reálna cena pri Nákupe ${t.trip}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("meal_plans")
        .update({
          plan: plan,
          is_edited: true,
          edited_at: nowIso,
        })
        .eq("user_id", user.id)
        .eq("week_start", row.week_start);

      if (error) setMsg("Chyba pri ukladaní: " + error.message);
      else {
        setMsg("✅ Uložené.");
        setRow((prev) => (prev ? { ...prev, plan: deepClone(plan), is_edited: true, edited_at: nowIso } : prev));
      }
    } catch (e: any) {
      setMsg("Chyba pri ukladaní: " + (e?.message ?? "unknown"));
    } finally {
      setSaving(false);
    }
  }

  const weekEnd = useMemo(() => {
    if (row?.week_end) return row.week_end;
    if (/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return addDaysISO(weekStart, 6);
    return "";
  }, [row?.week_end, weekStart]);

  const shopping = useMemo(() => plan?.shopping ?? [], [plan]);

  function exportTXT() {
    if (!shopping.length) return;
    downloadText(`fudly-nakup-${weekStart}.txt`, shoppingToTXT(weekStart, shopping));
  }

  const shoppingByTripAndCategory = useMemo(() => {
    const result: Array<{
      trip: number;
      covers_days: string;
      estimated_cost_eur?: number;
      actual_cost_eur?: number | null;
      categories: Array<{ key: CategoryKey; items: ShoppingItem[] }>;
    }> = [];

    for (const t of shopping || []) {
      const map = new Map<CategoryKey, ShoppingItem[]>();

      for (const it of t.items || []) {
        const ck = inferCategoryKey(it.name);
        map.set(ck, [...(map.get(ck) ?? []), it]);
      }

      const order: CategoryKey[] = ["zelenina", "ovocie", "maso_ryby", "vajcia", "mliecne", "obilniny", "ostatne"];
      const categories = order
        .filter((k) => (map.get(k) ?? []).length > 0)
        .map((k) => ({ key: k, items: map.get(k)! }));

      result.push({
        trip: t.trip,
        covers_days: t.covers_days,
        estimated_cost_eur: t.estimated_cost_eur,
        actual_cost_eur: t.actual_cost_eur ?? null,
        categories,
      });
    }

    return result;
  }, [shopping]);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Detail týždňa</h1>
            <p className="mt-2 text-gray-300">
              Týždeň {formatDateSK(weekStart)} – {formatDateSK(weekEnd)}
            </p>
          </div>

          <div className="text-right">
            {authLoading ? (
              <div className="text-sm text-gray-400">Kontrolujem prihlásenie…</div>
            ) : email ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-300">
                  Prihlásený ako <span className="text-white font-semibold">{email}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Link
                    href="/profile"
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Späť do profilu
                  </Link>
                  <Link
                    href="/generate"
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Generátor
                  </Link>
                  <button
                    onClick={logout}
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Odhlásiť
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200"
              >
                Prihlásiť sa
              </Link>
            )}
          </div>
        </header>

        {email && (
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            {loading ? <div className="text-sm text-gray-400">Načítavam…</div> : null}
            {!loading && msg ? <div className="mb-4 text-sm text-gray-200">{msg}</div> : null}

            {!loading && row && plan && (
              <>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="text-sm text-gray-400">
                    Stav: {row.is_edited ? "Upravené" : "Generované"}
                    {row.edited_at ? ` • Upravené: ${new Date(row.edited_at).toLocaleString()}` : ""}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={saveEdits}
                      disabled={saving}
                      className="rounded-xl bg-white px-5 py-3 text-black font-semibold hover:bg-gray-200 transition disabled:opacity-40"
                      type="button"
                    >
                      {saving ? "Ukladám..." : "Uložiť zmeny"}
                    </button>
                  </div>
                </div>

                {/* EXPORT iba TXT */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={exportTXT}
                    disabled={!shopping.length}
                    className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900 disabled:opacity-40"
                  >
                    Export TXT
                  </button>
                </div>

                {/* KALÓRIE */}
                <div className="mt-6 rounded-2xl border border-gray-800 bg-black p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-semibold">Kalórie</div>
                    <div className="text-xs text-gray-400">
  domácnosť:{" "}
  <span className="text-white font-semibold">{plan.summary?.avg_daily_kcal ?? "—"}</span> kcal/deň
  {" • "}
  týždeň: <span className="text-white font-semibold">{plan.summary?.weekly_total_kcal ?? "—"}</span> kcal
  {" • "}
  na osobu:{" "}
  <span className="text-white font-semibold">{plan.summary?.avg_daily_kcal_per_person ?? "—"}</span> kcal/deň
  {" • "}
  týždeň na osobu:{" "}
  <span className="text-white font-semibold">{plan.summary?.weekly_total_kcal_per_person ?? "—"}</span> kcal
</div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    {plan.days.map((d, idx) => (
                      <div key={idx} className="rounded-xl border border-gray-800 bg-zinc-950 p-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="font-semibold">
                            {d.day_name ?? `Deň ${d.day}`} {d.date ? `• ${formatDateSK(d.date)}` : ""}
                          </div>
                          <div className="text-xs text-gray-400">
                            spolu: <span className="text-white font-semibold">{d.total_kcal ?? "—"}</span> kcal
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                          <div className="rounded-lg border border-gray-800 bg-black p-2">
                            <div className="text-xs text-gray-400 mb-1">Raňajky</div>
                            <div className="text-gray-200">{d.breakfast}</div>
                            <div className="text-xs text-gray-400 mt-1">{d.breakfast_kcal ?? "—"} kcal</div>
                          </div>
                          <div className="rounded-lg border border-gray-800 bg-black p-2">
                            <div className="text-xs text-gray-400 mb-1">Obed</div>
                            <div className="text-gray-200">{d.lunch}</div>
                            <div className="text-xs text-gray-400 mt-1">{d.lunch_kcal ?? "—"} kcal</div>
                          </div>
                          <div className="rounded-lg border border-gray-800 bg-black p-2">
                            <div className="text-xs text-gray-400 mb-1">Večera</div>
                            <div className="text-gray-200">{d.dinner}</div>
                            <div className="text-xs text-gray-400 mt-1">{d.dinner_kcal ?? "—"} kcal</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                          <SmallNumber
                            label="R kcal"
                            value={d.breakfast_kcal}
                            onChange={(v) => updateDay(idx, { breakfast_kcal: v })}
                          />
                          <SmallNumber
                            label="O kcal"
                            value={d.lunch_kcal}
                            onChange={(v) => updateDay(idx, { lunch_kcal: v })}
                          />
                          <SmallNumber
                            label="V kcal"
                            value={d.dinner_kcal}
                            onChange={(v) => updateDay(idx, { dinner_kcal: v })}
                          />
                          <SmallNumber label="Spolu" value={d.total_kcal} onChange={(v) => updateDay(idx, { total_kcal: v })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NÁKUPY PODĽA KATEGÓRIÍ – BEZ OBRÁZKOV/IKON */}
                <div className="mt-8 rounded-2xl border border-gray-800 bg-black p-4">
                  <div className="text-lg font-semibold mb-4">Nákupy podľa kategórií</div>

                  {shoppingByTripAndCategory.length ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {shoppingByTripAndCategory.map((t, tripIdx) => (
                        <div key={t.trip} className="rounded-2xl border border-gray-800 bg-zinc-950 p-4">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="text-lg font-semibold">Nákup {t.trip}</div>
                            <div className="text-xs text-gray-400">
                              dni {t.covers_days}
                              {t.estimated_cost_eur != null ? (
                                <>
                                  {" • "}odhad: <span className="text-white font-semibold">{t.estimated_cost_eur}</span> €
                                </>
                              ) : null}
                            </div>
                          </div>

                          {/* Reálna cena pre tento trip */}
                          <div className="mt-3 rounded-xl border border-gray-800 bg-black p-3">
                            <div className="text-xs text-gray-500 mb-1">Reálna cena (€) – tento nákup</div>
                            <input
                              value={
                                typeof (plan.shopping?.[tripIdx]?.actual_cost_eur) === "number"
                                  ? String(plan.shopping?.[tripIdx]?.actual_cost_eur)
                                  : ""
                              }
                              onChange={(e) => updateTripActualCost(tripIdx, e.target.value)}
                              placeholder="napr. 32.50"
                              className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                              inputMode="decimal"
                            />
                            <div className="mt-1 text-xs text-gray-500">
                              Tip: po úprave klikni hore na “Uložiť zmeny”.
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            {t.categories.map((c) => (
                              <div key={c.key} className="rounded-xl border border-gray-800 bg-black p-3">
                                <div className="font-semibold">{CATEGORY_LABEL[c.key]}</div>

                                <div className="mt-2 space-y-2">
                                  {c.items.map((it, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-zinc-950 px-3 py-2"
                                    >
                                      <div className="min-w-0">
                                        <span className="truncate block">{it.name}</span>
                                      </div>
                                      <div className="text-sm text-gray-300 shrink-0">{it.quantity}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">Tento plán nemá uložené nákupy.</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function SmallNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <input
        value={value ?? ""}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (!t) return onChange(undefined);
          const n = Number(t);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
        inputMode="numeric"
        placeholder="—"
      />
    </label>
  );
}