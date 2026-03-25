import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Service Role クライアント（Admin API用 — レート制限なし）
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    // 1. Admin APIでユーザー作成（メール確認済み・レート制限なし）
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        return NextResponse.json(
          { error: "このメールアドレスは既に登録されています" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "アカウントの作成に失敗しました" },
        { status: 500 }
      );
    }

    // 2. meo_user_settings に初期レコードを作成
    await adminSupabase.from("meo_user_settings").upsert(
      {
        user_id: data.user.id,
        anthropic_key: "",
        serp_api_key: "",
        active_clinic_id: "",
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ ok: true, userId: data.user.id });
  } catch (e) {
    console.error("signup error:", e);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
