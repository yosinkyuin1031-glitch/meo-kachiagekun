import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, APP_URL } from "@/lib/stripe";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // Stripe顧客IDを取得
    const { data: sub } = await supabase
      .from("meo_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json(
        { error: "サブスクリプション情報が見つかりません" },
        { status: 404 }
      );
    }

    // カスタマーポータルセッションを作成
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: APP_URL,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Portal error:", error);
    return NextResponse.json(
      { error: "ポータルの作成に失敗しました" },
      { status: 500 }
    );
  }
}
