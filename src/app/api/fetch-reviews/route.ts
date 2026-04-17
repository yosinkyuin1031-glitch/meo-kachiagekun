import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

interface SerpReview {
  user?: { name?: string };
  rating?: number;
  date?: string;
  snippet?: string;
}

interface SerpPlaceResult {
  place_id?: string;
  data_id?: string;
  title?: string;
  rating?: number;
  reviews?: number;
}

/**
 * SerpApi Google Maps検索でplace_idを取得
 */
async function findPlaceId(query: string, apiKey: string): Promise<string | null> {
  const params = new URLSearchParams({
    engine: "google_maps",
    q: query,
    hl: "ja",
    gl: "jp",
    api_key: apiKey,
  });
  const response = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!response.ok) throw new Error(`SerpApi error: ${response.status}`);
  const data = await response.json();

  // place_results（単一結果）またはlocal_resultsの先頭
  if (data.place_results?.data_id) return data.place_results.data_id;
  if (data.place_results?.place_id) return data.place_results.place_id;
  const first: SerpPlaceResult | undefined = data.local_results?.[0];
  return first?.data_id || first?.place_id || null;
}

/**
 * SerpApi Google Maps Reviewsで口コミを取得（ページング対応）
 */
async function fetchReviews(dataId: string, apiKey: string, maxCount: number): Promise<SerpReview[]> {
  const allReviews: SerpReview[] = [];
  let nextPageToken: string | undefined;

  while (allReviews.length < maxCount) {
    const params = new URLSearchParams({
      engine: "google_maps_reviews",
      data_id: dataId,
      hl: "ja",
      api_key: apiKey,
      sort_by: "ratingHigh", // 評価が高い順
    });
    if (nextPageToken) params.set("next_page_token", nextPageToken);

    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SerpApi reviews error: ${response.status} - ${errText}`);
    }
    const data = await response.json();
    const reviews: SerpReview[] = data.reviews || [];
    if (reviews.length === 0) break;

    allReviews.push(...reviews);

    nextPageToken = data.serpapi_pagination?.next_page_token;
    if (!nextPageToken) break;
  }

  return allReviews.slice(0, maxCount);
}

/**
 * AIで口コミを要約・タグ付け
 */
async function summarizeReviews(reviews: SerpReview[], anthropicKey: string): Promise<{
  summaryOverall: string;
  symptomTags: Record<string, string[]>;
  representativeReviews: { text: string; rating: number; pattern: string }[];
}> {
  const client = new Anthropic({ apiKey: anthropicKey });

  const reviewsText = reviews
    .filter((r) => r.snippet && r.snippet.length > 10)
    .map((r, i) => `[${i + 1}] ★${r.rating || "?"} ${r.snippet}`)
    .join("\n");

  const prompt = `以下は治療院のGoogle口コミです。これらを分析して、記事生成のコンテキストとして使える形に要約してください。

【口コミ一覧】
${reviewsText}

【出力するJSON形式】
{
  "summaryOverall": "全体的な傾向を200文字程度で要約",
  "symptomTags": {
    "腰痛": ["改善エピソードの要約1", "改善エピソードの要約2"],
    "肩こり": ["..."],
    "頭痛": ["..."]
  },
  "representativeReviews": [
    { "text": "象徴的な口コミ本文", "rating": 5, "pattern": "症状名や特徴" }
  ]
}

【ルール】
- symptomTagsは口コミに登場する症状名でタグ付け（腰痛・肩こり・頭痛・自律神経・骨盤・姿勢など）
- 各症状ごとに、口コミから抽出した具体的な改善エピソードや患者の声を3〜5個まとめる
- 数字（回数・期間・年代）は必ず保持する
- representativeReviewsには、特に説得力のある具体的な口コミを8〜12件選ぶ
- JSON以外の文字は一切出力しないこと`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI summarization failed: invalid JSON response");
  return JSON.parse(jsonMatch[0]);
}

// APIキーを取得：環境変数 → DB → の順（generate/route.tsと同じ方式）
async function resolveAnthropicKey(userId?: string): Promise<string> {
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey && envKey.trim().length > 50) return envKey.trim();
  if (userId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("meo_user_settings")
      .select("anthropic_key")
      .eq("user_id", userId)
      .single();
    if (data?.anthropic_key && data.anthropic_key.trim().length > 50) {
      return data.anthropic_key.trim();
    }
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { clinicId, businessName, area, maxCount } = await request.json();

    if (!clinicId || !businessName || !area) {
      return NextResponse.json({ error: "院ID・店舗名・エリアは必須です" }, { status: 400 });
    }

    const limit = Math.min(Math.max(parseInt(maxCount) || 30, 10), 100);

    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) {
      return NextResponse.json({ error: "システムのAPIキーが設定されていません。管理者に連絡してください。" }, { status: 500 });
    }
    const anthropicKey = await resolveAnthropicKey(user.id);
    if (!anthropicKey) {
      return NextResponse.json({ error: "AIのAPIキーが設定されていません。管理者に連絡してください。" }, { status: 500 });
    }

    // 月間取得回数チェック（4回まで）
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { count: monthlyCount } = await supabase
      .from("meo_review_fetch_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("clinic_id", clinicId)
      .gte("fetched_at", monthStart);
    if ((monthlyCount || 0) >= 4) {
      return NextResponse.json({ error: "今月の取得回数上限（4回）に達しました。来月またご利用ください。" }, { status: 429 });
    }

    // 1. place_id取得
    const dataId = await findPlaceId(`${area} ${businessName}`, serpApiKey);
    if (!dataId) {
      return NextResponse.json({ error: "Google Mapsで該当店舗が見つかりませんでした" }, { status: 404 });
    }

    // 2. 口コミ取得
    const reviews = await fetchReviews(dataId, serpApiKey, limit);
    if (reviews.length === 0) {
      return NextResponse.json({ error: "口コミが取得できませんでした" }, { status: 404 });
    }

    // 3. DBに既存口コミを削除して新規保存
    await supabase.from("meo_clinic_reviews").delete().eq("user_id", user.id).eq("clinic_id", clinicId);
    const reviewRows = reviews
      .filter((r) => r.snippet && r.snippet.length > 10)
      .map((r) => ({
        user_id: user.id,
        clinic_id: clinicId,
        author_name: r.user?.name || null,
        rating: r.rating || null,
        review_text: r.snippet || "",
        review_date: r.date || null,
        source: "google",
      }));
    if (reviewRows.length > 0) {
      await supabase.from("meo_clinic_reviews").insert(reviewRows);
    }

    // 4. AIで要約
    const summary = await summarizeReviews(reviews, anthropicKey);

    // 5. 要約をDBに保存（upsert）
    const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
    await supabase.from("meo_review_summaries").upsert({
      user_id: user.id,
      clinic_id: clinicId,
      summary_overall: summary.summaryOverall,
      symptom_tags: summary.symptomTags,
      representative_reviews: summary.representativeReviews,
      total_count: reviews.length,
      avg_rating: avgRating,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,clinic_id" });

    // 6. 取得履歴を記録
    await supabase.from("meo_review_fetch_log").insert({
      user_id: user.id,
      clinic_id: clinicId,
      fetch_count: reviews.length,
    });

    return NextResponse.json({
      success: true,
      reviewCount: reviews.length,
      avgRating,
      summary,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    console.error("Fetch reviews error:", errorMsg);
    return NextResponse.json({ error: `口コミ取得に失敗しました: ${errorMsg}` }, { status: 500 });
  }
}
