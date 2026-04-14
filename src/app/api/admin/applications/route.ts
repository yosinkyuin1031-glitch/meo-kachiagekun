import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["ooguchiyouhei@gmail.com"];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("meo_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "申込み取得に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ applications: data || [] });
  } catch (e) {
    console.error("Applications fetch error:", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// ステータス更新
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: "IDとステータスは必須です" }, { status: 400 });
    }

    const { error } = await supabase
      .from("meo_applications")
      .update({ status })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Application update error:", e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
