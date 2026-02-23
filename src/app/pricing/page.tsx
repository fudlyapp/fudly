// src/app/pricing/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Cenník | Fudly",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Fudly</div>
            <h1 className="mt-2 text-3xl font-bold">Cenník</h1>
            <p className="mt-2 text-gray-300">
              Členstvá a čo obsahujú. (Platby doplníme v ďalšom kroku.)
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/generate"
              className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
            >
              Generátor
            </Link>
            <Link
              href="/profile"
              className="rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm hover:bg-zinc-900"
            >
              Profil
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="text-lg font-semibold">Basic</div>
            <div className="mt-1 text-sm text-gray-300">
              Platené členstvo • 3 generovania / týždeň
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-200">
              <li>• Generovanie jedálničkov + nákupov</li>
              <li>• Uložené plány a nákupy v profile</li>
              <li>• Predvolené preferencie</li>
              <li>• Štýly: Lacné, Rýchle, Vyvážené, Vegetariánske</li>
            </ul>

            <div className="mt-6 text-xs text-gray-500">
              Kalórie a štýly Fit/Tradičné/Exotické budú v Plus.
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-zinc-900 p-6">
            <div className="text-lg font-semibold">Plus</div>
            <div className="mt-1 text-sm text-gray-300">
              Platené členstvo • 5 generovaní / týždeň
            </div>

            <ul className="mt-4 space-y-2 text-sm text-gray-200">
              <li>• Všetko z Basic</li>
              <li>• Kalórie (prehľad + filtrovanie)</li>
              <li>• Štýly: Fit, Tradičné, Exotické</li>
              <li>• Vyšší limit generovania</li>
            </ul>

            <div className="mt-6 text-xs text-gray-500">
              Platby a aktivácia členstva doplníme v ďalšej fáze.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}