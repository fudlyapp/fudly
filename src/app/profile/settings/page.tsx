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

const STYLE_OPTIONS = [
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
  const [msg, setMsg] = useState("");

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

      const { data: sess } = await supabase.auth.getSession();
      const u = sess.session?.user;

      if (!u) {
        setUserId(null);
        setLoading(false);
        return;
      }

      setEmail(u.email ?? null);
      setUserId(u.id);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", u.id)
        .maybeSingle();

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
    if (!userId) return;

    const payload: ProfileRow = {
      user_id: userId,
      full_name: fullName.trim() || null,
      people_default: people.trim() ? Number(people) : null,
      weekly_budget_eur_default: budget.trim() ? Number(budget) : null,
      shopping_trips_default: Number(shoppingTrips),
      repeat_days_default: Number(repeatDays),
      style_default: style,
      intolerances: intolerances.trim() || null,
      avoid: avoid.trim() || null,
      have: have.trim() || null,
      favorites: favorites.trim() || null,
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });

    setMsg(error ? "Chyba pri ukladaní." : "✅ Profil uložený.");
  }

  if (loading) {
    return (
      <main className="min-h-screen p-6 page-invert-bg">
        <div className="mx-auto max-w-4xl text-sm muted">Načítavam…</div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen p-6 page-invert-bg">
        <div className="mx-auto max-w-4xl surface-same-as-nav surface-border rounded-2xl p-6">
          <div className="text-lg font-semibold">Nie si prihlásený</div>
          <p className="mt-2 muted">Pre nastavenia profilu sa prihlás.</p>
          <Link href="/login" className="mt-4 inline-block btn-primary">
            Prihlásiť sa
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 page-invert-bg">
      <div className="mx-auto w-full max-w-4xl space-y-6">

        <header className="surface-same-as-nav surface-border rounded-2xl p-6">
          <div className="text-sm muted">Prihlásený ako</div>
          <div className="font-semibold">{email}</div>
        </header>

        <section className="surface-same-as-nav surface-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Základné údaje</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Meno">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-surface" />
            </Field>

            <Field label="Štýl">
              <select value={style} onChange={(e) => setStyle(e.target.value)} className="input-surface">
                {STYLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="surface-same-as-nav surface-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Preferencie</h2>

          <div className="grid grid-cols-1 gap-4">
            <Field label="Intolerancie">
              <input value={intolerances} onChange={(e) => setIntolerances(e.target.value)} className="input-surface" />
            </Field>

            <Field label="Vyhnúť sa">
              <input value={avoid} onChange={(e) => setAvoid(e.target.value)} className="input-surface" />
            </Field>

            <Field label="Mám doma">
              <input value={have} onChange={(e) => setHave(e.target.value)} className="input-surface" />
            </Field>

            <Field label="Obľúbené">
              <input value={favorites} onChange={(e) => setFavorites(e.target.value)} className="input-surface" />
            </Field>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm muted">{msg}</div>
            <button onClick={save} className="btn-primary">
              Uložiť profil
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm muted">{label}</div>
      {children}
    </label>
  );
}