// src/app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function Page() {
  return (
    <div className="min-h-screen page-invert-bg">
      <Suspense fallback={null}>
        <LoginClient />
      </Suspense>
    </div>
  );
}