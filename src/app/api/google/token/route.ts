import { NextRequest, NextResponse } from "next/server";

/**
 * Google OAuthトークン交換・リフレッシュ
 * code → access_token / refresh_token 交換
 * または refresh_token → 新しい access_token
 */
export async function POST(req: NextRequest) {
  const { code, clientId, clientSecret, redirectUri, refreshToken } = await req.json();

  const params: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
  };

  if (code) {
    // 認証コード → トークン交換
    params.code = code;
    params.redirect_uri = redirectUri;
    params.grant_type = "authorization_code";
  } else if (refreshToken) {
    // リフレッシュトークン → 新アクセストークン
    params.refresh_token = refreshToken;
    params.grant_type = "refresh_token";
  } else {
    return NextResponse.json({ error: "codeまたはrefreshTokenが必要です" }, { status: 400 });
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error_description || data.error || "トークン取得に失敗しました" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });
}
