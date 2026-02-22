"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type MealKey = "breakfast" | "lunch" | "dinner";

type Recipe = {
  title: string;
  time_min: number;
  portions: number;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: string[];
};

type PlanJSON = {
  summary?: {
    people?: number;
    weekly_budget_eur?: number;
    shopping_trips_per_week?: number;
    repeat_days_max?: number;
    estimated_total_cost_eur?: number;
    savings_tips?: string[];
  };
  days: Array<{
    day: number;
    day_name?: string;
    date?: string; // YYYY-MM-DD
    breakfast: string;
    lunch: string;
    dinner: string;
    note: string;
  }>;
  shopping?: Array<{
    trip: number;
    covers_days: string;
    items: Array<{ name: string; quantity: string }>;
  }>;
  recipes?: Record<string, Recipe>;
};

type MealPlanRow = {
  id: string;
  user_id: string;
  week_start: string;
  plan: PlanJSON | null;
  plan_generated: PlanJSON | null;
  is_edited: boolean | null;
};

function recipeKey(day: number, meal: MealKey) {
  return `d${day}_${meal}`;
}

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

/** -------------------- Kategórie + emoji -------------------- */
type Category = { name: string; emoji: string };

function categorizeItem(nameRaw: string): Category {
  const name = (nameRaw || "").toLowerCase();
  const hasAny = (arr: string[]) => arr.some((w) => name.includes(w));

  if (hasAny(["kurac", "hoväd", "bravč", "morča", "mleté", "mäso", "slan", "šunka", "saláma", "klob", "ryba", "tuniak", "losos"])) {
    return { name: "Mäso a ryby", emoji: "🥩" };
  }
  if (hasAny(["mliek", "smotan", "jogurt", "tvaroh", "syr", "maslo", "kefír"])) {
    return { name: "Mliečne", emoji: "🥛" };
  }
  if (hasAny(["vajc"])) return { name: "Vajcia", emoji: "🥚" };
  if (hasAny(["chlieb", "rož", "baget", "tortill", "pečiv", "žeml"])) return { name: "Pečivo", emoji: "🥖" };
  if (hasAny(["ryža", "cestovin", "špaget", "rezanc", "kuskus", "bulgur", "ovos", "vločky", "múka", "krupic", "quinoa"])) {
    return { name: "Prílohy a obilniny", emoji: "🍚" };
  }
  if (hasAny(["zemiak", "mrkv", "cibuľ", "cibula", "cesnak", "paprik", "paradajk", "uhork", "šalát", "brokolic", "cuketa", "baklaž", "špenát", "kapust", "kukuric"])) {
    return { name: "Zelenina", emoji: "🥦" };
  }
  if (hasAny(["jablk", "banán", "pomaranč", "citrón", "ovoc", "hrušk", "jahod", "hrozno"])) return { name: "Ovocie", emoji: "🍎" };
  if (hasAny(["olej", "masť", "ocot"])) return { name: "Oleje a dochucovadlá", emoji: "🫒" };
  if (hasAny(["soľ", "sol", "koren", "kari", "oregano", "bazalk", "majorán", "tymi", "chilli", "vývar", "vyvar", "bujón", "bujon", "horčic", "horcic", "kečup", "kecup", "majon", "sója", "soja"])) {
    return { name: "Koreniny a omáčky", emoji: "🧂" };
  }
  if (hasAny(["konzerv", "fazuľ", "fazul", "cícer", "cicer", "šošovic", "sosovic", "pretlak", "pasírovan", "pasirovan", "steril", "kysl"])) {
    return { name: "Trvanlivé", emoji: "🥫" };
  }
  if (hasAny(["čokol", "cokol", "kakao", "med", "džem", "dzem", "cukor"])) return { name: "Sladké", emoji: "🍯" };

  return { name: "Ostatné", emoji: "🧺" };
}

type GroupedCategory = {
  category: string;
  emoji: string;
  items: Array<{ name: string; quantity: string }>;
};

function groupItemsByCategory(items: Array<{ name: string; quantity: string }>): GroupedCategory[] {
  const groups: Record<string, { emoji: string; items: Array<{ name: string; quantity: string }> }> = {};

  for (const it of items) {
    const cat = categorizeItem(it.name);
    if (!groups[cat.name]) groups[cat.name] = { emoji: cat.emoji, items: [] };
    groups[cat.name].items.push(it);
  }

  const order = [
    "Zelenina",
    "Ovocie",
    "Mäso a ryby",
    "Mliečne",
    "Vajcia",
    "Pečivo",
    "Prílohy a obilniny",
    "Koreniny a omáčky",
    "Oleje a dochucovadlá",
    "Trvanlivé",
    "Sladké",
    "Ostatné",
  ];

  const result: GroupedCategory[] = Object.entries(groups)
    .map(([category, v]) => ({ category, emoji: v.emoji, items: v.items }))
    .sort((a, b) => {
      const ai = order.indexOf(a.category);
      const bi = order.indexOf(b.category);
      if (ai === -1 && bi === -1) return a.category.localeCompare(b.category, "sk");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

  return result;
}

/** -------------------- Spájanie duplicitných položiek -------------------- */
type ParsedQty =
  | { ok: true; normalizedValue: number; normalizedUnit: string }
  | { ok: false };

function normalizeItemName(name: string) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:()]/g, "");
}

function parseQuantity(qtyRaw: string): ParsedQty {
  const qty = (qtyRaw || "").trim().toLowerCase();
  if (!qty) return { ok: false };

  const m = qty.match(/^(\d+(?:[.,]\d+)?)\s*([a-záäčďéíľĺňóôŕšťúýž]+)$/i);
  if (!m) return { ok: false };

  const v = Number(m[1].replace(",", "."));
  const unitRaw = m[2].toLowerCase();
  if (!Number.isFinite(v)) return { ok: false };

  if (unitRaw === "kg") return { ok: true, normalizedValue: v * 1000, normalizedUnit: "g" };
  if (unitRaw === "g") return { ok: true, normalizedValue: v, normalizedUnit: "g" };

  if (unitRaw === "l") return { ok: true, normalizedValue: v * 1000, normalizedUnit: "ml" };
  if (unitRaw === "ml") return { ok: true, normalizedValue: v, normalizedUnit: "ml" };

  if (["ks", "kus", "kusy"].includes(unitRaw)) return { ok: true, normalizedValue: v, normalizedUnit: "ks" };
  if (["bal", "balík", "balik", "balenie"].includes(unitRaw)) return { ok: true, normalizedValue: v, normalizedUnit: "bal" };

  return { ok: true, normalizedValue: v, normalizedUnit: unitRaw };
}

function formatMergedQuantity(value: number, unit: string) {
  if (unit === "g" && value >= 1000) {
    const kg = value / 1000;
    const out = Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
    return `${out} kg`;
  }
  if (unit === "ml" && value >= 1000) {
    const l = value / 1000;
    const out = Number.isInteger(l) ? String(l) : l.toFixed(1);
    return `${out} l`;
  }

  const out = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${out} ${unit}`;
}

type MergeEntry = {
  displayName: string;
  quantitiesRaw: string[];
  parsed: { normalizedUnit: string; total: number } | null;
};

function mergeDuplicateItems(items: Array<{ name: string; quantity: string }>) {
  const map = new Map<string, MergeEntry>();

  for (const it of items) {
    const key = normalizeItemName(it.name);
    if (!key) continue;

    const parsed = parseQuantity(it.quantity);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        displayName: it.name.trim() || it.name,
        quantitiesRaw: [it.quantity],
        parsed: parsed.ok ? { normalizedUnit: parsed.normalizedUnit, total: parsed.normalizedValue } : null,
      });
      continue;
    }

    existing.quantitiesRaw.push(it.quantity);

    if (existing.parsed && parsed.ok && existing.parsed.normalizedUnit === parsed.normalizedUnit) {
      existing.parsed.total += parsed.normalizedValue;
    } else {
      existing.parsed = null;
    }
  }

  // ✅ DÔLEŽITÉ: nepoužívame iterator priamo, ale explicitne urobíme array
  const entries: MergeEntry[] = Array.from(map.values());

  const merged: Array<{ name: string; quantity: string }> = entries.map((e) => {
    if (e.parsed) {
      return {
        name: e.displayName,
        quantity: formatMergedQuantity(e.parsed.total, e.parsed.normalizedUnit),
      };
    }
    const uniq = Array.from(new Set(e.quantitiesRaw.map((x) => (x || "").trim()).filter(Boolean)));
    return { name: e.displayName, quantity: uniq.join(" + ") || "" };
  });

  merged.sort((a, b) => a.name.localeCompare(b.name, "sk"));
  return merged;
}

/** -------------------- UI komponenty -------------------- */
function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-black p-3">
      <div className="text-gray-400">{label}</div>
      <div className="text-lg font-semibold">{children}</div>
    </div>
  );
}

function MealButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-left underline decoration-gray-700 underline-offset-4 hover:decoration-gray-300 transition"
    >
      {children}
    </button>
  );
}

function RecipeView({ recipe }: { recipe: Recipe }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-gray-800 bg-black p-3">
          <div className="text-gray-400">Čas</div>
          <div className="text-gray-200 font-semibold">{recipe.time_min} min</div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-black p-3">
          <div className="text-gray-400">Porcie</div>
          <div className="text-gray-200 font-semibold">{recipe.portions}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-black p-4">
        <div className="text-sm text-gray-400">Ingrediencie</div>
        <ul className="mt-2 space-y-2 text-sm">
          {recipe.ingredients.map((it, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-gray-200">{it.name}</span>
              <span className="text-gray-400">{it.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-black p-4">
        <div className="text-sm text-gray-400">Postup</div>
        <ol className="mt-2 list-decimal pl-5 space-y-2 text-sm text-gray-200">
          {recipe.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function ProfileWeekPage() {
  const params = useParams<{ week: string }>();
  const week = params.week;

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [row, setRow] = useState<MealPlanRow | null>(null);
  const [error, setError] = useState<string>("");

  const [openRecipe, setOpenRecipe] = useState<{
    day: number;
    meal: MealKey;
    title: string;
    recipe?: Recipe | null;
    reason?: "edited" | "missing" | "error";
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
    })();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        setRow(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, user_id, week_start, plan, plan_generated, is_edited")
        .eq("user_id", user.id)
        .eq("week_start", week)
        .maybeSingle();

      if (error) setError(error.message);
      setRow((data as MealPlanRow) ?? null);
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
  const plan = row?.plan ?? row?.plan_generated ?? null;
  const planGenerated = row?.plan_generated ?? null;

  function openMealRecipe(day: number, meal: MealKey, mealTitle: string) {
    try {
      const genMealTitle = planGenerated?.days?.find((d) => d.day === day)?.[meal] ?? null;
      const edited = genMealTitle !== null && genMealTitle !== mealTitle;

      if (edited) {
        setOpenRecipe({ day, meal, title: mealTitle, recipe: null, reason: "edited" });
        return;
      }

      const key = recipeKey(day, meal);
      const recipe = planGenerated?.recipes?.[key] ?? null;

      if (!recipe) {
        setOpenRecipe({ day, meal, title: mealTitle, recipe: null, reason: "missing" });
        return;
      }

      setOpenRecipe({ day, meal, title: mealTitle, recipe, reason: undefined });
    } catch {
      setOpenRecipe({ day, meal, title: mealTitle, recipe: null, reason: "error" });
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">
              Týždeň {formatDateSK(week)} – {formatDateSK(weekEnd)}
            </h1>
            <p className="mt-2 text-gray-300">Klikni na jedlo a otvorí sa recept. Nákupy sú zoradené podľa kategórií.</p>
          </div>

          <div className="text-right">
            {email ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-300">
                  Prihlásený ako <span className="text-white font-semibold">{email}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Link
                    href="/profile"
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Späť
                  </Link>
                  <Link
                    href={`/profile/${week}/edit`}
                    className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200"
                  >
                    Upraviť jedlá
                  </Link>
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

        {loading ? <div className="text-sm text-gray-400">Načítavam…</div> : null}
        {error ? <div className="text-sm text-red-300">Chyba: {error}</div> : null}

        {!loading && !error && !plan && (
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">Nenašiel som žiadny plán pre tento týždeň.</div>
        )}

        {plan && (
          <div className="grid grid-cols-1 gap-6">
            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Prehľad</h2>
              <div className="mt-3 grid gap-2 text-sm text-gray-200 md:grid-cols-4">
                <Box label="Budget">{plan.summary?.weekly_budget_eur ?? "—"} €</Box>
                <Box label="Odhad ceny">{plan.summary?.estimated_total_cost_eur ?? "—"} €</Box>
                <Box label="Ľudí">{plan.summary?.people ?? "—"}</Box>
                <Box label="Nákupy / týždeň">{plan.summary?.shopping_trips_per_week ?? "—"}×</Box>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Jedálniček</h2>

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
                    {plan.days.map((d) => {
                      const dayLabel = d.day_name ? d.day_name : `Deň ${d.day}`;
                      const dateLabel = d.date ? formatDateSK(d.date) : "";

                      return (
                        <tr key={d.day} className="border-t border-gray-800 align-top">
                          <td className="px-3 py-2 font-semibold text-gray-200 whitespace-nowrap">
                            {dayLabel}
                            {dateLabel ? <span className="text-gray-400 font-normal"> ({dateLabel})</span> : null}
                          </td>

                          <td className="px-3 py-2 text-gray-200">
                            <MealButton onClick={() => openMealRecipe(d.day, "breakfast", d.breakfast)}>
                              {d.breakfast}
                            </MealButton>
                          </td>

                          <td className="px-3 py-2 text-gray-200">
                            <MealButton onClick={() => openMealRecipe(d.day, "lunch", d.lunch)}>
                              {d.lunch}
                            </MealButton>
                          </td>

                          <td className="px-3 py-2 text-gray-200">
                            <MealButton onClick={() => openMealRecipe(d.day, "dinner", d.dinner)}>
                              {d.dinner}
                            </MealButton>
                          </td>

                          <td className="px-3 py-2 text-gray-400">{d.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Nákupy podľa kategórií</h2>

              {!plan.shopping?.length ? (
                <div className="mt-3 text-sm text-gray-400">Žiadny nákupný zoznam.</div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {plan.shopping.map((trip) => {
                    const mergedItems = mergeDuplicateItems(trip.items);
                    const grouped = groupItemsByCategory(mergedItems);

                    return (
                      <div key={trip.trip} className="rounded-2xl border border-gray-800 bg-black p-4">
                        <div className="flex items-baseline justify-between">
                          <div className="text-lg font-semibold">Nákup {trip.trip}</div>
                          <div className="text-xs text-gray-400">dni {trip.covers_days}</div>
                        </div>

                        <div className="mt-4 space-y-4">
                          {grouped.map((g: GroupedCategory) => (
                            <div key={g.category} className="rounded-xl border border-gray-800 bg-zinc-950 p-3">
                              <div className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                                <span className="text-lg">{g.emoji}</span>
                                <span>{g.category}</span>
                              </div>

                              <ul className="mt-2 space-y-2 text-sm">
                                {g.items.map((it: { name: string; quantity: string }, idx: number) => (
                                  <li
                                    key={idx}
                                    className="rounded-lg border border-gray-900 bg-black px-3 py-2 flex items-start justify-between gap-3"
                                  >
                                    <span className="text-gray-200 flex items-center gap-2">
                                      <span className="opacity-90">{g.emoji}</span>
                                      <span>{it.name}</span>
                                    </span>
                                    <span className="text-gray-400">{it.quantity}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 text-xs text-gray-400">
                          Duplicitné položky sa zlučujú. Ak sa množstvá nedajú bezpečne spočítať, zobrazí sa “+”.
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {openRecipe ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-zinc-950 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-gray-400">
                    Recept • deň {openRecipe.day} • {openRecipe.meal}
                  </div>
                  <div className="mt-1 text-xl font-semibold">{openRecipe.title}</div>
                </div>
                <button
                  onClick={() => setOpenRecipe(null)}
                  className="rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm hover:bg-zinc-900"
                >
                  Zavrieť
                </button>
              </div>

              <div className="mt-4">
                {openRecipe.reason === "edited" ? (
                  <div className="rounded-xl border border-gray-800 bg-black p-4 text-gray-200">
                    Jedlo bolo upravené, recept nie je dostupný.
                  </div>
                ) : openRecipe.reason === "missing" ? (
                  <div className="rounded-xl border border-gray-800 bg-black p-4 text-gray-200">
                    Tento plán nemá uložené recepty.
                    <div className="mt-3 text-sm text-gray-400">
                      Riešenie: v Generátore znovu vygeneruj týždeň a daj “Uložiť do profilu”.
                    </div>
                    <div className="mt-4">
                      <Link
                        href="/generate"
                        className="inline-block rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200"
                      >
                        Ísť do Generátora
                      </Link>
                    </div>
                  </div>
                ) : openRecipe.reason === "error" ? (
                  <div className="rounded-xl border border-gray-800 bg-black p-4 text-gray-200">
                    Recept sa nepodarilo načítať.
                  </div>
                ) : !openRecipe.recipe ? (
                  <div className="rounded-xl border border-gray-800 bg-black p-4 text-gray-200">
                    Recept sa nepodarilo načítať.
                  </div>
                ) : (
                  <RecipeView recipe={openRecipe.recipe} />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}