import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PlaceResult {
  title: string;
  address?: string;
  rating?: number;
  reviews?: number;
}

interface KeywordResult {
  keyword: string;
  rank: number | null;
  businessName: string;
  totalResults: number;
  checkedAt: string;
  topThree: { rank: number; name: string; rating?: number; reviews?: number }[];
}

/**
 * 店舗名の正規化（マッチング用）
 * スペース・全半角・記号の違いを吸収する
 */
function normalizeName(name: string): string {
  return name
    // 全角スペース→半角スペース→除去
    .replace(/[\s\u3000]/g, "")
    // 全角英数→半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    )
    // 全角カタカナ→ひらがな
    .replace(/[\u30A1-\u30F6]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    )
    // 小文字化
    .toLowerCase()
    // よくある記号を除去
    .replace(/[・\-−–ー()（）「」【】]/g, "");
}

/**
 * 店舗名が一致するかを柔軟に判定
 * 1. 完全一致（正規化後）
 * 2. 部分一致（どちらかがもう一方を含む）
 * 3. 主要部分の一致（「院」「店」等の接尾辞を除いた比較）
 */
function matchesBusinessName(resultTitle: string, searchName: string): boolean {
  const normResult = normalizeName(resultTitle);
  const normSearch = normalizeName(searchName);

  // 完全一致
  if (normResult === normSearch) return true;

  // 部分一致（双方向）
  if (normResult.includes(normSearch) || normSearch.includes(normResult)) return true;

  // 接尾辞除去で比較（「院」「店」「整体」「整骨」「鍼灸」等を除外）
  const suffixes = ["院", "店", "整体", "整骨院", "鍼灸院", "接骨院", "治療院", "クリニック"];
  let coreResult = normResult;
  let coreSearch = normSearch;
  for (const suffix of suffixes) {
    if (coreResult.endsWith(suffix)) coreResult = coreResult.slice(0, -suffix.length);
    if (coreSearch.endsWith(suffix)) coreSearch = coreSearch.slice(0, -suffix.length);
  }
  if (coreResult && coreSearch && (coreResult.includes(coreSearch) || coreSearch.includes(coreResult))) return true;

  return false;
}

async function searchWithSerpApi(query: string, apiKey: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    engine: "google_maps",
    q: query,
    hl: "ja",
    gl: "jp",
    api_key: apiKey,
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SerpApi error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // local_results が無い場合、place_results（単一結果）をチェック
  let results = data.local_results || [];

  // place_results（検索結果が1件の場合にこちらに入ることがある）
  if (results.length === 0 && data.place_results) {
    const pr = data.place_results;
    results = [{
      title: pr.title || "",
      address: pr.address,
      rating: pr.rating,
      reviews: pr.reviews,
    }];
  }

  return results.map((r: { title?: string; address?: string; rating?: number; reviews?: number }) => ({
    title: r.title || "",
    address: r.address,
    rating: r.rating,
    reviews: r.reviews,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { businessName, area, keywords } = await request.json();

    if (!businessName || !area || !keywords?.length) {
      return NextResponse.json(
        { error: "店舗名・エリア・キーワードは必須です" },
        { status: 400 }
      );
    }

    // サーバー環境変数からAPIキーを取得（顧客はAPIキー不要）
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "システムのAPIキーが設定されていません。管理者に連絡してください。" },
        { status: 500 }
      );
    }

    // 月間チェック回数制限
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("meo_ranking_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("checked_at", monthStart);

    const MONTHLY_LIMIT = 4; // 月4回まで（1回=全キーワード一括チェック）
    const checkCount = Math.ceil((count || 0) / keywords.length); // キーワード数で割って回数を算出
    if (checkCount >= MONTHLY_LIMIT) {
      return NextResponse.json(
        { error: `今月の順位チェック回数上限（${MONTHLY_LIMIT}回）に達しました。来月またご利用ください。` },
        { status: 429 }
      );
    }

    const results: KeywordResult[] = [];

    for (const keyword of keywords as string[]) {
      // キーワードにエリア名が含まれていればそのまま、なければエリア名を付加
      const hasArea = keyword.includes(area) || area.split(/[都道府県市区町村]/).some((part: string) => part && keyword.includes(part));
      const query = hasArea ? keyword : `${area} ${keyword}`;

      try {
        const places = await searchWithSerpApi(query, apiKey);

        let rank: number | null = null;
        for (let i = 0; i < places.length; i++) {
          if (places[i].title && matchesBusinessName(places[i].title, businessName)) {
            rank = i + 1;
            break;
          }
        }

        const topThree = places.slice(0, 3).map((p, i) => ({
          rank: i + 1,
          name: p.title || "不明",
          rating: p.rating,
          reviews: p.reviews,
        }));

        results.push({
          keyword,
          rank,
          businessName,
          totalResults: places.length,
          checkedAt: new Date().toISOString(),
          topThree,
        });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "不明なエラー";
        if (errorMsg.includes("Invalid API key")) {
          return NextResponse.json(
            { error: "APIキーが無効です。正しいSerpApiのAPIキーを設定してください。" },
            { status: 401 }
          );
        }
        results.push({
          keyword,
          rank: null,
          businessName,
          totalResults: 0,
          checkedAt: new Date().toISOString(),
          topThree: [],
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Ranking check error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "ランキングチェックに失敗しました。入力内容を確認のうえ、しばらくしてから再度お試しください。" },
      { status: 500 }
    );
  }
}
