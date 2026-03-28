"use client";

import { useState } from "react";
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
import { format } from "date-fns";

interface Props {
  history: RankingHistory[];
  keywords: string[];
}

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

export default function HistoryChart({ history, keywords }: Props) {
  const [selectedKeyword, setSelectedKeyword] = useState<string>("all");

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <p className="text-4xl mb-4">📊</p>
        <p className="text-gray-500 text-lg">まだ順位データがありません</p>
        <p className="text-gray-400 text-sm mt-2">
          「ランキングチェック」タブで一括チェックを実行してください
        </p>
      </div>
    );
  }

  const dateMap = new Map<string, Record<string, number | null>>();
  const filteredHistory =
    selectedKeyword === "all"
      ? history
      : history.filter((h) => h.keyword === selectedKeyword);

  filteredHistory.forEach((entry) => {
    const dateKey = format(new Date(entry.checkedAt), "MM/dd HH:mm");
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {});
    }
    dateMap.get(dateKey)![entry.keyword] = entry.rank;
  });

  const chartData = Array.from(dateMap.entries())
    .map(([date, ranks]) => ({ date, ...ranks }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const displayKeywords =
    selectedKeyword === "all" ? keywords : [selectedKeyword];

  const beforeAfter = keywords.map((kw) => {
    const kwHistory = history
      .filter((h) => h.keyword === kw)
      .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime());
    if (kwHistory.length === 0) return null;
    const first = kwHistory[0];
    const last = kwHistory[kwHistory.length - 1];
    const change =
      first.rank !== null && last.rank !== null ? first.rank - last.rank : null;
    return {
      keyword: kw,
      before: first.rank,
      beforeDate: format(new Date(first.checkedAt), "MM/dd"),
      after: last.rank,
      afterDate: format(new Date(last.checkedAt), "MM/dd"),
      change,
    };
  }).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-4">
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

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">順位推移グラフ</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              reversed
              domain={[1, "auto"]}
              tick={{ fontSize: 11 }}
              label={{ value: "順位", angle: -90, position: "insideLeft", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => (value ? `${value}位` : "圏外")}
              contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
            />
            <Legend
              wrapperStyle={{ fontSize: "13px", lineHeight: "20px", paddingTop: "8px" }}
              iconSize={12}
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
            />
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
      </div>

      {beforeAfter.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4">ビフォーアフター比較</h3>
          <div className="grid gap-3">
            {beforeAfter.map((item) => {
              if (!item) return null;
              return (
                <div key={item.keyword} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700 w-24 truncate">{item.keyword}</span>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">{item.beforeDate}</p>
                      <p className="text-lg font-bold text-gray-600">
                        {item.before !== null ? `${item.before}位` : "圏外"}
                      </p>
                    </div>
                    <span className="text-gray-300 text-xl">→</span>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">{item.afterDate}</p>
                      <p className="text-lg font-bold text-gray-800">
                        {item.after !== null ? `${item.after}位` : "圏外"}
                      </p>
                    </div>
                    {item.change !== null && (
                      <span className={`text-sm font-bold px-2 py-1 rounded ${
                        item.change > 0 ? "bg-green-100 text-green-700"
                          : item.change < 0 ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {item.change > 0 ? `↑${item.change}` : item.change < 0 ? `↓${Math.abs(item.change)}` : "→ 変動なし"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
