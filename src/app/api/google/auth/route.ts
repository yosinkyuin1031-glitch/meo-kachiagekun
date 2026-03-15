import { NextRequest, NextResponse } from "next/server";

/**
 * Google OAuth認証開始エンドポイント
 * クライアントからclientIdを受け取り、認証URLを返す
 */
export async function POST(req: NextRequest) {
  const { clientId, redirectUri } = await req.json();

  if (!clientId) {
    return NextResponse.json({ error: "clientIdが必要です" }, { status: 400 });
  }

  const scope = "https://www.googleapis.com/auth/business.manage";
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  return NextResponse.json({ authUrl: authUrl.toString() });
}
