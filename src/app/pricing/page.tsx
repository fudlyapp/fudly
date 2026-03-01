// src/app/pricing/page.tsx
import { Suspense } from "react";
import PricingClient from "./PricingClient";

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6 page-invert-bg">Načítavam…</div>}>
      <PricingClient />
    </Suspense>
  );
}