import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// モニター期間（日数）
const MONITOR_DAYS = 90;
const GRACE_DAYS = 7;
const ADMIN_EMAILS = ["ooguchiyouhei@gmail.com", "yosinkyuin1031@gmail.com"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 認証不要パス
  const publicPaths = ["/login", "/signup", "/guide", "/apply", "/privacy", "/terms", "/forgot-password", "/reset-password", "/expired"];
  const isPublicPath =
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ログイン済みなのにログインページにいる場合はリダイレクト
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ユーザーごとのモニター期間チェック
  if (user && !isPublicPath && pathname !== "/expired") {
    // 管理者はスキップ
    if (ADMIN_EMAILS.includes(user.email || "")) return supabaseResponse;

    // モニター開始日を取得
    const { data: settings } = await supabase
      .from("meo_user_settings")
      .select("monitor_start")
      .eq("user_id", user.id)
      .single();

    if (settings?.monitor_start) {
      const monitorStart = new Date(settings.monitor_start);
      const graceEnd = new Date(monitorStart);
      graceEnd.setDate(graceEnd.getDate() + MONITOR_DAYS + GRACE_DAYS);

      // 猶予期間を過ぎている場合、サブスクチェック
      if (new Date() >= graceEnd) {
        const { data: sub } = await supabase
          .from("meo_subscriptions")
          .select("status")
          .eq("user_id", user.id)
          .single();

        const isActive = sub?.status === "active" || sub?.status === "trialing";
        if (!isActive) {
          const url = request.nextUrl.clone();
          url.pathname = "/expired";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
