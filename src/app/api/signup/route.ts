import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Service Role クライアント（メール確認スキップ + 初期レコード作成用）
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Anon クライアント（サインアップ用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

    // 1. Supabase Auth でサインアップ
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error.message.includes("already registered")) {
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

    // 2. Admin APIでメール確認済みにする（pg直接接続不要）
    await adminSupabase.auth.admin.updateUserById(data.user.id, {
      email_confirm: true,
    });

    // 3. meo_user_settings に初期レコードを作成
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
