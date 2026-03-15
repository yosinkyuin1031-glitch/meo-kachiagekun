import { NextRequest, NextResponse } from "next/server";

/**
 * Googleアクセストークンの有効性を確認する
 */
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();

  if (!accessToken) {
    return NextResponse.json({ valid: false, error: "トークンなし" });
  }

  try {
    // トークン情報を検証
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`
    );
    const tokenInfo = await tokenInfoRes.json();

    if (!tokenInfoRes.ok) {
      return NextResponse.json({
        valid: false,
        error: tokenInfo.error_description || "トークンが無効です",
        expired: true,
      });
    }

    // アカウント一覧を取得してみる
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let accountCount = 0;
    let accountError = "";
    if (accountsRes.ok) {
      const data = await accountsRes.json();
      accountCount = data.accounts?.length || 0;
    } else {
      const errData = await accountsRes.json().catch(() => ({}));
      accountError = errData.error?.message || `API error ${accountsRes.status}`;
    }

    return NextResponse.json({
      valid: true,
      email: tokenInfo.email,
      scope: tokenInfo.scope,
      expiresIn: tokenInfo.expires_in,
      accountCount,
      accountError,
    });
  } catch (e) {
    return NextResponse.json({
      valid: false,
      error: e instanceof Error ? e.message : "確認に失敗しました",
    });
  }
}
