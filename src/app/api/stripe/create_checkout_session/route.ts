import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  // Pozn.: typ apiVersion v Stripe balíku býva “string literal”.
  // Keď ti TypeScript nadáva, nechaj `as any`.
  return new Stripe(key, { apiVersion: "2026-01-28.clover" as any });
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe nie je nakonfigurovaný (chýba STRIPE_SECRET_KEY)." },
        { status: 500 }
      );
    }

    // TODO: sem pôjde tvoja logika na vytvorenie checkout session
    // (priceId, customer, successUrl/cancelUrl, metadata user_id, atď.)

    return NextResponse.json(
      { error: "Not implemented yet" },
      { status: 501 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}