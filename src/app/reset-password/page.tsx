//src/app/reset-password/page.tsx
import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function Page() {
  return (
    <div className="min-h-screen page-invert-bg">
      <Suspense fallback={null}>
        <ResetPasswordClient />
      </Suspense>
    </div>
  );
}