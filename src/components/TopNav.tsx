// src/components/TopNav.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const SHOW_LANGUAGE_SWITCH = false; // dočasne skryté

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="
        rounded-full px-4 py-2 text-sm font-semibold transition border
        bg-white text-black border-gray-300 hover:bg-gray-100
        dark:bg-black dark:text-gray-200 dark:border-gray-700 dark:hover:bg-zinc-900
        w-full sm:w-auto text-center
      "
    >
      {label}
    </Link>
  );
}

function PrimaryNavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="
        rounded-full px-5 py-2.5 text-sm font-semibold transition border shadow-sm
        bg-black text-white border-black hover:bg-gray-800 hover:shadow
        dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-200
        w-full sm:w-auto text-center
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setAuthLoading(true);
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setEmail(data.session?.user?.email ?? null);
      } catch (e) {
        console.error("TopNav getSession error:", e);
        if (!mounted) return;
        setEmail(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const isLoggedIn = !!email;

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-black/70">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* LOGO + názov */}
        <Link href="/" className="flex items-center gap-3" onClick={closeMobile}>
          <Image
            src="/logo_black.png"
            alt="Fudly"
            width={44}
            height={44}
            className="w-9 h-9 sm:w-11 sm:h-11 block dark:hidden"
            priority
          />
          <Image
            src="/logo_white.png"
            alt="Fudly"
            width={44}
            height={44}
            className="w-9 h-9 sm:w-11 sm:h-11 hidden dark:block"
            priority
          />
          <div className="font-semibold text-lg">Fudly</div>
        </Link>

        {/* DESKTOP MENU */}
        <div className="hidden md:flex items-center gap-2">
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
                  <NavLink href="/faq" label="FAQ" />

                  <div className="w-3" />

                  <NavLink href="/profile" label="Profil" />

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
                  <NavLink href="/faq" label="FAQ" />

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

        {/* MOBILE RIGHT: Theme + Hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-black"
            aria-label="Menu"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* MOBILE MENU PANEL */}
      {mobileOpen ? (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-black/95 backdrop-blur">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-3 flex flex-col gap-2">
            {authLoading ? (
              <div className="text-sm muted">Načítavam…</div>
            ) : isLoggedIn ? (
              <>
                <NavLink href="/generate" label="Generátor" onClick={closeMobile} />
                <NavLink href="/pricing" label="Členstvá" onClick={closeMobile} />
                <NavLink href="/contact" label="Kontakt" onClick={closeMobile} />
                <NavLink href="/docs" label="Dokumenty" onClick={closeMobile} />
                <NavLink href="/faq" label="FAQ" onClick={closeMobile} />
                <NavLink href="/profile" label="Profil" onClick={closeMobile} />

                <button
                  onClick={() => {
                    closeMobile();
                    logout();
                  }}
                  className="
                    rounded-full px-5 py-2.5 text-sm font-semibold transition border shadow-sm
                    bg-black text-white border-black hover:bg-gray-800
                    dark:bg-white dark:text-black dark:border-white dark:hover:bg-gray-200
                    w-full text-center
                  "
                  type="button"
                >
                  Odhlásiť sa
                </button>
              </>
            ) : (
              <>
                <NavLink href="/pricing" label="Členstvá" onClick={closeMobile} />
                <NavLink href="/contact" label="Kontakt" onClick={closeMobile} />
                <NavLink href="/faq" label="FAQ" onClick={closeMobile} />
                <PrimaryNavLink href="/login" label="Prihlásiť sa | Vytvoriť účet" onClick={closeMobile} />
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}