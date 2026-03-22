import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel Cron で毎週月曜9時（JST）に実行
// vercel.json: "0 0 * * 1" (UTC 0:00 = JST 9:00)

const WEEKLY_GOAL = 3;

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  };
}

export async function GET(request: Request) {
  // Vercel Cron の認証チェック
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // サーバーサイドでService Role Keyを使用（環境変数が必要）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      // Service Role Keyがない場合はAnon Keyでフォールバック
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        return NextResponse.json(
          { error: "Supabase credentials not configured" },
          { status: 500 }
        );
      }
    }

    const supabase = createClient(
      supabaseUrl!,
      serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 全ユーザー設定を取得
    const { data: users, error: usersError } = await supabase
      .from("meo_user_settings")
      .select("user_id");

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: "No users found", summaries: [] });
    }

    const { start, end } = getWeekRange();
    const summaries = [];

    for (const u of users) {
      // 今週のコンテンツ数をカウント
      const { count, error: countError } = await supabase
        .from("meo_contents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", u.user_id)
        .gte("created_at", start)
        .lte("created_at", end);

      if (countError) continue;

      const postCount = count || 0;
      let status: "none" | "in_progress" | "achieved";
      let message: string;

      if (postCount === 0) {
        status = "none";
        message = "今週の投稿はまだ0本です。GBP投稿やFAQを作成しましょう！";
      } else if (postCount < WEEKLY_GOAL) {
        status = "in_progress";
        const remaining = WEEKLY_GOAL - postCount;
        message = `今週${postCount}本投稿しました！あと${remaining}本でペース達成です`;
      } else {
        status = "achieved";
        message = `今週${postCount}本投稿達成！素晴らしいペースです`;
      }

      summaries.push({
        userId: u.user_id,
        weeklyPostCount: postCount,
        weeklyGoal: WEEKLY_GOAL,
        status,
        message,
        weekStart: start,
        weekEnd: end,
      });
    }

    // 将来的にここでメール送信を追加
    // 例: Resend API を使って各ユーザーにメール送信
    // for (const summary of summaries) {
    //   await sendReminderEmail(summary.userId, summary.message);
    // }

    return NextResponse.json({
      message: `Processed ${summaries.length} users`,
      summaries,
      executedAt: new Date().toISOString(),
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    console.error("Weekly reminder error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
