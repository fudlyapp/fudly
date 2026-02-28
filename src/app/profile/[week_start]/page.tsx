// src/app/profile/[week_start]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Recipe = {
  title: string;
  time_min: number;
  portions: number;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: string[];
};

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

type CategoryKey = "zelenina" | "ovocie" | "maso_ryby" | "vajcia" | "mliecne" | "pecivo" | "prilohy" | "ostatne";

type ShoppingItem = {
  name: string;
  quantity: string;
  category_key?: CategoryKey;
};

type ShoppingTrip = {
  trip: number;
  covers_days: string;
  estimated_cost_eur?: number;
  actual_cost_eur?: number | null;
  items: ShoppingItem[];
};

type PlanMeta = {
  edited_meals?: Record<string, true>;
  shopping_edited_trips?: Record<string, true>;
};

type PlanJSON = {
  summary?: any;
  days: PlanDay[];
  shopping?: ShoppingTrip[];
  recipes?: Record<string, Recipe>;
  meta?: PlanMeta;
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
      `Nákup ${t.trip} (dni ${t.covers_days}) – odhad: ${t.estimated_cost_eur ?? "—"} € – reálna: ${t.actual_cost_eur ?? "—"} €`
    );
    for (const it of t.items || []) lines.push(`- ${it.name} — ${it.quantity}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** --- KATEGÓRIE --- */
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

  if (/(zelenin|paradaj|tomat|uhork|cibu|cesnak|mrkv|paprik|zemiak|spenat|špenát|brokoli|salat|šalát)/.test(n))
    return "zelenina";
  if (/(ovoc|banan|banán|jablk|citron|citrón|pomaran|mandar|jahod|hrušk|hrusk|kiwi|hrozno)/.test(n)) return "ovocie";
  if (/(kura|kuracie|hydina|hovad|hoväd|slanina|bravc|bravč|ryb|losos|tuna|tuniak|mlet)/.test(n))
    return "maso_ryby";
  if (/(vajc)/.test(n)) return "vajcia";
  if (/(mliek|jogurt|kefir|smot|syr|mozarella|mozzarella|parmez|eidam|bryndz|maslo)/.test(n)) return "mliecne";
  if (/(chlieb|rožok|rozok|zeml|baget|toast|peciv|pečiv)/.test(n)) return "pecivo";
  if (/(ryza|ryž|cestovin|spaget|špaget|vlo(č|c)k|ovsen|muka|múka|krup|bulgur|kuskus)/.test(n)) return "prilohy";

  return "ostatne";
}

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  zelenina: "Zelenina",
  ovocie: "Ovocie",
  maso_ryby: "Mäso a ryby",
  vajcia: "Vajcia",
  mliecne: "Mliečne",
  pecivo: "Pečivo",
  prilohy: "Prílohy a obilniny",
  ostatne: "Ostatné",
};

const CATEGORY_ORDER: CategoryKey[] = ["zelenina", "ovocie", "maso_ryby", "vajcia", "mliecne", "pecivo", "prilohy", "ostatne"];

function recipeKey(day: number, meal: "breakfast" | "lunch" | "dinner") {
  return `d${day}_${meal}` as const;
}

/** --- MODAL --- */
function Modal({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-gray-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="text-lg font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-700 bg-black px-3 py-1.5 text-sm hover:bg-zinc-900"
          >
            Zavrieť
          </button>
        </div>

        <div className="mt-4">{children}</div>

        {actions ? <div className="mt-4 flex flex-wrap gap-2 justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}

/** ✅ zistí, či plán obsahuje kcal polia (PLUS) */
function planHasCalories(plan: PlanJSON | null) {
  if (!plan) return false;

  const s = plan.summary ?? {};
  if (
    typeof s.avg_daily_kcal === "number" ||
    typeof s.weekly_total_kcal === "number" ||
    typeof s.avg_daily_kcal_per_person === "number" ||
    typeof s.weekly_total_kcal_per_person === "number"
  ) return true;

  const days = Array.isArray(plan.days) ? plan.days : [];
  return days.some((d) =>
    typeof d.breakfast_kcal === "number" ||
    typeof d.lunch_kcal === "number" ||
    typeof d.dinner_kcal === "number" ||
    typeof d.total_kcal === "number"
  );
}

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

  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState<string>("");
  const [recipeBody, setRecipeBody] = useState<React.ReactNode>(null);

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
      const cloned = deepClone(r.plan);

      cloned.meta = cloned.meta ?? {};
      cloned.meta.edited_meals = cloned.meta.edited_meals ?? {};
      cloned.meta.shopping_edited_trips = cloned.meta.shopping_edited_trips ?? {};

      setRow(r);
      setPlan(cloned);
      setLoading(false);
    })();
  }, [supabase, weekStart, email]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
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

  const caloriesEnabled = useMemo(() => planHasCalories(plan), [plan]);

  /** --- MEALS --- */
  function updateMealText(dayIdx: number, meal: "breakfast" | "lunch" | "dinner", value: string) {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      if (!Array.isArray(next.days) || !next.days[dayIdx]) return prev;

      (next.days[dayIdx] as any)[meal] = value;

      next.meta = next.meta ?? {};
      next.meta.edited_meals = next.meta.edited_meals ?? {};
      next.meta.edited_meals[recipeKey(next.days[dayIdx].day, meal)] = true;

      return next;
    });
  }

  function showRecipeFor(dayNumber: number, meal: "breakfast" | "lunch" | "dinner", mealTitle: string) {
    const k = recipeKey(dayNumber, meal);
    const edited = !!plan?.meta?.edited_meals?.[k];

    if (edited) {
      setRecipeTitle("Recept");
      setRecipeBody(<div className="text-sm text-gray-200">Jedlo bolo manuálne upravené, preto recept nie je k dispozícii.</div>);
      setRecipeOpen(true);
      return;
    }

    const r = plan?.recipes?.[k];
    if (!r) {
      setRecipeTitle("Recept");
      setRecipeBody(<div className="text-sm text-gray-200">Recept sa nenašiel (pravdepodobne nie je uložený v pláne).</div>);
      setRecipeOpen(true);
      return;
    }

    setRecipeTitle(r.title || mealTitle || "Recept");
    setRecipeBody(
      <div className="space-y-4">
        <div className="text-sm text-gray-400">
          Čas: <span className="text-white font-semibold">{r.time_min ?? "—"}</span> min {" • "}Porcie:{" "}
          <span className="text-white font-semibold">{r.portions ?? "—"}</span>
        </div>

        <div>
          <div className="font-semibold mb-2">Ingrediencie</div>
          <div className="space-y-2">
            {(r.ingredients || []).map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-black px-3 py-2">
                <div className="min-w-0 truncate">{it.name}</div>
                <div className="text-sm text-gray-300 shrink-0">{it.quantity}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="font-semibold mb-2">Postup</div>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-200">
            {(r.steps || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    );

    setRecipeOpen(true);
  }

  /** --- KALÓRIE edit (iba ak sú povolené) --- */
  function updateDay(idx: number, patch: Partial<PlanDay>) {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      if (!Array.isArray(next.days) || !next.days[idx]) return prev;
      next.days[idx] = { ...next.days[idx], ...patch };
      return next;
    });
  }

  /** --- TRIP actual cost --- */
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
        if (!Number.isFinite(parsed) || parsed < 0) return prev;
        num = parsed;
      }

      next.shopping[tripIndex].actual_cost_eur = num;

      next.summary = next.summary ?? {};
      const sum = (next.shopping || [])
        .map((x) => (typeof x.actual_cost_eur === "number" ? x.actual_cost_eur : 0))
        .reduce((a, b) => a + b, 0);

      const anyFilled = (next.shopping || []).some((x) => typeof x.actual_cost_eur === "number");
      next.summary.actual_total_cost_eur = anyFilled ? Number(sum.toFixed(2)) : null;

      return next;
    });
  }

  /** --- SHOPPING edit: remove/add --- */
  function removeShoppingItem(tripIdx: number, itemIdx: number) {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.shopping = Array.isArray(next.shopping) ? next.shopping : [];
      if (!next.shopping[tripIdx]) return prev;

      next.shopping[tripIdx].items = Array.isArray(next.shopping[tripIdx].items) ? next.shopping[tripIdx].items : [];
      next.shopping[tripIdx].items.splice(itemIdx, 1);

      next.meta = next.meta ?? {};
      next.meta.shopping_edited_trips = next.meta.shopping_edited_trips ?? {};
      const tripNo = next.shopping[tripIdx].trip;
      next.meta.shopping_edited_trips[String(tripNo)] = true;

      return next;
    });
  }

  function addShoppingItem(tripIdx: number, cat: CategoryKey, name: string, qty: string) {
    const n = name.trim();
    const q = qty.trim();
    if (!n) return;

    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);
      next.shopping = Array.isArray(next.shopping) ? next.shopping : [];
      if (!next.shopping[tripIdx]) return prev;

      next.shopping[tripIdx].items = Array.isArray(next.shopping[tripIdx].items) ? next.shopping[tripIdx].items : [];
      next.shopping[tripIdx].items.push({ name: n, quantity: q || "—", category_key: cat });

      next.meta = next.meta ?? {};
      next.meta.shopping_edited_trips = next.meta.shopping_edited_trips ?? {};
      const tripNo = next.shopping[tripIdx].trip;
      next.meta.shopping_edited_trips[String(tripNo)] = true;

      return next;
    });
  }

  /** --- SAVE --- */
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

  /** --- SHOPPING view grouped --- */
  const shoppingByTrip = useMemo(() => {
    const trips = Array.isArray(shopping) ? shopping : [];

    return trips.map((t) => {
      const map = new Map<CategoryKey, Array<{ item: ShoppingItem; originalIndex: number }>>();

      const items = Array.isArray(t.items) ? t.items : [];
      items.forEach((it, idx) => {
        const ck = it.category_key ?? inferCategoryKey(it.name);
        map.set(ck, [...(map.get(ck) ?? []), { item: it, originalIndex: idx }]);
      });

      const categories = CATEGORY_ORDER.filter((k) => (map.get(k) ?? []).length > 0).map((k) => ({
        key: k,
        items: map.get(k)!,
      }));

      return {
        trip: t.trip,
        covers_days: t.covers_days,
        estimated_cost_eur: t.estimated_cost_eur,
        actual_cost_eur: t.actual_cost_eur ?? null,
        categories,
      };
    });
  }, [shopping]);

  const anyShoppingEdited = useMemo(() => {
    const m = plan?.meta?.shopping_edited_trips ?? {};
    return Object.keys(m).length > 0;
  }, [plan?.meta?.shopping_edited_trips]);

  function isTripEdited(tripNo: number) {
    return !!plan?.meta?.shopping_edited_trips?.[String(tripNo)];
  }

  const [addCat, setAddCat] = useState<Record<number, CategoryKey>>({});
  const [addName, setAddName] = useState<Record<number, string>>({});
  const [addQty, setAddQty] = useState<Record<number, string>>({});

  function setTripForm(tripIdx: number, patch: Partial<{ cat: CategoryKey; name: string; qty: string }>) {
    if (patch.cat) setAddCat((p) => ({ ...p, [tripIdx]: patch.cat! }));
    if (patch.name !== undefined) setAddName((p) => ({ ...p, [tripIdx]: patch.name! }));
    if (patch.qty !== undefined) setAddQty((p) => ({ ...p, [tripIdx]: patch.qty! }));
  }

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
                  <Link href="/profile" className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900">
                    Späť do profilu
                  </Link>
                  <Link href="/generate" className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900">
                    Generátor
                  </Link>
                  <button onClick={logout} className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900">
                    Odhlásiť
                  </button>
                </div>
              </div>
            ) : (
              <Link href="/login" className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200">
                Prihlásiť sa
              </Link>
            )}
          </div>
        </header>

        <Modal open={recipeOpen} title={recipeTitle} onClose={() => setRecipeOpen(false)}>
          {recipeBody}
        </Modal>

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

                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={exportTXT}
                    disabled={!shopping.length}
                    className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900 disabled:opacity-40"
                  >
                    Export TXT
                  </button>

                  {anyShoppingEdited ? (
                    <div className="text-xs text-amber-300">
                      Nákupný zoznam bol upravený — odhady cien nemusia sedieť.
                    </div>
                  ) : null}
                </div>

                {/* JEDÁLNIČEK */}
                <div className="mt-6 rounded-2xl border border-gray-800 bg-black p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-semibold">Jedálniček</div>

                    {caloriesEnabled ? (
                      <div className="text-xs text-gray-400">
                        domácnosť: <span className="text-white font-semibold">{plan.summary?.avg_daily_kcal ?? "—"}</span> kcal/deň
                        {" • "}týždeň: <span className="text-white font-semibold">{plan.summary?.weekly_total_kcal ?? "—"}</span> kcal
                        {" • "}na osobu: <span className="text-white font-semibold">{plan.summary?.avg_daily_kcal_per_person ?? "—"}</span> kcal/deň
                        {" • "}týždeň na osobu:{" "}
                        <span className="text-white font-semibold">{plan.summary?.weekly_total_kcal_per_person ?? "—"}</span> kcal
                      </div>
                    ) : (
                      <div className="text-xs text-amber-300">
                        Kalórie: dostupné v <span className="font-semibold">PLUS</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    {plan.days.map((d, idx) => (
                      <div key={idx} className="rounded-xl border border-gray-800 bg-zinc-950 p-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="font-semibold">
                            {d.day_name ?? `Deň ${d.day}`} {d.date ? `• ${formatDateSK(d.date)}` : ""}
                          </div>
                          <div className="text-xs text-gray-400">
                            {caloriesEnabled ? (
                              <>
                                spolu: <span className="text-white font-semibold">{typeof d.total_kcal === "number" ? d.total_kcal : "—"}</span> kcal
                              </>
                            ) : (
                              <span className="text-amber-300">Kalórie: PLUS</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <MealBox
                            label="Raňajky"
                            value={d.breakfast}
                            kcal={caloriesEnabled ? d.breakfast_kcal : undefined}
                            kcalLocked={!caloriesEnabled}
                            onChange={(v) => updateMealText(idx, "breakfast", v)}
                            onShowRecipe={() => showRecipeFor(d.day, "breakfast", d.breakfast)}
                            edited={!!plan.meta?.edited_meals?.[recipeKey(d.day, "breakfast")]}
                          />
                          <MealBox
                            label="Obed"
                            value={d.lunch}
                            kcal={caloriesEnabled ? d.lunch_kcal : undefined}
                            kcalLocked={!caloriesEnabled}
                            onChange={(v) => updateMealText(idx, "lunch", v)}
                            onShowRecipe={() => showRecipeFor(d.day, "lunch", d.lunch)}
                            edited={!!plan.meta?.edited_meals?.[recipeKey(d.day, "lunch")]}
                          />
                          <MealBox
                            label="Večera"
                            value={d.dinner}
                            kcal={caloriesEnabled ? d.dinner_kcal : undefined}
                            kcalLocked={!caloriesEnabled}
                            onChange={(v) => updateMealText(idx, "dinner", v)}
                            onShowRecipe={() => showRecipeFor(d.day, "dinner", d.dinner)}
                            edited={!!plan.meta?.edited_meals?.[recipeKey(d.day, "dinner")]}
                          />
                        </div>

                        {/* ✅ kcal edit inputy len ak plan obsahuje kalórie */}
                        {caloriesEnabled ? (
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <SmallNumber label="R kcal" value={d.breakfast_kcal} onChange={(v) => updateDay(idx, { breakfast_kcal: v })} />
                            <SmallNumber label="O kcal" value={d.lunch_kcal} onChange={(v) => updateDay(idx, { lunch_kcal: v })} />
                            <SmallNumber label="V kcal" value={d.dinner_kcal} onChange={(v) => updateDay(idx, { dinner_kcal: v })} />
                            <SmallNumber label="Spolu" value={d.total_kcal} onChange={(v) => updateDay(idx, { total_kcal: v })} />
                          </div>
                        ) : null}

                        {d.note ? <div className="mt-3 text-xs text-gray-500">{d.note}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>

                {/* NÁKUPY */}
                <div className="mt-8 rounded-2xl border border-gray-800 bg-black p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-lg font-semibold">Nákupy podľa kategórií</div>
                    <div className="text-xs text-gray-400">Tip: zmeny si nezabudni uložiť hore cez “Uložiť zmeny”.</div>
                  </div>

                  {shoppingByTrip.length ? (
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {shoppingByTrip.map((t, tripIdx) => {
                        const editedThisTrip = isTripEdited(t.trip);

                        return (
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
                                {editedThisTrip ? <span className="text-amber-300"> • zoznam upravený – odhad nezohľadňuje zmeny</span> : null}
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl border border-gray-800 bg-black p-3">
                              <div className="text-xs text-gray-500 mb-1">Reálna cena (€) – tento nákup</div>
                              <input
                                value={
                                  typeof plan.shopping?.[tripIdx]?.actual_cost_eur === "number"
                                    ? String(plan.shopping?.[tripIdx]?.actual_cost_eur)
                                    : ""
                                }
                                onChange={(e) => updateTripActualCost(tripIdx, e.target.value)}
                                placeholder="napr. 32.50"
                                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                                inputMode="decimal"
                              />
                            </div>

                            <div className="mt-4 space-y-3">
                              {t.categories.map((c) => (
                                <CategoryBox
                                  key={c.key}
                                  title={CATEGORY_LABEL[c.key]}
                                  onAdd={() => {
                                    const name = window.prompt(`Pridať položku – ${CATEGORY_LABEL[c.key]}: názov`, "");
                                    if (!name) return;
                                    const qty = window.prompt("Množstvo (napr. 2 ks / 500 g / 1 l)", "") ?? "";
                                    addShoppingItem(tripIdx, c.key, name, qty);
                                  }}
                                >
                                  <div className="mt-2 space-y-2">
                                    {c.items.map(({ item, originalIndex }) => (
                                      <div
                                        key={originalIndex}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-zinc-950 px-3 py-2"
                                      >
                                        <div className="min-w-0">
                                          <span className="truncate block">{item.name}</span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <div className="text-sm text-gray-300">{item.quantity}</div>
                                          <button
                                            type="button"
                                            onClick={() => removeShoppingItem(tripIdx, originalIndex)}
                                            className="rounded-lg border border-gray-700 bg-black px-2 py-1 text-xs hover:bg-zinc-900"
                                            title="Odstrániť"
                                          >
                                            −
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CategoryBox>
                              ))}
                            </div>

                            <div className="mt-4 rounded-2xl border border-gray-800 bg-black p-3">
                              <div className="text-sm font-semibold">Pridať položku</div>
                              <div className="mt-2 grid grid-cols-1 gap-2">
                                <select
                                  value={addCat[tripIdx] ?? "zelenina"}
                                  onChange={(e) => setTripForm(tripIdx, { cat: e.target.value as CategoryKey })}
                                  className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                                >
                                  {CATEGORY_ORDER.map((k) => (
                                    <option key={k} value={k}>
                                      {CATEGORY_LABEL[k]}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  value={addName[tripIdx] ?? ""}
                                  onChange={(e) => setTripForm(tripIdx, { name: e.target.value })}
                                  placeholder="Názov (napr. Kiwi)"
                                  className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                                />

                                <input
                                  value={addQty[tripIdx] ?? ""}
                                  onChange={(e) => setTripForm(tripIdx, { qty: e.target.value })}
                                  placeholder="Množstvo (napr. 3 ks / 1 kg / 500 ml)"
                                  className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                                />

                                <button
                                  type="button"
                                  onClick={() => {
                                    const cat = addCat[tripIdx] ?? "zelenina";
                                    const name = addName[tripIdx] ?? "";
                                    const qty = addQty[tripIdx] ?? "";
                                    addShoppingItem(tripIdx, cat, name, qty);
                                    setTripForm(tripIdx, { name: "", qty: "" });
                                  }}
                                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200"
                                >
                                  + Pridať
                                </button>

                                <div className="text-xs text-gray-500">Pozn.: ceny neprepočítavame — pri upravenom zozname odhad nemusí sedieť.</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-gray-400">Tento plán nemá uložené nákupy.</div>
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

function MealBox({
  label,
  value,
  kcal,
  kcalLocked,
  onChange,
  onShowRecipe,
  edited,
}: {
  label: string;
  value: string;
  kcal?: number;
  kcalLocked: boolean;
  onChange: (v: string) => void;
  onShowRecipe: () => void;
  edited: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-black p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-gray-400">{label}</div>
        <div className={kcalLocked ? "text-[11px] text-amber-300" : "text-[11px] text-gray-500"}>
          {kcalLocked ? "PLUS" : `${typeof kcal === "number" ? kcal : "—"} kcal`}
        </div>
      </div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        {edited ? <div className="text-[11px] text-amber-300">Upravené – recept nebude dostupný</div> : <div />}
        <button
          type="button"
          onClick={onShowRecipe}
          className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900"
        >
          Zobraziť recept
        </button>
      </div>
    </div>
  );
}

function CategoryBox({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-black p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">{title}</div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-gray-700 bg-black px-2 py-1 text-xs hover:bg-zinc-900"
          title="Pridať položku do tejto kategórie"
        >
          +
        </button>
      </div>
      {children}
    </div>
  );
}

function SmallNumber({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
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