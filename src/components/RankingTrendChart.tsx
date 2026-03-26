"use client";

import { useState, useMemo } from "react";
import { RankingHistory } from "@/lib/ranking-types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, startOfWeek, parseISO, isValid } from "date-fns";
import { ja } from "date-fns/locale";

interface Props {
  history: RankingHistory[];
  keywords: string[];
}

type ViewMode = "daily" | "weekly";

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

function safeParseDate(dateStr: string): Date | null {
  try {
    const d = parseISO(dateStr);
    if (isValid(d)) return d;
    const fallback = new Date(dateStr);
    if (isValid(fallback)) return fallback;
    return null;
  } catch {
    return null;
  }
}

export default function RankingTrendChart({ history, keywords }: Props) {
  const [selectedKeyword, setSelectedKeyword] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("daily");

  const chartData = useMemo(() => {
    const filteredHistory =
      selectedKeyword === "all"
        ? history
        : history.filter((h) => h.keyword === selectedKeyword);

    if (viewMode === "daily") {
      // 日別: 日付ごとにグループ化
      const dateMap = new Map<string, Record<string, number | null>>();
      filteredHistory.forEach((entry) => {
        const d = safeParseDate(entry.checkedAt);
        if (!d) return;
        const dateKey = format(d, "MM/dd");
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {});
        }
        const existing = dateMap.get(dateKey)![entry.keyword];
        // 同日同キーワードは最新のみ
        if (existing === undefined || existing === null) {
          dateMap.get(dateKey)![entry.keyword] = entry.rank;
        }
      });

      return Array.from(dateMap.entries())
        .map(([date, ranks]) => ({ date, ...ranks }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } else {
      // 週別: 週の開始日でグループ化
      const weekMap = new Map<string, Record<string, { total: number; count: number }>>();
      filteredHistory.forEach((entry) => {
        const d = safeParseDate(entry.checkedAt);
        if (!d) return;
        const weekStart = startOfWeek(d, { locale: ja });
        const weekKey = format(weekStart, "MM/dd", { locale: ja });
        if (!weekMap.has(weekKey)) {
          weekMap.set(weekKey, {});
        }
        const kwData = weekMap.get(weekKey)!;
        if (!kwData[entry.keyword]) {
          kwData[entry.keyword] = { total: 0, count: 0 };
        }
        if (entry.rank !== null) {
          kwData[entry.keyword].total += entry.rank;
          kwData[entry.keyword].count += 1;
        }
      });

      return Array.from(weekMap.entries())
        .map(([date, kwData]) => {
          const record: Record<string, unknown> = { date: `w/${date}` };
          Object.entries(kwData).forEach(([kw, { total, count }]) => {
            record[kw] = count > 0 ? Math.round(total / count) : null;
          });
          return record;
        })
        .sort((a, b) => (a.date as string).localeCompare(b.date as string));
    }
  }, [history, selectedKeyword, viewMode]);

  const displayKeywords =
    selectedKeyword === "all" ? keywords : [selectedKeyword];

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <p className="text-4xl mb-4">📈</p>
        <p className="text-gray-500 text-lg">順位推移データがありません</p>
        <p className="text-gray-400 text-sm mt-2">
          「順位チェック」で一括チェックを実行するとデータが蓄積されます
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* コントロール */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* 日別/週別切替 */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("daily")}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "daily"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              日別
            </button>
            <button
              onClick={() => setViewMode("weekly")}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === "weekly"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              週別
            </button>
          </div>

          {/* キーワード選択 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedKeyword("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedKeyword === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              すべて
            </button>
            {keywords.map((kw) => (
              <button
                key={kw}
                onClick={() => setSelectedKeyword(kw)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedKeyword === kw
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* チャート */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">
          順位推移グラフ（{viewMode === "daily" ? "日別" : "週別平均"}）
        </h3>
        {chartData.length === 0 ? (
          <p className="text-center text-gray-400 py-8">表示するデータがありません</p>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                reversed
                domain={[1, "auto"]}
                tick={{ fontSize: 11 }}
                label={{
                  value: "順位",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 12,
                }}
              />
              <Tooltip
                formatter={(value) => (value ? `${value}位` : "圏外")}
                contentStyle={{
                  borderRadius: "8px",
                  fontSize: "12px",
                  border: "1px solid #e5e7eb",
                }}
              />
              <Legend />
              {displayKeywords.map((kw, i) => (
                <Line
                  key={kw}
                  type="monotone"
                  dataKey={kw}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                  name={kw}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 変動サマリー */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">キーワード別変動サマリー</h3>
        <div className="grid gap-3">
          {keywords.map((kw) => {
            const kwHistory = history
              .filter((h) => h.keyword === kw)
              .sort(
                (a, b) =>
                  new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
              );
            if (kwHistory.length === 0) return null;

            const latest = kwHistory[0];
            const weekAgo = kwHistory.find((h) => {
              const diff =
                new Date(kwHistory[0].checkedAt).getTime() -
                new Date(h.checkedAt).getTime();
              return diff >= 6 * 24 * 60 * 60 * 1000;
            });
            const monthAgo = kwHistory.find((h) => {
              const diff =
                new Date(kwHistory[0].checkedAt).getTime() -
                new Date(h.checkedAt).getTime();
              return diff >= 25 * 24 * 60 * 60 * 1000;
            });

            const weekChange =
              latest.rank !== null && weekAgo?.rank !== null && weekAgo
                ? weekAgo.rank - latest.rank
                : null;
            const monthChange =
              latest.rank !== null && monthAgo?.rank !== null && monthAgo
                ? monthAgo.rank - latest.rank
                : null;

            return (
              <div
                key={kw}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-700 min-w-[100px] truncate">
                    {kw}
                  </span>
                  <span className="text-lg font-bold text-gray-800">
                    {latest.rank !== null ? `${latest.rank}位` : "圏外"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {weekChange !== null && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400">週間</p>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          weekChange > 0
                            ? "bg-green-100 text-green-700"
                            : weekChange < 0
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {weekChange > 0
                          ? `+${weekChange}`
                          : weekChange < 0
                          ? `${weekChange}`
                          : "0"}
                      </span>
                    </div>
                  )}
                  {monthChange !== null && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400">月間</p>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          monthChange > 0
                            ? "bg-green-100 text-green-700"
                            : monthChange < 0
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {monthChange > 0
                          ? `+${monthChange}`
                          : monthChange < 0
                          ? `${monthChange}`
                          : "0"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
