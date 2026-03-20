import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function getBearer(req: Request) {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

export async function POST(req: Request) {
  try {
    const token = getBearer(req);

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const authClient = createSupabaseAdminClient();
    const { data: userRes, error: userErr } = await authClient.auth.getUser(token);

    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userId = userRes.user.id;
    const supabase = createSupabaseAdminClient();

    const { data: row, error: rowErr } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id,stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (rowErr) {
      return NextResponse.json(
        { error: rowErr.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    let customerId: string | null = row?.stripe_customer_id ?? null;
    const subscriptionId: string | null = row?.stripe_subscription_id ?? null;

    if (!customerId && subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const c = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

      if (c) {
        customerId = c;

        await supabase
          .from("subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", userId);
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Missing stripe_customer_id. Buy a plan first." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const origin = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin
    ).replace(/\/$/, "");

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/pricing?portal=1`,
    });

    return NextResponse.json(
      { url: session.url },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}