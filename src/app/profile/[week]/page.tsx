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
    date?: string;
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

type MealKey = "breakfast" | "lunch" | "dinner";

function recipeKey(day: number, meal: MealKey) {
  return `d${day}_${meal}`;
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
    edited: boolean;
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
      setRow((data as any) ?? null);
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
    const genMealTitle =
      planGenerated?.days?.find((d) => d.day === day)?.[meal] ?? null;

    const edited = genMealTitle !== null && genMealTitle !== mealTitle;

    const key = recipeKey(day, meal);
    const recipe = planGenerated?.recipes?.[key] ?? null;

    setOpenRecipe({
      day,
      meal,
      title: mealTitle,
      recipe,
      edited,
    });
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
            <p className="mt-2 text-gray-300">
              Klikni na jedlo a otvorí sa recept.
            </p>
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
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            Nenašiel som žiadny plán pre tento týždeň.
          </div>
        )}

        {plan && (
          <div className="grid grid-cols-1 gap-6">
            {/* Summary */}
            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Prehľad</h2>

              <div className="mt-3 grid gap-2 text-sm text-gray-200 md:grid-cols-4">
                <Box label="Budget">
                  {plan.summary?.weekly_budget_eur ?? "—"} €
                </Box>
                <Box label="Odhad ceny">
                  {plan.summary?.estimated_total_cost_eur ?? "—"} €
                </Box>
                <Box label="Ľudí">
                  {plan.summary?.people ?? "—"}
                </Box>
                <Box label="Nákupy / týždeň">
                  {plan.summary?.shopping_trips_per_week ?? "—"}×
                </Box>
              </div>

              {plan.summary?.savings_tips?.length ? (
                <div className="mt-4">
                  <div className="text-sm text-gray-400">Tipy na úsporu</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-gray-200">
                    {plan.summary.savings_tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {/* Days */}
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
                            {dateLabel ? (
                              <span className="text-gray-400 font-normal"> ({dateLabel})</span>
                            ) : null}
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

            {/* Shopping */}
            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Nákupy</h2>

              {!plan.shopping?.length ? (
                <div className="mt-3 text-sm text-gray-400">Žiadny nákupný zoznam.</div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {plan.shopping.map((trip) => (
                    <div key={trip.trip} className="rounded-2xl border border-gray-800 bg-black p-4">
                      <div className="flex items-baseline justify-between">
                        <div className="text-lg font-semibold">Nákup {trip.trip}</div>
                        <div className="text-xs text-gray-400">dni {trip.covers_days}</div>
                      </div>

                      <ul className="mt-3 space-y-2 text-sm">
                        {trip.items.map((it, idx) => (
                          <li key={idx} className="flex items-start justify-between gap-3">
                            <span className="text-gray-200">{it.name}</span>
                            <span className="text-gray-400">{it.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Recipe modal */}
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
                {openRecipe.edited ? (
                  <div className="rounded-xl border border-gray-800 bg-black p-4 text-gray-200">
                    Jedlo bolo upravené, recept nie je dostupný.
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