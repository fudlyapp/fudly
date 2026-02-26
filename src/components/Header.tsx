"use client";

import Link from "next/link";
import LangSwitcher from "@/components/LangSwitcher";
import { useT } from "@/lib/i18n/useT";

export default function Header() {
  const { t } = useT();

  return (
    <header className="border-b border-gray-800">
      <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold">
            Fudly
          </Link>

          <nav className="flex items-center gap-3">
            <Link href="/generate" className="text-sm text-gray-300 hover:text-white">
              {t.nav.generator}
            </Link>
            <Link href="/pricing" className="text-sm text-gray-300 hover:text-white">
              {t.nav.pricing}
            </Link>
            <Link href="/profile" className="text-sm text-gray-300 hover:text-white">
              {t.nav.profile}
            </Link>
          </nav>
        </div>

        <LangSwitcher />
      </div>
    </header>
  );
}