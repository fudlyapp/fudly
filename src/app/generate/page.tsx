"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Recipe = {
  title: string;
  time_min: number;
  portions: number;
  ingredients: Array<{ name: string; quantity: string }>;
  steps: string[];
};

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
    day_name?: string;
    date?: string; // YYYY-MM-DD
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
  recipes?: Record<string, Recipe>;
};

type ApiResponse =
  | { kind: "json"; plan: PlanJSON }
  | { kind: "text"; text: string }
  | { error: any };

type ProfileRow = {
  user_id: string;
  full_name: string | null;

  people_default: number | null;
  weekly_budget_eur_default: number | null;
  shopping_trips_default: number | null;
  repeat_days_default: number | null;
  style_default: string | null;

  intolerances: string | null;
  avoid: string | null;
  have: string | null;
  favorites: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateSKFromISO(iso?: string) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  return `${dd}.${mm}.${y}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysISO(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  return toISODate(d);
}

function mondayOfWeekISO(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return toISODate(d);
}

function buildWeekOptions() {
  const today = new Date();
  const day = today.getDay();
  const thisMonday = mondayOfWeekISO(today);
  const nextMonday = addDaysISO(thisMonday, 7);

  // Podmienka podľa tvojho zadania:
  // - iba v pondelok (day=1) môžeš generovať aj "tento" týždeň
  // - inak iba budúci
  const allowThisWeek = day === 1;

  const options: Array<{
    value: string; // week_start (monday) ISO
    label: string; // DD.MM.YYYY – DD.MM.YYYY
    kind: "this" | "next";
  }> = [];

  if (allowThisWeek) {
    options.push({
      value: thisMonday,
      label: `${formatDateSKFromISO(thisMonday)} – ${formatDateSKFromISO(addDaysISO(thisMonday, 6))}`,
      kind: "this",
    });
  }

  options.push({
    value: nextMonday,
    label: `${formatDateSKFromISO(nextMonday)} – ${formatDateSKFromISO(addDaysISO(nextMonday, 6))}`,
    kind: "next",
  });

  return options;
}

type StyleOption = {
  value: string;
  label: string;
  emoji: string;
  desc: string;
};

const STYLE_OPTIONS: StyleOption[] = [
  { value: "lacné", label: "Lacné", emoji: "💰", desc: "čo najnižšia cena" },
  { value: "rychle", label: "Rýchle", emoji: "⚡", desc: "max 20–30 min" },
  { value: "vyvazene", label: "Vyvážené", emoji: "🥗", desc: "bielkoviny + zelenina" },
  { value: "vegetarianske", label: "Vegetariánske", emoji: "🌱", desc: "bez mäsa" },
  { value: "tradicne", label: "Tradičné", emoji: "🍲", desc: "domáca poctivá strava" },
  { value: "exoticke", label: "Exotické", emoji: "🍜", desc: "ázia / mexiko / fusion" },
  { value: "fit", label: "Fit", emoji: "🏋️", desc: "viac bielkovín, menej cukru" },
];

export default function GeneratorPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [weekOptions] = useState(() => buildWeekOptions());
  const [weekStart, setWeekStart] = useState<string>(weekOptions[0]?.value ?? "");

  const [people, setPeople] = useState("");
  const [budget, setBudget] = useState("");

  const [intolerances, setIntolerances] = useState("");
  const [avoid, setAvoid] = useState("");
  const [have, setHave] = useState("");
  const [favorites, setFavorites] = useState("");

  const [style, setStyle] = useState(STYLE_OPTIONS[0].value);
  const [shoppingTrips, setShoppingTrips] = useState("2");
  const [repeatDays, setRepeatDays] = useState("2");

  const [loading, setLoading] = useState(false);
  const [textResult, setTextResult] = useState<string>("");
  const [plan, setPlan] = useState<PlanJSON | null>(null);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");

  const [prefLoading, setPrefLoading] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");

  const [lastInput, setLastInput] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      const { data } = await supabase.auth.getSession();
      setUserEmail(data.session?.user?.email ?? null);
      setAuthLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
      setAuthLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const isValid = useMemo(() => {
    const p = Number(people);
    const b = Number(budget);
    return (
      !!weekStart &&
      Number.isFinite(p) &&
      p >= 1 &&
      p <= 6 && // max 6 podľa zadania
      Number.isFinite(b) &&
      b >= 1 && // 1–1000 podľa zadania
      b <= 1000
    );
  }, [people, budget, weekStart]);

  const weekLabel = useMemo(() => {
    const found = weekOptions.find((o) => o.value === weekStart);
    return found?.label ?? "";
  }, [weekStart, weekOptions]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setTextResult("");
    setPlan(null);
    setSaveMsg("");
    setPrefMsg("");

    const inputPayload = {
      weekStart,
      language: "sk",
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
    setPrefMsg("");

    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;

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
      const { error } = await supabase.from("meal_plans").upsert(
        {
          user_id: user.id,
          week_start: weekStart,
          input: lastInput,
          plan_generated: plan,
          plan: null,
          is_edited: false,
          edited_at: null,
        },
        { onConflict: "user_id,week_start" }
      );

      if (error) setSaveMsg("Chyba pri ukladaní: " + error.message);
      else setSaveMsg("✅ Uložené do profilu!");
    } catch (e: any) {
      setSaveMsg("Chyba pri ukladaní: " + (e?.message ?? "unknown"));
    } finally {
      setSaveLoading(false);
    }
  }

  async function loadSavedFromProfile() {
    setPrefMsg("");
    setSaveMsg("");
    setPrefLoading(true);

    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    if (!user) {
      setPrefLoading(false);
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id, full_name, people_default, weekly_budget_eur_default, shopping_trips_default, repeat_days_default, style_default, intolerances, avoid, have, favorites"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setPrefMsg("Chyba pri načítaní profilu: " + error.message);
      setPrefLoading(false);
      return;
    }

    const p = (data as ProfileRow) ?? null;
    if (!p) {
      setPrefMsg("Nemáš ešte uložené preferencie. Ulož ich tlačidlom „Uložiť ako predvolené“.");
      setPrefLoading(false);
      return;
    }

    if (p.people_default != null) setPeople(String(p.people_default));
    if (p.weekly_budget_eur_default != null) setBudget(String(p.weekly_budget_eur_default));
    if (p.shopping_trips_default != null) setShoppingTrips(String(p.shopping_trips_default));
    if (p.repeat_days_default != null) setRepeatDays(String(p.repeat_days_default));
    if (p.style_default) setStyle(p.style_default);

    setIntolerances(p.intolerances ?? "");
    setAvoid(p.avoid ?? "");
    setHave(p.have ?? "");
    setFavorites(p.favorites ?? "");

    setPrefMsg("✅ Načítané z profilu.");
    setPrefLoading(false);
  }

  async function saveDefaultsToProfile() {
    setPrefMsg("");
    setSaveMsg("");
    setPrefLoading(true);

    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    if (!user) {
      setPrefLoading(false);
      window.location.href = "/login";
      return;
    }

    const payload: ProfileRow = {
      user_id: user.id,
      full_name: null,

      people_default: people.trim() ? Number(people) : null,
      weekly_budget_eur_default: budget.trim() ? Number(budget) : null,
      shopping_trips_default: shoppingTrips.trim() ? Number(shoppingTrips) : null,
      repeat_days_default: repeatDays.trim() ? Number(repeatDays) : null,
      style_default: style.trim() || null,

      intolerances: intolerances.trim() || null,
      avoid: avoid.trim() || null,
      have: have.trim() || null,
      favorites: favorites.trim() || null,
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });

    if (error) {
      setPrefMsg("Chyba pri ukladaní profilu: " + error.message);
      setPrefLoading(false);
      return;
    }

    setPrefMsg("✅ Uložené ako predvolené do profilu.");
    setPrefLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Týždenný jedálniček + nákupy</h1>
            <p className="mt-2 text-gray-300">
              Vyplň raz, ulož do profilu, potom len klikneš „Načítať uložené“.
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
                <div className="flex justify-end gap-2">
                  <Link
                    href="/profile"
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Profil
                  </Link>
                  <button
                    onClick={logout}
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Odhlásiť sa
                  </button>
                </div>
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

        <form onSubmit={onSubmit} className="rounded-2xl border border-gray-800 bg-zinc-900 p-6 shadow-lg">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Týždeň (pondelok–nedeľa)">
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                {weekOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.kind === "this" ? "Tento" : "Budúci"}: {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Počet ľudí (1–6)">
              <input
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="2"
              />
            </Field>

            <Field label="Budget / týždeň (€) (1–1000)">
              <input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="80"
              />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Preferovaný štýl">
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.emoji} {s.label} — {s.desc}
                  </option>
                ))}
              </select>
            </Field>

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

            <Field label="Mám doma (použi)" hint="minimalizuj odpad">
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

          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-sm text-gray-400">
                {isValid
                  ? `✅ pripravené • týždeň: ${weekLabel}`
                  : "Skontroluj: týždeň, počet ľudí 1–6, budget 1–1000"}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={loadSavedFromProfile}
                  disabled={prefLoading}
                  className="rounded-xl border border-gray-700 bg-black px-5 py-3 font-semibold hover:bg-zinc-900 transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {prefLoading ? "Načítavam..." : "Načítať uložené"}
                </button>

                <button
                  type="button"
                  onClick={saveDefaultsToProfile}
                  disabled={prefLoading}
                  className="rounded-xl border border-gray-700 bg-black px-5 py-3 font-semibold hover:bg-zinc-900 transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {prefLoading ? "Ukladám..." : "Uložiť ako predvolené"}
                </button>

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

            {(prefMsg || saveMsg) ? (
              <div className="text-sm text-gray-200">
                {prefMsg ? <div>{prefMsg}</div> : null}
                {saveMsg ? <div>{saveMsg}</div> : null}
              </div>
            ) : null}
          </div>
        </form>

        {plan && (
          <div className="mt-8 rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="text-lg font-semibold">Hotovo ✅</div>
            <div className="mt-1 text-sm text-gray-300">
              Plán je vygenerovaný pre týždeň <span className="font-semibold">{weekLabel}</span>. Ulož si ho do profilu.
            </div>
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