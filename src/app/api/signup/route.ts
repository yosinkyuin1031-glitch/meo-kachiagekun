import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

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

    // 2. DBで直接メール確認済みにする（email_confirmed_at を設定）
    await pool.query(
      `UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1`,
      [data.user.id]
    );

    // 3. meo_user_settings に初期レコードを作成
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
  } catch {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
