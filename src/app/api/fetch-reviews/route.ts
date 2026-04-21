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
 * GoogleマップのURLから data_id（0x...:0x...形式）を抽出
 * 例: https://www.google.com/maps/place/.../@..../data=!...!1s0xabc:0xdef!8m2...
 * 例: https://maps.app.goo.gl/xxxxx → リダイレクト後のURLから抽出
 */
async function extractDataIdFromUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    let finalUrl = url.trim();
    // 短縮URLの場合はリダイレクト先を追う
    if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)/.test(finalUrl)) {
      const resp = await fetch(finalUrl, { redirect: "follow" });
      finalUrl = resp.url || finalUrl;
    }
    // data=!...!1s<DATA_ID> パターン
    const m1 = finalUrl.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
    if (m1) return m1[1];
    // ftid=<DATA_ID> パターン（検索URL）
    const m2 = finalUrl.match(/[?&]ftid=(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
    if (m2) return m2[1];
    return null;
  } catch {
    return null;
  }
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
 * AIで口コミを要約・タグ付け（tool_useで構造化出力を強制）
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

  const tool = {
    name: "save_review_summary" as const,
    description: "口コミの要約結果を保存する",
    input_schema: {
      type: "object" as const,
      properties: {
        summaryOverall: { type: "string" as const, description: "全体的な傾向を200文字程度で要約" },
        symptomTags: {
          type: "object" as const,
          description: "症状名をキー、改善エピソードの配列を値とするオブジェクト",
          additionalProperties: { type: "array" as const, items: { type: "string" as const } },
        },
        representativeReviews: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              text: { type: "string" as const, description: "口コミ本文" },
              rating: { type: "number" as const, description: "評価（1-5）" },
              pattern: { type: "string" as const, description: "症状名や特徴" },
            },
            required: ["text", "rating", "pattern"],
          },
        },
      },
      required: ["summaryOverall", "symptomTags", "representativeReviews"],
    },
  };

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    tools: [tool],
    tool_choice: { type: "tool", name: "save_review_summary" },
    messages: [{
      role: "user",
      content: `以下は治療院のGoogle口コミです。分析して save_review_summary ツールで結果を保存してください。

【口コミ一覧】
${reviewsText}

【ルール】
- symptomTagsは口コミに登場する症状名でタグ付け（腰痛・肩こり・頭痛・自律神経・骨盤・姿勢など）
- 各症状ごとに、口コミから抽出した具体的な改善エピソードや患者の声を3〜5個まとめる
- 数字（回数・期間・年代）は必ず保持する
- representativeReviewsには、特に説得力のある具体的な口コミを8〜12件選ぶ`,
    }],
  });

  const toolBlock = message.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("AI summarization failed: no tool_use response");
  }

  const input = toolBlock.input as {
    summaryOverall: string;
    symptomTags: Record<string, string[]>;
    representativeReviews: { text: string; rating: number; pattern: string }[];
  };
  return input;
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

/**
 * GET: DB保存済みの口コミ・要約を取得（ページ表示時の自動読み込み用）
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const clinicId = request.nextUrl.searchParams.get("clinicId");
    if (!clinicId) {
      return NextResponse.json({ error: "clinicIdは必須です" }, { status: 400 });
    }

    // 口コミ一覧
    const { data: reviews } = await supabase
      .from("meo_clinic_reviews")
      .select("author_name, rating, review_text, review_date")
      .eq("user_id", user.id)
      .eq("clinic_id", clinicId)
      .order("rating", { ascending: false });

    // 要約
    const { data: summaryData } = await supabase
      .from("meo_review_summaries")
      .select("summary_overall, symptom_tags, representative_reviews, total_count, avg_rating, updated_at")
      .eq("user_id", user.id)
      .eq("clinic_id", clinicId)
      .single();

    const allReviews = (reviews || []).map((r) => ({
      author: r.author_name || "匿名",
      rating: r.rating || 0,
      text: r.review_text || "",
      date: r.review_date || "",
    }));

    const summary = summaryData ? {
      summaryOverall: summaryData.summary_overall || "",
      symptomTags: (summaryData.symptom_tags || {}) as Record<string, string[]>,
      representativeReviews: (summaryData.representative_reviews || []) as { text: string; rating: number; pattern: string }[],
    } : null;

    return NextResponse.json({
      reviewCount: allReviews.length,
      avgRating: summaryData?.avg_rating || 0,
      updatedAt: summaryData?.updated_at || null,
      summary,
      allReviews,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { clinicId, businessName, area, maxCount, googleMapUrl, nearestStation } = await request.json();

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
    //    優先度: ①GoogleマップURL（確実に一致）→ ②住所+店舗名検索
    let dataId: string | null = null;
    if (googleMapUrl) {
      dataId = await extractDataIdFromUrl(googleMapUrl);
    }
    if (!dataId) {
      // 最寄り駅も含めて絞り込み精度を上げる
      const queryParts = [area, nearestStation, businessName].filter(Boolean);
      dataId = await findPlaceId(queryParts.join(" "), serpApiKey);
    }
    if (!dataId) {
      return NextResponse.json({
        error: "Googleマップで該当店舗が見つかりませんでした。設定の「各種URL」→「Googleマップ口コミURL」に正確なURLを貼り付けるとより確実に取得できます。",
      }, { status: 404 });
    }

    // 2. 口コミ取得
    const reviews = await fetchReviews(dataId, serpApiKey, limit);
    if (reviews.length === 0) {
      return NextResponse.json({ error: "口コミが取得できませんでした" }, { status: 404 });
    }

    // 3. 既存口コミを取得して重複チェック
    const { data: existingReviews } = await supabase
      .from("meo_clinic_reviews")
      .select("review_text")
      .eq("user_id", user.id)
      .eq("clinic_id", clinicId);
    const existingTexts = new Set((existingReviews || []).map((r) => r.review_text));

    const newReviewRows = reviews
      .filter((r) => r.snippet && r.snippet.length > 10)
      .filter((r) => !existingTexts.has(r.snippet || "")) // 重複排除
      .map((r) => ({
        user_id: user.id,
        clinic_id: clinicId,
        author_name: r.user?.name || null,
        rating: r.rating || null,
        review_text: r.snippet || "",
        review_date: r.date || null,
        source: "google",
      }));
    if (newReviewRows.length > 0) {
      await supabase.from("meo_clinic_reviews").insert(newReviewRows);
    }
    const duplicateCount = reviews.filter((r) => r.snippet && r.snippet.length > 10).length - newReviewRows.length;

    // 4. AIで要約（タイムアウト防止: 上位50件に制限）
    const reviewsForAI = reviews.slice(0, 50);
    const summary = await summarizeReviews(reviewsForAI, anthropicKey);

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

    // 全口コミ一覧（UI表示用）
    const allReviewsList = reviews
      .filter((r) => r.snippet && r.snippet.length > 10)
      .map((r) => ({
        author: r.user?.name || "匿名",
        rating: r.rating || 0,
        text: r.snippet || "",
        date: r.date || "",
      }));

    return NextResponse.json({
      success: true,
      reviewCount: reviews.length,
      newCount: newReviewRows.length,
      duplicateCount,
      avgRating,
      summary,
      allReviews: allReviewsList,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    console.error("Fetch reviews error:", errorMsg);
    return NextResponse.json({ error: `口コミ取得に失敗しました: ${errorMsg}` }, { status: 500 });
  }
}
