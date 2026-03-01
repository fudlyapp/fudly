// src/app/pricing/page.tsx
import { Suspense } from "react";
import PricingClient from "./PricingClient";

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 page-invert-bg">
          <div className="mx-auto w-full max-w-6xl">
            <div className="rounded-2xl p-4 surface-same-as-nav surface-border text-sm muted">
              Načítavam…
            </div>
          </div>
        </main>
      }
    >
      <PricingClient />
    </Suspense>
  );
}