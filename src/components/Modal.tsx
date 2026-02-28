"use client";

import Link from "next/link";

type ModalAction =
  | { label: string; onClick: () => void; variant?: "primary" | "secondary" }
  | { label: string; href: string; variant?: "primary" | "secondary" };

export default function Modal({
  open,
  title,
  message,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  actions?: ModalAction[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-zinc-950 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-white">{title}</div>
            {message ? <div className="mt-2 text-sm text-gray-200 whitespace-pre-wrap">{message}</div> : null}
          </div>

          <button
            onClick={onClose}
            className="shrink-0 rounded-xl border border-gray-700 bg-black px-3 py-2 text-sm hover:bg-zinc-900"
            type="button"
          >
            Zavrieť
          </button>
        </div>

        {actions?.length ? (
          <div className="mt-5 flex flex-wrap gap-2 justify-end">
            {actions.map((a, i) => {
              const cls =
                a.variant === "primary"
                  ? "rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200"
                  : "rounded-xl border border-gray-700 bg-black px-4 py-2 text-sm font-semibold hover:bg-zinc-900";

              if ("href" in a) {
                return (
                  <Link key={i} href={a.href} className={cls} onClick={onClose}>
                    {a.label}
                  </Link>
                );
              }

              return (
                <button
                  key={i}
                  type="button"
                  className={cls}
                  onClick={() => {
                    a.onClick();
                    onClose();
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}