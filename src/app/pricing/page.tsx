// src/app/pricing/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Členstvá",
};

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6 page-invert-bg">Načítavam…</div>}>
      <PricingClient />
    </Suspense>
  );
}