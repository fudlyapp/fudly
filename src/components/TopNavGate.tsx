"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";

export default function TopNavGate() {
  const pathname = usePathname();

  // Na homepage nechceme nič okrem hero sekcie
  if (pathname === "/") return null;

  return <TopNav />;
}