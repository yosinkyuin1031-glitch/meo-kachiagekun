import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { accessToken, siteUrl, startDate, endDate, rowLimit } = await req.json();

  if (!accessToken || !siteUrl) {
    return NextResponse.json({ error: "accessToken and siteUrl are required" }, { status: 400 });
  }

  // Default: last 28 days
  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() - 2); // GSC data has ~2 day delay
  const defaultStart = new Date(defaultEnd);
  defaultStart.setDate(defaultStart.getDate() - 28);

  const start = startDate || defaultStart.toISOString().split("T")[0];
  const end = endDate || defaultEnd.toISOString().split("T")[0];

  try {
    const encodedUrl = encodeURIComponent(siteUrl);
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedUrl}/searchAnalytics/query`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: start,
        endDate: end,
        dimensions: ["query"],
        rowLimit: rowLimit || 100,
        type: "web",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      if (res.status === 401) {
        return NextResponse.json({ error: "TOKEN_EXPIRED" }, { status: 401 });
      }
      return NextResponse.json({ error: err.error?.message || "検索データ取得に失敗" }, { status: res.status });
    }

    const data = await res.json();
    const queries = (data.rows || []).map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 1000) / 10, // percentage with 1 decimal
      position: Math.round(row.position * 10) / 10,
    }));

    return NextResponse.json({
      queries,
      startDate: start,
      endDate: end,
      totalRows: queries.length,
    });
  } catch (e) {
    return NextResponse.json({ error: "検索データ取得エラー" }, { status: 500 });
  }
}
