import { NextRequest, NextResponse } from "next/server";

/**
 * Google Business Profile に投稿を作成する
 * - テキスト（最新情報）
 * - 画像（WordPress media URLまたは外部URL）
 * - 「詳細」ボタン（ホームページURL）
 */
export async function POST(req: NextRequest) {
  const { accessToken, locationId, summary, imageUrl, linkUrl } = await req.json();

  if (!accessToken || !locationId || !summary) {
    return NextResponse.json(
      { error: "accessToken, locationId, summaryが必要です" },
      { status: 400 }
    );
  }

  try {
    // 投稿データ構築
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const postBody: any = {
      languageCode: "ja",
      summary,
      topicType: "STANDARD",
    };

    // 画像（公開URLが必要）
    if (imageUrl) {
      postBody.media = [
        {
          mediaFormat: "PHOTO",
          sourceUrl: imageUrl,
        },
      ];
    }

    // 「詳細」ボタン（CTAリンク）
    if (linkUrl) {
      postBody.callToAction = {
        actionType: "LEARN_MORE",
        url: linkUrl,
      };
    }

    // GBP APIに投稿
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationId}/localPosts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postBody),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "GBP投稿に失敗しました", details: data },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      postName: data.name,
      postUrl: data.searchUrl || null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "GBP投稿中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
