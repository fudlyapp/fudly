"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type PlanJSON = {
  summary: {
    people: number;
    weekly_budget_eur: number;
    shopping_trips_per_week: number;
    repeat_days_max: number;
    estimated_total_cost_eur: number;
    savings_tips: string[];
  };
  days: Array<{
    day: number;
    breakfast: string;
    lunch: string;
    dinner: string;
    note: string;
  }>;
  shopping: Array<{
    trip: number;
    covers_days: string;
    items: Array<{ name: string; quantity: string }>;
  }>;
};

type ApiResponse =
  | { kind: "json"; plan: PlanJSON }
  | { kind: "text"; text: string }
  | { error: any };

export default function GeneratorPage() {
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [people, setPeople] = useState("");
  const [budget, setBudget] = useState("");

  const [intolerances, setIntolerances] = useState("");
  const [avoid, setAvoid] = useState("");
  const [have, setHave] = useState("");
  const [favorites, setFavorites] = useState("");

  const [style, setStyle] = useState("lacné");
  const [shoppingTrips, setShoppingTrips] = useState("2");
  const [repeatDays, setRepeatDays] = useState("2");

  const [loading, setLoading] = useState(false);
  const [textResult, setTextResult] = useState<string>("");
  const [plan, setPlan] = useState<PlanJSON | null>(null);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  // uložíme si posledné vstupy, aby sa presne toto uložilo do DB
  const [lastInput, setLastInput] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
      setAuthLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const isValid = useMemo(() => {
    const p = Number(people);
    const b = Number(budget);
    return Number.isFinite(p) && p >= 1 && p <= 12 && Number.isFinite(b) && b >= 10 && b <= 500;
  }, [people, budget]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setTextResult("");
    setPlan(null);
    setSaveMsg("");

    const inputPayload = {
      people,
      budget,
      intolerances,
      avoid,
      have,
      favorites,
      style,
      shoppingTrips,
      repeatDays,
    };

    setLastInput(inputPayload);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputPayload),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        setTextResult(`Chyba: ${JSON.stringify((data as any).error ?? data, null, 2)}`);
        return;
      }

      if ("kind" in data && data.kind === "json") {
        setPlan(data.plan);
      } else if ("kind" in data && data.kind === "text") {
        setTextResult(data.text);
      } else {
        setTextResult("Chyba: neočakávaná odpoveď zo servera.");
      }
    } catch (err: any) {
      setTextResult(`Chyba: ${err?.message ?? "neznáma chyba"}`);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function savePlan() {
    setSaveMsg("");

    const { data: u } = await supabase.auth.getUser();
    const user = u.user;

    if (!user) {
      setSaveMsg("Najprv sa prihlás (inak nemám kam uložiť plán).");
      window.location.href = "/login";
      return;
    }
    if (!plan || !lastInput) {
      setSaveMsg("Najprv vygeneruj jedálniček.");
      return;
    }

    setSaveLoading(true);
    try {
      const { error } = await supabase.from("meal_plans").insert({
        user_id: user.id,
        input: lastInput,
        plan: plan,
      });

      if (error) {
        setSaveMsg("Chyba pri ukladaní: " + error.message);
      } else {
        setSaveMsg("✅ Uložené do profilu!");
      }
    } catch (e: any) {
      setSaveMsg("Chyba pri ukladaní: " + (e?.message ?? "unknown"));
    } finally {
      setSaveLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Týždenný jedálniček + nákupy</h1>
            <p className="mt-2 text-gray-300">
              Šetri čas (batch cooking) a peniaze (menej nákupov, menej odpadu).
            </p>
          </div>

          <div className="text-right">
            {authLoading ? (
              <div className="text-sm text-gray-400">Kontrolujem prihlásenie…</div>
            ) : userEmail ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-300">
                  Prihlásený ako <span className="text-white font-semibold">{userEmail}</span>
                </div>
                <button
                  onClick={logout}
                  className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                >
                  Odhlásiť sa
                </button>
              </div>
            ) : (
              <button
                onClick={() => (window.location.href = "/login")}
                className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200"
              >
                Prihlásiť sa
              </button>
            )}
          </div>
        </header>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-gray-800 bg-zinc-900 p-6 shadow-lg"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Počet ľudí">
              <input
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="2"
              />
            </Field>

            <Field label="Budget / týždeň (€)">
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="80"
              />
            </Field>

            <Field label="Preferovaný štýl">
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                <option value="lacné">💰 Lacné</option>
                <option value="rychle">⚡ Rýchle</option>
                <option value="vyvazene">🥗 Vyvážené</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nákupy / týždeň">
              <select
                value={shoppingTrips}
                onChange={(e) => setShoppingTrips(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                <option value="1">1×</option>
                <option value="2">2×</option>
                <option value="3">3×</option>
                <option value="4">4×</option>
              </select>
            </Field>

            <Field label="Varenie na viac dní">
              <select
                value={repeatDays}
                onChange={(e) => setRepeatDays(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                <option value="1">1 deň (bez opakovania)</option>
                <option value="2">2 dni</option>
                <option value="3">3 dni</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Field label="❌ Intolerancie / NESMÚ byť použité" hint="tvrdý zákaz">
              <input
                value={intolerances}
                onChange={(e) => setIntolerances(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="laktóza, arašidy"
              />
            </Field>

            <Field label="Vyhnúť sa" hint="mäkká preferencia">
              <input
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="huby, brokolica"
              />
            </Field>

            <Field label="Mám doma (použi)" hint="minimizuj odpad">
              <input
                value={have}
                onChange={(e) => setHave(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="ryža, vajcia"
              />
            </Field>

            <Field label="Obľúbené" hint="nech je to chutné">
              <input
                value={favorites}
                onChange={(e) => setFavorites(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="cestoviny, kura"
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-sm text-gray-400">
              {isValid ? "✅ pripravené" : "Skontroluj: počet ľudí 1–12, budget 10–500"}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={savePlan}
                disabled={saveLoading || !plan}
                className="rounded-xl border border-gray-700 bg-black px-5 py-3 font-semibold hover:bg-zinc-900 transition disabled:cursor-not-allowed disabled:opacity-40"
                title={!plan ? "Najprv vygeneruj jedálniček" : "Uložiť do profilu"}
              >
                {saveLoading ? "Ukladám..." : "Uložiť do profilu"}
              </button>

              <button
                disabled={loading || !isValid}
                className="rounded-xl bg-white px-5 py-3 text-black font-semibold hover:bg-gray-200 transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Generujem..." : "Vygenerovať"}
              </button>
            </div>
          </div>

          {saveMsg ? (
            <div className="mt-4 text-sm text-gray-200">{saveMsg}</div>
          ) : null}
        </form>

        {/* Výstup */}
        {plan && (
          <div className="mt-8 grid grid-cols-1 gap-6">
            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Prehľad</h2>
              <div className="mt-3 grid gap-2 text-sm text-gray-200 md:grid-cols-3">
                <div className="rounded-xl bg-black p-3">
                  <div className="text-gray-400">Odhad ceny</div>
                  <div className="text-lg font-semibold">{plan.summary.estimated_total_cost_eur} €</div>
                </div>
                <div className="rounded-xl bg-black p-3">
                  <div className="text-gray-400">Nákupy / týždeň</div>
                  <div className="text-lg font-semibold">{plan.summary.shopping_trips_per_week}×</div>
                </div>
                <div className="rounded-xl bg-black p-3">
                  <div className="text-gray-400">Opakovanie jedál</div>
                  <div className="text-lg font-semibold">{plan.summary.repeat_days_max} dni</div>
                </div>
              </div>

              {plan.summary.savings_tips?.length ? (
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

            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Týždenný jedálniček</h2>

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
                    {plan.days.map((d) => (
                      <tr key={d.day} className="border-t border-gray-800">
                        <td className="px-3 py-2 font-semibold text-gray-200">Deň {d.day}</td>
                        <td className="px-3 py-2 text-gray-200">{d.breakfast}</td>
                        <td className="px-3 py-2 text-gray-200">{d.lunch}</td>
                        <td className="px-3 py-2 text-gray-200">{d.dinner}</td>
                        <td className="px-3 py-2 text-gray-400">{d.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Nákupy</h2>

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
            </section>
          </div>
        )}

        {!plan && textResult && (
          <section className="mt-8 rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold mb-3">Výstup (fallback)</h2>
            <pre className="overflow-auto rounded-xl bg-black p-4 text-sm text-green-400 whitespace-pre-wrap">
              {textResult}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-gray-300">{label}</span>
        {hint ? <span className="text-xs text-gray-500">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}
