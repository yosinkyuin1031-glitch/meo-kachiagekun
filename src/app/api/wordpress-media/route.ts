import { NextRequest, NextResponse } from "next/server";

/**
 * WordPressメディアライブラリに画像をアップロード
 * base64画像 → WordPress media → 公開URLを返す
 */
export async function POST(req: NextRequest) {
  const { siteUrl, username, appPassword, imageBase64, filename } = await req.json();

  if (!siteUrl || !username || !appPassword || !imageBase64) {
    return NextResponse.json(
      { error: "必須パラメータが不足しています" },
      { status: 400 }
    );
  }

  try {
    // base64 → Buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const mediaUrl = `${siteUrl}/wp-json/wp/v2/media`;
    const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");

    const res = await fetch(mediaUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Disposition": `attachment; filename="${filename || "gbp-image.png"}"`,
        "Content-Type": "image/png",
      },
      body: buffer,
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "画像のアップロードに失敗しました" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      mediaId: data.id,
      mediaUrl: data.source_url,
      mediaLink: data.link,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "アップロード中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
