"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  language: string;
  intolerances: string;
  avoid: string;
  have: string;
  favorites: string;
};

export default function ProfileSettingsPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState("sk");
  const [intolerances, setIntolerances] = useState("");
  const [avoid, setAvoid] = useState("");
  const [have, setHave] = useState("");
  const [favorites, setFavorites] = useState("");

  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user;
      setEmail(user?.email ?? null);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, language, intolerances, avoid, have, favorites")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMsg("Chyba pri načítaní profilu: " + error.message);
      } else if (data) {
        const p = data as ProfileRow;
        setFullName(p.full_name ?? "");
        setLanguage(p.language ?? "sk");
        setIntolerances(p.intolerances ?? "");
        setAvoid(p.avoid ?? "");
        setHave(p.have ?? "");
        setFavorites(p.favorites ?? "");
      }

      setLoading(false);
    })();
  }, [supabase]);

  async function save() {
    setMsg("");

    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;

    if (!user) {
      setMsg("Najprv sa prihlás.");
      return;
    }

    const payload = {
      user_id: user.id,
      full_name: fullName || null,
      language,
      intolerances,
      avoid,
      have,
      favorites,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });

    if (error) setMsg("Chyba pri ukladaní: " + error.message);
    else setMsg("✅ Uložené.");
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Profil</h1>
            <p className="mt-2 text-gray-300">Ulož si preferencie a potom ich načítaš jedným klikom v generátore.</p>
          </div>

          <div className="text-right">
            <div className="text-sm text-gray-300">
              {email ? (
                <>
                  Prihlásený ako <span className="text-white font-semibold">{email}</span>
                </>
              ) : (
                "Nie si prihlásený"
              )}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Link href="/profile" className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900">
                Späť
              </Link>
              <Link href="/generate" className="rounded-xl bg-white px-4 py-2 text-sm text-black font-semibold hover:bg-gray-200">
                Generátor
              </Link>
            </div>
          </div>
        </header>

        {loading ? <div className="text-sm text-gray-400">Načítavam…</div> : null}

        <section className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Meno (voliteľné)">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="Michal"
              />
            </Field>

            <Field label="Jazyk">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
              >
                <option value="sk">🇸🇰 Slovensky</option>
                <option value="cs">🇨🇿 Česky</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </Field>

            <Field label="❌ Intolerancie / NESMÚ byť použité">
              <input
                value={intolerances}
                onChange={(e) => setIntolerances(e.target.value)}
                className="w-full rounded-xl border border-gray-700 bg-black px-3 py-2 text-white"
                placeholder="laktóza, arašidy"
              />
            </Field>

            <Field label="Vyhnúť sa (mäkká preferencia)">
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

          <div className="mt-6 flex items-center justify-between gap-4">
            <button
              onClick={save}
              className="rounded-xl bg-white px-5 py-3 text-black font-semibold hover:bg-gray-200"
            >
              Uložiť
            </button>

            {msg ? <div className="text-sm text-gray-200">{msg}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm text-gray-300">{label}</div>
      {children}
    </label>
  );
}