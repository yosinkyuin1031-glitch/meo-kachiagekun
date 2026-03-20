import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { clientId, redirectUri } = await req.json();

  const scope = "https://www.googleapis.com/auth/webmasters.readonly";
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return NextResponse.json({ authUrl });
}
