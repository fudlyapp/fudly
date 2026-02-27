// src/components/TopNav.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import LangSwitcher from "@/components/LangSwitcher";
import { useT } from "@/lib/i18n/useT";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthState = {
  loading: boolean;
  email: string | null;
};

export default function TopNav() {
  const { t, lang } = useT();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [auth, setAuth] = useState<AuthState>({ loading: true, email: null });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email ?? null;
      if (mounted) setAuth({ loading: false, email });
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      setAuth({ loading: false, email });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  // keď používaš tmavý header, držíme biele logo
  const logoSrc = "/fudly_white.png";

  return (
    <header className="border-b border-gray-800 bg-black/60 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-wide min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-800 bg-black">
              <Image src="/fudly_white.png" alt="Fudly" width={22} height={22} priority unoptimized />
            </span>
            <span className="truncate">Fudly</span>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm text-gray-300">
            <Link className="hover:text-white" href="/generate">
              {t.nav.generator}
            </Link>
            <Link className="hover:text-white" href="/pricing">
              {t.nav.pricing}
            </Link>
            <Link className="hover:text-white" href="/profile">
              {t.nav.profile}
            </Link>
            <Link className="hover:text-white" href="/contact">
              {t.nav.contact}
            </Link>
            <Link className="hover:text-white" href="/legal">
              {t.nav.legal}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* auth buttons */}
          {auth.loading ? null : auth.email ? (
            <>
              <Link
                href="/profile"
                className="hidden sm:inline-flex rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm hover:bg-zinc-900"
              >
                {t.nav.profile}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="hidden sm:inline-flex rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm hover:bg-zinc-900"
              >
                {t.nav.logout}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm hover:bg-zinc-900"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/login?mode=signup"
                className="hidden sm:inline-flex rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-gray-200"
              >
                {/* toto si doplníme do dictu ak chceš, zatiaľ fallback */}
                {lang === "en" ? "Sign up" : lang === "ua" ? "Реєстрація" : "Vytvoriť účet"}
              </Link>
            </>
          )}

          <LangSwitcher />
        </div>
      </div>

      {/* mobile nav */}
      <div className="md:hidden border-t border-gray-900">
        <div className="mx-auto w-full max-w-5xl px-6 py-3 flex items-center justify-between text-sm text-gray-300">
          <Link className="hover:text-white" href="/generate">
            {t.nav.generator}
          </Link>
          <Link className="hover:text-white" href="/pricing">
            {t.nav.pricing}
          </Link>
          <Link className="hover:text-white" href="/profile">
            {t.nav.profile}
          </Link>
          {!auth.loading && !auth.email ? (
            <Link className="hover:text-white" href="/login">
              {t.nav.login}
            </Link>
          ) : (
            <button type="button" onClick={logout} className="hover:text-white">
              {t.nav.logout}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}