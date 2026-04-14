import { createClient } from "@/lib/supabase/server";

/**
 * モニター期間: ユーザーごとに初回ログイン日から3ヶ月
 * 猶予期間: モニター終了後1週間
 * それ以降: 月額2,980円の有料契約が必要
 */

// モニター期間（日数）
const MONITOR_DAYS = 90; // 3ヶ月
// 移行猶予期間（日数）
const GRACE_DAYS = 7;
// 月額料金
export const MONTHLY_PRICE = 2980;
// 管理者メール
const ADMIN_EMAILS = ["ooguchiyouhei@gmail.com", "yosinkyuin1031@gmail.com"];

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
 * ユーザーのモニター開始日を取得（なければ記録して返す）
 */
export async function getOrSetMonitorStart(userId: string): Promise<Date | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meo_user_settings")
    .select("monitor_start")
    .eq("user_id", userId)
    .single();

  if (data?.monitor_start) {
    return new Date(data.monitor_start);
  }

  // 初回ログイン → 今日をモニター開始日として記録
  const now = new Date().toISOString();
  await supabase
    .from("meo_user_settings")
    .update({ monitor_start: now })
    .eq("user_id", userId);

  return new Date(now);
}

/**
 * ユーザーのモニター終了日を計算
 */
export function getMonitorEnd(monitorStart: Date): Date {
  const end = new Date(monitorStart);
  end.setDate(end.getDate() + MONITOR_DAYS);
  return end;
}

/**
 * ユーザーの猶予期間終了日を計算
 */
export function getGraceEnd(monitorStart: Date): Date {
  const end = new Date(monitorStart);
  end.setDate(end.getDate() + MONITOR_DAYS + GRACE_DAYS);
  return end;
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
 * ユーザーがモニター期間中かどうか
 */
export function isInMonitorPeriod(monitorStart: Date): boolean {
  return new Date() < getMonitorEnd(monitorStart);
}

/**
 * ユーザーが猶予期間中かどうか
 */
export function isInGracePeriod(monitorStart: Date): boolean {
  const now = new Date();
  return now >= getMonitorEnd(monitorStart) && now < getGraceEnd(monitorStart);
}

/**
 * ユーザーがアプリを利用可能かどうか
 */
export async function canAccessApp(userId: string, userEmail?: string): Promise<boolean> {
  // 管理者は常にアクセス可能
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) return true;

  // モニター開始日を取得（初回なら記録）
  const monitorStart = await getOrSetMonitorStart(userId);
  if (!monitorStart) return true; // 設定がなければ許可

  // モニター期間中 or 猶予期間中
  if (isInMonitorPeriod(monitorStart) || isInGracePeriod(monitorStart)) return true;

  // それ以降は有料会員のみ
  return isActiveSubscriber(userId);
}

/**
 * ユーザーのモニター残り日数
 */
export function getMonitorDaysRemaining(monitorStart: Date): number {
  const end = getMonitorEnd(monitorStart);
  const diff = end.getTime() - new Date().getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * ユーザーの猶予残り日数
 */
export function getGraceDaysRemaining(monitorStart: Date): number {
  const now = new Date();
  const monitorEnd = getMonitorEnd(monitorStart);
  if (now < monitorEnd) return GRACE_DAYS;
  const graceEnd = getGraceEnd(monitorStart);
  const diff = graceEnd.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
