import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["ooguchiyouhei@gmail.com"];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 今月のSerpApi使用量（ranking_historyの件数 = API呼び出し数）
    const { count: monthlyApiCalls } = await supabase
      .from("meo_ranking_history")
      .select("*", { count: "exact", head: true })
      .gte("checked_at", monthStart);

    // 全体統計
    const { count: totalUsers } = await supabase
      .from("meo_clinics")
      .select("*", { count: "exact", head: true });

    const { count: totalContents } = await supabase
      .from("meo_contents")
      .select("*", { count: "exact", head: true });

    const { count: totalRankings } = await supabase
      .from("meo_ranking_history")
      .select("*", { count: "exact", head: true });

    const { count: pendingApps } = await supabase
      .from("meo_applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // SerpApi コスト計算（1リクエスト = 1クレジット ≈ 1.5円）
    const estimatedCost = Math.round((monthlyApiCalls || 0) * 1.5);

    return NextResponse.json({
      monthlyApiCalls: monthlyApiCalls || 0,
      estimatedCost,
      totalUsers: totalUsers || 0,
      totalContents: totalContents || 0,
      totalRankings: totalRankings || 0,
      pendingApplications: pendingApps || 0,
    });
  } catch (e) {
    console.error("Usage fetch error:", e);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
