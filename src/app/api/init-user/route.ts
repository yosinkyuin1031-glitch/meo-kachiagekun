import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // meo_user_settings に初期レコードを作成（既に存在する場合はスキップ）
    await supabase
      .from("meo_user_settings")
      .upsert(
        {
          user_id: user.id,
          anthropic_key: "",
          serp_api_key: "",
          active_clinic_id: "",
        },
        { onConflict: "user_id" }
      );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Init user error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "ユーザー初期化に失敗しました。しばらくしてから再度お試しください。" }, { status: 500 });
  }
}
