//src/app/profile/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/useT";
import {
  Flame,
  ShoppingCart,
  SlidersHorizontal,
  Utensils,
  Wallet,
} from "lucide-react";

type ShoppingItem = {
  name: string;
  quantity: string;
  category_key?: string;
  estimated_price_eur?: number | null;
};

type ShoppingTrip = {
  trip: number;
  covers_days: string;
  estimated_cost_eur?: number | null;
  actual_cost_eur?: number | null;
  items: ShoppingItem[];
};

type MealPlanRow = {
  id: string;
  week_start: string;
  plan: any;
  plan_generated: any;
  is_edited: boolean | null;
  edited_at: string | null;
  created_at: string | null;
};

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
  specifications: string | null;
};

type Entitlements = {
  plan: "basic" | "plus" | null;
  status: string;
  active_like?: boolean;
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

type TabKey = "defaults" | "plans" | "shopping" | "calories" | "finance";

type StyleOption = {
  value: string;
  label: string;
  emoji: string;
  desc: string;
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

const CATEGORY_ORDER: CategoryKey[] = ["veg", "fruit", "meat", "fish", "dairy", "bakery", "dry", "frozen", "spices", "other"];

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  veg: "#16a34a",
  fruit: "#f59e0b",
  meat: "#dc2626",
  fish: "#2563eb",
  dairy: "#7c3aed",
  bakery: "#d97706",
  dry: "#475569",
  frozen: "#06b6d4",
  spices: "#f97316",
  other: "#6b7280",
};

const STYLE_OPTIONS: StyleOption[] = [
  { value: "lacné", label: "Lacné", emoji: "💰", desc: "čo najnižšia cena" },
  { value: "rychle", label: "Rýchle", emoji: "⚡", desc: "max 20–30 min" },
  { value: "vyvazene", label: "Vyvážené", emoji: "🥗", desc: "bielkoviny + zelenina" },
  { value: "vegetarianske", label: "Vegetariánske", emoji: "🌱", desc: "bez mäsa" },
  { value: "veganske", label: "Vegánske", emoji: "🌿", desc: "bez mäsa, rýb, vajec a mliečnych výrobkov" },
  { value: "tradicne", label: "Tradičné", emoji: "🍲", desc: "domáca poctivá strava" },
  { value: "exoticke", label: "Exotické", emoji: "🍜", desc: "ázia / mexiko / fusion" },
  { value: "fit", label: "Fit", emoji: "🏋️", desc: "viac bielkovín, menej cukru" },
];

const MONTH_LABELS = [
  "Január",
  "Február",
  "Marec",
  "Apríl",
  "Máj",
  "Jún",
  "Júl",
  "August",
  "September",
  "Október",
  "November",
  "December",
] as const;

function monthNameSK(mm: string) {
  const idx = Number(mm) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx > 11) return mm;
  return MONTH_LABELS[idx];
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

function yearMonthKey(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Neznámy";
  return iso.slice(0, 7);
}

function ymLabel(ym: string) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const y = m[1];
  const mm = m[2];
  return `${monthNameSK(mm)} ${y}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function moneyFmt(v: number | null | undefined) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)} €`;
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

  for (const t of shopping || []) {
    lines.push(
      `Nákup ${t.trip} (dni ${t.covers_days}) – odhad: ${t.estimated_cost_eur ?? "—"} € – reálna: ${
        t.actual_cost_eur ?? "—"
      } €`
    );
    for (const it of t.items || []) {
      lines.push(
        `- ${it.name} — ${it.quantity}${typeof it.estimated_price_eur === "number" ? ` — ${it.estimated_price_eur.toFixed(2)} €` : ""}`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function normalizeItemName(raw: string) {
  const s = (raw || "").toLowerCase();

  const inParens = s.match(/\(([^)]+)\)/);
  if (inParens?.[1]) {
    const firstInside = inParens[1].split(",")[0]?.trim();
    if (firstInside) return firstInside;
  }

  const first = s.split(",")[0]?.trim() ?? s.trim();
  const cleaned = first.replace(/\([^)]*\)/g, "").replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned;
}

function iconForIngredient(rawName: string) {
  const n = normalizeItemName(rawName);

  if (/(kura|kuracie|hydina)/.test(n)) return "🍗";
  if (/(morč|morka)/.test(n)) return "🦃";
  if (/(hoväd|hovadzie)/.test(n)) return "🥩";
  if (/(bravč|bravc|slanina)/.test(n)) return "🥓";
  if (/(ryb|losos|tuniak|tuna)/.test(n)) return "🐟";

  if (/(mliek|jogurt|kefir|smot)/.test(n)) return "🥛";
  if (/(syr|mozarella|mozzarella|parmez|eidam|bryndz)/.test(n)) return "🧀";
  if (/(vajc)/.test(n)) return "🥚";
  if (/(maslo)/.test(n)) return "🧈";

  if (/(chlieb|rožok|rozok|zeml)/.test(n)) return "🥖";
  if (/(ryž|ryza)/.test(n)) return "🍚";
  if (/(cestovin|špaget|spaget|penne|fusilli)/.test(n)) return "🍝";
  if (/(ovsen|vlo(č|c)k)/.test(n)) return "🥣";
  if (/(múka|muka)/.test(n)) return "🌾";

  if (/(banán|banan)/.test(n)) return "🍌";
  if (/(jablk)/.test(n)) return "🍎";
  if (/(citrón|citron|limet)/.test(n)) return "🍋";
  if (/(jahod)/.test(n)) return "🍓";
  if (/(pomaran|mandar)/.test(n)) return "🍊";

  if (/(paradaj|tomat)/.test(n)) return "🍅";
  if (/(uhork)/.test(n)) return "🥒";
  if (/(cibuľ|cibul)/.test(n)) return "🧅";
  if (/(cesnak)/.test(n)) return "🧄";
  if (/(paprik)/.test(n)) return "🫑";
  if (/(mrkv)/.test(n)) return "🥕";
  if (/(zemiak)/.test(n)) return "🥔";
  if (/(špenát|spenat)/.test(n)) return "🥬";

  if (/(fazuľ|fazul|šošov|sosov|cícer|cicer)/.test(n)) return "🫘";

  if (/(olej)/.test(n)) return "🫒";
  if (/(soľ|sol|koren|paprika mletá|rasca)/.test(n)) return "🧂";
  if (/(cukor|med)/.test(n)) return "🍯";

  return "🛒";
}

function inferCategoryKey(name: string): CategoryKey {
  const n = normalizeItemName(name);

  if (/(paradajk|uhork|paprik|cibuľ|cibul|cesnak|mrkv|zemiak|šalát|salat|brokolic|karfiol|cuketa|špenát|spenat)/.test(n))
    return "veg";
  if (/(jablk|banán|banan|hrušk|pomaranč|pomaranc|citrón|citron|kiwi|jahod|malin|hrozno)/.test(n)) return "fruit";
  if (/(kurac|hovädz|hovedz|bravč|bravc|mlet|slan|šunka|sunka|klobás|klobas)/.test(n)) return "meat";
  if (/(losos|tuniak|tresk|ryb)/.test(n)) return "fish";
  if (/(mliek|jogurt|syr|tvaroh|smotan|maslo|mozarel|parmez|vajc)/.test(n)) return "dairy";
  if (/(chlieb|rožok|rozok|baget|tortill|toast|žeml|zeml)/.test(n)) return "bakery";
  if (/(ryža|ryza|cestov|múka|muka|ovsen|šošov|sosov|cícer|cicer|fazuľ|fazul|konzerv|olej)/.test(n)) return "dry";
  if (/(mrazen)/.test(n)) return "frozen";
  if (/(soľ|sol|koren|paprika mletá|rasca|kari|oregano|bazalk)/.test(n)) return "spices";

  return "other";
}

function computeActualFromTrips(plan: any) {
  const shopping = plan?.shopping;
  if (!Array.isArray(shopping)) return { sum: null as number | null, missing: 0, totalTrips: 0 };

  const totalTrips = shopping.length;
  let missing = 0;
  let sum = 0;
  let any = false;

  for (const t of shopping) {
    const v = t?.actual_cost_eur;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      sum += v;
      any = true;
    } else {
      missing += 1;
    }
  }

  return { sum: any ? Number(sum.toFixed(2)) : null, missing, totalTrips };
}
function computeCaloriesFromPlan(plan: any) {
  const days = Array.isArray(plan?.days) ? plan.days : [];
  if (!days.length) {
    return {
      avg: null as number | null,
      weekly: null as number | null,
      has: false,
    };
  }

  let weeklyTotal = 0;
  let anyCalories = false;

  for (const day of days) {
    const breakfast =
      typeof day?.breakfast_kcal === "number" && Number.isFinite(day.breakfast_kcal)
        ? day.breakfast_kcal
        : 0;

    const lunch =
      typeof day?.lunch_kcal === "number" && Number.isFinite(day.lunch_kcal)
        ? day.lunch_kcal
        : 0;

    const dinner =
      typeof day?.dinner_kcal === "number" && Number.isFinite(day.dinner_kcal)
        ? day.dinner_kcal
        : 0;

    const hasAnyMealKcal =
      (typeof day?.breakfast_kcal === "number" && Number.isFinite(day.breakfast_kcal)) ||
      (typeof day?.lunch_kcal === "number" && Number.isFinite(day.lunch_kcal)) ||
      (typeof day?.dinner_kcal === "number" && Number.isFinite(day.dinner_kcal));

    if (hasAnyMealKcal) {
      weeklyTotal += Math.round(breakfast + lunch + dinner);
      anyCalories = true;
    }
  }

  if (!anyCalories) {
    return {
      avg: null as number | null,
      weekly: null as number | null,
      has: false,
    };
  }

  const daysCount = days.length || 7;

  return {
    avg: Math.round(weeklyTotal / daysCount),
    weekly: Math.round(weeklyTotal),
    has: true,
  };
}

function toIntOrNull(raw: string, opts?: { min?: number; max?: number }) {
  const v = (raw ?? "").toString().trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (opts?.min != null && i < opts.min) return null;
  if (opts?.max != null && i > opts.max) return null;
  return i;
}

function mondayISO(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function TabButton({
  active,
  onClick,
  children,
  locked,
  icon,
  mobileLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  locked?: boolean;
  icon?: React.ReactNode;
  mobileLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "transition border",
        "flex items-center gap-3 text-left",
        "w-full rounded-2xl px-4 py-3 sm:w-auto sm:rounded-full sm:px-4 sm:py-2",
        active
          ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
          : "bg-transparent border-gray-400 text-gray-900 hover:bg-gray-100 dark:border-gray-900 dark:text-gray-400 dark:hover:bg-zinc-900",
        locked ? "opacity-80" : "",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-current",
          active
            ? "border-white/20 dark:border-black/20"
            : "border-gray-300 dark:border-gray-700",
        ].join(" ")}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold sm:hidden">
          {mobileLabel ?? children}
        </span>
        <span className="hidden sm:block text-sm font-semibold whitespace-nowrap">
          {children}
        </span>
      </span>

      <span className="ml-auto flex items-center gap-2 shrink-0">
        {locked ? <span title="Len pre PLUS">🔒</span> : null}
        <span className="sm:hidden text-base">›</span>
      </span>
    </button>
  );
}

function BudgetActualBarChart({
  rows,
  title,
  subtitle,
}: {
  rows: Array<{ label: string; budget: number | null; actual: number | null }>;
  title: string;
  subtitle: string;
}) {
  const maxValue = Math.max(
    1,
    ...rows.flatMap((r) => [
      typeof r.budget === "number" ? r.budget : 0,
      typeof r.actual === "number" ? r.actual : 0,
    ])
  );

  const totals = useMemo(() => {
    let budget = 0;
    let actual = 0;
    let hasBudget = false;
    let hasActual = false;

    for (const r of rows) {
      if (typeof r.budget === "number" && Number.isFinite(r.budget)) {
        budget += r.budget;
        hasBudget = true;
      }
      if (typeof r.actual === "number" && Number.isFinite(r.actual)) {
        actual += r.actual;
        hasActual = true;
      }
    }

    const budgetVal = hasBudget ? round2(budget) : null;
    const actualVal = hasActual ? round2(actual) : null;
    const diffVal = budgetVal != null && actualVal != null ? round2(actualVal - budgetVal) : null;

    return { budgetVal, actualVal, diffVal };
  }, [rows]);

  return (
    <div className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs muted-2">{subtitle}</div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-xs muted-2">Budget spolu</div>
          <div className="mt-1 text-2xl font-bold">
            {totals.budgetVal != null ? `${totals.budgetVal.toFixed(2)} €` : "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-xs muted-2">Reálna cena spolu</div>
          <div
            className={[
              "mt-1 text-2xl font-bold",
              totals.actualVal != null && totals.budgetVal != null
                ? totals.actualVal > totals.budgetVal
                  ? "text-red-500"
                  : "text-green-600 dark:text-green-400"
                : "",
            ].join(" ")}
          >
            {totals.actualVal != null ? `${totals.actualVal.toFixed(2)} €` : "—"}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="text-xs muted-2">Rozdiel</div>
          <div
            className={[
              "mt-1 text-2xl font-bold",
              totals.diffVal != null
                ? totals.diffVal > 0
                  ? "text-red-500"
                  : totals.diffVal < 0
                  ? "text-green-600 dark:text-green-400"
                  : ""
                : "",
            ].join(" ")}
          >
            {totals.diffVal != null
              ? `${totals.diffVal > 0 ? "+" : ""}${totals.diffVal.toFixed(2)} €`
              : "—"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-72 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex h-full items-end gap-4 overflow-x-auto">
            {rows.map((r, idx) => {
              const budgetHeight = typeof r.budget === "number" ? Math.max(8, (r.budget / maxValue) * 100) : 0;
              const actualHeight = typeof r.actual === "number" ? Math.max(8, (r.actual / maxValue) * 100) : 0;

              const actualIsOver =
                typeof r.actual === "number" &&
                typeof r.budget === "number" &&
                Number.isFinite(r.actual) &&
                Number.isFinite(r.budget) &&
                r.actual > r.budget;

              return (
                <div key={idx} className="min-w-[140px] h-full flex flex-col justify-end">
                  <div className="flex-1 flex items-end justify-center gap-3">
                    <div className="flex flex-col items-center justify-end h-full w-12">
                      <div className="text-[11px] muted-2 mb-2">{moneyFmt(r.budget)}</div>
                      <div
                        className="w-10 rounded-t-md bg-slate-700 dark:bg-slate-300"
                        style={{ height: `${budgetHeight}%` }}
                        title={`Budget: ${moneyFmt(r.budget)}`}
                      />
                    </div>

                    <div className="flex flex-col items-center justify-end h-full w-12">
                      <div className="text-[11px] muted-2 mb-2">{moneyFmt(r.actual)}</div>
                      {typeof r.actual === "number" ? (
                        <div
                          className={`w-10 rounded-t-md ${actualIsOver ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ height: `${actualHeight}%` }}
                          title={`Reálna cena: ${moneyFmt(r.actual)}`}
                        />
                      ) : (
                        <div
                          className="w-10 rounded-t-md border border-dashed border-gray-300 dark:border-gray-700"
                          style={{ height: `10%` }}
                          title="Bez reálnej ceny"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-center">
                    <div className="text-[11px] muted-2 leading-tight">{r.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-slate-700 dark:bg-slate-300" />
            <span>Budget</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
            <span>Reálna cena v limite</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-500" />
            <span>Reálna cena nad budget</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildCategoryRowsFromFinanceItems(items: Array<{ plan: any }>) {
  const totals = new Map<CategoryKey, number>();

  for (const x of items) {
    const shopping = x.plan?.shopping;
    if (!Array.isArray(shopping)) continue;

    for (const trip of shopping as ShoppingTrip[]) {
      const tripItems = Array.isArray(trip?.items) ? trip.items : [];
      for (const item of tripItems) {
        const price = item?.estimated_price_eur;
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
        const key = inferCategoryKey(item?.name || "");
        totals.set(key, round2((totals.get(key) ?? 0) + price));
      }
    }
  }

  const total = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  if (!total) return [];

  return CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORY_LABEL[key],
    amount: Number((totals.get(key) ?? 0).toFixed(2)),
  }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((x) => ({
      key: x.key,
      label: x.label,
      amount: x.amount,
      pct: Number(((x.amount / total) * 100).toFixed(1)),
    }));
}

function buildTopItemsRowsFromFinanceItems(items: Array<{ plan: any }>) {
  const totals = new Map<string, { label: string; amount: number }>();

  for (const x of items) {
    const shopping = x.plan?.shopping;
    if (!Array.isArray(shopping)) continue;

    for (const trip of shopping as ShoppingTrip[]) {
      const tripItems = Array.isArray(trip?.items) ? trip.items : [];
      for (const item of tripItems) {
        const price = item?.estimated_price_eur;
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;

        const key = normalizeItemName(item.name || "");
        const existing = totals.get(key);
        if (existing) {
          existing.amount = round2(existing.amount + price);
        } else {
          totals.set(key, {
            label: item.name || key,
            amount: round2(price),
          });
        }
      }
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function CategoryDonutChart({
  rows,
  isPlus,
}: {
  rows: Array<{ key: CategoryKey; label: string; amount: number; pct: number }>;
  isPlus: boolean;
}) {
  const gradient = useMemo(() => {
    let start = 0;
    const parts = rows.map((r) => {
      const end = start + r.pct;
      const color = CATEGORY_COLORS[r.key];
      const part = `${color} ${start}% ${end}%`;
      start = end;
      return part;
    });
    return `conic-gradient(${parts.join(", ")})`;
  }, [rows]);

  return (
    <div className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Odhad výdavkov podľa kategórií</div>
          <div className="mt-1 text-xs muted-2">Rozdelenie podľa cien jednotlivých položiek.</div>
        </div>
        {!isPlus ? (
          <div className="text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1">
            PLUS
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-center">
        <div className="flex items-center justify-center">
          <div
            className="relative h-44 w-44 rounded-full"
            style={{ background: gradient }}
            aria-label="Donut chart"
          >
            <div className="absolute inset-[22%] rounded-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 flex items-center justify-center text-center p-2">
              <div>
                <div className="text-xs muted-2">Kategórie</div>
                <div className="text-sm font-semibold">{isPlus ? rows.length : "PLUS"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block h-3 w-3 rounded-sm shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[r.key] }}
                />
                <span className="truncate">{isPlus ? r.label : `Kategória ${idx + 1}`}</span>
              </div>
              <div className="shrink-0 muted-2">
                {isPlus ? (
                  <>
                    {r.pct.toFixed(1)} % • <span className="font-semibold">{r.amount.toFixed(2)} €</span>
                  </>
                ) : (
                  <span className="font-semibold">•••</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!isPlus ? (
        <div className="mt-4 text-xs muted-2">
          V BASIC vidíš iba preview. Konkrétne názvy kategórií, percentá a hodnoty sú dostupné v PLUS.
        </div>
      ) : null}
    </div>
  );
}

function TopItemsBarChart({
  rows,
  isPlus,
}: {
  rows: Array<{ label: string; amount: number }>;
  isPlus: boolean;
}) {
  const maxValue = Math.max(1, ...rows.map((r) => r.amount));

  return (
    <div className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">TOP 5 najdrahších položiek</div>
          <div className="mt-1 text-xs muted-2">Podľa odhadovanej ceny položiek v nákupoch.</div>
        </div>
        {!isPlus ? (
          <div className="text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1">
            PLUS
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {rows.map((r, i) => {
          const width = Math.max(8, (r.amount / maxValue) * 100);
          return (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold truncate">{isPlus ? r.label : `Položka ${i + 1}`}</span>
                <span className="shrink-0">{isPlus ? `${r.amount.toFixed(2)} €` : "•••"}</span>
              </div>
              <div className="h-4 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-sky-600" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {!isPlus ? (
        <div className="mt-4 text-xs muted-2">
          V BASIC vidíš iba preview. Konkrétne názvy položiek a hodnoty sú dostupné v PLUS.
        </div>
      ) : null}
    </div>
  );
}

function FinanceMonthSummary({
  items,
  isPlus,
}: {
  items: Array<{
    r: MealPlanRow;
    plan: any;
    bud: number | null | undefined;
    est: number | null | undefined;
    act: number | null;
    missing: number;
    totalTrips: number;
    has: boolean;
  }>;
  isPlus: boolean;
}) {
  const weeklyRows = useMemo(() => {
    return items.map((x) => ({
      label: `${formatDateSK(x.r.week_start)} – ${formatDateSK(addDaysISO(x.r.week_start, 6))}`,
      budget: typeof x.bud === "number" ? x.bud : null,
      actual: typeof x.act === "number" ? x.act : null,
    }));
  }, [items]);

  const categoryRows = useMemo(() => buildCategoryRowsFromFinanceItems(items), [items]);
  const topItemsRows = useMemo(() => buildTopItemsRowsFromFinanceItems(items), [items]);

  return (
    <div className="space-y-4">
      <BudgetActualBarChart
        rows={weeklyRows}
        title="Mesačný graf: budget vs reálna cena"
        subtitle="Porovnanie po týždňoch v zvolenom mesiaci."
      />

      {categoryRows.length ? (
        <CategoryDonutChart rows={categoryRows} isPlus={isPlus} />
      ) : (
        <div className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Odhad výdavkov podľa kategórií</div>
              <div className="mt-1 text-sm muted">Pre tento filter zatiaľ nie sú dostupné ceny položiek.</div>
            </div>
            {!isPlus ? (
              <div className="text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1">
                PLUS
              </div>
            ) : null}
          </div>
        </div>
      )}

      {topItemsRows.length ? (
        <TopItemsBarChart rows={topItemsRows} isPlus={isPlus} />
      ) : (
        <div className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">TOP 5 najdrahších položiek</div>
              <div className="mt-1 text-sm muted">Pre tento filter zatiaľ nie sú dostupné ceny položiek.</div>
            </div>
            {!isPlus ? (
              <div className="text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1">
                PLUS
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceYearSummary({
  items,
  isPlus,
  yearLabel,
}: {
  items: Array<{
    r: MealPlanRow;
    plan: any;
    bud: number | null | undefined;
    est: number | null | undefined;
    act: number | null;
    missing: number;
    totalTrips: number;
    has: boolean;
  }>;
  isPlus: boolean;
  yearLabel: string;
}) {
  const monthRows = useMemo(() => {
    const byMonth = new Map<
      string,
      { budget: number; actual: number; hasBudget: boolean; hasActual: boolean }
    >();

    for (const item of items) {
      const mm = item.r.week_start.slice(5, 7);
      if (!byMonth.has(mm)) {
        byMonth.set(mm, { budget: 0, actual: 0, hasBudget: false, hasActual: false });
      }
      const bucket = byMonth.get(mm)!;

      if (typeof item.bud === "number" && Number.isFinite(item.bud)) {
        bucket.budget += item.bud;
        bucket.hasBudget = true;
      }
      if (typeof item.act === "number" && Number.isFinite(item.act)) {
        bucket.actual += item.act;
        bucket.hasActual = true;
      }
    }

    return Array.from(byMonth.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([mm, v]) => ({
        label: monthNameSK(mm),
        budget: v.hasBudget ? round2(v.budget) : null,
        actual: v.hasActual ? round2(v.actual) : null,
      }));
  }, [items]);

  const categoryRows = useMemo(() => buildCategoryRowsFromFinanceItems(items), [items]);
  const topItemsRows = useMemo(() => buildTopItemsRowsFromFinanceItems(items), [items]);

  return (
    <div className="space-y-4">
      <BudgetActualBarChart
        rows={monthRows}
        title={`Ročný graf: budget vs reálna cena (${yearLabel})`}
        subtitle="Porovnanie po mesiacoch v zvolenom roku."
      />

      {categoryRows.length ? (
        <CategoryDonutChart rows={categoryRows} isPlus={isPlus} />
      ) : (
        <div className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Odhad výdavkov podľa kategórií</div>
              <div className="mt-1 text-sm muted">Pre tento filter zatiaľ nie sú dostupné ceny položiek.</div>
            </div>
            {!isPlus ? (
              <div className="text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1">
                PLUS
              </div>
            ) : null}
          </div>
        </div>
      )}

      {topItemsRows.length ? (
        <TopItemsBarChart rows={topItemsRows} isPlus={isPlus} />
      ) : (
        <div className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">TOP 5 najdrahších položiek</div>
              <div className="mt-1 text-sm muted">Pre tento filter zatiaľ nie sú dostupné ceny položiek.</div>
            </div>
            {!isPlus ? (
              <div className="text-xs font-semibold rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1">
                PLUS
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { t } = useT();

  const currentYear = String(new Date().getFullYear());

  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("plans");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MealPlanRow[]>([]);
  const [error, setError] = useState<string>("");

  const [prefLoading, setPrefLoading] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");
  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);

  const [people, setPeople] = useState("");
  const [budget, setBudget] = useState("");
  const [shoppingTrips, setShoppingTrips] = useState("2");
  const [repeatDays, setRepeatDays] = useState("2");
  const [style, setStyle] = useState("lacné");
  const [intolerances, setIntolerances] = useState("");
  const [avoid, setAvoid] = useState("");
  const [have, setHave] = useState("");
  const [favorites, setFavorites] = useState("");
  const [specifications, setSpecifications] = useState("");

  const [yearFilter, setYearFilter] = useState<string>(currentYear);
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const [entLoading, setEntLoading] = useState(false);
  const [ent, setEnt] = useState<Entitlements | null>(null);

  const hasActivePlan = !!ent?.active_like;
const isPlus = hasActivePlan && ent?.plan === "plus";
const caloriesEnabled = hasActivePlan && !!ent?.calories_enabled;
const planLabel = hasActivePlan && ent?.plan ? ent.plan.toUpperCase() : "ŽIADNY";

  async function fetchEntitlements(signal?: AbortSignal) {
    if (!accessToken) {
      setEnt(null);
      return;
    }

    const ws = rows?.[0]?.week_start ?? mondayISO(new Date());
    setEntLoading(true);
    try {
      const res = await fetch(`/api/entitlements?week_start=${encodeURIComponent(ws)}&t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal,
      });

      const data = await res.json().catch(() => null);
      if (!signal?.aborted) setEnt(res.ok && data ? (data as Entitlements) : null);
    } catch (e: any) {
      if (e?.name !== "AbortError") setEnt(null);
    } finally {
      if (!signal?.aborted) setEntLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setAuthLoading(true);
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
      setAccessToken(data.session?.access_token ?? null);
      setAuthLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      setAccessToken(session?.access_token ?? null);
      setAuthLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setError("");
      setLoading(true);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;

      if (!user) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("meal_plans")
        .select("id, week_start, plan, plan_generated, is_edited, edited_at, created_at")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false });

      if (error) setError(error.message);
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [supabase, email]);

  useEffect(() => {
    const ac = new AbortController();
    fetchEntitlements(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, rows.length]);

    useEffect(() => {
    if (!accessToken) return;

    let ac: AbortController | null = null;

    const refresh = () => {
      ac?.abort();
      ac = new AbortController();
      fetchEntitlements(ac.signal);
    };

    const onFocus = () => {
      refresh();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      ac?.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, rows.length]);
  useEffect(() => {
    if (tab === "calories" && (!caloriesEnabled || !isPlus)) setTab("plans");
  }, [tab, caloriesEnabled, isPlus]);

  useEffect(() => {
    (async () => {
      setPrefMsg("");
      setPrefLoading(true);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;
      if (!user) {
        setProfileRow(null);
        setPrefLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id, full_name, language, people_default, weekly_budget_eur_default, shopping_trips_default, repeat_days_default, style_default, intolerances, avoid, have, favorites, specifications"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setPrefMsg("Chyba pri načítaní predvolených: " + error.message);
        setProfileRow(null);
        setPrefLoading(false);
        return;
      }

      const p = (data as ProfileRow) ?? null;
      setProfileRow(p);

      if (p) {
        if (p.people_default != null) setPeople(String(p.people_default));
        if (p.weekly_budget_eur_default != null) setBudget(String(p.weekly_budget_eur_default));
        if (p.shopping_trips_default != null) setShoppingTrips(String(p.shopping_trips_default));
        if (p.repeat_days_default != null) setRepeatDays(String(p.repeat_days_default));

        const allowed = new Set(STYLE_OPTIONS.map((x) => x.value));
        const incoming = (p.style_default || "").trim();
        setStyle(allowed.has(incoming) ? incoming : "lacné");

        setIntolerances(p.intolerances ?? "");
        setAvoid(p.avoid ?? "");
        setHave(p.have ?? "");
        setFavorites(p.favorites ?? "");
        setSpecifications(p.specifications ?? "");
      }

      setPrefLoading(false);
    })();
  }, [supabase, email]);

  const years = useMemo(() => {
    const set = new Set<string>();
    set.add(currentYear);
    for (const r of rows) {
      const m = r.week_start.match(/^(\d{4})-/);
      if (m) set.add(m[1]);
    }
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [rows, currentYear]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.week_start)) return false;
      const y = r.week_start.slice(0, 4);
      const m = r.week_start.slice(5, 7);
      if (yearFilter !== "all" && y !== yearFilter) return false;
      if (monthFilter !== "all" && m !== monthFilter) return false;
      return true;
    });
  }, [rows, yearFilter, monthFilter]);

  const groupedPlans = useMemo(() => {
    const map = new Map<string, MealPlanRow[]>();
    for (const r of filteredRows) {
      const ym = yearMonthKey(r.week_start);
      map.set(ym, [...(map.get(ym) ?? []), r]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({ ym: k, items: map.get(k)! }));
  }, [filteredRows]);

  const shoppingWeeksFiltered = useMemo(() => {
    const base = rows
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.week_start))
      .filter((r) => {
        const y = r.week_start.slice(0, 4);
        const m = r.week_start.slice(5, 7);
        if (yearFilter !== "all" && y !== yearFilter) return false;
        if (monthFilter !== "all" && m !== monthFilter) return false;
        return true;
      })
      .map((r) => {
        const plan = r.plan ?? r.plan_generated ?? null;
        const shopping = (plan?.shopping ?? []) as ShoppingTrip[];
        const has = Array.isArray(shopping) && shopping.length > 0;
        return { r, plan, shopping, has };
      })
      .filter((x) => x.has);

    const map = new Map<string, typeof base>();
    for (const item of base) {
      const ym = yearMonthKey(item.r.week_start);
      map.set(ym, [...(map.get(ym) ?? []), item]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({ ym: k, items: map.get(k)! }));
  }, [rows, yearFilter, monthFilter]);

    const caloriesWeeksFiltered = useMemo(() => {
    const base = rows
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.week_start))
      .filter((r) => {
        const y = r.week_start.slice(0, 4);
        const m = r.week_start.slice(5, 7);
        if (yearFilter !== "all" && y !== yearFilter) return false;
        if (monthFilter !== "all" && m !== monthFilter) return false;
        return true;
      })
      .map((r) => {
        const plan = r.plan ?? r.plan_generated ?? null;
        const { avg, weekly, has } = computeCaloriesFromPlan(plan);
        return { r, plan, avg, weekly, has };
      })
      .filter((x) => x.has);

    const map = new Map<string, typeof base>();
    for (const item of base) {
      const ym = yearMonthKey(item.r.week_start);
      map.set(ym, [...(map.get(ym) ?? []), item]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({ ym: k, items: map.get(k)! }));
  }, [rows, yearFilter, monthFilter]);
  const financeWeeksFiltered = useMemo(() => {
    const base = rows
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.week_start))
      .filter((r) => {
        const y = r.week_start.slice(0, 4);
        const m = r.week_start.slice(5, 7);
        if (yearFilter !== "all" && y !== yearFilter) return false;
        if (monthFilter !== "all" && m !== monthFilter) return false;
        return true;
      })
      .map((r) => {
        const plan = r.plan ?? r.plan_generated ?? null;
        const bud = plan?.summary?.weekly_budget_eur;
        const est = plan?.summary?.estimated_total_cost_eur;
        const { sum: act, missing, totalTrips } = computeActualFromTrips(plan);
        const has = bud != null || est != null || act != null;
        return { r, plan, bud, est, act, missing, totalTrips, has };
      })
      .filter((x) => x.has);

    const map = new Map<string, typeof base>();
    for (const item of base) {
      const ym = yearMonthKey(item.r.week_start);
      map.set(ym, [...(map.get(ym) ?? []), item]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({ ym: k, items: map.get(k)! }));
  }, [rows, yearFilter, monthFilter]);

  const financeFlatItems = useMemo(() => financeWeeksFiltered.flatMap((g) => g.items), [financeWeeksFiltered]);

  function buildSaveDefaultsConfirmationMessage() {
    const almostEmpty =
      !people.trim() &&
      !budget.trim() &&
      !intolerances.trim() &&
      !avoid.trim() &&
      !have.trim() &&
      !favorites.trim() &&
      !specifications.trim();

    if (almostEmpty) {
      return "Vyzerá to, že formulár je takmer prázdny.\n\nNaozaj chceš prepísať predvolené nastavenia?";
    }

    return "Naozaj chceš aktualizovať predvolené nastavenia?\n\nTýmto prepíšeš svoje doterajšie predvolené hodnoty.";
  }

  async function saveDefaults() {
    const confirmed = window.confirm(buildSaveDefaultsConfirmationMessage());
    if (!confirmed) return;

    setPrefMsg("");
    setPrefLoading(true);

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setPrefLoading(false);
      window.location.href = "/login";
      return;
    }

    const payload: ProfileRow = {
      user_id: user.id,
      full_name: null,
      language: null,
      people_default: toIntOrNull(people, { min: 1, max: 20 }),
      weekly_budget_eur_default: (() => {
        const v = budget.trim();
        if (!v) return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= 1 && n <= 100000 ? n : null;
      })(),
      shopping_trips_default: toIntOrNull(shoppingTrips, { min: 1, max: 10 }),
      repeat_days_default: toIntOrNull(repeatDays, { min: 1, max: 7 }),
      style_default: style.trim() || null,
      intolerances: intolerances.trim() || null,
      avoid: avoid.trim() || null,
      have: have.trim() || null,
      favorites: favorites.trim() || null,
      specifications: specifications.trim() || null,
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });

    if (error) {
      setPrefMsg("Chyba pri ukladaní: " + error.message);
      setPrefLoading(false);
      return;
    }

    setProfileRow(payload);
    setPrefMsg("✅ Predvolené uložené.");
    setPrefLoading(false);
  }

  const lockedCalories = !(isPlus && caloriesEnabled);

  const tabs = [
    {
      key: "plans" as TabKey,
      label: "Uložené jedálničky",
      mobileLabel: "Jedálničky",
      icon: <Utensils size={18} />,
      locked: false,
    },
    {
      key: "shopping" as TabKey,
      label: "Uložené nákupné zoznamy",
      mobileLabel: "Nákupy",
      icon: <ShoppingCart size={18} />,
      locked: false,
    },
    {
      key: "calories" as TabKey,
      label: "Kalórie",
      mobileLabel: "Kalórie",
      icon: <Flame size={18} />,
      locked: lockedCalories,
    },
    {
      key: "finance" as TabKey,
      label: "Financie",
      mobileLabel: "Financie",
      icon: <Wallet size={18} />,
      locked: false,
    },
    {
      key: "defaults" as TabKey,
      label: "Predvolené",
      mobileLabel: "Predvolené",
      icon: <SlidersHorizontal size={18} />,
      locked: false,
    },
  ];

  return (
    <main className="min-h-screen px-4 sm:px-6 py-6 page-invert-bg overflow-x-hidden">
      <div className="mx-auto w-full max-w-5xl min-w-0">
        <header className="mb-6">
          <h1 className="mt-2 text-3xl font-bold">{t.nav.profile}</h1>
          <p className="mt-2 muted">Prehľad: predvolené, jedálničky, nákupné zoznamy, kalórie a financie.</p>

          {authLoading ? (
            <div className="mt-3 text-sm muted-2">Kontrolujem prihlásenie…</div>
          ) : email ? (
            <div className="mt-3 text-sm muted">
              Prihlásený ako <span className="font-semibold">{email}</span>
              {entLoading ? <span className="ml-2 text-xs muted-2">• načítavam členstvo…</span> : null}
              {!entLoading ? <span className="ml-2 text-xs muted-2">• plán: {planLabel}</span> : null}
            </div>
          ) : null}
        </header>

        {!email && !authLoading && (
          <div className="rounded-3xl p-6 surface-same-as-nav surface-border">
            <div className="muted">Najprv sa prihlás.</div>
            <Link href="/login" className="mt-4 inline-flex btn-primary px-4 py-2 text-sm w-full sm:w-auto justify-center">
              Prihlásiť sa
            </Link>
          </div>
        )}

        {email && (
          <>
            <div className="mb-6">
  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-2">
    {tabs.map((item) => (
      <TabButton
        key={item.key}
        active={tab === item.key}
        locked={item.locked}
        icon={item.icon}
        mobileLabel={item.mobileLabel}
        onClick={() => {
          if (item.key === "calories" && lockedCalories) {
            window.location.href = "/pricing";
            return;
          }
          setTab(item.key);
        }}
      >
        {item.label}
      </TabButton>
    ))}
  </div>
</div>

            {(tab === "plans" || tab === "shopping" || tab === "calories" || tab === "finance") && (
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                <select
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    setMonthFilter("all");
                  }}
                  className="input-surface text-sm w-full sm:w-auto"
                >
                  <option value="all">Všetky roky</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>

                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="input-surface text-sm w-full sm:w-auto"
                  disabled={yearFilter === "all"}
                  title={yearFilter === "all" ? "Najprv vyber rok" : ""}
                >
                  <option value="all">Všetky mesiace</option>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const mm = String(i + 1).padStart(2, "0");
                    return (
                      <option key={mm} value={mm}>
                        {monthNameSK(mm)}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {tab === "defaults" ? (
              <section className="rounded-3xl p-6 surface-same-as-nav surface-border">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold">Predvolené</h2>
                    <p className="mt-1 text-sm muted">Predvolený plán sa načíta v Generátore cez tlačítko „Načítať uložené“.</p>
                  </div>

                  <button onClick={saveDefaults} disabled={prefLoading} className="btn-primary w-full sm:w-auto">
                    {prefLoading ? "Ukladám..." : "Uložiť predvolené"}
                  </button>
                </div>

                {prefMsg ? <div className="mt-3 text-sm muted">{prefMsg}</div> : null}

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Počet ľudí">
                    <input value={people} onChange={(e) => setPeople(e.target.value)} className="input-surface" placeholder="2" />
                  </Field>

                  <Field label="Budget / týždeň (€)">
                    <input value={budget} onChange={(e) => setBudget(e.target.value)} className="input-surface" placeholder="80" />
                  </Field>

                  <Field label="Preferovaný štýl">
                    <select value={style} onChange={(e) => setStyle(e.target.value)} className="input-surface">
                      {STYLE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.emoji} {s.label} — {s.desc}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Nákupy / týždeň">
                    <select value={shoppingTrips} onChange={(e) => setShoppingTrips(e.target.value)} className="input-surface">
                      <option value="1">1×</option>
                      <option value="2">2×</option>
                      <option value="3">3×</option>
                      <option value="4">4×</option>
                    </select>
                  </Field>

                  <Field label="Varenie na viac dní">
                    <select value={repeatDays} onChange={(e) => setRepeatDays(e.target.value)} className="input-surface">
                      <option value="1">1 deň</option>
                      <option value="2">2 dni</option>
                      <option value="3">3 dni</option>
                    </select>
                  </Field>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4">
                  <Field label="Intolerancie (tvrdý zákaz)">
                    <input
                      value={intolerances}
                      onChange={(e) => setIntolerances(e.target.value)}
                      className="input-surface"
                      placeholder="laktóza, arašidy"
                    />
                  </Field>

                  <Field label="Vyhnúť sa">
                    <input value={avoid} onChange={(e) => setAvoid(e.target.value)} className="input-surface" placeholder="huby, brokolica" />
                  </Field>

                  <Field label="Mám doma (použi)">
                    <input value={have} onChange={(e) => setHave(e.target.value)} className="input-surface" placeholder="ryža, vajcia" />
                  </Field>

                  <Field label="Obľúbené">
                    <input value={favorites} onChange={(e) => setFavorites(e.target.value)} className="input-surface" placeholder="cestoviny, kura" />
                  </Field>

                  <Field label="Špecifikácie">
                    <textarea
                      value={specifications}
                      onChange={(e) => setSpecifications(e.target.value)}
                      className="input-surface min-h-[110px]"
                      placeholder="napr. utorok a streda rovnaký obed, v piatok večer šunková pizza"
                    />
                  </Field>
                </div>

                {!profileRow ? <div className="mt-4 text-xs muted-2">Zatiaľ nemáš uložené predvolené – vyplň a ulož.</div> : null}
              </section>
            ) : null}

            {tab === "plans" ? (
              <section className="rounded-3xl p-6 surface-same-as-nav surface-border">
                <h2 className="text-xl font-semibold">Uložené jedálničky</h2>
                <p className="mt-1 text-sm muted">Filtrovanie podľa roka a mesiaca.</p>

                {loading ? <div className="mt-4 text-sm muted-2">Načítavam…</div> : null}
                {error ? <div className="mt-4 text-sm text-red-500">Chyba: {error}</div> : null}

                {!loading && !error && rows.length === 0 ? (
                  <div className="mt-4 muted">
                    Zatiaľ nemáš uložený žiadny jedálniček. Choď do{" "}
                    <Link className="underline" href="/generate">
                      Generátora
                    </Link>{" "}
                    a vygeneruj si ho.
                  </div>
                ) : null}

                <div className="mt-4 space-y-6">
                  {groupedPlans.map((g) => (
                    <div key={g.ym}>
                      <div className="text-sm muted-2 mb-3">
                        {g.ym === "Neznámy" ? "Neznámy dátum" : `Mesiac: ${ymLabel(g.ym)}`}
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {g.items.map((r) => {
                          const weekEnd = addDaysISO(r.week_start, 6);
                          const plan = r.plan ?? r.plan_generated ?? null;
                          const est = plan?.summary?.estimated_total_cost_eur;
                          const bud = plan?.summary?.weekly_budget_eur;

                          return (
                            <Link
                              key={r.id}
                              href={`/profile/${r.week_start}`}
                              className="block rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800 hover:opacity-[0.98] transition"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-lg font-semibold">
                                    Týždeň {formatDateSK(r.week_start)} – {formatDateSK(weekEnd)}
                                  </div>
                                  <div className="mt-1 text-sm muted-2">
                                    {r.is_edited ? "Upravené" : "Generované"} {bud ? `• Budget: ${bud} €` : ""}{" "}
                                    {est ? `• Odhad: ${Number(est).toFixed(2)} €` : ""}
                                  </div>
                                </div>
                                <div className="text-sm muted-2 shrink-0">Otvor</div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "shopping" ? (
              <section className="rounded-3xl p-6 surface-same-as-nav surface-border">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold">Uložené nákupné zoznamy</h2>
                    <p className="mt-1 text-sm muted">V prehľade sa zobrazuje celý nákupný zoznam vrátane cien položiek, ak sú dostupné.</p>
                  </div>
                </div>

                {loading ? <div className="mt-4 text-sm muted-2">Načítavam…</div> : null}
                {error ? <div className="mt-4 text-sm text-red-500">Chyba: {error}</div> : null}

                {!loading && !error && shoppingWeeksFiltered.length === 0 ? (
                  <div className="mt-4 muted">Zatiaľ nemáš žiadne uložené nákupy pre tento filter.</div>
                ) : null}

                <div className="mt-4 space-y-6">
                  {shoppingWeeksFiltered.map((g) => (
                    <div key={g.ym}>
                      <div className="text-sm muted-2 mb-3">
                        {g.ym === "Neznámy" ? "Neznámy dátum" : `Mesiac: ${ymLabel(g.ym)}`}
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {g.items.map(({ r, plan, shopping }) => {
                          const weekEnd = addDaysISO(r.week_start, 6);
                          const total = plan?.summary?.estimated_total_cost_eur;

                          return (
                            <div key={r.id} className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-lg font-semibold">
                                    Týždeň {formatDateSK(r.week_start)} – {formatDateSK(weekEnd)}
                                  </div>
                                  <div className="mt-1 text-sm muted-2">
                                    {typeof total === "number" ? `Celkový odhad: ${total.toFixed(2)} €` : "Celkový odhad: —"}
                                    {" • "}nákupov: {Array.isArray(shopping) ? shopping.length : 0}
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => downloadText(`fudly-nakup-${r.week_start}.txt`, shoppingToTXT(r.week_start, shopping))}
                                    className="rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition w-full sm:w-auto"
                                  >
                                    Export TXT
                                  </button>
                                  <Link
                                    href={`/profile/${r.week_start}`}
                                    className="rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 transition w-full sm:w-auto text-center"
                                  >
                                    Otvoriť detail
                                  </Link>
                                </div>
                              </div>

                              <div className="mt-4 space-y-3">
                                {Array.isArray(shopping) && shopping.length > 0 ? (
                                  shopping.map((trip, tripIndex) => (
                                    <div key={tripIndex} className="rounded-xl p-3 surface-same-as-nav surface-border">
                                      <div className="flex items-baseline justify-between gap-3">
                                        <div className="font-semibold">🧺 Nákup {trip?.trip ?? tripIndex + 1}</div>
                                        <div className="text-xs muted-2 text-right">
                                          {trip?.covers_days ? `dni: ${trip.covers_days}` : ""}
                                          {trip?.estimated_cost_eur != null ? (
                                            <>
                                              {" • "}odhad: <span className="font-semibold">{Number(trip.estimated_cost_eur).toFixed(2)} €</span>
                                            </>
                                          ) : null}
                                          {trip?.actual_cost_eur != null ? (
                                            <>
                                              {" • "}reálne: <span className="font-semibold">{Number(trip.actual_cost_eur).toFixed(2)} €</span>
                                            </>
                                          ) : null}
                                        </div>
                                      </div>

                                      {Array.isArray(trip?.items) && trip.items.length ? (
                                        <ul className="mt-2 space-y-1 text-sm muted">
                                          {trip.items.map((it, i) => (
                                            <li key={i} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                                              <span className="flex items-center gap-2 min-w-0">
                                                <span className="shrink-0">{iconForIngredient(it.name)}</span>
                                                <span className="break-words">{it.name}</span>
                                              </span>
                                              <span className="muted-2 shrink-0">{it.quantity}</span>
                                              <span className="font-semibold shrink-0">
                                                {typeof it.estimated_price_eur === "number" ? `${it.estimated_price_eur.toFixed(2)} €` : "—"}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <div className="mt-2 text-sm muted-2">Žiadne položky.</div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-xl p-3 surface-same-as-nav surface-border text-sm muted-2">Žiadne položky.</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "calories" ? (
              <section className="rounded-3xl p-6 surface-same-as-nav surface-border">
                <h2 className="text-xl font-semibold">Kalórie</h2>
                <p className="mt-1 text-sm muted">Priemer kcal/deň + súčet týždňa.</p>

                {loading ? <div className="mt-4 text-sm muted-2">Načítavam…</div> : null}
                {error ? <div className="mt-4 text-sm text-red-500">Chyba: {error}</div> : null}

                {!loading && !error && caloriesWeeksFiltered.length === 0 ? (
                  <div className="mt-4 muted">Pre tento filter nemáš uložené kalórie.</div>
                ) : null}

                <div className="mt-4 space-y-6">
                  {caloriesWeeksFiltered.map((g) => (
                    <div key={g.ym}>
                      <div className="text-sm muted-2 mb-3">{g.ym === "Neznámy" ? "Neznámy dátum" : `Mesiac: ${ymLabel(g.ym)}`}</div>

                      <div className="grid grid-cols-1 gap-4">
                        {g.items.map(({ r, avg, weekly }) => {
                          const weekEnd = addDaysISO(r.week_start, 6);
                          return (
                            <Link
                              key={r.id}
                              href={`/profile/${r.week_start}`}
                              className="block rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800 hover:opacity-[0.98] transition"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-lg font-semibold">
                                    Týždeň {formatDateSK(r.week_start)} – {formatDateSK(weekEnd)}
                                  </div>
                                  <div className="mt-1 text-sm muted-2">
                                    Priemer denne (domácnosť): <span className="font-semibold">{typeof avg === "number" ? avg : "—"}</span> kcal/deň {" • "}
                                    Týždeň: <span className="font-semibold">{typeof weekly === "number" ? weekly : "—"}</span> kcal
                                  </div>
                                </div>
                                <div className="text-sm muted-2 shrink-0">Otvor</div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "finance" ? (
              <section className="rounded-3xl p-6 surface-same-as-nav surface-border">
                <h2 className="text-xl font-semibold">Financie</h2>
                

                {loading ? <div className="mt-4 text-sm muted-2">Načítavam…</div> : null}
                {error ? <div className="mt-4 text-sm text-red-500">Chyba: {error}</div> : null}

                {!loading && !error && financeWeeksFiltered.length === 0 ? (
                  <div className="mt-4 muted">Zatiaľ nemáš dáta pre financie v tomto filtri.</div>
                ) : null}

                <div className="mt-4 space-y-6">
                  {yearFilter !== "all" && monthFilter === "all" && financeFlatItems.length > 0 ? (
                    <FinanceYearSummary items={financeFlatItems} isPlus={!!isPlus} yearLabel={yearFilter} />
                  ) : null}

                  {financeWeeksFiltered.map((g) => (
                    <div key={g.ym}>
                      <div className="text-sm muted-2 mb-3">{g.ym === "Neznámy" ? "Neznámy dátum" : `Mesiac: ${ymLabel(g.ym)}`}</div>

                      {monthFilter !== "all" ? <FinanceMonthSummary items={g.items} isPlus={!!isPlus} /> : null}

                      <div className="mt-4 grid grid-cols-1 gap-4">
                        {g.items.map(({ r, bud, est, act, missing, totalTrips }) => {
                          const weekEnd = addDaysISO(r.week_start, 6);

                          const budgetVal = typeof bud === "number" ? bud : null;
                          const estVal = typeof est === "number" ? est : null;
                          const actVal = typeof act === "number" ? act : null;

                          const diffEst = budgetVal != null && estVal != null ? estVal - budgetVal : null;
                          const diffAct = budgetVal != null && actVal != null ? actVal - budgetVal : null;

                          return (
                            <div key={r.id} className="rounded-2xl p-4 page-invert-bg border border-gray-200 dark:border-gray-800">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-lg font-semibold">
                                    Týždeň {formatDateSK(r.week_start)} – {formatDateSK(weekEnd)}
                                  </div>

                                  <div className="mt-1 text-sm muted-2">
                                    Budget: <span className="font-semibold">{budgetVal != null ? `${budgetVal} €` : "—"}</span> {" • "}
                                    Odhad: <span className="font-semibold">{estVal != null ? `${estVal.toFixed(2)} €` : "—"}</span>
                                    {diffEst != null ? (
                                      <>
                                        {" • "}vs budget:{" "}
                                        <span className={diffEst > 0 ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>
                                          {diffEst > 0 ? "+" : ""}
                                          {diffEst.toFixed(2)} €
                                        </span>
                                      </>
                                    ) : null}
                                  </div>

                                  <div className="mt-1 text-sm muted-2">
                                    Reálna cena (nákupy): <span className="font-semibold">{actVal != null ? `${actVal.toFixed(2)} €` : "—"}</span>
                                    {diffAct != null ? (
                                      <>
                                        {" • "}vs budget:{" "}
                                        <span className={diffAct > 0 ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>
                                          {diffAct > 0 ? "+" : ""}
                                          {diffAct.toFixed(2)} €
                                        </span>
                                      </>
                                    ) : null}
                                    {" • "}
                                    <span className={missing > 0 ? "text-yellow-600 dark:text-yellow-300" : "muted-2"}>
                                      {totalTrips > 0 ? `chýba ${missing}/${totalTrips} nákupov` : "žiadne nákupy"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-2 min-w-0 sm:min-w-[220px]">
                                  <Link
                                    href={`/profile/${r.week_start}`}
                                    className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-zinc-900 text-center transition w-full sm:w-auto"
                                  >
                                    Otvoriť detail
                                  </Link>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-xs muted-2">
                  Reálnu cenu dopĺňaš v detaile týždňa pri jednotlivých nákupných zoznamoch. Odhad podľa kategórií a TOP 5 fungujú len tam, kde sú dostupné ceny položiek.
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm muted">{label}</span>
      </div>
      {children}
    </label>
  );
}