// src/app/generate/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/useT";
import Modal from "@/components/Modal";

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

type ApiResponse = { kind: "json"; plan: PlanJSON } | { kind: "text"; text: string } | { error: any };

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

function formatDateFromISO(iso?: string) {
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

  const allowThisWeek = day === 1;

  const options: Array<{ value: string; label: string; kind: "this" | "next" }> = [];

  if (allowThisWeek) {
    options.push({
      value: thisMonday,
      label: `${formatDateFromISO(thisMonday)} – ${formatDateFromISO(addDaysISO(thisMonday, 6))}`,
      kind: "this",
    });
  }

  options.push({
    value: nextMonday,
    label: `${formatDateFromISO(nextMonday)} – ${formatDateFromISO(addDaysISO(nextMonday, 6))}`,
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
    for (const [k, v] of Object.entries(next.recipes)) fixed[normalizeRecipeKey(k)] = v as Recipe;
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

// TODO: napojíš na reálne subscriptions (aktuálne máš trial/basic v backende, tu je placeholder)
function getActiveTier() {
  return "basic" as "basic" | "plus";
}
function GENERATION_LIMIT_FOR_TIER(tier: "basic" | "plus") {
  return tier === "plus" ? 5 : 3;
}

export default function GeneratorPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { t, lang } = useT();

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

  const [loading, setLoading] = useState(false);
  const [textResult, setTextResult] = useState("");
  const [plan, setPlan] = useState<PlanJSON | null>(null);

  const [prefLoading, setPrefLoading] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");

  const [existingRow, setExistingRow] = useState<MealPlanRowLite | null>(null);
  const [existingLoading, setExistingLoading] = useState(false);

  const [modal, setModal] = useState<{
    open: boolean;
    title: string;
    message?: string;
    actions?: any[];
  }>({ open: false, title: "" });

  function showModal(title: string, message?: string, actions?: any[]) {
    setModal({ open: true, title, message, actions });
  }

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
    return !!weekStart && Number.isFinite(p) && p >= 1 && p <= 6 && Number.isFinite(b) && b >= 1 && b <= 1000;
  }, [people, budget, weekStart]);

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

        if (error) setExistingRow(null);
        else setExistingRow((data as any) ?? null);
      } finally {
        setExistingLoading(false);
      }
    })();
  }, [supabase, userEmail, weekStart]);

  const usedGenerations = useMemo(() => {
    const n = existingRow?.generation_count ?? 0;
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  }, [existingRow]);

  const remainingGenerations = useMemo(
    () => Math.max(0, generationLimit - usedGenerations),
    [generationLimit, usedGenerations]
  );

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
        "user_id, full_name, people_default, weekly_budget_eur_default, shopping_trips_default, repeat_days_default, style_default, intolerances, avoid, have, favorites"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setPrefMsg(`${t.generator.loadProfileError} ${error.message}`);
      setPrefLoading(false);
      return;
    }

    const p = (data as ProfileRow) ?? null;
    if (!p) {
      setPrefMsg(t.generator.loadProfileNoDefaults);
      setPrefLoading(false);
      return;
    }

    if (p.people_default != null) setPeople(String(p.people_default));
    if (p.weekly_budget_eur_default != null) setBudget(String(p.weekly_budget_eur_default));
    if (p.shopping_trips_default != null) setShoppingTrips(String(p.shopping_trips_default));
    if (p.repeat_days_default != null) setRepeatDays(String(p.repeat_days_default));

    if (p.style_default) {
      const allowed = new Set(STYLE_OPTIONS.map((x) => x.value));
      const incoming = p.style_default.trim();
      if (allowed.has(incoming)) setStyle(incoming);
    }

    setIntolerances(p.intolerances ?? "");
    setAvoid(p.avoid ?? "");
    setHave(p.have ?? "");
    setFavorites(p.favorites ?? "");

    setPrefMsg(t.generator.loadedFromProfile);
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
      setPrefMsg(`${t.generator.saveProfileError} ${error.message}`);
      setPrefLoading(false);
      return;
    }

    setPrefMsg(t.generator.savedToProfile);
    setPrefLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function keepExistingPlan() {
    const p = (existingRow?.plan ?? existingRow?.plan_generated) as PlanJSON | null;
    if (p) {
      setPlan(normalizePlan(p));
      setTextResult("");
      showModal("OK", "Nechal som existujúci plán. Nájdeš ho aj v Profile.", [
        { label: "Otvoriť Profil", href: "/profile", variant: "primary" },
        { label: "Zavrieť", onClick: () => {}, variant: "secondary" },
      ]);
    } else {
      setPlan(null);
      setTextResult(t.generator.emptySavedPlan);
      showModal("Plán je prázdny", t.generator.emptySavedPlan, [{ label: "Zavrieť", onClick: () => {}, variant: "secondary" }]);
    }
  }

  async function generateAndAutoSave() {
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

    const currentCount = existingRow?.generation_count ?? 0;
    if (currentCount >= generationLimit) {
      setLoading(false);
      showModal(
        "Limit generovaní",
        t.generator.limitReached(generationLimit),
        [
          { label: "Cenník", href: "/pricing", variant: "primary" },
          { label: "OK", onClick: () => {}, variant: "secondary" },
        ]
      );
      return;
    }

    const styleMeta = STYLE_OPTIONS.find((x) => x.value === style);
    if (styleMeta?.plusOnly && tier !== "plus") {
      setLoading(false);
      showModal(
        "Dostupné iba v PLUS",
        t.generator.plusOnlyStyle(styleMeta.label),
        [
          { label: "Pozrieť Cenník", href: "/pricing", variant: "primary" },
          { label: "OK", onClick: () => {}, variant: "secondary" },
        ]
      );
      return;
    }

    const inputPayload = {
      weekStart,
      language: lang, // ✅ toto tu chýbalo
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

    try {
      const { data: ss } = await supabase.auth.getSession();
      const accessToken = ss.session?.access_token;
      if (!accessToken) {
        showModal("Nie si prihlásený", t.generator.notLoggedIn, [{ label: "Prihlásiť", href: "/login", variant: "primary" }]);
        return;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(inputPayload),
      });

      const data: ApiResponse = await res.json();

      if (!res.ok) {
        const errText = JSON.stringify((data as any).error ?? data, null, 2);
        showModal("Chyba servera", t.generator.serverError(errText), [{ label: "OK", onClick: () => {}, variant: "secondary" }]);
        return;
      }

      if ("kind" in data && data.kind === "json") {
        const normalized = normalizePlan(data.plan);

        if (!hasAllRecipes(normalized)) {
          showModal("Chyba receptov", "Server vrátil plán bez kompletných receptov. Skús znova.", [
            { label: "Skúsiť znova", onClick: () => generateAndAutoSave(), variant: "primary" },
            { label: "OK", onClick: () => {}, variant: "secondary" },
          ]);
          return;
        }

        const weekEnd = addDaysISO(weekStart, 6);
        const nextCount = currentCount + 1;
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
          setPlan(normalized);
          showModal("Plán vygenerovaný, ale neuložený", t.generator.generatedButSaveFailed(error.message), [
            { label: "Profil", href: "/profile", variant: "primary" },
            { label: "OK", onClick: () => {}, variant: "secondary" },
          ]);
          return;
        }

        setExistingRow((prev) => {
          const base = prev ?? ({} as any);
          return { id: base.id ?? "unknown", week_start: weekStart, generation_count: nextCount, plan: normalized, plan_generated: normalized };
        });

        setPlan(normalized);

        showModal("Hotovo ✅", "Jedálniček bol vygenerovaný a uložený.", [
          { label: "Otvoriť Profil", href: "/profile", variant: "primary" },
          { label: "Zavrieť", onClick: () => {}, variant: "secondary" },
        ]);
      } else if ("kind" in data && data.kind === "text") {
        setTextResult(data.text);
        showModal("Výstup servera", data.text, [{ label: "OK", onClick: () => {}, variant: "secondary" }]);
      } else {
        showModal("Neočakávaná odpoveď", t.generator.unexpectedServer, [{ label: "OK", onClick: () => {}, variant: "secondary" }]);
      }
    } catch (err: any) {
      showModal("Chyba", t.generator.serverError(err?.message ?? "unknown"), [{ label: "OK", onClick: () => {}, variant: "secondary" }]);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    if (existingRow) {
      showModal(
        "Plán už existuje",
        `Na tento týždeň už máš uložený jedálniček.\n\nChceš ho prepísať novým?\n\n${weekLabel}`,
        [
          { label: "Nechať existujúci", onClick: () => keepExistingPlan(), variant: "secondary" },
          { label: "Prepísať", onClick: () => generateAndAutoSave(), variant: "primary" },
        ]
      );
      return;
    }

    await generateAndAutoSave();
  }

  const canGenerate = useMemo(() => {
    if (!isValid) return false;
    if (!userEmail) return true;
    if (existingLoading) return false;
    if (remainingGenerations <= 0) return false;
    return true;
  }, [isValid, userEmail, existingLoading, remainingGenerations]);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="mt-2 text-3xl font-bold">{t.generator.title}</h1>
            <div className="mt-2 text-sm text-gray-400">{t.generator.subtitle}</div>
          </div>

          <div className="text-right">
            {authLoading ? (
              <div className="text-sm text-gray-400">{t.generator.checkingAuth}</div>
            ) : userEmail ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-300">
                  {t.generator.loggedAs} <span className="text-white font-semibold">{userEmail}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Link href="/profile" className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900">
                    {t.generator.profile}
                  </Link>
                  <button onClick={logout} className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900">
                    {t.generator.logout}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => (window.location.href = "/login")}
                className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200"
              >
                {t.generator.login}
              </button>
            )}
          </div>
        </header>

        <form onSubmit={onSubmit} className="rounded-2xl border border-gray-800 bg-zinc-900 p-6 shadow-lg">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label={t.generator.week}>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                {weekOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.kind === "this" ? t.generator.thisWeek : t.generator.nextWeek}: {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t.generator.people}>
              <input
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="2"
              />
            </Field>

            <Field label={t.generator.budget}>
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
            <Field label={t.generator.style}>
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
              {tier !== "plus" ? <div className="mt-1 text-xs text-gray-500">Fit / Tradičné / Exotické sú v Plus členstve.</div> : null}
            </Field>

            <Field label={t.generator.trips}>
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

            <Field label={t.generator.repeatDays}>
              <select
                value={repeatDays}
                onChange={(e) => setRepeatDays(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Field label={t.generator.intolerances} hint={t.generator.hardBanHint}>
              <input
                value={intolerances}
                onChange={(e) => setIntolerances(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="laktóza, arašidy"
              />
            </Field>

            <Field label={t.generator.avoid} hint={t.generator.softPrefHint}>
              <input
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="huby, brokolica"
              />
            </Field>

            <Field label={t.generator.have} hint={t.generator.wasteLessHint}>
              <input
                value={have}
                onChange={(e) => setHave(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="ryža, vajcia"
              />
            </Field>

            <Field label={t.generator.favorites} hint={t.generator.tastyHint}>
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
                    {t.generator.ready} • {t.generator.week}: {weekLabel}
                    {userEmail ? (
                      <>
                        {" • "}
                        {t.generator.generations}:{" "}
                        <span className="text-white font-semibold">
                          {usedGenerations}/{generationLimit}
                        </span>{" "}
                        ({t.generator.remaining} <span className="text-white font-semibold">{remainingGenerations}</span>)
                      </>
                    ) : null}
                  </>
                ) : (
                  t.generator.checkInputs
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={loadSavedFromProfile}
                    disabled={prefLoading}
                    className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900 transition disabled:opacity-40"
                  >
                    {prefLoading ? t.common.loading : t.generator.loadSaved}
                  </button>

                  <button
                    type="button"
                    onClick={saveDefaultsToProfile}
                    disabled={prefLoading}
                    className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900 transition disabled:opacity-40"
                  >
                    {prefLoading ? t.common.loading : t.generator.saveAsDefault}
                  </button>
                </div>

                {userEmail ? (
                  <button
                    disabled={loading || !canGenerate}
                    className="rounded-xl bg-white px-6 py-3 text-black font-semibold hover:bg-gray-200 transition disabled:cursor-not-allowed disabled:opacity-40"
                    title={remainingGenerations <= 0 ? t.generator.generateCtaHint(generationLimit) : t.generator.generateCtaHintOk}
                    type="submit"
                  >
                    {loading ? t.generator.generating : t.generator.generate}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => (window.location.href = "/login")}
                    className="rounded-xl bg-white px-6 py-3 text-black font-semibold hover:bg-gray-200 transition"
                  >
                    {t.generator.loginToGenerate}
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500">{t.generator.planningTip}</div>

            {prefMsg ? <div className="text-sm text-gray-200">{prefMsg}</div> : null}
            {textResult ? <pre className="whitespace-pre-wrap text-sm text-gray-200">{textResult}</pre> : null}

            {plan ? <div className="mt-2 text-sm text-gray-400">OK (plán vygenerovaný - nájdeš ho v profile)</div> : null}
          </div>
        </form>
      </div>

      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        actions={modal.actions}
        onClose={() => setModal((p) => ({ ...p, open: false }))}
      />
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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