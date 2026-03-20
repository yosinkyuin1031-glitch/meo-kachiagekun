import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { clientId, clientSecret, code, redirectUri, refreshToken } = await req.json();

  try {
    let body: Record<string, string>;

    if (refreshToken) {
      // Token refresh
      body = {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      };
    } else {
      // Exchange auth code
      body = {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      };
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error_description || data.error || "トークン取得に失敗" }, { status: 400 });
    }

    return NextResponse.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });
  } catch (e) {
    return NextResponse.json({ error: "トークン取得エラー" }, { status: 500 });
  }
}
