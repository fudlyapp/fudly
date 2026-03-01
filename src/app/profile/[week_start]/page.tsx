// src/app/profile/[week_start]/page.tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Recipe = {
  title: string;
  time_min: number;
  portions: number;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: string[];
};

type ShoppingItem = {
  name: string;
  quantity: string;
  category_key?: string;
};

type ShoppingTrip = {
  trip: number;
  covers_days: string;
  estimated_cost_eur?: number;
  actual_cost_eur?: number | null;
  items: ShoppingItem[];
};

type PlanDay = {
  day: number;
  day_name?: string;
  date?: string; // YYYY-MM-DD
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
  shopping: ShoppingTrip[];
  recipes?: Record<string, Recipe>;
  meta?: {
    edited_meals?: Record<string, boolean>;
    shopping_edited_trips?: Record<string, boolean>;
  };
};

type MealPlanRow = {
  week_start: string;
  week_end: string | null;
  plan: any;
  plan_generated: any;
  is_edited?: boolean | null;
  edited_at?: string | null;
};

type CategoryKey =
  | "veg"
  | "fruit"
  | "meat"
  | "fish"
  | "dairy"
  | "bakery"
  | "dry"
  | "frozen"
  | "spices"
  | "other";

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  veg: "Zelenina",
  fruit: "Ovocie",
  meat: "Mäso",
  fish: "Ryby",
  dairy: "Mliečne",
  bakery: "Pečivo",
  dry: "Trvanlivé",
  frozen: "Mrazené",
  spices: "Koreničky",
  other: "Ostatné",
};

const CATEGORY_ORDER: CategoryKey[] = [
  "veg",
  "fruit",
  "meat",
  "fish",
  "dairy",
  "bakery",
  "dry",
  "frozen",
  "spices",
  "other",
];

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

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

function recipeKey(dayNumber: number, meal: "breakfast" | "lunch" | "dinner") {
  return `d${dayNumber}_${meal}`;
}

function planHasCalories(plan: PlanJSON | null) {
  if (!plan?.days?.length) return false;
  return plan.days.some(
    (d) =>
      typeof d.total_kcal === "number" ||
      typeof d.breakfast_kcal === "number" ||
      typeof d.lunch_kcal === "number" ||
      typeof d.dinner_kcal === "number"
  );
}

function inferCategoryKey(name: string): CategoryKey {
  const n = (name || "").toLowerCase();

  if (
    /(paradajk|uhork|paprik|cibuľ|cibul|cesnak|mrkv|zemiak|šalát|salat|brokolic|karfiol|cuketa|špenát|spenat)/.test(
      n
    )
  )
    return "veg";
  if (/(jablk|banán|banan|hrušk|pomaranč|pomaranc|citrón|citron|kiwi|jahod|malin|hrozno)/.test(n)) return "fruit";
  if (/(kurac|hovädz|hovedz|bravč|bravc|mlet|slan|šunka|sunka|klobás|klobas)/.test(n)) return "meat";
  if (/(losos|tuniak|tresk|ryb)/.test(n)) return "fish";
  if (/(mliek|jogurt|sy[rř]|tvaroh|smotan|maslo|mozarel|parmez|vajc)/.test(n)) return "dairy";
  if (/(chlieb|rožok|rozok|baget|tortill|toast|žeml|zeml)/.test(n)) return "bakery";
  if (/(ryža|ryza|cestov|múka|muka|ovsen|šošov|sosov|cícer|cicer|fazuľ|fazul|konzerv|olej)/.test(n)) return "dry";
  if (/(mrazen)/.test(n)) return "frozen";
  if (/(soľ|sol|koren|paprika mletá|rasca|kari|oregano|bazalk)/.test(n)) return "spices";

  return "other";
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
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
  lines.push(`Týždeň: ${formatDateSK(weekStart)} – ${formatDateSK(addDaysISO(weekStart, 6))}`);
  lines.push("");

  for (const t of shopping || []) {
    lines.push(
      `Nákup ${t.trip} (dni ${t.covers_days}) – odhad: ${t.estimated_cost_eur ?? "—"} € – reálna: ${t.actual_cost_eur ?? "—"} €`
    );
    for (const it of t.items || []) lines.push(`- ${it.name} — ${it.quantity}`);
    lines.push("");
  }

  return lines.join("\n");
}

export default function WeekDetailPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const params = useParams<{ week_start: string }>();
  const weekStart = (params?.week_start || "").toString();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [row, setRow] = useState<MealPlanRow | null>(null);
  const [plan, setPlan] = useState<PlanJSON | null>(null);

  const [dirty, setDirty] = useState(false);

  // recept modal
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeTitle, setRecipeTitle] = useState("Recept");
  const [recipeBody, setRecipeBody] = useState<React.ReactNode>(null);

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
        .select("plan, plan_generated, week_start, week_end, is_edited, edited_at")
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
      const cloned = deepClone((r.plan ?? r.plan_generated) as PlanJSON);

      cloned.meta = cloned.meta ?? {};
      cloned.meta.edited_meals = cloned.meta.edited_meals ?? {};
      cloned.meta.shopping_edited_trips = cloned.meta.shopping_edited_trips ?? {};

      setRow(r);
      setPlan(cloned);
      setDirty(false);
      setLoading(false);
    })();
  }, [supabase, weekStart]);

  // ochrana pred refresh/close tab
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const weekEnd = useMemo(() => {
    if (row?.week_end) return row.week_end;
    if (/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return addDaysISO(weekStart, 6);
    return "";
  }, [row?.week_end, weekStart]);

  const caloriesEnabled = useMemo(() => planHasCalories(plan), [plan]);

  const shopping = useMemo(() => plan?.shopping ?? [], [plan]);
  const anyShoppingEdited = useMemo(() => {
    const m = plan?.meta?.shopping_edited_trips ?? {};
    return Object.keys(m).length > 0;
  }, [plan?.meta?.shopping_edited_trips]);

  function isTripEdited(tripNo: number) {
    return !!plan?.meta?.shopping_edited_trips?.[String(tripNo)];
  }

  /** ---- MEALS editing ---- */
  function updateMealText(dayIdx: number, meal: "breakfast" | "lunch" | "dinner", value: string) {
    setDirty(true);
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

  /** ---- Recipes modal (keeps your behavior: if edited meal -> recipe unavailable) ---- */
  function showRecipeFor(dayNumber: number, meal: "breakfast" | "lunch" | "dinner") {
    const k = recipeKey(dayNumber, meal);
    const edited = !!plan?.meta?.edited_meals?.[k];

    if (edited) {
      setRecipeTitle("Recept");
      setRecipeBody(<div className="text-sm muted">Jedlo bolo manuálne upravené, preto recept nie je k dispozícii.</div>);
      setRecipeOpen(true);
      return;
    }

    const r = plan?.recipes?.[k];
    if (!r) {
      setRecipeTitle("Recept");
      setRecipeBody(<div className="text-sm muted">Recept sa nenašiel (pravdepodobne nie je uložený v pláne).</div>);
      setRecipeOpen(true);
      return;
    }

    setRecipeTitle(r.title || "Recept");
    setRecipeBody(
      <div className="space-y-4">
        <div className="text-xs muted-2">
          {r.time_min ? `${r.time_min} min` : ""} {r.portions ? `• ${r.portions} porcie` : ""}
        </div>

        {r.ingredients?.length ? (
          <div>
            <div className="text-sm font-semibold">Ingrediencie</div>
            <ul className="mt-2 space-y-1 text-sm">
              {r.ingredients.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="muted">{it.name}</span>
                  <span className="muted-2">{it.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {r.steps?.length ? (
          <div>
            <div className="text-sm font-semibold">Postup</div>
            <ol className="mt-2 list-decimal pl-5 space-y-1 text-sm">
              {r.steps.map((s, i) => (
                <li key={i} className="muted">
                  {s}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    );
    setRecipeOpen(true);
  }

  /** ---- SHOPPING grouped + edit/add/remove ---- */
  const shoppingByTrip = useMemo(() => {
    const trips = Array.isArray(shopping) ? shopping : [];

    return trips.map((t) => {
      const map = new Map<CategoryKey, Array<{ item: ShoppingItem; originalIndex: number }>>();

      const items = Array.isArray(t.items) ? t.items : [];
      items.forEach((it, idx) => {
        const ck = (it.category_key as CategoryKey) ?? inferCategoryKey(it.name);
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

  function updateActualCost(tripIdx: number, value: string) {
    setDirty(true);
    const v = value.trim();
    const num = v === "" ? null : Number(v);

    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);

      next.shopping = Array.isArray(next.shopping) ? next.shopping : [];
      if (!next.shopping[tripIdx]) return prev;

      next.shopping[tripIdx].actual_cost_eur = v === "" ? null : Number.isFinite(num) ? num : null;
      return next;
    });
  }

  function updateShoppingItem(tripIdx: number, itemIdx: number, patch: Partial<ShoppingItem>) {
    setDirty(true);
    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);

      next.shopping = Array.isArray(next.shopping) ? next.shopping : [];
      if (!next.shopping[tripIdx]) return prev;

      next.shopping[tripIdx].items = Array.isArray(next.shopping[tripIdx].items) ? next.shopping[tripIdx].items : [];
      if (!next.shopping[tripIdx].items[itemIdx]) return prev;

      next.shopping[tripIdx].items[itemIdx] = { ...next.shopping[tripIdx].items[itemIdx], ...patch };

      next.meta = next.meta ?? {};
      next.meta.shopping_edited_trips = next.meta.shopping_edited_trips ?? {};
      const tripNo = next.shopping[tripIdx].trip;
      next.meta.shopping_edited_trips[String(tripNo)] = true;

      return next;
    });
  }

  function removeShoppingItem(tripIdx: number, itemIdx: number) {
    setDirty(true);
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

  const [addCat, setAddCat] = useState<Record<number, CategoryKey>>({});
  const [addName, setAddName] = useState<Record<number, string>>({});
  const [addQty, setAddQty] = useState<Record<number, string>>({});

  function addShoppingItem(tripIdx: number) {
    const cat = addCat[tripIdx] ?? "other";
    const name = (addName[tripIdx] ?? "").trim();
    const qty = (addQty[tripIdx] ?? "").trim();

    if (!name) return;

    setDirty(true);
    setPlan((prev) => {
      if (!prev) return prev;
      const next = deepClone(prev);

      next.shopping = Array.isArray(next.shopping) ? next.shopping : [];
      if (!next.shopping[tripIdx]) return prev;

      next.shopping[tripIdx].items = Array.isArray(next.shopping[tripIdx].items) ? next.shopping[tripIdx].items : [];
      next.shopping[tripIdx].items.push({ name, quantity: qty || "—", category_key: cat });

      next.meta = next.meta ?? {};
      next.meta.shopping_edited_trips = next.meta.shopping_edited_trips ?? {};
      const tripNo = next.shopping[tripIdx].trip;
      next.meta.shopping_edited_trips[String(tripNo)] = true;

      return next;
    });

    setAddName((p) => ({ ...p, [tripIdx]: "" }));
    setAddQty((p) => ({ ...p, [tripIdx]: "" }));
  }

  /** ---- SAVE ---- */
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
        .update({ plan, is_edited: true, edited_at: nowIso } as any)
        .eq("user_id", user.id)
        .eq("week_start", row.week_start);

      if (error) setMsg("Chyba pri ukladaní: " + error.message);
      else {
        setMsg("✅ Uložené.");
        setDirty(false);
        setRow((prev) => (prev ? { ...prev, plan: deepClone(plan), is_edited: true, edited_at: nowIso } : prev));
      }
    } catch (e: any) {
      setMsg("Chyba pri ukladaní: " + (e?.message ?? "unknown"));
    } finally {
      setSaving(false);
    }
  }

  function exportTXT() {
    if (!shopping.length) return;
    downloadText(`fudly-nakup-${weekStart}.txt`, shoppingToTXT(weekStart, shopping));
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 sm:px-6 py-6 page-invert-bg overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl text-sm muted">Načítavam…</div>
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="min-h-screen px-4 sm:px-6 py-6 page-invert-bg overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl rounded-2xl p-6 surface-same-as-nav surface-border">
          <div className="text-lg font-semibold">Detail týždňa</div>
          <div className="mt-2 text-sm text-red-500">{msg || "Niečo sa pokazilo."}</div>
          <Link href="/profile" className="mt-4 inline-block btn-primary px-4 py-2 text-sm w-full sm:w-auto text-center">
            Späť do profilu
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-6 page-invert-bg overflow-x-hidden">
      <div className="mx-auto w-full max-w-6xl space-y-6 min-w-0 pb-24">
        {/* Header */}
        <div className="rounded-2xl p-6 surface-same-as-nav surface-border flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm muted-2">Detail týždňa</div>
            <div className="text-2xl font-bold">
              {formatDateSK(weekStart)} – {formatDateSK(weekEnd || "")}
            </div>
            <div className="mt-2 text-sm muted">Úpravy jedál + upraviteľné nákupy (kategórie) + reálne ceny.</div>

            {anyShoppingEdited ? (
              <div className="mt-3 text-xs muted-2">
                Pozn.: Aspoň jeden nákup bol upravený — odhadovaná cena nemusí zodpovedať aktuálnemu zoznamu.
              </div>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full sm:w-auto">
            <Link
              href={`/profile/${weekStart}/export`}
              className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition w-full sm:w-auto text-center"
            >
              Export (tlač)
            </Link>
            <button
              type="button"
              onClick={exportTXT}
              className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition w-full sm:w-auto"
            >
              Export TXT
            </button>

            {/* Späť s potvrdením pri neuložených zmenách */}
            <button
              type="button"
              onClick={() => {
                if (dirty && !confirm("Máš neuložené zmeny. Naozaj chceš odísť?")) return;
                window.location.href = "/profile";
              }}
              className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition w-full sm:w-auto text-center"
            >
              Späť
            </button>

            <button type="button" onClick={saveEdits} disabled={saving} className="btn-primary px-4 py-2 text-sm w-full sm:w-auto">
              {saving ? "Ukladám…" : "Uložiť"}
            </button>
          </div>
        </div>

        {/* Meals */}
        <section className="rounded-2xl p-6 surface-same-as-nav surface-border">
          <h2 className="text-xl font-semibold">Jedálniček</h2>
          <div className="mt-2 text-sm muted">Klikni do jedla a uprav text. Ak upravíš jedlo, recept preň nebude dostupný.</div>

          <div className="mt-5 space-y-4">
            {plan.days.map((d, dayIdx) => (
              <div key={d.day} className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {d.day_name ?? `Deň ${d.day}`}{" "}
                      {d.date ? <span className="text-xs muted-2">({formatDateSK(d.date)})</span> : null}
                    </div>
                    {caloriesEnabled ? (
                      <div className="mt-1 text-xs muted-2">
                        {typeof d.total_kcal === "number" ? (
                          <>
                            Spolu: <span className="font-semibold">{d.total_kcal}</span> kcal
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(["breakfast", "lunch", "dinner"] as const).map((meal) => {
                    const k = recipeKey(d.day, meal);
                    const edited = !!plan?.meta?.edited_meals?.[k];

                    const label = meal === "breakfast" ? "Raňajky" : meal === "lunch" ? "Obed" : "Večera";

                    return (
                      <div key={meal} className="rounded-2xl p-3 border border-gray-200 dark:border-gray-800 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{label}</div>
                          <button
                            type="button"
                            onClick={() => showRecipeFor(d.day, meal)}
                            className="text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 hover:bg-gray-100 dark:hover:bg-zinc-900 transition shrink-0"
                          >
                            {edited ? "Recept (nedost.)" : "Recept"}
                          </button>
                        </div>

                        <textarea
                          className="mt-2 input-surface h-20 sm:h-24 resize-none"
                          value={(d as any)[meal] ?? ""}
                          onChange={(e) => updateMealText(dayIdx, meal, e.target.value)}
                        />

                        {caloriesEnabled ? (
                          <div className="mt-2 text-xs muted-2">
                            {meal === "breakfast" && typeof d.breakfast_kcal === "number" ? (
                              <>
                                kcal: <span className="font-semibold">{d.breakfast_kcal}</span>
                              </>
                            ) : null}
                            {meal === "lunch" && typeof d.lunch_kcal === "number" ? (
                              <>
                                kcal: <span className="font-semibold">{d.lunch_kcal}</span>
                              </>
                            ) : null}
                            {meal === "dinner" && typeof d.dinner_kcal === "number" ? (
                              <>
                                kcal: <span className="font-semibold">{d.dinner_kcal}</span>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Poznámka – garantovane menšie písmo */}
                {typeof d.note === "string" ? (
                  <div className="mt-3">
                    <div className="text-xs muted-2 mb-1">Poznámka</div>
                    <input
                      className="input-surface !text-[11px] !leading-tight py-2"
                      value={d.note}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDirty(true);
                        setPlan((prev) => {
                          if (!prev) return prev;
                          const next = deepClone(prev);
                          next.days[dayIdx].note = v;
                          return next;
                        });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Shopping – ešte kompaktnejšie */}
        <section className="rounded-2xl p-4 sm:p-6 surface-same-as-nav surface-border">
          <h2 className="text-base font-semibold">Nákupy</h2>
          <div className="mt-1 text-xs muted">
            Položky môžeš upravovať, pridávať aj mazať. Keď upravíš nákup, označí sa ako „upravený“.
          </div>

          <div className="mt-4 space-y-4">
            {shoppingByTrip.map((t, tripIdx) => (
              <div key={t.trip} className="rounded-2xl p-2.5 page-invert-bg border border-gray-200 dark:border-gray-800 min-w-0">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      Nákup {t.trip}
                      {isTripEdited(t.trip) ? (
                        <span className="text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 px-2 py-0.5">
                          upravený
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs muted-2">Dni: {t.covers_days}</div>
                    <div className="mt-1 text-xs muted-2">
                      Odhad: <span className="font-semibold">{t.estimated_cost_eur ?? "—"}</span> €
                      {isTripEdited(t.trip) ? <span className="ml-2">• odhad nemusí sedieť</span> : null}
                    </div>
                  </div>

                  <div className="w-full lg:w-[260px] min-w-0">
                    <div className="text-xs muted mb-1">Reálna cena (€)</div>
                    <input
                      className="input-surface !text-xs !leading-tight py-2"
                      value={t.actual_cost_eur ?? ""}
                      onChange={(e) => updateActualCost(tripIdx, e.target.value)}
                      placeholder="napr. 32.50"
                    />
                  </div>
                </div>

                {/* categories */}
                <div className="mt-3 space-y-2">
                  {t.categories.map((c) => (
                    <div key={c.key} className="rounded-2xl border border-gray-200 dark:border-gray-800 p-2.5 min-w-0">
                      <div className="text-sm font-semibold">{CATEGORY_LABEL[c.key]}</div>

                      <div className="mt-2 space-y-2">
                        {c.items.map(({ item, originalIndex }) => (
                          <div key={originalIndex} className="grid grid-cols-1 md:grid-cols-[1fr_180px_110px] gap-2 items-start min-w-0">
                            <input
                              className="input-surface !text-xs !leading-tight py-2 min-w-0"
                              value={item.name}
                              onChange={(e) => updateShoppingItem(tripIdx, originalIndex, { name: e.target.value })}
                            />
                            <input
                              className="input-surface !text-xs !leading-tight py-2 min-w-0"
                              value={item.quantity}
                              onChange={(e) => updateShoppingItem(tripIdx, originalIndex, { quantity: e.target.value })}
                            />
                            <button
                              type="button"
                              onClick={() => removeShoppingItem(tripIdx, originalIndex)}
                              className="rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition w-full md:w-auto"
                            >
                              Odstrániť
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* add new */}
                <div className="mt-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-2.5 min-w-0">
                  <div className="text-sm font-semibold">Pridať položku</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-[180px_1fr_180px_140px] gap-2 min-w-0">
                    <select
                      className="input-surface !text-xs !leading-tight py-2 min-w-0"
                      value={addCat[tripIdx] ?? "other"}
                      onChange={(e) => setAddCat((p) => ({ ...p, [tripIdx]: e.target.value as CategoryKey }))}
                    >
                      {CATEGORY_ORDER.map((k) => (
                        <option key={k} value={k}>
                          {CATEGORY_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input-surface !text-xs !leading-tight py-2 min-w-0"
                      value={addName[tripIdx] ?? ""}
                      onChange={(e) => setAddName((p) => ({ ...p, [tripIdx]: e.target.value }))}
                      placeholder="Názov položky"
                    />
                    <input
                      className="input-surface !text-xs !leading-tight py-2 min-w-0"
                      value={addQty[tripIdx] ?? ""}
                      onChange={(e) => setAddQty((p) => ({ ...p, [tripIdx]: e.target.value }))}
                      placeholder="Množstvo"
                    />
                    <button type="button" onClick={() => addShoppingItem(tripIdx)} className="btn-primary w-full md:w-auto text-xs px-4 py-2">
                      Pridať
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {msg ? (
          <div className={`text-sm ${msg.startsWith("✅") ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {msg}
          </div>
        ) : null}
      </div>

      {/* Sticky save bar dole */}
      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-50">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-4">
            <div className="rounded-2xl surface-same-as-nav surface-border p-3 flex items-center justify-between gap-3">
              <div className="text-sm muted min-w-0">Máš neuložené zmeny.</div>
              <button type="button" onClick={saveEdits} disabled={saving} className="btn-primary px-4 py-2 text-sm shrink-0">
                {saving ? "Ukladám…" : "Uložiť"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Recipe modal */}
      {recipeOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRecipeOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl p-4 sm:p-6 surface-same-as-nav surface-border max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-bold">{recipeTitle}</div>
              </div>
              <button
                type="button"
                onClick={() => setRecipeOpen(false)}
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition shrink-0"
              >
                Zavrieť
              </button>
            </div>

            <div className="mt-4">{recipeBody}</div>
          </div>
        </div>
      ) : null}
    </main>
  );
}