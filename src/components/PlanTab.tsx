"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

// モニター期間終了日（2026年7月1日 00:00 JST）
const MONITOR_PERIOD_END = new Date("2026-07-01T00:00:00+09:00");

interface SubscriptionInfo {
  status: "active" | "canceled" | "past_due" | "trialing" | "inactive";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
}

function isMonitorPeriod(): boolean {
  return new Date() < MONITOR_PERIOD_END;
}

function getMonitorDaysRemaining(): number {
  const now = new Date();
  const diff = MONITOR_PERIOD_END.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function PlanTab() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("meo_subscriptions")
      .select("status, current_period_end, cancel_at_period_end, stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    setSubscription(data as SubscriptionInfo | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleCheckout = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("エラーが発生しました: " + (data.error || "不明なエラー"));
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePortal = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("エラーが発生しました: " + (data.error || "不明なエラー"));
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  };

  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const isCanceled = subscription?.status === "canceled";
  const isPastDue = subscription?.status === "past_due";
  const monitorActive = isMonitorPeriod();
  const daysRemaining = getMonitorDaysRemaining();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 現在のプラン */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">プラン情報</h2>
          <p className="text-sm text-gray-500 mt-1">現在のご利用プランと支払い状況</p>
        </div>

        <div className="p-6 space-y-6">
          {/* プランステータスカード */}
          <div className={`rounded-xl p-5 border-2 ${
            isActive
              ? "bg-green-50 border-green-200"
              : monitorActive
                ? "bg-blue-50 border-blue-200"
                : "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isActive
                      ? "bg-green-100 text-green-800"
                      : monitorActive
                        ? "bg-blue-100 text-blue-800"
                        : isCanceled
                          ? "bg-red-100 text-red-800"
                          : isPastDue
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                  }`}>
                    {isActive
                      ? "有料プラン（利用中）"
                      : monitorActive
                        ? "モニター無料期間"
                        : isCanceled
                          ? "解約済み"
                          : isPastDue
                            ? "支払い未完了"
                            : "未契約"}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mt-2">
                  {isActive ? "MEO勝ち上げくん 有料プラン" : "MEO勝ち上げくん"}
                </h3>
                {isActive && (
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    月額 1,980円<span className="text-sm font-normal text-gray-500">（税込）</span>
                  </p>
                )}
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                isActive
                  ? "bg-green-100"
                  : monitorActive
                    ? "bg-blue-100"
                    : "bg-gray-100"
              }`}>
                <span className="text-2xl">
                  {isActive ? "💎" : monitorActive ? "🎁" : "📋"}
                </span>
              </div>
            </div>
          </div>

          {/* モニター期間情報 */}
          {monitorActive && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">📅</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-800">モニター無料期間</h4>
                  <p className="text-xs text-blue-600 mt-0.5">
                    2026年7月1日まで全機能を無料でご利用いただけます
                  </p>
                  <p className="text-lg font-bold text-blue-800 mt-1">
                    残り {daysRemaining} 日
                  </p>
                </div>
              </div>
              {!isActive && (
                <p className="text-xs text-blue-500 mt-3 pl-13">
                  モニター期間終了後は月額1,980円の有料プランへの切り替えが必要です。
                  事前にお申し込みいただくとスムーズに移行できます。
                </p>
              )}
            </div>
          )}

          {/* 有料プラン情報（契約中の場合） */}
          {isActive && subscription && (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-500">ステータス</span>
                <span className="text-sm font-medium text-green-600">有効</span>
              </div>
              {subscription.current_period_end && (
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">次回請求日</span>
                  <span className="text-sm font-medium text-gray-800">
                    {new Date(subscription.current_period_end).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
              {subscription.cancel_at_period_end && (
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-sm text-yellow-800 font-medium">
                    解約予約済み
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    現在の期間終了日まではご利用いただけます。
                    解約を取り消す場合は「プラン管理」からお手続きください。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 支払い未完了 */}
          {isPastDue && (
            <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-200">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="text-sm font-bold text-yellow-800">お支払いに問題があります</h4>
                  <p className="text-xs text-yellow-600 mt-1">
                    クレジットカード情報を更新してください。
                    「プラン管理」ボタンからカード情報を変更できます。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 解約済み（モニター期間外） */}
          {isCanceled && !monitorActive && (
            <div className="bg-red-50 rounded-xl p-5 border border-red-200">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚫</span>
                <div>
                  <h4 className="text-sm font-bold text-red-800">プランが解約されています</h4>
                  <p className="text-xs text-red-600 mt-1">
                    引き続きご利用いただくには、有料プランへのお申し込みが必要です。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {/* 有料プラン申し込みボタン */}
            {!isActive && (
              <button
                onClick={handleCheckout}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {actionLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>💳</span>
                    <span>有料プランに申し込む（月額1,980円）</span>
                  </>
                )}
              </button>
            )}

            {/* プラン管理ボタン（契約済みユーザー） */}
            {(isActive || isPastDue || subscription?.cancel_at_period_end) && (
              <button
                onClick={handlePortal}
                disabled={actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-xl font-medium border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <span>⚙️</span>
                    <span>プラン管理（解約・カード変更）</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* プラン内容 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">プラン内容</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "⚡", title: "コンテンツ一括生成", desc: "ブログ・FAQ・GBP投稿・note記事を一括生成" },
              { icon: "🔍", title: "MEO順位チェック", desc: "Googleマップでのキーワード順位を自動計測" },
              { icon: "📊", title: "アナリティクス", desc: "アクセス数・表示回数などの分析ダッシュボード" },
              { icon: "✅", title: "施策チェックリスト", desc: "MEO対策の進捗を管理するチェックリスト" },
              { icon: "⭐", title: "口コミ返信AI", desc: "Googleの口コミに対するAI返信文を生成" },
              { icon: "🖼️", title: "GBP画像生成", desc: "Googleビジネスプロフィール用の画像を生成" },
            ].map((feature) => (
              <div key={feature.title} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <span className="text-xl flex-shrink-0 mt-0.5">{feature.icon}</span>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">{feature.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
