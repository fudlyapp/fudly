// src/components/TopNavGate.tsx
"use client";

import TopNav from "./TopNav";

export default function TopNavGate({ children }: { children?: React.ReactNode }) {
  // Momentálne len wrapper kvôli spätnej kompatibilite
  return (
    <>
      <TopNav />
      {children ?? null}
    </>
  );
}