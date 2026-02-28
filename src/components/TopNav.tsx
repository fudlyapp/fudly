// src/components/TopNav.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const SHOW_LANGUAGE_SWITCH = false; // dočasne skryté

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="
        rounded-full px-4 py-2 text-sm font-semibold transition border
        bg-white text-black border-gray-300 hover:bg-gray-100
        dark:bg-black dark:text-gray-200 dark:border-gray-700 dark:hover:bg-zinc-900
      "
    >
      {label}
    </Link>
  );
}

function PrimaryNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="
        rounded-full px-5 py-2.5 text-sm font-semibold transition border shadow-sm
        bg-black text-white border-black hover:bg-gray-800 hover:shadow
        dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-200
      "
    >
      {label}
    </Link>
  );
}

export default function TopNav() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  const isLoggedIn = !!email;

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-black/70">
      <div className="mx-auto w-full max-w-6xl px-6 py-3 flex items-center justify-between gap-4">
        {/* LOGO + názov */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo_black.png"
            alt="Fudly"
            width={44}
            height={44}
            className="w-11 h-11 block dark:hidden"
            priority
          />
          <Image
            src="/logo_white.png"
            alt="Fudly"
            width={44}
            height={44}
            className="w-11 h-11 hidden dark:block"
            priority
          />
          <div className="font-semibold text-lg">Fudly</div>
        </Link>

        {/* MENU */}
        <div className="flex items-center gap-2">
          {authLoading ? (
            <div className="text-xs text-gray-500 px-3 dark:text-gray-400">…</div>
          ) : (
            <>
              {isLoggedIn ? (
                <>
                  <NavLink href="/generate" label="Generátor" />
                  <NavLink href="/pricing" label="Členstvá" />
                  <NavLink href="/contact" label="Kontakt" />
                  <NavLink href="/docs" label="Dokumenty" />

                  <div className="w-3" />

                  <NavLink href="/profile" label="Profil" />

                  {/* CTA: Odhlásiť sa (inverted oproti ostatným) */}
                  <button
                    onClick={logout}
                    className="
                      rounded-full px-5 py-2.5 text-sm font-semibold transition border shadow-sm
                      bg-black text-white border-black hover:bg-gray-800
                      dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-200
                    "
                    type="button"
                  >
                    Odhlásiť sa
                  </button>
                </>
              ) : (
                <>
                  <NavLink href="/pricing" label="Členstvá" />
                  <NavLink href="/contact" label="Kontakt" />

                  {/* CTA: Prihlásiť sa */}
                  <PrimaryNavLink href="/login" label="Prihlásiť sa | Vytvoriť účet" />
                </>
              )}

              {SHOW_LANGUAGE_SWITCH ? (
                <div className="ml-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-black dark:text-gray-300">
                  Jazyk
                </div>
              ) : null}

              <div className="ml-1">
                <ThemeToggle />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}