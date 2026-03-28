import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. サインアップ（メール確認はSupabase側で無効化済み）
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error?.message?.includes("already registered")) {
        return NextResponse.json(
          { error: "このメールアドレスは既に登録されています" },
          { status: 400 }
        );
      }
      // ユーザー向けに分かりやすいメッセージに変換
      let userMessage = "アカウントの作成に失敗しました。もう一度お試しください。";
      if (error?.message?.includes("rate limit") || error?.message?.includes("too many")) {
        userMessage = "しばらく時間をおいてから、もう一度お試しください。";
      } else if (error?.message?.includes("invalid") && error?.message?.includes("email")) {
        userMessage = "メールアドレスの形式が正しくありません。正しいメールアドレスを入力してください。";
      } else if (error?.message?.includes("password")) {
        userMessage = "パスワードは6文字以上で入力してください。";
      }
      return NextResponse.json({ error: userMessage }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "アカウントの作成に失敗しました。もう一度お試しください。" },
        { status: 500 }
      );
    }

    // 2. meo_user_settings に初期レコードを作成
    await supabase.from("meo_user_settings").upsert(
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
      { error: "サーバーで問題が発生しました。しばらく時間をおいてから、もう一度お試しください。" },
      { status: 500 }
    );
  }
}
