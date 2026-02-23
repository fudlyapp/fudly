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

type PlanDay = {
  day: number;
  day_name?: string;
  date?: string; // YYYY-MM-DD
  breakfast: string;
  lunch: string;
  dinner: string;
  note: string;

  breakfast_kcal?: number;
  lunch_kcal?: number;
  dinner_kcal?: number;
  total_kcal?: number;
};

type PlanJSON = {
  summary: any;
  days: PlanDay[];
  shopping: Array<{
    trip: number;
    covers_days: string;
    estimated_cost_eur?: number;
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

  language: string | null;

  people_default: number | null;
  weekly_budget_eur_default: number | null;
  shopping_trips_default: number | null;
  repeat_days_default: number | null;
  style_default: string | null;

  intolerances: string | null;
  avoid: string | null;
  have: string | null;
  favorites: string | null;

  // (do budúcna) tier / membership (ak to dáš do profiles)
  // membership_tier?: string | null;
};

type MealPlanRowLite = {
  id: string;
  week_start: string;
  generation_count: number | null;
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

function mondayOfWeekISO(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return toISODate(d);
}

function formatDateSKFromISO(iso?: string) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  return `${dd}.${mm}.${y}`;
}

function buildWeekOptions() {
  const today = new Date();
  const day = today.getDay();
  const thisMonday = mondayOfWeekISO(today);
  const nextMonday = addDaysISO(thisMonday, 7);

  // iba v pondelok môžeš generovať aj tento týždeň
  const allowThisWeek = day === 1;

  const options: Array<{
    value: string; // monday ISO
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
  plusOnly?: boolean;
};

const STYLE_OPTIONS: StyleOption[] = [
  { value: "lacné", label: "Lacné", emoji: "💰", desc: "čo najnižšia cena" },
  { value: "rychle", label: "Rýchle", emoji: "⚡", desc: "max 20–30 min" },
  { value: "vyvazene", label: "Vyvážené", emoji: "🥗", desc: "bielkoviny + zelenina" },
  { value: "vegetarianske", label: "Vegetariánske", emoji: "🌱", desc: "bez mäsa" },

  // PLUS-only podľa tvojho zadania
  { value: "tradicne", label: "Tradičné", emoji: "🍲", desc: "domáca poctivá strava", plusOnly: true },
  { value: "exoticke", label: "Exotické", emoji: "🍜", desc: "ázia / mexiko / fusion", plusOnly: true },
  { value: "fit", label: "Fit", emoji: "🏋️", desc: "viac bielkovín, menej cukru", plusOnly: true },
];

function normalizeRecipeKey(key: string) {
  const k = (key || "").trim();
  if (!k) return k;
  const m1 = k.match(/^d(\d)(breakfast|lunch|dinner)$/i);
  if (m1) return `d${m1[1]}_${m1[2].toLowerCase()}`;
  const m2 = k.match(/^d(\d)[\-_](breakfast|lunch|dinner)$/i);
  if (m2) return `d${m2[1]}_${m2[2].toLowerCase()}`;
  return k;
}

function normalizePlan(plan: PlanJSON): PlanJSON {
  if (!plan) return plan;
  const next: PlanJSON = JSON.parse(JSON.stringify(plan));

  if (next.recipes && typeof next.recipes === "object") {
    const fixed: Record<string, Recipe> = {};
    for (const [k, v] of Object.entries(next.recipes)) {
      fixed[normalizeRecipeKey(k)] = v as Recipe;
    }
    next.recipes = fixed;
  }

  if (Array.isArray(next.days)) next.days = next.days.slice(0, 7);

  return next;
}

function expectedRecipeKeys() {
  const keys: string[] = [];
  for (let d = 1; d <= 7; d++) keys.push(`d${d}_breakfast`, `d${d}_lunch`, `d${d}_dinner`);
  return keys;
}

function hasAllRecipes(plan: PlanJSON | null) {
  if (!plan?.recipes) return false;
  const have = new Set(Object.keys(plan.recipes).map(normalizeRecipeKey));
  return expectedRecipeKeys().every((k) => have.has(k));
}

function getActiveTier() {
  // ZATIAĽ jednoduchý stub:
  // - teraz sme ešte nenapojili Stripe/členstvá, tak beriem "basic"
  // Keď spravíme membership, toto budeme čítať z DB (profiles alebo subscriptions tabuľky).
  return "basic" as "basic" | "plus";
}

function GENERATION_LIMIT_FOR_TIER(tier: "basic" | "plus") {
  return tier === "plus" ? 5 : 3;
}

export default function GeneratorPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const tier = getActiveTier();
  const generationLimit = GENERATION_LIMIT_FOR_TIER(tier);

  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  const [language, setLanguage] = useState<"sk" | "en" | "uk">("sk");

  const [loading, setLoading] = useState(false);
  const [textResult, setTextResult] = useState("");
  const [plan, setPlan] = useState<PlanJSON | null>(null);

  const [prefLoading, setPrefLoading] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");

  // existujúci plán na týždeň (kvôli limitu + modal)
  const [existingRow, setExistingRow] = useState<MealPlanRowLite | null>(null);
  const [existingLoading, setExistingLoading] = useState(false);

  // modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [pendingAction, setPendingAction] = useState<null | { kind: "overwrite" | "keep" }>(null);

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

  const weekLabel = useMemo(() => {
    const found = weekOptions.find((o) => o.value === weekStart);
    return found?.label ?? "";
  }, [weekStart, weekOptions]);

  const isValid = useMemo(() => {
    const p = Number(people);
    const b = Number(budget);
    return (
      !!weekStart &&
      Number.isFinite(p) &&
      p >= 1 &&
      p <= 6 &&
      Number.isFinite(b) &&
      b >= 1 &&
      b <= 1000
    );
  }, [people, budget, weekStart]);

  // načítaj existujúci plán + generation_count vždy keď zmeníš týždeň (a si prihlásený)
  useEffect(() => {
    (async () => {
      setExistingRow(null);
      if (!userEmail) return;

      setExistingLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (!user) return;

        const { data, error } = await supabase
          .from("meal_plans")
          .select("id, week_start, generation_count, plan, plan_generated")
          .eq("user_id", user.id)
          .eq("week_start", weekStart)
          .maybeSingle();

        if (error) {
          // ticho, len nech to neblokuje
          setExistingRow(null);
        } else {
          setExistingRow((data as any) ?? null);
        }
      } finally {
        setExistingLoading(false);
      }
    })();
  }, [supabase, userEmail, weekStart]);

  const usedGenerations = useMemo(() => {
    const n = existingRow?.generation_count ?? 0;
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  }, [existingRow]);

  const remainingGenerations = useMemo(() => {
    return Math.max(0, generationLimit - usedGenerations);
  }, [generationLimit, usedGenerations]);

  // načítaj defaulty z profilu
  async function loadSavedFromProfile() {
    setPrefMsg("");
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
        "user_id, full_name, language, people_default, weekly_budget_eur_default, shopping_trips_default, repeat_days_default, style_default, intolerances, avoid, have, favorites"
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
      setPrefMsg("Nemáš ešte uložené predvolené. Ulož ich tlačidlom „Uložiť ako predvolené“.");
      setPrefLoading(false);
      return;
    }

    if (p.people_default != null) setPeople(String(p.people_default));
    if (p.weekly_budget_eur_default != null) setBudget(String(p.weekly_budget_eur_default));
    if (p.shopping_trips_default != null) setShoppingTrips(String(p.shopping_trips_default));
    if (p.repeat_days_default != null) setRepeatDays(String(p.repeat_days_default));

    if (p.language === "en" || p.language === "uk" || p.language === "sk") {
      setLanguage(p.language);
    }

    if (p.style_default) {
      const allowed = new Set(STYLE_OPTIONS.map((x) => x.value));
      const incoming = p.style_default.trim();
      if (allowed.has(incoming)) setStyle(incoming);
    }

    setIntolerances(p.intolerances ?? "");
    setAvoid(p.avoid ?? "");
    setHave(p.have ?? "");
    setFavorites(p.favorites ?? "");

    setPrefMsg("✅ Načítané z profilu.");
    setPrefLoading(false);
  }

  async function saveDefaultsToProfile() {
    setPrefMsg("");
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

      language,

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

    const { error } = await supabase.from("profiles").upsert(payload as any, { onConflict: "user_id" });

    if (error) {
      setPrefMsg("Chyba pri ukladaní profilu: " + error.message);
      setPrefLoading(false);
      return;
    }

    setPrefMsg("✅ Uložené ako predvolené do profilu.");
    setPrefLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function openOverwriteModal() {
    setConfirmMsg(
      `Pre týždeň ${weekLabel} už máš uložený jedálniček.\n\nChceš ho prepísať novým generovaním?`
    );
    setConfirmOpen(true);
  }

  async function keepExistingPlan() {
    // len načítame existujúci plán do preview
    const p = (existingRow?.plan ?? existingRow?.plan_generated) as PlanJSON | null;
    if (p) {
      setPlan(normalizePlan(p));
      setTextResult("");
    } else {
      setPlan(null);
      setTextResult("Tento týždeň má uložený záznam, ale plán je prázdny.");
    }
  }

  async function generateAndAutoSave({ overwrite }: { overwrite: boolean }) {
    setLoading(true);
    setTextResult("");
    setPlan(null);
    setPrefMsg("");

    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    if (!user) {
      setLoading(false);
      window.location.href = "/login";
      return;
    }

    // limit (ak už je limit vyčerpaný, nepustíme)
    const currentCount = existingRow?.generation_count ?? 0;
    if (currentCount >= generationLimit) {
      setLoading(false);
      setTextResult(
        `Dosiahol si limit generovaní pre tento týždeň (${generationLimit}). Ak chceš viac, bude to v Plus členstve.`
      );
      return;
    }

    // PLUS-only štýly
    const styleMeta = STYLE_OPTIONS.find((x) => x.value === style);
    if (styleMeta?.plusOnly && tier !== "plus") {
      setLoading(false);
      setTextResult(
        `Štýl „${styleMeta.label}“ je dostupný iba v Plus členstve. Vyber iný štýl alebo upgrade.`
      );
      return;
    }

    const inputPayload = {
      weekStart,
      language,
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
        const normalized = normalizePlan(data.plan);

        // bezpečnostná poistka: recepty musia byť komplet
        if (!hasAllRecipes(normalized)) {
          setTextResult(
            "Chyba: vygenerovaný plán nemá recept pre každé jedlo. Skús znova (API má teraz validáciu, takže by sa to už nemalo stávať)."
          );
          return;
        }

        // AUTO-SAVE do Supabase (plan aj plan_generated rovnaké)
        const weekEnd = addDaysISO(weekStart, 6);
        const nextCount = overwrite ? currentCount + 1 : currentCount + 1; // aj prvé uloženie je +1

        const nowIso = new Date().toISOString();

        const { error } = await supabase.from("meal_plans").upsert(
          {
            user_id: user.id,
            week_start: weekStart,
            week_end: weekEnd,
            input: inputPayload,
            plan_generated: normalized,
            plan: normalized,
            is_edited: false,
            edited_at: null,
            generation_count: nextCount,
            last_generated_at: nowIso,
          } as any,
          { onConflict: "user_id,week_start" }
        );

        if (error) {
          setTextResult("Plán sa síce vygeneroval, ale nepodarilo sa ho uložiť: " + error.message);
          setPlan(normalized);
          return;
        }

        // refresh existingRow + remaining counter
        setExistingRow((prev) => {
          const base = prev ?? ({} as any);
          return {
            id: base.id ?? "unknown",
            week_start: weekStart,
            generation_count: nextCount,
            plan: normalized,
            plan_generated: normalized,
          };
        });

        setPlan(normalized);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    // ak existuje plán na týždeň, spýtaj sa
    if (existingRow) {
      openOverwriteModal();
      return;
    }

    // inak generuj a ulož
    await generateAndAutoSave({ overwrite: false });
  }

  const canGenerate = useMemo(() => {
    if (!isValid) return false;
    if (!userEmail) return true; // button bude viesť na login
    if (existingLoading) return false;
    if (remainingGenerations <= 0) return false;
    return true;
  }, [isValid, userEmail, existingLoading, remainingGenerations]);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Týždenný jedálniček + nákupy</h1>
            <div className="mt-2 text-xs text-gray-500">
              Plánovanie môže trvať 2–3 minúty (jedálniček + nákupy + recepty). Počas generovania stránku nerefrešuj.
            </div>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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

            <Field label="Jazyk">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                <option value="sk">Slovenčina</option>
                <option value="en">English</option>
                <option value="uk">Українська</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Preferovaný štýl">
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                {STYLE_OPTIONS.map((s) => {
                  const disabled = !!s.plusOnly && tier !== "plus";
                  return (
                    <option key={s.value} value={s.value} disabled={disabled}>
                      {s.emoji} {s.label} — {s.desc}
                      {s.plusOnly ? " (PLUS)" : ""}
                    </option>
                  );
                })}
              </select>
              {tier !== "plus" ? (
                <div className="mt-1 text-xs text-gray-500">Fit / Tradičné / Exotické budú v Plus členstve.</div>
              ) : null}
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
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-gray-400">
                {isValid ? (
                  <>
                    ✅ pripravené • týždeň: {weekLabel}
                    {userEmail ? (
                      <>
                        {" • "}
                        generovaní:{" "}
                        <span className="text-white font-semibold">
                          {usedGenerations}/{generationLimit}
                        </span>{" "}
                        (zostáva{" "}
                        <span className="text-white font-semibold">{remainingGenerations}</span>)
                      </>
                    ) : null}
                  </>
                ) : (
                  "Skontroluj: týždeň, počet ľudí 1–6, budget 1–1000"
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* malé chips tlačidlá */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={loadSavedFromProfile}
                    disabled={prefLoading}
                    className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900 transition disabled:opacity-40"
                  >
                    {prefLoading ? "Načítavam..." : "Načítať uložené"}
                  </button>

                  <button
                    type="button"
                    onClick={saveDefaultsToProfile}
                    disabled={prefLoading}
                    className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900 transition disabled:opacity-40"
                  >
                    {prefLoading ? "Ukladám..." : "Uložiť ako predvolené"}
                  </button>

                  <div className="text-xs text-gray-500 md:ml-2">
                    Vyplň raz, ulož do profilu, potom len klikneš „Načítať uložené“.
                  </div>
                </div>

                {/* hlavné CTA */}
                {userEmail ? (
                  <button
                    disabled={loading || !canGenerate}
                    className="rounded-xl bg-white px-6 py-3 text-black font-semibold hover:bg-gray-200 transition disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      remainingGenerations <= 0
                        ? `Limit pre týždeň: ${generationLimit} generovaní`
                        : "Vygenerovať a automaticky uložiť"
                    }
                  >
                    {loading ? "Generujem..." : "Vygenerovať"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => (window.location.href = "/login")}
                    className="rounded-xl bg-white px-6 py-3 text-black font-semibold hover:bg-gray-200 transition"
                  >
                    Prihlásiť sa a generovať
                  </button>
                )}
              </div>
            </div>

            {prefMsg ? <div className="text-sm text-gray-200">{prefMsg}</div> : null}
          </div>
        </form>

        {/* PREVIEW plánu */}
        {plan && (
          <section className="mt-8 rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">Vygenerované ✅</div>
                <div className="mt-1 text-sm text-gray-300">
                  Týždeň <span className="font-semibold">{weekLabel}</span>
                </div>
              </div>

              <div className="text-sm text-gray-400">
                Odhad:{" "}
                <span className="text-white font-semibold">{plan.summary?.estimated_total_cost_eur ?? "—"} €</span>
                {" • "}
                Budget:{" "}
                <span className="text-white font-semibold">{plan.summary?.weekly_budget_eur ?? "—"} €</span>
              </div>
            </div>

            {/* KALÓRIE: v basic zatiaľ skryté, v plus zobrazíme */}
            {tier === "plus" ? (
              <div className="mt-4 rounded-xl border border-gray-800 bg-black p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-semibold">Kalórie</div>
                  <div className="text-xs text-gray-400">
                    domácnosť:{" "}
                    <span className="text-white font-semibold">{plan.summary?.avg_daily_kcal ?? "—"}</span> kcal/deň
                    {" • "}
                    týždeň:{" "}
                    <span className="text-white font-semibold">{plan.summary?.weekly_total_kcal ?? "—"}</span> kcal
                    {" • "}
                    na osobu:{" "}
                    <span className="text-white font-semibold">
                      {plan.summary?.avg_daily_kcal_per_person ?? "—"}
                    </span>{" "}
                    kcal/deň
                    {" • "}
                    týždeň na osobu:{" "}
                    <span className="text-white font-semibold">
                      {plan.summary?.weekly_total_kcal_per_person ?? "—"}
                    </span>{" "}
                    kcal
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-gray-800 bg-black p-4">
                <div className="text-sm text-gray-300">
                  Kalórie budú dostupné v Plus členstve.
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-gray-800 bg-black p-4">
                <div className="text-sm font-semibold mb-3">Jedálniček (7 dní)</div>
                <div className="grid grid-cols-1 gap-3">
                  {plan.days.map((d) => (
                    <div key={d.day} className="rounded-xl border border-gray-800 bg-zinc-950 p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-semibold">
                          {d.day_name ?? `Deň ${d.day}`}
                          {d.date ? ` • ${formatDateSKFromISO(d.date)}` : ""}
                        </div>
                        <div className="text-xs text-gray-400">Deň {d.day}</div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div className="rounded-lg border border-gray-800 bg-black p-2">
                          <div className="text-xs text-gray-400 mb-1">Raňajky</div>
                          <div className="text-gray-200">{d.breakfast}</div>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-black p-2">
                          <div className="text-xs text-gray-400 mb-1">Obed</div>
                          <div className="text-gray-200">{d.lunch}</div>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-black p-2">
                          <div className="text-xs text-gray-400 mb-1">Večera</div>
                          <div className="text-gray-200">{d.dinner}</div>
                        </div>
                      </div>
                      {d.note ? (
                        <div className="mt-2 text-xs text-gray-400">
                          Poznámka: <span className="text-gray-300">{d.note}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black p-4">
                <div className="text-sm font-semibold mb-3">Nákupy</div>
                {plan.shopping?.length ? (
                  <div className="grid grid-cols-1 gap-3">
                    {plan.shopping.map((s) => (
                      <div key={s.trip} className="rounded-xl border border-gray-800 bg-zinc-950 p-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="font-semibold">Nákup {s.trip}</div>
                          <div className="text-xs text-gray-400">
                            Pokryje dni: {s.covers_days}
                            {s.estimated_cost_eur != null ? (
                              <>
                                {" • "}odhad:{" "}
                                <span className="text-white font-semibold">{s.estimated_cost_eur}</span> €
                              </>
                            ) : null}
                          </div>
                        </div>
                        <ul className="mt-2 space-y-1 text-sm text-gray-200">
                          {s.items?.map((it, i) => (
                            <li key={i} className="flex items-center justify-between gap-3">
                              <span className="truncate">{it.name}</span>
                              <span className="text-gray-400">{it.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Tento plán nemá uložené nákupy.</div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-800 bg-black p-4">
                <div className="text-sm font-semibold mb-3">Recepty</div>
                {plan.recipes && Object.keys(plan.recipes).length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {Object.entries(plan.recipes).map(([key, r]) => (
                      <details key={key} className="rounded-xl border border-gray-800 bg-zinc-950 p-3">
                        <summary className="cursor-pointer select-none">
                          <span className="font-semibold">{r.title || key}</span>{" "}
                          <span className="text-xs text-gray-400">
                            • {r.time_min ?? "—"} min • porcie: {r.portions ?? "—"} • ({key})
                          </span>
                        </summary>

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-lg border border-gray-800 bg-black p-3">
                            <div className="text-xs text-gray-400 mb-2">Suroviny</div>
                            <ul className="space-y-1 text-sm text-gray-200">
                              {(r.ingredients || []).map((ing, i) => (
                                <li key={i} className="flex items-center justify-between gap-3">
                                  <span className="truncate">{ing.name}</span>
                                  <span className="text-gray-400">{ing.quantity}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-lg border border-gray-800 bg-black p-3">
                            <div className="text-xs text-gray-400 mb-2">Postup</div>
                            <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-200">
                              {(r.steps || []).map((st, i) => (
                                <li key={i}>{st}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">
                    Tento plán nemá uložené recepty. (Ak sa to deje, API to teraz bude vracať ako error.)
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              Tip: V detaile týždňa v profile vieš plán upravovať.
            </div>
          </section>
        )}

        {!plan && textResult ? (
          <section className="mt-8 rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold mb-3">Výstup</h2>
            <pre className="overflow-auto rounded-xl bg-black p-4 text-sm text-green-400 whitespace-pre-wrap">
              {textResult}
            </pre>
          </section>
        ) : null}

        {/* MODAL: existuje plán na týždeň */}
        {confirmOpen ? (
          <Modal
            title="Už existuje jedálniček"
            body={confirmMsg}
            onClose={() => setConfirmOpen(false)}
            actions={
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  onClick={async () => {
                    setConfirmOpen(false);
                    setPendingAction({ kind: "keep" });
                    await keepExistingPlan();
                    setPendingAction(null);
                  }}
                >
                  Nie, ponechať aktuálny
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200"
                  onClick={async () => {
                    setConfirmOpen(false);
                    setPendingAction({ kind: "overwrite" });
                    await generateAndAutoSave({ overwrite: true });
                    setPendingAction(null);
                  }}
                  disabled={remainingGenerations <= 0}
                  title={remainingGenerations <= 0 ? `Limit pre týždeň: ${generationLimit}` : ""}
                >
                  Áno, vygenerovať nový
                </button>
              </div>
            }
          />
        ) : null}

        {/* drobný stav keď sa vykonáva modal akcia */}
        {pendingAction ? (
          <div className="mt-4 text-xs text-gray-500">
            {pendingAction.kind === "keep" ? "Načítavam existujúci plán…" : "Generujem a ukladám…"}
          </div>
        ) : null}
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

function Modal({
  title,
  body,
  actions,
  onClose,
}: {
  title: string;
  body: string;
  actions: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-800 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <div className="text-lg font-semibold">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm hover:bg-zinc-900"
          >
            Zavrieť
          </button>
        </div>

        <div className="mt-4 whitespace-pre-wrap text-sm text-gray-200">{body}</div>

        <div className="mt-5">{actions}</div>
      </div>
    </div>
  );
}