import { createClient } from "@/lib/supabase/client";
import { ClinicProfile, AppSettings, BusinessProfile, GeneratedContent, SearchConsoleSettings, GbpMaterialImage, ChecklistItem } from "./types";
import { RankingHistory } from "./ranking-types";

// ─── ヘルパー ────────────────────────────────────
function supabase() {
  return createClient();
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) throw new Error("未認証");
  return user.id;
}

// ─── 共通設定（APIキー・アクティブ院） ──────────
export async function getSettings(): Promise<AppSettings> {
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) {
      return {
        anthropicKey: data.anthropic_key || "",
        activeClinicId: data.active_clinic_id || "",
      };
    }
  } catch {
    // 未認証時など
  }
  return { anthropicKey: "", activeClinicId: "" };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const userId = await getUserId();
  await supabase()
    .from("meo_user_settings")
    .upsert({
      user_id: userId,
      anthropic_key: settings.anthropicKey,
      active_clinic_id: settings.activeClinicId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
}

// ─── 院リスト ────────────────────────────────
export async function getClinics(): Promise<ClinicProfile[]> {
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_clinics")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!data) return [];
    return data.map(dbClinicToProfile);
  } catch {
    return [];
  }
}

function dbClinicToProfile(row: Record<string, unknown>): ClinicProfile {
  return {
    id: row.id as string,
    name: (row.name as string) || "",
    area: (row.area as string) || "",
    keywords: (row.keywords as string[]) || [],
    description: (row.description as string) || "",
    category: (row.category as string) || "整体院",
    categories: (row.categories as string[]) || undefined,
    ownerName: (row.owner_name as string) || undefined,
    specialty: (row.specialty as string) || undefined,
    noteProfile: row.note_profile && Object.keys(row.note_profile as object).length > 0 ? row.note_profile as ClinicProfile["noteProfile"] : undefined,
    urls: row.urls && Object.keys(row.urls as object).length > 0 ? row.urls as ClinicProfile["urls"] : undefined,
    wordpress: row.wordpress && Object.keys(row.wordpress as object).length > 0 ? row.wordpress as ClinicProfile["wordpress"] : undefined,
    strengths: (row.strengths as string) || undefined,
    experience: (row.experience as string) || undefined,
    reviews: (row.reviews as string) || undefined,
    nearestStation: (row.nearest_station as string) || undefined,
    coverageAreas: (row.coverage_areas as string[]) || undefined,
  };
}

export async function saveClinics(clinics: ClinicProfile[]): Promise<void> {
  const userId = await getUserId();
  // 全削除して再挿入
  await supabase().from("meo_clinics").delete().eq("user_id", userId);
  if (clinics.length === 0) return;
  const rows = clinics.map((c) => ({
    id: c.id,
    user_id: userId,
    name: c.name,
    area: c.area,
    keywords: c.keywords,
    description: c.description,
    category: c.category,
    categories: c.categories || [],
    owner_name: c.ownerName || "",
    specialty: c.specialty || "",
    note_profile: c.noteProfile || {},
    urls: c.urls || {},
    wordpress: c.wordpress || {},
    strengths: c.strengths || "",
    experience: c.experience || "",
    reviews: c.reviews || "",
    nearest_station: c.nearestStation || "",
    coverage_areas: c.coverageAreas || [],
  }));
  await supabase().from("meo_clinics").insert(rows);
}

export async function addClinic(clinic: ClinicProfile): Promise<void> {
  const userId = await getUserId();
  await supabase().from("meo_clinics").insert({
    id: clinic.id,
    user_id: userId,
    name: clinic.name,
    area: clinic.area,
    keywords: clinic.keywords,
    description: clinic.description,
    category: clinic.category,
    categories: clinic.categories || [],
    owner_name: clinic.ownerName || "",
    specialty: clinic.specialty || "",
    note_profile: clinic.noteProfile || {},
    urls: clinic.urls || {},
    wordpress: clinic.wordpress || {},
    strengths: clinic.strengths || "",
    experience: clinic.experience || "",
    reviews: clinic.reviews || "",
    nearest_station: clinic.nearestStation || "",
    coverage_areas: clinic.coverageAreas || [],
  });
}

export async function updateClinic(id: string, updates: Partial<ClinicProfile>): Promise<void> {
  const userId = await getUserId();
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.area !== undefined) dbUpdates.area = updates.area;
  if (updates.keywords !== undefined) dbUpdates.keywords = updates.keywords;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.categories !== undefined) dbUpdates.categories = updates.categories;
  if (updates.ownerName !== undefined) dbUpdates.owner_name = updates.ownerName;
  if (updates.specialty !== undefined) dbUpdates.specialty = updates.specialty;
  if (updates.noteProfile !== undefined) dbUpdates.note_profile = updates.noteProfile || {};
  if (updates.urls !== undefined) dbUpdates.urls = updates.urls || {};
  if (updates.wordpress !== undefined) dbUpdates.wordpress = updates.wordpress || {};
  if (updates.strengths !== undefined) dbUpdates.strengths = updates.strengths;
  if (updates.experience !== undefined) dbUpdates.experience = updates.experience;
  if (updates.reviews !== undefined) dbUpdates.reviews = updates.reviews;
  if (updates.nearestStation !== undefined) dbUpdates.nearest_station = updates.nearestStation;
  if (updates.coverageAreas !== undefined) dbUpdates.coverage_areas = updates.coverageAreas;

  await supabase()
    .from("meo_clinics")
    .update(dbUpdates)
    .eq("id", id)
    .eq("user_id", userId);
}

export async function deleteClinic(id: string): Promise<void> {
  const userId = await getUserId();
  await supabase().from("meo_clinics").delete().eq("id", id).eq("user_id", userId);
}

export async function getActiveClinic(): Promise<ClinicProfile | null> {
  const settings = await getSettings();
  const clinics = await getClinics();
  if (!settings.activeClinicId && clinics.length > 0) {
    return clinics[0];
  }
  return clinics.find((c) => c.id === settings.activeClinicId) || clinics[0] || null;
}

// ─── 統合プロフィール（ContentGenerator用） ─────
export async function getBusinessProfile(): Promise<BusinessProfile> {
  const settings = await getSettings();
  const clinic = await getActiveClinic();
  if (!clinic) {
    return { name: "", area: "", keywords: [], description: "", category: "整体院", anthropicKey: settings.anthropicKey };
  }
  return {
    name: clinic.name,
    area: clinic.area,
    nearestStation: clinic.nearestStation,
    coverageAreas: clinic.coverageAreas,
    keywords: clinic.keywords,
    description: clinic.description,
    category: clinic.category,
    anthropicKey: settings.anthropicKey,
    ownerName: clinic.ownerName,
    specialty: clinic.specialty,
    noteProfile: clinic.noteProfile,
    urls: clinic.urls,
    wordpress: clinic.wordpress,
    strengths: clinic.strengths,
    experience: clinic.experience,
    reviews: clinic.reviews,
  };
}

export async function getProfile(): Promise<BusinessProfile> {
  return getBusinessProfile();
}

export async function saveProfile(profile: BusinessProfile): Promise<void> {
  const settings = await getSettings();
  settings.anthropicKey = profile.anthropicKey;
  await saveSettings(settings);

  const clinic = await getActiveClinic();
  if (clinic) {
    await updateClinic(clinic.id, {
      name: profile.name,
      area: profile.area,
      keywords: profile.keywords,
      description: profile.description,
      category: profile.category,
      wordpress: profile.wordpress,
    });
  }
}

// ─── 生成コンテンツ ──────────────────────────
export async function getContents(): Promise<GeneratedContent[]> {
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_contents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!data) return [];
    return data.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title || "",
      content: row.content || "",
      keyword: row.keyword || "",
      createdAt: row.created_at,
      clinicId: row.clinic_id || undefined,
      wpPostId: row.wp_post_id || undefined,
      wpPostUrl: row.wp_post_url || undefined,
      notePostUrl: row.note_post_url || undefined,
    }));
  } catch {
    return [];
  }
}

export async function saveContent(content: GeneratedContent): Promise<void> {
  const userId = await getUserId();
  await supabase().from("meo_contents").insert({
    id: content.id,
    user_id: userId,
    type: content.type,
    title: content.title,
    content: content.content,
    keyword: content.keyword,
    clinic_id: content.clinicId || "",
    wp_post_id: content.wpPostId || null,
    wp_post_url: content.wpPostUrl || null,
    note_post_url: content.notePostUrl || null,
    created_at: content.createdAt,
  });
}

export async function updateContent(id: string, updates: Partial<GeneratedContent>): Promise<void> {
  const userId = await getUserId();
  const dbUpdates: Record<string, unknown> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.wpPostId !== undefined) dbUpdates.wp_post_id = updates.wpPostId;
  if (updates.wpPostUrl !== undefined) dbUpdates.wp_post_url = updates.wpPostUrl;
  if (updates.notePostUrl !== undefined) dbUpdates.note_post_url = updates.notePostUrl;

  await supabase()
    .from("meo_contents")
    .update(dbUpdates)
    .eq("id", id)
    .eq("user_id", userId);
}

export async function deleteContent(id: string): Promise<void> {
  const userId = await getUserId();
  await supabase()
    .from("meo_contents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
}

// ─── キーワード別の既存コンテンツチェック ─────
export async function getContentsByKeyword(keyword: string): Promise<GeneratedContent[]> {
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_contents")
      .select("*")
      .eq("user_id", userId)
      .eq("keyword", keyword)
      .order("created_at", { ascending: false });

    if (!data) return [];
    return data.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title || "",
      content: row.content || "",
      keyword: row.keyword || "",
      createdAt: row.created_at,
      clinicId: row.clinic_id || undefined,
      wpPostId: row.wp_post_id || undefined,
      wpPostUrl: row.wp_post_url || undefined,
      notePostUrl: row.note_post_url || undefined,
    }));
  } catch {
    return [];
  }
}

// ─── 生成フィードバック ──────────────────────

export interface GenerationFeedback {
  id: string;
  contentId: string;
  type: "good" | "bad" | "edit";
  originalContent: string;
  editedContent?: string;
  note?: string;
  createdAt: string;
}

export async function getFeedbacks(): Promise<GenerationFeedback[]> {
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_feedbacks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!data) return [];
    return data.map((row) => ({
      id: row.id,
      contentId: row.content_id,
      type: row.type,
      originalContent: row.original_content,
      editedContent: row.edited_content || undefined,
      note: row.note || undefined,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

export async function saveFeedback(feedback: GenerationFeedback): Promise<void> {
  const userId = await getUserId();
  await supabase().from("meo_feedbacks").insert({
    id: feedback.id,
    user_id: userId,
    content_id: feedback.contentId,
    type: feedback.type,
    original_content: feedback.originalContent,
    edited_content: feedback.editedContent || null,
    note: feedback.note || null,
    created_at: feedback.createdAt,
  });
}

// ─── MEOランキング履歴 ──────────────────────────
export async function getRankingHistory(): Promise<RankingHistory[]> {
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_ranking_history")
      .select("*")
      .eq("user_id", userId)
      .order("checked_at", { ascending: false });

    if (!data) return [];
    return data.map((row) => ({
      id: row.id,
      keyword: row.keyword,
      rank: row.rank,
      businessName: row.business_name,
      checkedAt: row.checked_at,
      topThree: row.top_three || [],
    }));
  } catch {
    return [];
  }
}

export async function addRankingHistory(entries: RankingHistory[]): Promise<void> {
  const userId = await getUserId();
  const rows = entries.map((e) => ({
    id: e.id,
    user_id: userId,
    keyword: e.keyword,
    rank: e.rank,
    business_name: e.businessName || "",
    top_three: e.topThree || [],
    checked_at: e.checkedAt,
  }));
  await supabase().from("meo_ranking_history").insert(rows);
}

export async function getSerpApiKey(): Promise<string> {
  const settings = await getSettings();
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_user_settings")
      .select("serp_api_key")
      .eq("user_id", userId)
      .single();
    return data?.serp_api_key || "";
  } catch {
    return "";
  }
}

export async function saveSerpApiKey(key: string): Promise<void> {
  const userId = await getUserId();
  await supabase()
    .from("meo_user_settings")
    .upsert({
      user_id: userId,
      serp_api_key: key,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
}

// ─── Google Search Console設定 ──────────────────
export async function getSearchConsoleSettings(): Promise<SearchConsoleSettings | null> {
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_search_console_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!data) return null;
    return {
      clientId: data.client_id || "",
      clientSecret: data.client_secret || "",
      accessToken: data.access_token || undefined,
      refreshToken: data.refresh_token || undefined,
      tokenExpiry: data.token_expiry || undefined,
      siteUrl: data.site_url || undefined,
      siteName: data.site_name || undefined,
    };
  } catch {
    return null;
  }
}

export async function saveSearchConsoleSettings(settings: SearchConsoleSettings): Promise<void> {
  const userId = await getUserId();
  await supabase()
    .from("meo_search_console_settings")
    .upsert({
      user_id: userId,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      access_token: settings.accessToken || null,
      refresh_token: settings.refreshToken || null,
      token_expiry: settings.tokenExpiry || null,
      site_url: settings.siteUrl || null,
      site_name: settings.siteName || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
}

export async function clearSearchConsoleSettings(): Promise<void> {
  const userId = await getUserId();
  await supabase()
    .from("meo_search_console_settings")
    .delete()
    .eq("user_id", userId);
}

// ─── GBP素材画像ライブラリ ──────────────────────
export async function getGbpImages(): Promise<GbpMaterialImage[]> {
  try {
    const userId = await getUserId();
    const { data } = await supabase()
      .from("meo_gbp_images")
      .select("*")
      .eq("user_id", userId)
      .order("added_at", { ascending: false });

    if (!data) return [];

    // 各画像のsigned URLを取得
    const images: GbpMaterialImage[] = [];
    for (const row of data) {
      let dataUrl = "";
      if (row.storage_path) {
        const { data: urlData } = await supabase()
          .storage.from("meo-gbp-images")
          .createSignedUrl(row.storage_path, 3600);
        dataUrl = urlData?.signedUrl || "";
      }
      images.push({
        id: row.id,
        category: row.category as GbpMaterialImage["category"],
        dataUrl,
        name: row.name || "",
        addedAt: row.added_at,
      });
    }
    return images;
  } catch {
    return [];
  }
}

export async function saveGbpImage(image: GbpMaterialImage): Promise<void> {
  const userId = await getUserId();

  // dataUrlからBlobに変換してStorageにアップロード
  let storagePath = "";
  if (image.dataUrl && image.dataUrl.startsWith("data:")) {
    const response = await fetch(image.dataUrl);
    const blob = await response.blob();
    storagePath = `${userId}/${image.id}.jpg`;
    await supabase()
      .storage.from("meo-gbp-images")
      .upload(storagePath, blob, { contentType: "image/jpeg", upsert: true });
  }

  await supabase().from("meo_gbp_images").insert({
    id: image.id,
    user_id: userId,
    category: image.category,
    storage_path: storagePath,
    name: image.name,
    added_at: image.addedAt,
  });
}

export async function deleteGbpImage(id: string): Promise<void> {
  const userId = await getUserId();

  // Storage上のファイルも削除
  const { data } = await supabase()
    .from("meo_gbp_images")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (data?.storage_path) {
    await supabase().storage.from("meo-gbp-images").remove([data.storage_path]);
  }

  await supabase().from("meo_gbp_images").delete().eq("id", id).eq("user_id", userId);
}

// ─── AI学習コンテキスト（蓄積データ活用）──────────

export interface ContentInsight {
  pastTitles: string[];
  goodContentPatterns: string[];
  badContentPatterns: string[];
  totalGoodCount: number;
  totalBadCount: number;
}

export interface RankingInsight {
  keyword: string;
  latestRank: number | null;
  previousRank: number | null;
  trend: "up" | "down" | "stable" | "unknown";
  changeAmount: number;
  topCompetitors: string[];
}

// キーワードの過去コンテンツと評価傾向を取得
export async function getContentInsight(keyword: string): Promise<ContentInsight> {
  try {
    const userId = await getUserId();

    // 過去コンテンツのタイトル一覧
    const { data: contents } = await supabase()
      .from("meo_contents")
      .select("id, title, type, content")
      .eq("user_id", userId)
      .eq("keyword", keyword)
      .order("created_at", { ascending: false })
      .limit(20);

    const pastTitles = (contents || []).map((c) => c.title).filter(Boolean);

    // フィードバック情報を取得
    const contentIds = (contents || []).map((c) => c.id);
    let goodContentPatterns: string[] = [];
    let badContentPatterns: string[] = [];
    let totalGoodCount = 0;
    let totalBadCount = 0;

    if (contentIds.length > 0) {
      const { data: feedbacks } = await supabase()
        .from("meo_feedbacks")
        .select("type, content_id, note, original_content")
        .eq("user_id", userId)
        .in("content_id", contentIds);

      if (feedbacks) {
        totalGoodCount = feedbacks.filter((f) => f.type === "good").length;
        totalBadCount = feedbacks.filter((f) => f.type === "bad").length;

        // 良い評価のコンテンツから冒頭150文字を抽出
        const goodIds = feedbacks.filter((f) => f.type === "good").map((f) => f.content_id);
        goodContentPatterns = (contents || [])
          .filter((c) => goodIds.includes(c.id))
          .map((c) => c.content?.substring(0, 150) || "")
          .filter(Boolean)
          .slice(0, 3);

        // 悪い評価のメモを抽出
        badContentPatterns = feedbacks
          .filter((f) => f.type === "bad" && f.note)
          .map((f) => f.note as string)
          .slice(0, 3);
      }
    }

    return { pastTitles, goodContentPatterns, badContentPatterns, totalGoodCount, totalBadCount };
  } catch {
    return { pastTitles: [], goodContentPatterns: [], badContentPatterns: [], totalGoodCount: 0, totalBadCount: 0 };
  }
}

// キーワードの順位変動を取得
export async function getRankingInsight(keyword: string): Promise<RankingInsight> {
  try {
    const userId = await getUserId();

    const { data } = await supabase()
      .from("meo_ranking_history")
      .select("rank, checked_at, top_three")
      .eq("user_id", userId)
      .eq("keyword", keyword)
      .order("checked_at", { ascending: false })
      .limit(2);

    if (!data || data.length === 0) {
      return { keyword, latestRank: null, previousRank: null, trend: "unknown", changeAmount: 0, topCompetitors: [] };
    }

    const latestRank = data[0].rank;
    const previousRank = data.length > 1 ? data[1].rank : null;
    const topCompetitors = ((data[0].top_three || []) as { name: string }[]).map((t) => t.name).filter(Boolean);

    let trend: "up" | "down" | "stable" | "unknown" = "unknown";
    let changeAmount = 0;

    if (latestRank !== null && previousRank !== null) {
      changeAmount = previousRank - latestRank; // 正=上昇、負=下降
      if (changeAmount > 0) trend = "up";
      else if (changeAmount < 0) trend = "down";
      else trend = "stable";
    }

    return { keyword, latestRank, previousRank, trend, changeAmount, topCompetitors };
  } catch {
    return { keyword, latestRank: null, previousRank: null, trend: "unknown", changeAmount: 0, topCompetitors: [] };
  }
}

// ─── チェックリスト（院ごと）────────────────────
export async function getChecklist(clinicId?: string): Promise<ChecklistItem[]> {
  try {
    const userId = await getUserId();
    const clinic = clinicId || (await getActiveClinic())?.id || "";
    if (!clinic) return getDefaultChecklist();

    const { data } = await supabase()
      .from("meo_checklists")
      .select("items")
      .eq("user_id", userId)
      .eq("clinic_id", clinic)
      .single();

    if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
      return data.items as ChecklistItem[];
    }
    return getDefaultChecklist();
  } catch {
    return getDefaultChecklist();
  }
}

export async function saveChecklist(items: ChecklistItem[], clinicId?: string): Promise<void> {
  const userId = await getUserId();
  const clinic = clinicId || (await getActiveClinic())?.id || "";
  if (!clinic) return;

  await supabase()
    .from("meo_checklists")
    .upsert({
      user_id: userId,
      clinic_id: clinic,
      items,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,clinic_id" });
}

function getDefaultChecklist(): ChecklistItem[] {
  return [
    { id: "gbp-1", category: "GBP最適化", title: "NAP情報（店名・住所・電話）を正確に登録", description: "ウェブサイト・ポータルサイト・SNSすべてで完全一致させる", priority: "high", completed: false },
    { id: "gbp-2", category: "GBP最適化", title: "営業時間を正確に設定", description: "営業中の店舗がアルゴリズムで優遇される", priority: "high", completed: false },
    { id: "gbp-3", category: "GBP最適化", title: "ビジネスの説明文を最適化", description: "750文字以内で地域名+症状キーワードを自然に含める", priority: "high", completed: false },
    { id: "gbp-4", category: "GBP最適化", title: "メインカテゴリを最適に設定", description: "業態に合ったカテゴリを1つ選択（整体院・鍼灸院等）", priority: "high", completed: false },
    { id: "gbp-5", category: "GBP最適化", title: "追加カテゴリを設定（最大9つ）", description: "関連カテゴリを追加（カイロ・マッサージ・リハビリ等）", priority: "medium", completed: false },
    { id: "gbp-6", category: "GBP最適化", title: "サービス内容を詳細に登録", description: "施術メニュー・料金・所要時間を細かく設定", priority: "medium", completed: false },
    { id: "gbp-7", category: "GBP最適化", title: "予約リンク・ウェブサイトURLを設定", description: "予約導線を整備する", priority: "high", completed: false },
    { id: "gbp-8", category: "GBP最適化", title: "Q&Aを自分で投稿・回答（5件以上）", description: "駐車場・予約・保険など よくある質問をFAQ化", priority: "medium", completed: false },
    { id: "photo-1", category: "写真・動画", title: "院内の雰囲気写真を追加（5枚以上）", description: "清潔感・明るさが伝わるもの", priority: "high", completed: false },
    { id: "photo-2", category: "写真・動画", title: "施術風景の写真を追加", description: "患者の安心感につながるもの", priority: "medium", completed: false },
    { id: "photo-3", category: "写真・動画", title: "スタッフの顔写真を追加", description: "信頼感の向上に効果的", priority: "medium", completed: false },
    { id: "photo-4", category: "写真・動画", title: "外観・アクセス写真を追加", description: "来院のハードルを下げる", priority: "medium", completed: false },
    { id: "photo-5", category: "写真・動画", title: "30秒以内の紹介動画を追加", description: "院内案内・施術風景の動画", priority: "low", completed: false },
    { id: "review-1", category: "口コミ戦略", title: "口コミ依頼用QRコードカードを作成", description: "会計時に渡せるカードを準備", priority: "high", completed: false },
    { id: "review-2", category: "口コミ戦略", title: "院内に口コミ投稿の案内を掲示", description: "ポスターやPOPで導線整備", priority: "medium", completed: false },
    { id: "review-3", category: "口コミ戦略", title: "既存の口コミすべてに返信", description: "感謝+症状キーワードを含めた返信", priority: "high", completed: false },
    { id: "review-4", category: "口コミ戦略", title: "LINE/メールで口コミ依頼フロー構築", description: "施術後のフォローアップで口コミリンクを案内", priority: "medium", completed: false },
    { id: "post-1", category: "GBP投稿", title: "週1〜2回のGBP投稿を開始", description: "写真付き・症状キーワード含む投稿を継続", priority: "high", completed: false },
    { id: "post-2", category: "GBP投稿", title: "季節に合わせた投稿テーマを準備", description: "花粉症・冷え性・年末疲れなど季節施策", priority: "medium", completed: false },
    { id: "cite-1", category: "サイテーション", title: "エキテンに登録", description: "登録519万店、月間960万人の大型ポータル", priority: "high", completed: false },
    { id: "cite-2", category: "サイテーション", title: "EPARK接骨・鍼灸に登録", description: "会員4,000万人超の国内最大級サイト", priority: "high", completed: false },
    { id: "cite-3", category: "サイテーション", title: "ヘルモアに登録", description: "治療院特化の口コミサイト（無料）", priority: "medium", completed: false },
    { id: "cite-4", category: "サイテーション", title: "しんきゅうコンパスに登録", description: "鍼灸院特化（31,000件超登録）", priority: "medium", completed: false },
    { id: "cite-5", category: "サイテーション", title: "Yahoo!プレイスに登録", description: "Yahoo!マップ連携", priority: "medium", completed: false },
    { id: "cite-6", category: "サイテーション", title: "Apple Business Connectに登録", description: "Appleマップ連携", priority: "low", completed: false },
    { id: "web-1", category: "ウェブサイト", title: "症状別ページを作成（主要5症状以上）", description: "腰痛・肩こり・頭痛等の専用ページ", priority: "high", completed: false },
    { id: "web-2", category: "ウェブサイト", title: "構造化データ（LocalBusiness）を実装", description: "Googleが院情報を正しく認識するための設定。JSON-LDコードをHTMLに追加。", priority: "high", completed: false },
    { id: "web-3", category: "ウェブサイト", title: "FAQページを作成＋構造化データ", description: "FAQ構造化データでリッチリザルト表示＆AI検索引用率UP", priority: "medium", completed: false },
    { id: "web-4", category: "ウェブサイト", title: "タイトルタグを最適化", description: "「地域名+症状+業態」の形式に", priority: "high", completed: false },
    { id: "web-5", category: "ウェブサイト", title: "モバイル表示速度を改善", description: "Core Web Vitals対応", priority: "medium", completed: false },
    { id: "web-6", category: "ウェブサイト", title: "患者の声・症例ページを作成", description: "写真付きの改善事例を掲載", priority: "medium", completed: false },
    { id: "ext-1", category: "外部施策", title: "noteアカウントを開設", description: "院長の想い・症状解説・セルフケア記事を投稿", priority: "medium", completed: false },
    { id: "ext-2", category: "外部施策", title: "Instagramを開設・運用開始", description: "施術ビフォーアフター・院内雰囲気の投稿", priority: "medium", completed: false },
    { id: "ext-3", category: "外部施策", title: "YouTubeでセルフケア動画を投稿", description: "ストレッチ・セルフケア動画で信頼獲得", priority: "low", completed: false },
    { id: "llmo-1", category: "LLMO対策", title: "FAQ構造化データを実装", description: "AI検索で引用されるためのJSON-LD設定", priority: "high", completed: false },
    { id: "llmo-2", category: "LLMO対策", title: "症状別の詳細コンテンツを作成", description: "ChatGPT・Geminiが参照する情報源になる", priority: "medium", completed: false },
    { id: "llmo-3", category: "LLMO対策", title: "E-E-A-T（経験・専門性・権威性・信頼性）を強化", description: "資格情報・経歴・実績をサイトに明記", priority: "medium", completed: false },
    { id: "wp-1", category: "WordPress投稿", title: "症状別ブログ記事を投稿（主要キーワード）", description: "各症状について1500〜2500字の記事をWordPressに投稿", priority: "high", completed: false },
    { id: "wp-2", category: "WordPress投稿", title: "FAQ記事をWordPressに投稿", description: "よくある質問をブログ記事として投稿（LLMO対策）", priority: "high", completed: false },
    { id: "wp-3", category: "WordPress投稿", title: "構造化データをサイトに実装", description: "プラグイン「Insert Headers and Footers」等でJSON-LDを設置", priority: "medium", completed: false },
  ];
}
