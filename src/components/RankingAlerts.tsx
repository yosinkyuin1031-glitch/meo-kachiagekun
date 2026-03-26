"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { RankingHistory } from "@/lib/ranking-types";
import { getRankingHistory } from "@/lib/supabase-storage";

interface Alert {
  id: string;
  keyword: string;
  type: "drop" | "rise" | "lost" | "recovered";
  message: string;
  severity: "critical" | "warning" | "info" | "success";
  previousRank: number | null;
  currentRank: number | null;
  change: number | null;
  checkedAt: string;
  dismissed: boolean;
}

const ALERT_THRESHOLD_DROP = 3; // 3位以上ダウンで警告
const ALERT_THRESHOLD_CRITICAL = 5; // 5位以上ダウンで緊急

export default function RankingAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // ローカルストレージから非表示済みを復元
  useEffect(() => {
    try {
      const stored = localStorage.getItem("meo_dismissed_alerts");
      if (stored) {
        setDismissedIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // 無視
    }
  }, []);

  const analyzeAlerts = useCallback(
    (history: RankingHistory[]): Alert[] => {
      const alertList: Alert[] = [];

      // キーワード別にグループ化
      const keywordGroups = new Map<string, RankingHistory[]>();
      history.forEach((h) => {
        if (!keywordGroups.has(h.keyword)) {
          keywordGroups.set(h.keyword, []);
        }
        keywordGroups.get(h.keyword)!.push(h);
      });

      keywordGroups.forEach((entries, keyword) => {
        // 日付順（新しい順）にソート
        const sorted = entries.sort(
          (a, b) =>
            new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
        );

        if (sorted.length < 2) return;

        const latest = sorted[0];
        const previous = sorted[1];

        const alertId = `${keyword}-${latest.checkedAt}`;

        // 圏外に落ちた
        if (latest.rank === null && previous.rank !== null) {
          alertList.push({
            id: alertId,
            keyword,
            type: "lost",
            message: `「${keyword}」が圏外になりました（前回: ${previous.rank}位）`,
            severity: "critical",
            previousRank: previous.rank,
            currentRank: null,
            change: null,
            checkedAt: latest.checkedAt,
            dismissed: dismissedIds.has(alertId),
          });
          return;
        }

        // 圏外から復帰
        if (latest.rank !== null && previous.rank === null) {
          alertList.push({
            id: alertId,
            keyword,
            type: "recovered",
            message: `「${keyword}」が圏外から${latest.rank}位に復帰しました`,
            severity: "success",
            previousRank: null,
            currentRank: latest.rank,
            change: null,
            checkedAt: latest.checkedAt,
            dismissed: dismissedIds.has(alertId),
          });
          return;
        }

        if (latest.rank === null || previous.rank === null) return;

        const change = previous.rank - latest.rank; // 正=上昇、負=下降

        // 大幅下降
        if (change <= -ALERT_THRESHOLD_CRITICAL) {
          alertList.push({
            id: alertId,
            keyword,
            type: "drop",
            message: `「${keyword}」が${Math.abs(change)}位ダウン（${previous.rank}位 → ${latest.rank}位）`,
            severity: "critical",
            previousRank: previous.rank,
            currentRank: latest.rank,
            change,
            checkedAt: latest.checkedAt,
            dismissed: dismissedIds.has(alertId),
          });
        } else if (change <= -ALERT_THRESHOLD_DROP) {
          alertList.push({
            id: alertId,
            keyword,
            type: "drop",
            message: `「${keyword}」が${Math.abs(change)}位ダウン（${previous.rank}位 → ${latest.rank}位）`,
            severity: "warning",
            previousRank: previous.rank,
            currentRank: latest.rank,
            change,
            checkedAt: latest.checkedAt,
            dismissed: dismissedIds.has(alertId),
          });
        }

        // 大幅上昇（ポジティブアラート）
        if (change >= ALERT_THRESHOLD_DROP) {
          alertList.push({
            id: alertId,
            keyword,
            type: "rise",
            message: `「${keyword}」が${change}位アップ（${previous.rank}位 → ${latest.rank}位）`,
            severity: "info",
            previousRank: previous.rank,
            currentRank: latest.rank,
            change,
            checkedAt: latest.checkedAt,
            dismissed: dismissedIds.has(alertId),
          });
        }
      });

      // 重要度順にソート
      const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
      return alertList.sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      );
    },
    [dismissedIds]
  );

  useEffect(() => {
    getRankingHistory().then((h) => {
      const analyzed = analyzeAlerts(h);
      setAlerts(analyzed);
      setLoading(false);
    });
  }, [analyzeAlerts]);

  const dismissAlert = (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a))
    );
    try {
      localStorage.setItem(
        "meo_dismissed_alerts",
        JSON.stringify([...newDismissed])
      );
    } catch {
      // 無視
    }
  };

  const dismissAll = () => {
    const newDismissed = new Set(dismissedIds);
    alerts.forEach((a) => newDismissed.add(a.id));
    setDismissedIds(newDismissed);
    setAlerts((prev) => prev.map((a) => ({ ...a, dismissed: true })));
    try {
      localStorage.setItem(
        "meo_dismissed_alerts",
        JSON.stringify([...newDismissed])
      );
    } catch {
      // 無視
    }
  };

  const visibleAlerts = useMemo(
    () =>
      showDismissed ? alerts : alerts.filter((a) => !a.dismissed),
    [alerts, showDismissed]
  );

  const criticalCount = alerts.filter(
    (a) => !a.dismissed && a.severity === "critical"
  ).length;
  const warningCount = alerts.filter(
    (a) => !a.dismissed && a.severity === "warning"
  ).length;

  const severityStyles = {
    critical: {
      bg: "bg-red-50",
      border: "border-red-200",
      icon: "bg-red-500",
      text: "text-red-800",
      badge: "bg-red-100 text-red-700",
      label: "緊急",
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      icon: "bg-amber-500",
      text: "text-amber-800",
      badge: "bg-amber-100 text-amber-700",
      label: "注意",
    },
    info: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      icon: "bg-blue-500",
      text: "text-blue-800",
      badge: "bg-blue-100 text-blue-700",
      label: "上昇",
    },
    success: {
      bg: "bg-green-50",
      border: "border-green-200",
      icon: "bg-green-500",
      text: "text-green-800",
      badge: "bg-green-100 text-green-700",
      label: "復帰",
    },
  };

  if (loading) {
    return null;
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 rounded-xl border border-green-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">
              順位アラートはありません
            </p>
            <p className="text-xs text-green-600">
              大幅な順位変動が検出されると、ここに通知が表示されます
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-800">順位アラート</h3>
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              {criticalCount} 件の緊急アラート
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
              {warningCount} 件の注意
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDismissed(!showDismissed)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showDismissed ? "非表示を隠す" : "非表示を表示"}
          </button>
          {visibleAlerts.length > 0 && (
            <button
              onClick={dismissAll}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              すべて既読にする
            </button>
          )}
        </div>
      </div>

      {/* アラートリスト */}
      <div className="space-y-2">
        {visibleAlerts.map((alert) => {
          const style = severityStyles[alert.severity];
          return (
            <div
              key={alert.id}
              className={`${style.bg} border ${style.border} rounded-lg p-4 transition-all ${
                alert.dismissed ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-6 h-6 ${style.icon} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}
                >
                  {alert.severity === "critical" && (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  )}
                  {alert.severity === "warning" && (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01"
                      />
                    </svg>
                  )}
                  {alert.severity === "info" && (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                  )}
                  {alert.severity === "success" && (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${style.badge}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(alert.checkedAt).toLocaleDateString("ja-JP", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className={`text-sm font-medium ${style.text}`}>
                    {alert.message}
                  </p>

                  {/* 改善アドバイス（下降アラート用） */}
                  {(alert.severity === "critical" ||
                    alert.severity === "warning") && (
                    <div className="mt-2 text-xs text-gray-500 bg-white/60 rounded p-2">
                      <p className="font-medium text-gray-600 mb-1">
                        改善のヒント:
                      </p>
                      <ul className="space-y-0.5 list-disc list-inside">
                        <li>GBP投稿を強化（週2回以上）</li>
                        <li>口コミを積極的に収集・返信</li>
                        <li>
                          「{alert.keyword}
                          」関連のブログ記事を追加
                        </li>
                        <li>サイテーション（ポータルサイト登録）を確認</li>
                      </ul>
                    </div>
                  )}
                </div>

                {!alert.dismissed && (
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                    title="非表示にする"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
