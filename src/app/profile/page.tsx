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

export default function ProfilePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MealPlanRow[]>([]);
  const [error, setError] = useState<string>("");

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

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Profil</h1>
            <p className="mt-2 text-gray-300">Tvoje uložené jedálničky podľa týždňov.</p>
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
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Uložené týždne</h2>

            {loading ? <div className="mt-4 text-sm text-gray-400">Načítavam…</div> : null}
            {error ? <div className="mt-4 text-sm text-red-300">Chyba: {error}</div> : null}

            {!loading && !error && rows.length === 0 ? (
              <div className="mt-4 text-gray-300">
                Zatiaľ nemáš uložený žiadny jedálniček. Choď do{" "}
                <Link className="underline" href="/generate">
                  Generátora
                </Link>{" "}
                a ulož si ho.
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-4">
              {rows.map((r) => {
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
                          {bud ? `• Budget: ${bud} €` : ""}{" "}
                          {est ? `• Odhad: ${est} €` : ""}
                        </div>
                      </div>
                      <div className="text-sm text-gray-400">Otvor</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}