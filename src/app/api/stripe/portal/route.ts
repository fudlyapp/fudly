// src/app/api/stripe/portal/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = data.user.id;

    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    const customerId = subRow?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { error: "Nemám stripe_customer_id pre tohto používateľa (najprv vytvor predplatné)." },
        { status: 400 }
      );
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const return_url = `${origin}/pricing`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url,
    });

    return NextResponse.json({ url: portal.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}