import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-3xl font-bold">Fudly</h1>
        <div className="flex flex-col gap-3">
          <Link className="rounded-xl border border-gray-700 px-4 py-3 hover:bg-zinc-900" href="/generate">
            Generátor
          </Link>
          <Link className="rounded-xl border border-gray-700 px-4 py-3 hover:bg-zinc-900" href="/pricing">
            Cenník
          </Link>
          <Link className="rounded-xl border border-gray-700 px-4 py-3 hover:bg-zinc-900" href="/profile">
            Profil
          </Link>
        </div>
      </div>
    </main>
  );
}