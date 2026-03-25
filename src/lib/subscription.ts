import { createClient } from "@/lib/supabase/server";

/**
 * ============================================================
 * Supabase テーブル作成SQL（ダッシュボードで手動実行してください）
 * ============================================================
 *
 * CREATE TABLE meo_subscriptions (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   stripe_customer_id TEXT NOT NULL,
 *   stripe_subscription_id TEXT,
 *   status TEXT NOT NULL DEFAULT 'inactive',
 *   -- status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'inactive'
 *   current_period_end TIMESTAMPTZ,
 *   cancel_at_period_end BOOLEAN DEFAULT FALSE,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(user_id),
 *   UNIQUE(stripe_customer_id)
 * );
 *
 * -- RLSポリシー
 * ALTER TABLE meo_subscriptions ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can view own subscription"
 *   ON meo_subscriptions FOR SELECT
 *   USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Service role can manage subscriptions"
 *   ON meo_subscriptions FOR ALL
 *   USING (true)
 *   WITH CHECK (true);
 *
 * -- インデックス
 * CREATE INDEX idx_meo_subscriptions_user_id ON meo_subscriptions(user_id);
 * CREATE INDEX idx_meo_subscriptions_stripe_customer_id ON meo_subscriptions(stripe_customer_id);
 *
 * ============================================================
 */

// モニター期間終了日（2026年7月1日 00:00 JST）
const MONITOR_PERIOD_END = new Date("2026-07-01T00:00:00+09:00");

export interface SubscriptionData {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  status: "active" | "canceled" | "past_due" | "trialing" | "inactive";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * ユーザーのサブスクリプション情報を取得
 */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meo_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as SubscriptionData;
}

/**
 * 有料会員かどうか判定
 */
export async function isActiveSubscriber(userId: string): Promise<boolean> {
  const sub = await getSubscriptionStatus(userId);
  if (!sub) return false;
  return sub.status === "active" || sub.status === "trialing";
}

/**
 * 現在がモニター期間かどうか判定
 * モニター期間中は全ユーザーがアクセス可能
 */
export function isMonitorPeriod(): boolean {
  return new Date() < MONITOR_PERIOD_END;
}

/**
 * ユーザーがアプリを利用可能かどうか
 * モニター期間中 → 全員OK
 * モニター期間後 → 有料会員のみ
 */
export async function canAccessApp(userId: string): Promise<boolean> {
  if (isMonitorPeriod()) return true;
  return isActiveSubscriber(userId);
}

/**
 * モニター期間の残り日数を取得
 */
export function getMonitorDaysRemaining(): number {
  const now = new Date();
  const diff = MONITOR_PERIOD_END.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * クライアントサイドで使えるモニター期間チェック（サーバー不要）
 */
export function isMonitorPeriodClient(): boolean {
  return new Date() < MONITOR_PERIOD_END;
}

/**
 * クライアントサイドでモニター残日数を取得
 */
export function getMonitorDaysRemainingClient(): number {
  const now = new Date();
  const diff = MONITOR_PERIOD_END.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
