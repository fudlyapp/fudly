"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type MealPlanRow = {
  id: string;
  week_start: string; // YYYY-MM-DD
  plan: any;
  plan_generated: any;
  is_edited: boolean | null;
  edited_at: string | null;
  created_at: string | null;
};

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

type TabKey = "defaults" | "plans" | "shopping" | "calories" | "finance";

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
  return iso.slice(0, 7); // YYYY-MM
}

function ymLabel(ym: string) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (!m) return ym;
  const y = m[1];
  const mm = m[2];
  return `${mm}.${y}`;
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

function shoppingToTXT(weekStart: string, shopping: any[]) {
  const lines: string[] = [];
  lines.push(`Fudly – Nákupný zoznam`);
  lines.push(`Týždeň: ${weekStart}`);
  lines.push("");

  for (const t of shopping || []) {
    lines.push(`Nákup ${t.trip} (dni ${t.covers_days}) – odhad: ${t.estimated_cost_eur ?? "—"} €`);
    for (const it of t.items || []) {
      lines.push(`- ${it.name} — ${it.quantity}`);
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
  const cleaned = first
    .replace(/\([^)]*\)/g, "")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

  if (/(zelenin|šalát|salat|mix zeleniny)/.test(n)) return "🥬";
  if (/(ovoc|mix ovocia)/.test(n)) return "🍎";
  if (/(mäso|maso)/.test(n)) return "🥩";
  if (/(ryby|ryba)/.test(n)) return "🐟";
  if (/(príloh|priloh|obilnin)/.test(n)) return "🌾";

  return "🛒";
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm font-semibold transition border",
        active ? "bg-white text-black border-white" : "bg-black text-gray-200 border-gray-700 hover:bg-zinc-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export default function ProfilePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("plans");

  // uložené plány
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MealPlanRow[]>([]);
  const [error, setError] = useState<string>("");

  // predvolené
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

  // filter rok/mesiac (spoločné pre “Jedálničky” aj “Nákupy” aj “Kalórie” aj “Financie”)
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all"); // "01".."12"

  // financie – ukladanie reálnej ceny
  const [financeSavingId, setFinanceSavingId] = useState<string | null>(null);
  const [financeMsg, setFinanceMsg] = useState<string>("");

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
          "user_id, full_name, people_default, weekly_budget_eur_default, shopping_trips_default, repeat_days_default, style_default, intolerances, avoid, have, favorites"
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
      }

      setPrefLoading(false);
    })();
  }, [supabase, email]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const m = r.week_start.match(/^(\d{4})-/);
      if (m) set.add(m[1]);
    }
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [rows]);

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
        const shopping = plan?.shopping ?? [];
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
        const avg = plan?.summary?.avg_daily_kcal;
        const weekly = plan?.summary?.weekly_total_kcal;
        const has = typeof avg === "number" || typeof weekly === "number";
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
        const act = plan?.summary?.actual_total_cost_eur;
        const has = bud != null || est != null || act != null;
        return { r, plan, bud, est, act, has };
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

  async function saveDefaults() {
    setPrefMsg("");
    setPrefLoading(true);

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
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
      setPrefMsg("Chyba pri ukladaní: " + error.message);
      setPrefLoading(false);
      return;
    }

    setProfileRow(payload);
    setPrefMsg("✅ Predvolené uložené.");
    setPrefLoading(false);
  }

  function exportWeekTXT(weekStart: string, shopping: any[]) {
    downloadText(`fudly-nakup-${weekStart}.txt`, shoppingToTXT(weekStart, shopping));
  }

  async function saveActualCost(rowId: string, weekStart: string, rawValue: string) {
    setFinanceMsg("");
    setFinanceSavingId(rowId);

    const value = rawValue.trim();
    let num: number | null = null;
    if (value) {
      const parsed = Number(value.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFinanceMsg("Neplatná reálna cena. Zadaj číslo (napr. 82.50).");
        setFinanceSavingId(null);
        return;
      }
      num = parsed;
    }

    const found = rows.find((r) => r.id === rowId);
    if (!found) {
      setFinanceMsg("Nenašiel som tento týždeň v zozname.");
      setFinanceSavingId(null);
      return;
    }

    const plan = deepClone((found.plan ?? found.plan_generated ?? {}) as any);
    plan.summary = plan.summary ?? {};
    plan.summary.actual_total_cost_eur = num;

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("meal_plans")
      .update({ plan, is_edited: true, edited_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("week_start", weekStart);

    if (error) {
      setFinanceMsg("Chyba pri ukladaní reálnej ceny: " + error.message);
      setFinanceSavingId(null);
      return;
    }

    // update lokálne
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return { ...r, plan, is_edited: true, edited_at: new Date().toISOString() };
      })
    );

    setFinanceMsg("✅ Reálna cena uložená.");
    setFinanceSavingId(null);
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Profil</h1>
            <p className="mt-2 text-gray-300">Prehľad: predvolené, jedálničky, nákupy, kalórie a financie.</p>
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
                  <Link
                    href="/generate"
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Generátor
                  </Link>
                  <button
                    onClick={logout}
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Odhlásiť
                  </button>
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

        {!email && !authLoading && (
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="text-gray-200">Najprv sa prihlás.</div>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-xl bg-white px-4 py-2 text-black font-semibold hover:bg-gray-200"
            >
              Prihlásiť sa
            </Link>
          </div>
        )}

        {email && (
          <>
            {/* TABS */}
            <div className="mb-6 flex flex-wrap gap-2">
              <TabButton active={tab === "plans"} onClick={() => setTab("plans")}>
                Uložené jedálničky
              </TabButton>
              <TabButton active={tab === "shopping"} onClick={() => setTab("shopping")}>
                Uložené nákupy
              </TabButton>
              <TabButton active={tab === "calories"} onClick={() => setTab("calories")}>
                Kalórie
              </TabButton>
              <TabButton active={tab === "finance"} onClick={() => setTab("finance")}>
                Financie
              </TabButton>
              <TabButton active={tab === "defaults"} onClick={() => setTab("defaults")}>
                Predvolené
              </TabButton>
            </div>

            {/* FILTERS (spoločné pre plans/shopping/calories/finance) */}
            {(tab === "plans" || tab === "shopping" || tab === "calories" || tab === "finance") && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <select
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    setMonthFilter("all");
                  }}
                  className="rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
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
                  className="rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                  disabled={yearFilter === "all"}
                  title={yearFilter === "all" ? "Najprv vyber rok" : ""}
                >
                  <option value="all">Všetky mesiace</option>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const mm = String(i + 1).padStart(2, "0");
                    return (
                      <option key={mm} value={mm}>
                        {mm}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* DEFAULTS */}
            {tab === "defaults" ? (
              <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Predvolené</h2>
                    <p className="mt-1 text-sm text-gray-300">
                      Toto sa načíta v Generátore cez „Načítať uložené“.
                    </p>
                  </div>

                  <button
                    onClick={saveDefaults}
                    disabled={prefLoading}
                    className="rounded-xl bg-white px-5 py-3 text-black font-semibold hover:bg-gray-200 transition disabled:opacity-40"
                  >
                    {prefLoading ? "Ukladám..." : "Uložiť predvolené"}
                  </button>
                </div>

                {prefMsg ? <div className="mt-3 text-sm text-gray-200">{prefMsg}</div> : null}

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Počet ľudí">
                    <input
                      value={people}
                      onChange={(e) => setPeople(e.target.value)}
                      className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                      placeholder="2"
                    />
                  </Field>

                  <Field label="Budget / týždeň (€)">
                    <input
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
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
                      className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                      placeholder="laktóza, arašidy"
                    />
                  </Field>

                  <Field label="Vyhnúť sa">
                    <input
                      value={avoid}
                      onChange={(e) => setAvoid(e.target.value)}
                      className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                      placeholder="huby, brokolica"
                    />
                  </Field>

                  <Field label="Mám doma (použi)">
                    <input
                      value={have}
                      onChange={(e) => setHave(e.target.value)}
                      className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                      placeholder="ryža, vajcia"
                    />
                  </Field>

                  <Field label="Obľúbené">
                    <input
                      value={favorites}
                      onChange={(e) => setFavorites(e.target.value)}
                      className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                      placeholder="cestoviny, kura"
                    />
                  </Field>
                </div>

                {!profileRow ? (
                  <div className="mt-4 text-xs text-gray-500">Zatiaľ nemáš uložené predvolené – vyplň a ulož.</div>
                ) : null}
              </section>
            ) : null}

            {/* PLANS */}
            {tab === "plans" ? (
              <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Uložené jedálničky</h2>
                    <p className="mt-1 text-sm text-gray-300">Filtrovanie podľa roka a mesiaca.</p>
                  </div>
                </div>

                {loading ? <div className="mt-4 text-sm text-gray-400">Načítavam…</div> : null}
                {error ? <div className="mt-4 text-sm text-red-300">Chyba: {error}</div> : null}

                {!loading && !error && rows.length === 0 ? (
                  <div className="mt-4 text-gray-300">
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
                      <div className="text-sm text-gray-400 mb-3">
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
                              className="block rounded-2xl border border-gray-800 bg-black p-4 hover:bg-zinc-950 transition"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-lg font-semibold">
                                    Týždeň {formatDateSK(r.week_start)} – {formatDateSK(weekEnd)}
                                  </div>
                                  <div className="mt-1 text-sm text-gray-400">
                                    {r.is_edited ? "Upravené" : "Generované"}{" "}
                                    {bud ? `• Budget: ${bud} €` : ""} {est ? `• Odhad: ${est} €` : ""}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-400">Otvor</div>
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

            {/* SHOPPING */}
            {tab === "shopping" ? (
              <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Uložené nákupy</h2>
                    <p className="mt-1 text-sm text-gray-300">
                      Rovnaké filtrovanie ako pri jedálničkoch + export zatiaľ iba TXT.
                    </p>
                  </div>
                  <Link
                    href="/generate"
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Generovať nový týždeň
                  </Link>
                </div>

                {loading ? <div className="mt-4 text-sm text-gray-400">Načítavam…</div> : null}
                {error ? <div className="mt-4 text-sm text-red-300">Chyba: {error}</div> : null}

                {!loading && !error && shoppingWeeksFiltered.length === 0 ? (
                  <div className="mt-4 text-gray-300">Zatiaľ nemáš žiadne uložené nákupy pre tento filter.</div>
                ) : null}

                <div className="mt-4 space-y-6">
                  {shoppingWeeksFiltered.map((g) => (
                    <div key={g.ym}>
                      <div className="text-sm text-gray-400 mb-3">
                        {g.ym === "Neznámy" ? "Neznámy dátum" : `Mesiac: ${ymLabel(g.ym)}`}
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {g.items.map(({ r, plan, shopping }) => {
                          const weekEnd = addDaysISO(r.week_start, 6);
                          const total = plan?.summary?.estimated_total_cost_eur;

                          const firstTrip = Array.isArray(shopping) ? shopping[0] : null;
                          const previewItems = Array.isArray(firstTrip?.items) ? firstTrip.items.slice(0, 6) : [];

                          return (
                            <div key={r.id} className="rounded-2xl border border-gray-800 bg-black p-4">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div>
                                  <div className="text-lg font-semibold">
                                    Týždeň {formatDateSK(r.week_start)} – {formatDateSK(weekEnd)}
                                  </div>
                                  <div className="mt-1 text-sm text-gray-400">
                                    {typeof total === "number" ? `Celkový odhad: ${total} €` : "Celkový odhad: —"}
                                    {" • "}nákupov: {Array.isArray(shopping) ? shopping.length : 0}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => exportWeekTXT(r.week_start, shopping)}
                                    className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900"
                                  >
                                    Export TXT
                                  </button>
                                  <Link
                                    href={`/profile/${r.week_start}`}
                                    className="rounded-full border border-gray-700 bg-black px-3 py-1.5 text-xs text-gray-200 hover:bg-zinc-900"
                                  >
                                    Otvoriť detail
                                  </Link>
                                </div>
                              </div>

                              <div className="mt-4 rounded-xl border border-gray-800 bg-zinc-950 p-3">
                                <div className="flex items-baseline justify-between gap-3">
                                  <div className="font-semibold">
                                    🧺 Preview: {firstTrip ? `Nákup ${firstTrip.trip}` : "—"}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {firstTrip?.covers_days ? `dni: ${firstTrip.covers_days}` : ""}
                                    {firstTrip?.estimated_cost_eur != null ? (
                                      <>
                                        {" • "}odhad:{" "}
                                        <span className="text-white font-semibold">
                                          {firstTrip.estimated_cost_eur} €
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>

                                {previewItems.length ? (
                                  <ul className="mt-2 space-y-1 text-sm text-gray-200">
                                    {previewItems.map((it: any, i: number) => (
                                      <li key={i} className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-2 min-w-0">
                                          <span className="shrink-0">{iconForIngredient(it.name)}</span>
                                          <span className="truncate">{it.name}</span>
                                        </span>
                                        <span className="text-gray-400 shrink-0">{it.quantity}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="mt-2 text-sm text-gray-400">Žiadne položky.</div>
                                )}

                                {firstTrip?.items?.length > 6 ? (
                                  <div className="mt-2 text-xs text-gray-500">
                                    Zobrazených 6 položiek. Zvyšok nájdeš v detaile týždňa.
                                  </div>
                                ) : null}
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

            {/* CALORIES */}
            {tab === "calories" ? (
              <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Kalórie</h2>
                    <p className="mt-1 text-sm text-gray-300">
                      Priemer kcal/deň + súčet týždňa. Dáta sú v uloženom pláne.
                    </p>
                  </div>
                  <Link
                    href="/generate"
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Generovať nový týždeň
                  </Link>
                </div>

                {loading ? <div className="mt-4 text-sm text-gray-400">Načítavam…</div> : null}
                {error ? <div className="mt-4 text-sm text-red-300">Chyba: {error}</div> : null}

                {!loading && !error && caloriesWeeksFiltered.length === 0 ? (
                  <div className="mt-4 text-gray-300">
                    Pre tento filter nemáš uložené kalórie. Vygeneruj nový týždeň (API už kalórie vracia).
                  </div>
                ) : null}

                <div className="mt-4 space-y-6">
                  {caloriesWeeksFiltered.map((g) => (
                    <div key={g.ym}>
                      <div className="text-sm text-gray-400 mb-3">
                        {g.ym === "Neznámy" ? "Neznámy dátum" : `Mesiac: ${ymLabel(g.ym)}`}
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {g.items.map(({ r, plan, avg, weekly }) => {
                          const weekEnd = addDaysISO(r.week_start, 6);
                          return (
                            <Link
                              key={r.id}
                              href={`/profile/${r.week_start}`}
                              className="block rounded-2xl border border-gray-800 bg-black p-4 hover:bg-zinc-950 transition"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="text-lg font-semibold">
                                    Týždeň {formatDateSK(r.week_start)} – {formatDateSK(weekEnd)}
                                  </div>
                                  <div className="mt-1 text-sm text-gray-400">
                                    Priemer:{" "}
                                    <span className="text-white font-semibold">{typeof avg === "number" ? avg : "—"}</span>{" "}
                                    kcal/deň
                                    {" • "}
                                    Týždeň:{" "}
                                    <span className="text-white font-semibold">
                                      {typeof weekly === "number" ? weekly : "—"}
                                    </span>{" "}
                                    kcal
                                  </div>
                                </div>
                                <div className="text-sm text-gray-400">Otvor</div>
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

            {/* FINANCE */}
            {tab === "finance" ? (
              <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Financie</h2>
                    <p className="mt-1 text-sm text-gray-300">
                      Budget vs odhad vs reálna cena. Reálnu cenu vieš dopísať ručne.
                    </p>
                  </div>
                  <Link
                    href="/generate"
                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
                  >
                    Generovať nový týždeň
                  </Link>
                </div>

                {financeMsg ? <div className="mt-3 text-sm text-gray-200">{financeMsg}</div> : null}

                {loading ? <div className="mt-4 text-sm text-gray-400">Načítavam…</div> : null}
                {error ? <div className="mt-4 text-sm text-red-300">Chyba: {error}</div> : null}

                {!loading && !error && financeWeeksFiltered.length === 0 ? (
                  <div className="mt-4 text-gray-300">Zatiaľ nemáš dáta pre financie v tomto filtri.</div>
                ) : null}

                <div className="mt-4 space-y-6">
                  {financeWeeksFiltered.map((g) => (
                    <div key={g.ym}>
                      <div className="text-sm text-gray-400 mb-3">
                        {g.ym === "Neznámy" ? "Neznámy dátum" : `Mesiac: ${ymLabel(g.ym)}`}
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {g.items.map(({ r, plan, bud, est, act }) => {
                          const weekEnd = addDaysISO(r.week_start, 6);

                          const budgetVal = typeof bud === "number" ? bud : null;
                          const estVal = typeof est === "number" ? est : null;
                          const actVal = typeof act === "number" ? act : null;

                          const diffEst = budgetVal != null && estVal != null ? estVal - budgetVal : null;
                          const diffAct = budgetVal != null && actVal != null ? actVal - budgetVal : null;

                          return (
                            <div key={r.id} className="rounded-2xl border border-gray-800 bg-black p-4">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div>
                                  <div className="text-lg font-semibold">
                                    Týždeň {formatDateSK(r.week_start)} – {formatDateSK(weekEnd)}
                                  </div>
                                  <div className="mt-1 text-sm text-gray-400">
                                    Budget:{" "}
                                    <span className="text-white font-semibold">{budgetVal != null ? `${budgetVal} €` : "—"}</span>
                                    {" • "}
                                    Odhad:{" "}
                                    <span className="text-white font-semibold">{estVal != null ? `${estVal} €` : "—"}</span>
                                    {diffEst != null ? (
                                      <>
                                        {" • "}vs budget:{" "}
                                        <span className={diffEst > 0 ? "text-red-300 font-semibold" : "text-green-300 font-semibold"}>
                                          {diffEst > 0 ? "+" : ""}
                                          {diffEst.toFixed(2)} €
                                        </span>
                                      </>
                                    ) : null}
                                  </div>

                                  <div className="mt-1 text-sm text-gray-400">
                                    Reálna cena:{" "}
                                    <span className="text-white font-semibold">{actVal != null ? `${actVal} €` : "—"}</span>
                                    {diffAct != null ? (
                                      <>
                                        {" • "}vs budget:{" "}
                                        <span className={diffAct > 0 ? "text-red-300 font-semibold" : "text-green-300 font-semibold"}>
                                          {diffAct > 0 ? "+" : ""}
                                          {diffAct.toFixed(2)} €
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="flex flex-col gap-2 min-w-[220px]">
                                  <label className="block">
                                    <div className="text-xs text-gray-500 mb-1">Doplniť reálnu cenu (€)</div>
                                    <input
                                      defaultValue={actVal != null ? String(actVal) : ""}
                                      placeholder="napr. 82.50"
                                      className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          const v = (e.target as HTMLInputElement).value;
                                          saveActualCost(r.id, r.week_start, v);
                                        }
                                      }}
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const input = document.activeElement as HTMLInputElement | null;
                                      // fallback: nájdi input v tejto karte cez DOM nie je super,
                                      // preto radšej ber hodnotu cez prompt, ak user klikne mimo input.
                                      // (UX: Enter v inpute je preferovaný)
                                      const v = window.prompt("Zadaj reálnu cenu (€):", actVal != null ? String(actVal) : "");
                                      if (v != null) saveActualCost(r.id, r.week_start, v);
                                    }}
                                    disabled={financeSavingId === r.id}
                                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm font-semibold hover:bg-zinc-900 disabled:opacity-40"
                                  >
                                    {financeSavingId === r.id ? "Ukladám..." : "Uložiť reálnu cenu"}
                                  </button>

                                  <Link
                                    href={`/profile/${r.week_start}`}
                                    className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm font-semibold hover:bg-zinc-900 text-center"
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

                <div className="mt-4 text-xs text-gray-500">
                  Tip: neskôr vieme doplniť reálne ceny aj per nákup (trip), nie len celkovo za týždeň.
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
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      {children}
    </label>
  );
}