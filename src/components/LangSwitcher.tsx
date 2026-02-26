"use client";

import { useT } from "@/lib/i18n/useT";

export default function LangSwitcher() {
  const { lang, setLang } = useT();

  function Btn({ code, label }: { code: "sk" | "en" | "uk"; label: string }) {
    const active = lang === code;
    return (
      <button
        type="button"
        onClick={() => {
          setLang(code);
          window.location.reload(); // zatiaľ najjednoduchšie aby sa prepli texty všade
        }}
        className={`rounded-full px-3 py-1 text-xs border ${
          active
            ? "bg-white text-black border-white"
            : "bg-black text-white border-gray-700 hover:bg-zinc-900"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Btn code="sk" label="SK" />
      <Btn code="en" label="EN" />
      <Btn code="uk" label="UK" />
    </div>
  );
}