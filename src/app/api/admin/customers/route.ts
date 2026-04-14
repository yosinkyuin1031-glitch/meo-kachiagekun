import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["ooguchiyouhei@gmail.com"];

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    // Service Role で全ユーザーデータを取得
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      return NextResponse.json({ error: "ユーザー取得に失敗しました" }, { status: 500 });
    }

    // 全院情報を取得（service roleでRLSバイパス）
    const { data: clinics } = await supabase.from("meo_clinics").select("*");
    const { data: rankings } = await supabase.from("meo_ranking_history").select("user_id, checked_at, keyword");
    const { data: contents } = await supabase.from("meo_contents").select("user_id, created_at");

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const customers = users.users
      .filter(u => !ADMIN_EMAILS.includes(u.email || ""))
      .map(u => {
        const userClinics = (clinics || []).filter(c => c.user_id === u.id);
        const userRankings = (rankings || []).filter(r => r.user_id === u.id);
        const userContents = (contents || []).filter(c => c.user_id === u.id);
        const monthlyChecks = userRankings.filter(r => r.checked_at >= monthStart);
        // キーワード数で割って実際のチェック回数を算出
        const clinic = userClinics[0];
        const kwCount = clinic?.keywords?.length || 1;
        const checkCount = Math.ceil(monthlyChecks.length / kwCount);
        const lastCheck = userRankings.length > 0
          ? userRankings.sort((a, b) => b.checked_at.localeCompare(a.checked_at))[0].checked_at
          : null;

        return {
          id: u.id,
          email: u.email || "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || null,
          clinic: clinic ? {
            id: clinic.id,
            name: clinic.name,
            area: clinic.area,
            category: clinic.category,
            keywords: clinic.keywords || [],
            strengths: clinic.strengths || "",
            specialty: clinic.specialty || "",
            experience: clinic.experience || "",
            urls: clinic.urls || {},
          } : null,
          stats: {
            monthlyChecks: checkCount,
            totalChecks: userRankings.length,
            totalContents: userContents.length,
            lastCheckAt: lastCheck,
          },
        };
      });

    return NextResponse.json({ customers });
  } catch (e) {
    console.error("Customers fetch error:", e);
    return NextResponse.json({ error: "顧客情報の取得に失敗しました" }, { status: 500 });
  }
}

// 顧客の院情報を管理者が編集
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const { clinicId, updates } = await request.json();
    if (!clinicId) {
      return NextResponse.json({ error: "clinicIdは必須です" }, { status: 400 });
    }

    const { error } = await supabase.from("meo_clinics").update(updates).eq("id", clinicId);
    if (error) {
      return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Customer update error:", e);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
