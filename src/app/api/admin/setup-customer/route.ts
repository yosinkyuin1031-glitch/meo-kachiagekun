import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["ooguchiyouhei@gmail.com"];

// 業種別推奨キーワード
const DEFAULT_KEYWORDS: Record<string, string[]> = {
  整体院: ["腰痛", "肩こり", "頭痛", "自律神経", "坐骨神経痛", "ぎっくり腰", "骨盤矯正", "整体", "猫背矯正", "膝痛"],
  鍼灸院: ["腰痛", "肩こり", "頭痛", "自律神経", "鍼灸", "美容鍼", "不妊", "冷え性", "更年���", "眼精疲労"],
  接骨院: ["腰痛", "肩こり", "交通事故", "むち���ち", "スポーツ障害", "骨盤矯正", "膝痛", "接骨院", "捻挫", "肉離れ"],
  治療院: ["腰痛", "肩こり", "頭痛", "自律神経", "坐骨神経痛", "整体", "鍼灸", "骨盤矯正", "冷え性", "不眠"],
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const { email, password, businessName, address, area, category, website, phone, rating, reviews } = await request.json();

    if (!email || !password || !businessName || !area) {
      return NextResponse.json({ error: "メール・パスワード・店舗名・エリアは必須です" }, { status: 400 });
    }

    // 1. アカウント作成（Admin API使用）
    const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (signUpError || !newUser.user) {
      const msg = signUpError?.message || "";
      if (msg.includes("already") || msg.includes("duplicate")) {
        return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
      }
      return NextResponse.json({ error: `アカウント作成に失敗しました: ${msg}` }, { status: 500 });
    }

    const userId = newUser.user.id;

    // 2. ユーザー設定の初期レコード作成
    await supabase.from("meo_user_settings").upsert({
      user_id: userId,
      anthropic_key: "",
      active_clinic_id: "",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // 3. 院情報を登録
    const clinicId = crypto.randomUUID();
    const keywords = DEFAULT_KEYWORDS[category] || DEFAULT_KEYWORDS["整��院"];

    // 住所からエリアを抽出（「〇〇県〇〇市」部分）
    const extractedArea = area;

    await supabase.from("meo_clinics").insert({
      id: clinicId,
      user_id: userId,
      name: businessName,
      area: extractedArea,
      keywords,
      description: "",
      category: category || "整体院",
      categories: [],
      owner_name: "",
      specialty: "",
      note_profile: {},
      urls: {
        homepage: website || "",
        googleMap: "",
        booking: "",
      },
      wordpress: {},
      strengths: "",
      experience: "",
      reviews: "",
      nearest_station: "",
      coverage_areas: [],
    });

    // 4. アクティブ院をセット
    await supabase.from("meo_user_settings").update({
      active_clinic_id: clinicId,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    return NextResponse.json({
      success: true,
      userId,
      clinicId,
      email,
      businessName,
      area: extractedArea,
      keywords,
      message: `${businessName}のアカウントを作成しました`,
    });
  } catch (e) {
    console.error("Customer setup error:", e);
    return NextResponse.json({ error: "セットアップに失敗しました" }, { status: 500 });
  }
}
