"use client";

import { useState, useEffect, useMemo } from "react";
import { RankingHistory, TopPlace } from "@/lib/ranking-types";
import { getRankingHistory } from "@/lib/supabase-storage";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";

interface Props {
  businessName: string;
  keywords: string[];
}

interface CompetitorStats {
  name: string;
  appearances: number; // 何回TOP3に登場したか
  avgRating: number;
  maxReviews: number;
  keywordsAppeared: string[];
  bestRank: number;
}

const COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316",
];

export default function CompetitorDashboard({ businessName, keywords }: Props) {
  const [history, setHistory] = useState<RankingHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRankingHistory().then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }, []);

  // 競合の統計を算出
  const competitors = useMemo(() => {
    const competitorMap = new Map<string, CompetitorStats>();

    history.forEach((entry) => {
      if (!entry.topThree) return;
      entry.topThree.forEach((place: TopPlace) => {
        if (!place.name) return;
        // 自分の院は除外（部分一致で判定）
        const normalizedBiz = businessName.replace(/[\s\u3000]/g, "").toLowerCase();
        const normalizedPlace = place.name.replace(/[\s\u3000]/g, "").toLowerCase();
        if (
          normalizedPlace.includes(normalizedBiz) ||
          normalizedBiz.includes(normalizedPlace)
        ) {
          return;
        }

        const existing = competitorMap.get(place.name);
        if (existing) {
          existing.appearances += 1;
          if (place.rating && place.rating > 0) {
            existing.avgRating =
              (existing.avgRating * (existing.appearances - 1) + place.rating) /
              existing.appearances;
          }
          if (place.reviews && place.reviews > existing.maxReviews) {
            existing.maxReviews = place.reviews;
          }
          if (!existing.keywordsAppeared.includes(entry.keyword)) {
            existing.keywordsAppeared.push(entry.keyword);
          }
          if (place.rank < existing.bestRank) {
            existing.bestRank = place.rank;
          }
        } else {
          competitorMap.set(place.name, {
            name: place.name,
            appearances: 1,
            avgRating: place.rating || 0,
            maxReviews: place.reviews || 0,
            keywordsAppeared: [entry.keyword],
            bestRank: place.rank,
          });
        }
      });
    });

    return Array.from(competitorMap.values())
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 10);
  }, [history, businessName]);

  // キーワード別の自院 vs 競合TOP の順位比較
  const keywordComparison = useMemo(() => {
    return keywords
      .map((kw) => {
        const kwHistory = history
          .filter((h) => h.keyword === kw)
          .sort(
            (a, b) =>
              new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
          );
        if (kwHistory.length === 0) return null;

        const latest = kwHistory[0];
        const myRank = latest.rank;
        const topCompetitor = latest.topThree?.find((p: TopPlace) => {
          const normalizedBiz = businessName
            .replace(/[\s\u3000]/g, "")
            .toLowerCase();
          const normalizedPlace = p.name
            .replace(/[\s\u3000]/g, "")
            .toLowerCase();
          return (
            !normalizedPlace.includes(normalizedBiz) &&
            !normalizedBiz.includes(normalizedPlace)
          );
        });

        return {
          keyword: kw,
          myRank: myRank ?? 21,
          topCompetitorRank: topCompetitor?.rank ?? 21,
          topCompetitorName: topCompetitor?.name ?? "-",
        };
      })
      .filter(Boolean) as {
      keyword: string;
      myRank: number;
      topCompetitorRank: number;
      topCompetitorName: string;
    }[];
  }, [history, keywords, businessName]);

  // レーダーチャート用データ（自院 vs TOP競合）
  const radarData = useMemo(() => {
    if (competitors.length === 0) return [];
    const topCompetitor = competitors[0];

    // 自院のデータを集計
    const myAppearances = history.filter(
      (h) =>
        h.topThree?.some((p: TopPlace) => {
          const normalizedBiz = businessName
            .replace(/[\s\u3000]/g, "")
            .toLowerCase();
          const normalizedPlace = p.name
            .replace(/[\s\u3000]/g, "")
            .toLowerCase();
          return (
            normalizedPlace.includes(normalizedBiz) ||
            normalizedBiz.includes(normalizedPlace)
          );
        })
    ).length;

    const myLatestRanks = keywords
      .map((kw) => {
        const latest = history
          .filter((h) => h.keyword === kw)
          .sort(
            (a, b) =>
              new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
          )[0];
        return latest?.rank;
      })
      .filter((r): r is number => r !== null && r !== undefined);

    const myAvgRank =
      myLatestRanks.length > 0
        ? myLatestRanks.reduce((a, b) => a + b, 0) / myLatestRanks.length
        : 20;

    // スコア化（20位中の何位かを0-100に変換）
    const rankToScore = (rank: number) =>
      Math.max(0, Math.round(((20 - rank) / 19) * 100));

    return [
      {
        metric: "TOP3登場回数",
        [businessName]: Math.min(100, myAppearances * 10),
        [topCompetitor.name]:
          Math.min(100, topCompetitor.appearances * 10),
      },
      {
        metric: "平均順位",
        [businessName]: rankToScore(myAvgRank),
        [topCompetitor.name]: rankToScore(topCompetitor.bestRank),
      },
      {
        metric: "キーワード網羅率",
        [businessName]: Math.round(
          (myLatestRanks.length / Math.max(keywords.length, 1)) * 100
        ),
        [topCompetitor.name]: Math.round(
          (topCompetitor.keywordsAppeared.length /
            Math.max(keywords.length, 1)) *
            100
        ),
      },
      {
        metric: "口コミ数",
        [businessName]: 50, // 自院の口コミ数は現在取得不可のため仮値
        [topCompetitor.name]: Math.min(
          100,
          Math.round((topCompetitor.maxReviews / 100) * 100)
        ),
      },
      {
        metric: "評価",
        [businessName]: 80, // 自院の評価は現在取得不可のため仮値
        [topCompetitor.name]: Math.round(
          (topCompetitor.avgRating / 5) * 100
        ),
      },
    ];
  }, [competitors, history, keywords, businessName]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">競合データを分析中...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <p className="text-4xl mb-4">🏢</p>
        <p className="text-gray-500 text-lg">競合データがありません</p>
        <p className="text-gray-400 text-sm mt-2">
          「順位チェック」でランキングを取得すると、競合分析ができます
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 競合出現頻度ランキング */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-gray-800 mb-1">競合出現頻度ランキング</h3>
        <p className="text-xs text-gray-400 mb-4">
          順位チェック時にTOP3に登場した回数が多い競合院
        </p>

        {competitors.length === 0 ? (
          <p className="text-center text-gray-400 py-8">競合データが不足しています</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, competitors.length * 40)}>
            <BarChart
              data={competitors}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(value) => [`${value}回`, "TOP3登場"]}
                contentStyle={{
                  borderRadius: "8px",
                  fontSize: "12px",
                  border: "1px solid #e5e7eb",
                }}
              />
              <Bar dataKey="appearances" name="TOP3登場回数" radius={[0, 6, 6, 0]}>
                {competitors.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* キーワード別 自院 vs 競合TOP */}
      {keywordComparison.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-1">
            キーワード別 自院 vs 競合1位
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            各キーワードでの自院順位と競合トップの比較
          </p>

          <div className="space-y-3">
            {keywordComparison.map((item) => {
              const myBetter = item.myRank <= item.topCompetitorRank;
              return (
                <div
                  key={item.keyword}
                  className="flex items-center gap-4 px-4 py-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium text-gray-700 min-w-[100px] truncate text-sm">
                    {item.keyword}
                  </span>

                  <div className="flex-1 flex items-center gap-3">
                    {/* 自院 */}
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                        myBetter
                          ? "bg-green-100 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      <span className="text-xs text-gray-400">自院:</span>
                      {item.myRank <= 20 ? `${item.myRank}位` : "圏外"}
                    </div>

                    <span className="text-gray-300">vs</span>

                    {/* 競合 */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm">
                      <span className="text-xs text-gray-400 truncate max-w-[120px]">
                        {item.topCompetitorName}:
                      </span>
                      <span className="font-medium">
                        {item.topCompetitorRank <= 20
                          ? `${item.topCompetitorRank}位`
                          : "圏外"}
                      </span>
                    </div>
                  </div>

                  {/* 差分 */}
                  {item.myRank <= 20 && item.topCompetitorRank <= 20 && (
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        myBetter
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {myBetter ? "優勢" : "劣勢"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* レーダーチャート比較 */}
      {radarData.length > 0 && competitors.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-1">総合比較レーダー</h3>
          <p className="text-xs text-gray-400 mb-4">
            自院 vs 最頻出競合「{competitors[0].name}」の5指標比較
          </p>

          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar
                name={businessName || "自院"}
                dataKey={businessName || "自院"}
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Radar
                name={competitors[0].name}
                dataKey={competitors[0].name}
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.1}
                strokeWidth={2}
              />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 競合詳細テーブル */}
      {competitors.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4">競合院詳細</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    院名
                  </th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">
                    TOP3登場
                  </th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">
                    最高順位
                  </th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">
                    評価
                  </th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">
                    口コミ
                  </th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">
                    出現キーワード
                  </th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((comp, i) => (
                  <tr
                    key={comp.name}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="py-2.5 px-3 font-medium text-gray-700 max-w-[200px] truncate">
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-2"
                        style={{
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                      {comp.name}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-600">
                      {comp.appearances}回
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          comp.bestRank === 1
                            ? "bg-yellow-400 text-white"
                            : comp.bestRank === 2
                            ? "bg-gray-300 text-white"
                            : comp.bestRank === 3
                            ? "bg-amber-600 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {comp.bestRank}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-yellow-500">
                      {comp.avgRating > 0
                        ? `${"★".repeat(Math.round(comp.avgRating))} ${comp.avgRating.toFixed(1)}`
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-gray-600">
                      {comp.maxReviews > 0 ? `${comp.maxReviews}件` : "-"}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {comp.keywordsAppeared.slice(0, 3).map((kw) => (
                          <span
                            key={kw}
                            className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded"
                          >
                            {kw}
                          </span>
                        ))}
                        {comp.keywordsAppeared.length > 3 && (
                          <span className="text-[10px] text-gray-400">
                            +{comp.keywordsAppeared.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
