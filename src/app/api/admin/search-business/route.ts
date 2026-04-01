import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["ooguchiyouhei@gmail.com"];

interface BusinessResult {
  title: string;
  address?: string;
  rating?: number;
  reviews?: number;
  gps_coordinates?: { latitude: number; longitude: number };
  place_id?: string;
  website?: string;
  phone?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
    }

    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ error: "検索キーワードを入力してください" }, { status: 400 });
    }

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "SerpApi APIキーが設定されていません" }, { status: 500 });
    }

    const params = new URLSearchParams({
      engine: "google_maps",
      q: query,
      hl: "ja",
      gl: "jp",
      api_key: apiKey,
    });

    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) {
      return NextResponse.json({ error: "Google Maps検索に失敗しました" }, { status: 500 });
    }

    const data = await response.json();
    const results: BusinessResult[] = (data.local_results || []).map(
      (r: Record<string, unknown>) => ({
        title: r.title || "",
        address: r.address || "",
        rating: r.rating,
        reviews: r.reviews,
        gps_coordinates: r.gps_coordinates,
        place_id: r.place_id,
        website: r.website,
        phone: r.phone,
      })
    );

    // 単一結果の場合
    if (results.length === 0 && data.place_results) {
      const pr = data.place_results;
      results.push({
        title: pr.title || "",
        address: pr.address || "",
        rating: pr.rating,
        reviews: pr.reviews,
        gps_coordinates: pr.gps_coordinates,
        place_id: pr.place_id,
        website: pr.website,
        phone: pr.phone,
      });
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Business search error:", e);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
