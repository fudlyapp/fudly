//src/app/profile/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

const STYLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "lacné", label: "💰 Lacné" },
  { value: "rychle", label: "⚡ Rýchle" },
  { value: "vyvazene", label: "🥗 Vyvážené" },
  { value: "vegetarianske", label: "🥬 Vegetariánske" },
  { value: "tradicne", label: "🍲 Tradičné" },
  { value: "exoticke", label: "🍜 Exotické" },
  { value: "fit", label: "🏋️ Fit" },
];

export default function ProfileSettingsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [msg, setMsg] = useState<string>("");

  // form fields
  const [fullName, setFullName] = useState("");

  const [people, setPeople] = useState("");
  const [budget, setBudget] = useState("");
  const [shoppingTrips, setShoppingTrips] = useState("2");
  const [repeatDays, setRepeatDays] = useState("2");
  const [style, setStyle] = useState("lacné");

  const [intolerances, setIntolerances] = useState("");
  const [avoid, setAvoid] = useState("");
  const [have, setHave] = useState("");
  const [favorites, setFavorites] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: sess } = await supabase.auth.getSession();
      const u = sess.session?.user;

      if (!u) {
        setEmail(null);
        setUserId(null);
        setLoading(false);
        return;
      }

      setEmail(u.email ?? null);
      setUserId(u.id);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "user_id, full_name, people_default, weekly_budget_eur_default, shopping_trips_default, repeat_days_default, style_default, intolerances, avoid, have, favorites"
        )
        .eq("user_id", u.id)
        .maybeSingle();

      if (error) {
        setMsg("Chyba pri načítaní profilu: " + error.message);
      }

      const p = (data as ProfileRow) ?? null;

      setFullName(p?.full_name ?? "");
      setPeople(p?.people_default != null ? String(p.people_default) : "");
      setBudget(p?.weekly_budget_eur_default != null ? String(p.weekly_budget_eur_default) : "");
      setShoppingTrips(p?.shopping_trips_default != null ? String(p.shopping_trips_default) : "2");
      setRepeatDays(p?.repeat_days_default != null ? String(p.repeat_days_default) : "2");
      setStyle(p?.style_default ?? "lacné");

      setIntolerances(p?.intolerances ?? "");
      setAvoid(p?.avoid ?? "");
      setHave(p?.have ?? "");
      setFavorites(p?.favorites ?? "");

      setLoading(false);
    })();
  }, [supabase]);

  async function save() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const u = sess.session?.user;

    if (!u) {
      window.location.href = "/login";
      return;
    }

    const payload: ProfileRow = {
      user_id: u.id,
      full_name: fullName.trim() || null,

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
      setMsg("Chyba pri ukladaní: " + error.message);
      return;
    }

    setMsg("✅ Profil uložený.");
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto w-full max-w-4xl text-sm text-gray-400">Načítavam…</div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-800 bg-zinc-900 p-6">
          <div className="text-lg font-semibold">Nie si prihlásený</div>
          <p className="mt-2 text-gray-300">Pre nastavenia profilu sa prihlás.</p>
          <div className="mt-4">
            <Link
              href="/login"
              className="inline-block rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200"
            >
              Prihlásiť sa
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Profil</h1>
            <p className="mt-2 text-gray-300">Ulož si preferencie a načítaj ich jedným klikom v generátore.</p>
          </div>

          <div className="text-right space-y-2">
            <div className="text-sm text-gray-300">
              Prihlásený ako <span className="text-white font-semibold">{email}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Link
                href="/profile"
                className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
              >
                Jedálničky
              </Link>
              <button
                onClick={logout}
                className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
              >
                Odhlásiť sa
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-semibold">Základné údaje</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Meno / prezývka">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="Fudly"
              />
            </Field>

            <Field label="Predvolený štýl">
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                {STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Ľudí">
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
        </section>

        <section className="mt-6 rounded-2xl border border-gray-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-semibold">Preferencie jedla</h2>

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
            <div className="text-sm text-gray-400">{msg || " "}</div>
            <button
              onClick={save}
              className="rounded-xl bg-white px-5 py-3 text-black font-semibold hover:bg-gray-200 transition"
            >
              Uložiť profil
            </button>
          </div>
        </section>
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