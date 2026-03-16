import { NextRequest, NextResponse } from "next/server";

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
  const results = data.local_results || [];

  return results.map((r: { title?: string; address?: string; rating?: number; reviews?: number }) => ({
    title: r.title || "",
    address: r.address,
    rating: r.rating,
    reviews: r.reviews,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const { businessName, area, keywords, apiKey } = await request.json();

    if (!businessName || !area || !keywords?.length) {
      return NextResponse.json(
        { error: "店舗名・エリア・キーワードは必須です" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "APIキーが設定されていません。設定画面でSerpApiのAPIキーを入力してください。" },
        { status: 400 }
      );
    }

    const results: KeywordResult[] = [];

    for (const keyword of keywords as string[]) {
      const query = `${area} ${keyword}`;

      try {
        const places = await searchWithSerpApi(query, apiKey);

        let rank: number | null = null;
        for (let i = 0; i < places.length; i++) {
          if (places[i].title && places[i].title.includes(businessName)) {
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
  } catch {
    return NextResponse.json(
      { error: "ランキングチェックに失敗しました" },
      { status: 500 }
    );
  }
}
