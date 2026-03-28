import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, getPriceId, APP_URL } from "@/lib/stripe";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 既存のStripe顧客を検索
    const { data: existingSub } = await supabase
      .from("meo_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    let customerId = existingSub?.stripe_customer_id;

    // 新規顧客を作成
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // meo_subscriptions にレコード作成
      await supabase.from("meo_subscriptions").upsert(
        {
          user_id: user.id,
          stripe_customer_id: customerId,
          status: "inactive",
        },
        { onConflict: "user_id" }
      );
    }

    // Checkout Session 作成（月額1,980円）
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: getPriceId(),
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}?subscription=success`,
      cancel_url: `${APP_URL}?subscription=canceled`,
      metadata: {
        supabase_user_id: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "決済ページの作成に失敗しました。しばらくしてから再度お試しください。" },
      { status: 500 }
    );
  }
}
