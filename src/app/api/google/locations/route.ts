import { NextRequest, NextResponse } from "next/server";

/**
 * Googleアカウントに紐づくビジネスロケーション一覧を取得
 */
export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();

  if (!accessToken) {
    return NextResponse.json({ error: "accessTokenが必要です" }, { status: 400 });
  }

  try {
    // Step 1: アカウント一覧を取得
    const accountsRes = await fetch(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const accountsData = await accountsRes.json();
    if (!accountsRes.ok) {
      return NextResponse.json(
        { error: accountsData.error?.message || "アカウント取得に失敗しました" },
        { status: 400 }
      );
    }

    const accounts = accountsData.accounts || [];
    if (accounts.length === 0) {
      return NextResponse.json({ accounts: [], locations: [] });
    }

    // Step 2: 各アカウントのロケーションを取得
    const allLocations: Array<{
      accountId: string;
      accountName: string;
      locationId: string;
      locationName: string;
      address: string;
    }> = [];

    for (const account of accounts) {
      const accountId = account.name; // accounts/xxx
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title,storefrontAddress`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const locData = await locRes.json();
      if (locRes.ok && locData.locations) {
        for (const loc of locData.locations) {
          const addr = loc.storefrontAddress;
          const addressStr = addr
            ? [addr.administrativeArea, addr.locality, addr.addressLines?.join(" ")].filter(Boolean).join(" ")
            : "";
          allLocations.push({
            accountId,
            accountName: account.accountName || account.name,
            locationId: loc.name, // accounts/xxx/locations/yyy
            locationName: loc.title || "不明",
            address: addressStr,
          });
        }
      }
    }

    return NextResponse.json({ accounts, locations: allLocations });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ロケーション取得に失敗しました" },
      { status: 500 }
    );
  }
}
