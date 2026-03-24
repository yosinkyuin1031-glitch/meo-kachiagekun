import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = await createClient();

    // meo_user_settings に初期レコードを作成（既に存在する場合はスキップ）
    await supabase
      .from("meo_user_settings")
      .upsert(
        {
          user_id: userId,
          anthropic_key: "",
          serp_api_key: "",
          active_clinic_id: "",
        },
        { onConflict: "user_id" }
      );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
