// src/app/generate/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/useT";

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
  meta?: any;
};

type ApiResponse =
  | { kind: "json"; plan: PlanJSON; warning?: any }
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
};

type MealPlanRowLite = {
  id: string;
  week_start: string;
  generation_count: number | null;
  plan: any;
  plan_generated: any;
};

type Entitlements = {
  plan: "basic" | "plus";
  status: string;
  can_generate: boolean;
  weekly_limit: number;
  used: number;
  remaining: number;
  calories_enabled: boolean;
  allowed_styles: string[];
  trial_until: string | null;
  current_period_end: string | null;
  has_stripe_link: boolean;
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
  const day = d.getDay();
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

type BannerState =
  | null
  | {
      variant: "error" | "info" | "success";
      title: string;
      message: string;
      detail?: string;
      canRetry?: boolean;
      showProfileLink?: boolean;
    };

function safeStringify(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function deriveErrorMessage(status: number, api: any) {
  const code = api?.error?.code;

  if (status === 429 && code === "WEEKLY_LIMIT_REACHED") {
    const used = api?.error?.used;
    const limit = api?.error?.limit;
    return {
      title: "Dosiahol si týždenný limit generovaní",
      message: `Tento týždeň máš využité generovania (${used}/${limit}). Skús to znova budúci týždeň alebo upgrade na PLUS.`,
      canRetry: false,
    };
  }

  if (status === 402 && code === "SUBSCRIPTION_INACTIVE") {
    return {
      title: "Na generovanie potrebuješ členstvo",
      message: "Najprv si vyber plán a spusti 14-dňový trial v Členstvách.",
      canRetry: false,
    };
  }

  if (status === 403 && code === "STYLE_NOT_ALLOWED") {
    return {
      title: "Zvolený štýl nie je dostupný",
      message: "Tento štýl je dostupný iba v inom pláne. Vyber iný štýl alebo upgrade na PLUS.",
      canRetry: false,
    };
  }

  if (status === 502 && code === "OPENAI_UPSTREAM_ERROR") {
    return {
      title: "Generovanie sa nepodarilo",
      message:
        "AI služba je dočasne nedostupná alebo preťažená. Skús to prosím znova o chvíľu. Zostávajúci počet generovaní ostáva nezmenený.",
      canRetry: true,
    };
  }

  if (status >= 500) {
    return {
      title: "Generovanie sa nepodarilo",
      message: "Nastala chyba na serveri. Skús to znova o chvíľu. Zostávajúci počet generovaní ostáva nezmenený.",
      canRetry: true,
    };
  }

  return {
    title: "Nastala chyba",
    message: "Niečo sa pokazilo. Skús to znova. Zostávajúci počet generovaní ostáva nezmenený.",
    canRetry: true,
  };
}

function CenterModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl p-5 md:p-6 surface-same-as-nav surface-border">
        <div className="flex items-start justify-between gap-3">
          <div className="text-lg md:text-xl font-bold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition"
          >
            Zavrieť
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function GeneratorPage() {
  // ✅ Supabase klient vytvoríme až v browseri (po mount-e), aby build/prerender nepadal
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  useEffect(() => {
    setSupabase(createSupabaseBrowserClient());
  }, []);

  const { t } = useT();

  // ✅ SOURCE OF TRUTH: session
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  const userEmail = session?.user?.email ?? null;
  const accessToken = session?.access_token ?? null;

  const [weekOptions] = useState(() => buildWeekOptions());
  const [weekStart, setWeekStart] = useState<string>(weekOptions[0]?.value ?? "");
  const weekStartRef = useRef(weekStart);
  useEffect(() => {
    weekStartRef.current = weekStart;
  }, [weekStart]);

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

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");

  const [banner, setBanner] = useState<BannerState>(null);
  const [lastPayload, setLastPayload] = useState<any>(null);

  // ✅ ENTITLEMENTS (zdroj pravdy)
  const [entLoading, setEntLoading] = useState(false);
  const [ent, setEnt] = useState<Entitlements | null>(null);

  // ✅ init auth + listener (len raz)
  useEffect(() => {
  if (!supabase) return;
  const sb = supabase; // ✅ toto je fix pre TS

  let alive = true;

  async function initAuth() {
    setAuthLoading(true);
    try {
      const { data } = await sb.auth.getSession(); // ✅ sb namiesto supabase
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

  const { data } = sb.auth.onAuthStateChange((_event, nextSession) => {
    if (!alive) return;
    setSession(nextSession);
    setAuthLoading(false);
  });

  return () => {
    alive = false;
    data.subscription.unsubscribe();
  };
}, [supabase]);

  async function getAccessTokenOrNull() {
    return accessToken ?? null;
  }

  async function fetchEntitlementsForWeek(ws: string, signal?: AbortSignal) {
    const token = await getAccessTokenOrNull();
    if (!token) {
      setEnt(null);
      return;
    }

    setEntLoading(true);
    try {
      const res = await fetch(`/api/entitlements?week_start=${encodeURIComponent(ws)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      const data = await res.json().catch(() => null);

      if (!signal?.aborted) {
        if (res.ok && data) setEnt(data as Entitlements);
        else setEnt(null);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setEnt(null);
    } finally {
      if (!signal?.aborted) setEntLoading(false);
    }
  }

  // ✅ entitlements fetch: iba keď máme token + pri zmene weekStart
  useEffect(() => {
    if (!accessToken) {
      setEnt(null);
      return;
    }

    const ac = new AbortController();
    fetchEntitlementsForWeek(weekStart, ac.signal);

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, weekStart]);

  const tier = (ent?.plan ?? "basic") as "basic" | "plus";
  const generationLimitSafe = ent?.weekly_limit ?? (tier === "plus" ? 5 : 3);

  const weekLabel = useMemo(() => {
    const found = weekOptions.find((o) => o.value === weekStart);
    return found?.label ?? "";
  }, [weekStart, weekOptions]);

  const isValid = useMemo(() => {
    const p = Number(people);
    const b = Number(budget);
    return !!weekStart && Number.isFinite(p) && p >= 1 && p <= 6 && Number.isFinite(b) && b >= 1 && b <= 1000;
  }, [people, budget, weekStart]);

  // ✅ načítanie uloženého týždňa
  useEffect(() => {
    if (!supabase) return;

    (async () => {
      setExistingRow(null);
      const user = session?.user;
      if (!user) return;

      setExistingLoading(true);
      try {
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
  }, [supabase, session, weekStart]);

  const usedGenerations = useMemo(() => {
    if (typeof ent?.used === "number") return ent.used;
    const n = existingRow?.generation_count ?? 0;
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  }, [existingRow, ent]);

  const remainingGenerations = useMemo(() => {
    if (typeof ent?.remaining === "number") return ent.remaining;
    return Math.max(0, generationLimitSafe - usedGenerations);
  }, [generationLimitSafe, usedGenerations, ent]);

  const paywalled = !!accessToken && !!ent && ent.can_generate === false;

  async function loadSavedFromProfile() {
    if (!supabase) return;

    setBanner(null);
    setPrefMsg("");
    setPrefLoading(true);

    const user = session?.user;
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
    if (!supabase) return;

    setBanner(null);
    setPrefMsg("");
    setPrefLoading(true);

    const user = session?.user;
    if (!user) {
      setPrefLoading(false);
      window.location.href = "/login";
      return;
    }

    const payload: ProfileRow = {
      user_id: user.id,
      full_name: null,
      language: null,

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

  function openOverwriteModal() {
    setConfirmMsg(t.generator.overwriteTitle(weekLabel));
    setConfirmOpen(true);
  }

  async function keepExistingPlan() {
    const p = (existingRow?.plan ?? existingRow?.plan_generated) as PlanJSON | null;
    if (p) {
      setPlan(normalizePlan(p));
      setTextResult("");
      setBanner({
        variant: "info",
        title: "Použitý uložený plán",
        message: "Neurobilo sa nové generovanie. Zostávajúci počet generovaní ostáva nezmenený.",
        showProfileLink: true,
      });
    } else {
      setPlan(null);
      setTextResult(t.generator.emptySavedPlan);
    }
  }

  async function callGenerateApi(inputPayload: any) {
    const token = await getAccessTokenOrNull();
    if (!token) {
      return { ok: false as const, status: 401 as const, data: { error: { code: "UNAUTHORIZED" } } as any };
    }

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(inputPayload),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: res.ok, status: res.status, data };
  }

  async function generateAndAutoSave(payloadOverride?: any) {
    if (!supabase) return;

    if (paywalled) {
      window.location.href = "/pricing";
      return;
    }

    setLoading(true);
    setTextResult("");
    setPrefMsg("");
    setBanner(null);

    const user = session?.user;
    if (!user) {
      setLoading(false);
      window.location.href = "/login?mode=login&next=" + encodeURIComponent("/generate");
      return;
    }

    const styleMeta = STYLE_OPTIONS.find((x) => x.value === (payloadOverride?.style ?? style));
    if (styleMeta?.plusOnly && tier !== "plus") {
      setLoading(false);
      setBanner({
        variant: "error",
        title: "Tento štýl je iba pre PLUS",
        message: t.generator.plusOnlyStyle(styleMeta.label),
        canRetry: false,
      });
      return;
    }

    const inputPayload = payloadOverride ?? {
      weekStart,
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

    setLastPayload(inputPayload);

    try {
      const out = await callGenerateApi(inputPayload);

      if (!out.ok) {
        const { title, message, canRetry } = deriveErrorMessage(out.status, out.data);

        setBanner({
          variant: "error",
          title,
          message,
          detail: out.data ? safeStringify(out.data) : `HTTP ${out.status}`,
          canRetry,
          showProfileLink: false,
        });

        return;
      }

      const data: ApiResponse = out.data as any;

      if (data && "kind" in data && data.kind === "json") {
        const normalized = normalizePlan(data.plan);

        if (!hasAllRecipes(normalized)) {
          setBanner({
            variant: "error",
            title: "Generovanie sa nepodarilo",
            message:
              "Výstup neobsahuje všetky recepty. Skús to prosím znova. Zostávajúci počet generovaní ostáva nezmenený.",
            canRetry: true,
          });
          return;
        }

        const weekEnd = addDaysISO(inputPayload.weekStart, 6);
        const currentCount = existingRow?.generation_count ?? 0;
        const nextCount = currentCount + 1;
        const nowIso = new Date().toISOString();

        const { error } = await supabase.from("meal_plans").upsert(
          {
            user_id: user.id,
            week_start: inputPayload.weekStart,
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
          setBanner({
            variant: "error",
            title: "Plán vygenerovaný, ale nepodarilo sa uložiť",
            message: "Skús prosím refresh alebo generuj znova.",
            detail: error.message,
            canRetry: true,
          });
          return;
        }

        setExistingRow((prev) => {
          const base = prev ?? ({} as any);
          return {
            id: base.id ?? "unknown",
            week_start: inputPayload.weekStart,
            generation_count: nextCount,
            plan: normalized,
            plan_generated: normalized,
          };
        });

        setPlan(normalized);

        setBanner({
          variant: "success",
          title: "✅ Jedálniček je vygenerovaný",
          message: "Nájdeš ho v Profile. Môžeš ho tam upraviť, pozrieť recepty aj nákupy.",
          showProfileLink: true,
        });

        // refresh entitlements usage pre UI
        const ac = new AbortController();
        await fetchEntitlementsForWeek(weekStart, ac.signal);
        return;
      }

      if (data && "kind" in data && data.kind === "text") {
        setBanner({
          variant: "error",
          title: "Generovanie sa nepodarilo",
          message: "AI vrátila nečitateľný výstup. Skús to prosím znova.",
          detail: data.text,
          canRetry: true,
        });
        return;
      }

      setBanner({
        variant: "error",
        title: "Neočakávaná odpoveď",
        message: "Server vrátil nečakaný formát. Skús to znova.",
        detail: safeStringify(data),
        canRetry: true,
      });
    } catch (err: any) {
      setBanner({
        variant: "error",
        title: "Generovanie sa nepodarilo",
        message: "Nastala chyba v prehliadači alebo sieti. Skús to znova.",
        detail: err?.message ?? "unknown",
        canRetry: true,
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    if (paywalled) {
      window.location.href = "/pricing";
      return;
    }

    if (existingRow) {
      openOverwriteModal();
      return;
    }

    await generateAndAutoSave();
  }

  const canGenerate = useMemo(() => {
    if (authLoading) return false;
    if (!accessToken) return false;
    if (!isValid) return false;
    if (existingLoading) return false;
    if (entLoading) return false;
    if (paywalled) return false;
    if (remainingGenerations <= 0) return false;
    return true;
  }, [authLoading, accessToken, isValid, existingLoading, entLoading, paywalled, remainingGenerations]);

  const secondaryPill =
    "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 " +
    "border-gray-300 text-gray-700 hover:bg-gray-100 " +
    "dark:border-gray-700 dark:text-gray-200 dark:hover:bg-zinc-900";

  const infoText = "text-sm muted";
  const fineText = "text-xs muted-2";

  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6">
          <h1 className="mt-2 text-3xl font-bold">{t.generator.title}</h1>
          <div className={`mt-2 ${infoText}`}>{t.generator.subtitle}</div>
          {authLoading ? <div className="mt-2 text-xs muted-2">Kontrolujem prihlásenie…</div> : null}
        </header>

        {paywalled ? (
          <div className="mb-6 rounded-3xl p-6 surface-same-as-nav surface-border">
            <div className="text-lg font-bold">Na generovanie potrebuješ členstvo</div>
            <div className="mt-2 text-sm muted">Najprv si vyber plán a spusti 14-dňový trial.</div>
            <div className="mt-4">
              <Link href="/pricing" className="btn-primary inline-block px-5 py-3">
                Otvoriť členstvá
              </Link>
            </div>
          </div>
        ) : null}

        <CenterModal open={!!banner} onClose={() => setBanner(null)} title={banner?.title ?? ""}>
          {banner ? (
            <div className="space-y-4">
              <div className="text-sm muted whitespace-pre-wrap">{banner.message}</div>

              {banner.detail ? (
                <details>
                  <summary className="text-xs muted-2 cursor-pointer select-none">Detail</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs muted-2">{banner.detail}</pre>
                </details>
              ) : null}

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                {banner.canRetry ? (
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-sm"
                    onClick={() => generateAndAutoSave(lastPayload ?? undefined)}
                    disabled={loading}
                  >
                    {loading ? "Skúšam..." : "Skúsiť znova"}
                  </button>
                ) : null}

                {banner.showProfileLink ? (
                  <Link
                    href="/profile"
                    className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition text-center"
                    onClick={() => setBanner(null)}
                  >
                    Otvoriť profil
                  </Link>
                ) : null}

                <button
                  type="button"
                  className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition"
                  onClick={() => setBanner(null)}
                >
                  Zavrieť
                </button>
              </div>
            </div>
          ) : null}
        </CenterModal>

        <CenterModal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Týždeň už máš vygenerovaný">
          <div className="space-y-4">
            <div className="text-sm muted whitespace-pre-wrap">{confirmMsg}</div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={async () => {
                  setConfirmOpen(false);
                  await generateAndAutoSave();
                }}
              >
                Prepísať a generovať
              </button>

              <button
                type="button"
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition"
                onClick={async () => {
                  setConfirmOpen(false);
                  await keepExistingPlan();
                }}
              >
                Použiť existujúci
              </button>

              <button
                type="button"
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition"
                onClick={() => setConfirmOpen(false)}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </CenterModal>

        <form onSubmit={onSubmit} className="rounded-3xl p-6 surface-same-as-nav surface-border">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label={t.generator.week}>
              <select value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="input-surface">
                {weekOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.kind === "this" ? t.generator.thisWeek : t.generator.nextWeek}: {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t.generator.people}>
              <input value={people} onChange={(e) => setPeople(e.target.value)} required className="input-surface" placeholder="2" />
            </Field>

            <Field label={t.generator.budget}>
              <input value={budget} onChange={(e) => setBudget(e.target.value)} required className="input-surface" placeholder="80" />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label={t.generator.style}>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="input-surface">
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

              {tier !== "plus" ? <div className="mt-1 text-xs muted-2">Fit / Tradičné / Exotické budú v Plus členstve.</div> : null}
            </Field>

            <Field label={t.generator.trips}>
              <select value={shoppingTrips} onChange={(e) => setShoppingTrips(e.target.value)} className="input-surface">
                <option value="1">1×</option>
                <option value="2">2×</option>
                <option value="3">3×</option>
                <option value="4">4×</option>
              </select>
            </Field>

            <Field label={t.generator.repeatDays}>
              <select value={repeatDays} onChange={(e) => setRepeatDays(e.target.value)} className="input-surface">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Field label={t.generator.intolerances} hint={t.generator.hardBanHint}>
              <input value={intolerances} onChange={(e) => setIntolerances(e.target.value)} className="input-surface" placeholder="laktóza, arašidy" />
            </Field>

            <Field label={t.generator.avoid} hint={t.generator.softPrefHint}>
              <input value={avoid} onChange={(e) => setAvoid(e.target.value)} className="input-surface" placeholder="huby, brokolica" />
            </Field>

            <Field label={t.generator.have} hint={t.generator.wasteLessHint}>
              <input value={have} onChange={(e) => setHave(e.target.value)} className="input-surface" placeholder="ryža, vajcia" />
            </Field>

            <Field label={t.generator.favorites} hint={t.generator.tastyHint}>
              <input value={favorites} onChange={(e) => setFavorites(e.target.value)} className="input-surface" placeholder="cestoviny, kura" />
            </Field>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className={infoText}>
                {isValid ? (
                  <>
                    {t.generator.ready} • {t.generator.week}: {weekLabel}
                    {accessToken ? (
                      <>
                        {" • "}
                        {t.generator.generations}:{" "}
                        <span className="font-semibold">
                          {usedGenerations}/{generationLimitSafe}
                        </span>{" "}
                        ({t.generator.remaining} <span className="font-semibold">{remainingGenerations}</span>)
                      </>
                    ) : null}
                  </>
                ) : (
                  t.generator.checkInputs
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={loadSavedFromProfile} disabled={prefLoading || paywalled || !accessToken} className={secondaryPill}>
                    {prefLoading ? t.common.loading : t.generator.loadSaved}
                  </button>

                  <button type="button" onClick={saveDefaultsToProfile} disabled={prefLoading || paywalled || !accessToken} className={secondaryPill}>
                    {prefLoading ? t.common.loading : t.generator.saveAsDefault}
                  </button>
                </div>

                {authLoading ? (
                  <button disabled className="btn-primary opacity-60 cursor-not-allowed">
                    Kontrolujem prihlásenie…
                  </button>
                ) : accessToken ? (
                  paywalled ? (
                    <Link href="/pricing" className="btn-primary px-5 py-3 text-sm font-semibold">
                      Vybrať členstvo
                    </Link>
                  ) : (
                    <button disabled={loading || !canGenerate} className="btn-primary disabled:cursor-not-allowed" type="submit">
                      {loading ? t.generator.generating : t.generator.generate}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => (window.location.href = "/login?mode=login&next=" + encodeURIComponent("/generate"))}
                    className="btn-primary"
                  >
                    {t.generator.loginToGenerate}
                  </button>
                )}
              </div>
            </div>

            <div className={fineText}>{t.generator.planningTip}</div>

            {prefMsg ? <div className={`text-sm ${infoText}`}>{prefMsg}</div> : null}
            {textResult ? <pre className="whitespace-pre-wrap text-sm muted">{textResult}</pre> : null}
            {plan ? <div className="hidden" /> : null}
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm muted">{label}</span>
        {hint ? <span className="text-xs muted-2">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}