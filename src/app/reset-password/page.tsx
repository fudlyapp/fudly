// src/app/reset-password/page.tsx
import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

function Loading() {
  return (
    <main className="min-h-screen page-invert-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl p-6 surface-same-as-nav surface-border">
        <div className="text-sm muted">Načítavam obnovu hesla…</div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen page-invert-bg">
      <Suspense fallback={<Loading />}>
        <ResetPasswordClient />
      </Suspense>
    </div>
  );
}