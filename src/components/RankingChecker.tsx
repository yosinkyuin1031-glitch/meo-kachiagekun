"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { BusinessProfile } from "@/lib/types";
import { RankingResult, RankingHistory, TopPlace } from "@/lib/ranking-types";
import { getRankingHistory, addRankingHistory, getSerpApiKey, saveSerpApiKey } from "@/lib/supabase-storage";
import RankingTable from "./RankingTable";
import HistoryChart from "./HistoryChart";
import RankingTrendChart from "./RankingTrendChart";
import CompetitorDashboard from "./CompetitorDashboard";
import ReportPdfExport from "./ReportPdfExport";
import RankingAlerts from "./RankingAlerts";
import { getContents } from "@/lib/supabase-storage";
import { GeneratedContent } from "@/lib/types";

interface Props {
  profile: BusinessProfile;
  onRegenerateKeyword?: (keyword: string) => void;
}

type SubTab = "check" | "history" | "trend" | "competitor" | "report" | "strategy";

/** キーワードごとの最新 vs 前回比較データ */
interface KeywordComparison {
  keyword: string;
  latestRank: number | null;
  latestDate: string;
  previousRank: number | null;
  previousDate: string | null;
  diff: number | null; // 正=改善, 負=悪化, 0=変動なし, null=比較不可
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 履歴からキーワードごとの最新/前回比較を算出 */
function buildComparisons(history: RankingHistory[], keywords: string[]): KeywordComparison[] {
  return keywords.map((kw) => {
    const kwHistory = history
      .filter((h) => h.keyword === kw)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

    if (kwHistory.length === 0) {
      return null;
    }

    const latest = kwHistory[0];

    // 前回 = 最新とは異なるチェック日のもの（同一日時のチェックを除外）
    const latestDateStr = formatDate(latest.checkedAt);
    const previous = kwHistory.find((h) => formatDate(h.checkedAt) !== latestDateStr) ?? null;

    let diff: number | null = null;
    if (latest.rank !== null && previous?.rank !== null && previous !== null) {
      // 順位は小さい方が良い。前回rank - 今回rank = 正なら改善
      diff = previous.rank - latest.rank;
    }

    return {
      keyword: kw,
      latestRank: latest.rank,
      latestDate: latest.checkedAt,
      previousRank: previous?.rank ?? null,
      previousDate: previous?.checkedAt ?? null,
      diff,
    } as KeywordComparison;
  }).filter(Boolean) as KeywordComparison[];
}

/** 比較バッジ表示 */
function ComparisonBadge({ comp }: { comp: KeywordComparison }) {
  const rankText = comp.latestRank !== null ? `${comp.latestRank}位` : "圏外";

  if (comp.previousRank === null || comp.previousDate === null) {
    return (
      <span className="text-gray-600 font-bold">
        {rankText} <span className="text-xs text-gray-400">(初回)</span>
      </span>
    );
  }

  const prevText = comp.previousRank !== null ? `${comp.previousRank}位` : "圏外";

  if (comp.diff === null) {
    return (
      <span className="text-gray-600 font-bold">
        {rankText} <span className="text-xs text-gray-400">(前回: {prevText})</span>
      </span>
    );
  }

  if (comp.diff > 0) {
    return (
      <span className="text-green-700 font-bold">
        {rankText}{" "}
        <span className="text-xs">
          (前回: {prevText}{" "}
          <span className="inline-flex items-center text-green-600">
            ↑{comp.diff}
          </span>
          )
        </span>
      </span>
    );
  }

  if (comp.diff < 0) {
    return (
      <span className="text-red-700 font-bold">
        {rankText}{" "}
        <span className="text-xs">
          (前回: {prevText}{" "}
          <span className="inline-flex items-center text-red-600">
            ↓{Math.abs(comp.diff)}
          </span>
          )
        </span>
      </span>
    );
  }

  // diff === 0
  return (
    <span className="text-gray-600 font-bold">
      {rankText}{" "}
      <span className="text-xs text-gray-400">
        (前回: {prevText} → 変動なし)
      </span>
    </span>
  );
}

/** 順位変動アラート */
interface RankAlert {
  keyword: string;
  type: "up" | "down" | "entered" | "dropped";
  currentRank: number | null;
  previousRank: number | null;
  diff: number;
}

function buildAlerts(comparisons: KeywordComparison[]): RankAlert[] {
  const alerts: RankAlert[] = [];
  for (const comp of comparisons) {
    if (comp.previousRank === null && comp.latestRank !== null && comp.previousDate !== null) {
      alerts.push({ keyword: comp.keyword, type: "entered", currentRank: comp.latestRank, previousRank: null, diff: 0 });
      continue;
    }
    if (comp.previousRank !== null && comp.latestRank === null && comp.previousDate !== null) {
      alerts.push({ keyword: comp.keyword, type: "dropped", currentRank: null, previousRank: comp.previousRank, diff: 0 });
      continue;
    }
    if (comp.diff !== null && Math.abs(comp.diff) >= 3) {
      alerts.push({ keyword: comp.keyword, type: comp.diff > 0 ? "up" : "down", currentRank: comp.latestRank, previousRank: comp.previousRank, diff: Math.abs(comp.diff) });
    }
  }
  return alerts;
}

interface CompetitorFrequency {
  name: string;
  count: number;
  keywords: string[];
  bestRank: number;
  avgRating: number | null;
}

function buildCompetitorFrequency(results: RankingResult[], businessName: string): CompetitorFrequency[] {
  const map = new Map<string, { count: number; keywords: string[]; bestRank: number; ratings: number[] }>();
  for (const r of results) {
    for (const place of r.topThree) {
      if (place.name.includes(businessName)) continue;
      const existing = map.get(place.name);
      if (existing) {
        existing.count++;
        existing.keywords.push(r.keyword);
        if (place.rank < existing.bestRank) existing.bestRank = place.rank;
        if (place.rating) existing.ratings.push(place.rating);
      } else {
        map.set(place.name, { count: 1, keywords: [r.keyword], bestRank: place.rank, ratings: place.rating ? [place.rating] : [] });
      }
    }
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      keywords: data.keywords,
      bestRank: data.bestRank,
      avgRating: data.ratings.length > 0 ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length : null,
    }))
    .sort((a, b) => b.count - a.count);
}

function AlertBanners({ alerts }: { alerts: RankAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        if (alert.type === "entered") {
          return (
            <div key={`alert-${alert.keyword}`} className="bg-emerald-50 border border-emerald-300 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-xl shrink-0">🎉</span>
              <p className="text-sm font-medium text-emerald-800">
                「{alert.keyword}」が圏外から <span className="font-bold">{alert.currentRank}位</span> にランクインしました
              </p>
            </div>
          );
        }
        if (alert.type === "dropped") {
          return (
            <div key={`alert-${alert.keyword}`} className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <p className="text-sm font-medium text-red-800">
                「{alert.keyword}」が {alert.previousRank}位 から <span className="font-bold">圏外</span> に落ちました
              </p>
            </div>
          );
        }
        if (alert.type === "down") {
          return (
            <div key={`alert-${alert.keyword}`} className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <p className="text-sm font-medium text-red-800">
                「{alert.keyword}」の順位が <span className="font-bold">{alert.diff}位下がりました</span>（{alert.previousRank}位 → {alert.currentRank}位）
              </p>
            </div>
          );
        }
        return (
          <div key={`alert-${alert.keyword}`} className="bg-green-50 border border-green-300 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-xl shrink-0">🚀</span>
            <p className="text-sm font-medium text-green-800">
              「{alert.keyword}」の順位が <span className="font-bold">{alert.diff}位上がりました</span>（{alert.previousRank}位 → {alert.currentRank}位）
            </p>
          </div>
        );
      })}
    </div>
  );
}

function CompetitorAnalysisPanel({ results, businessName }: { results: RankingResult[]; businessName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const competitors = useMemo(() => buildCompetitorFrequency(results, businessName), [results, businessName]);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🏢</span>
          <h3 className="font-bold text-gray-800">競合分析</h3>
          <span className="text-xs text-gray-400 ml-1">（{competitors.length}院検出）</span>
        </div>
        <span className="text-gray-400 text-sm">{isOpen ? "▲ 閉じる" : "▼ 開く"}</span>
      </button>

      {isOpen && (
        <div className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">キーワード</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">自院順位</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">1位</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">2位</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-center">3位</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((result) => {
                  const isWinning = result.rank !== null && result.rank <= 3;
                  const top1 = result.topThree.find((p) => p.rank === 1);
                  const top2 = result.topThree.find((p) => p.rank === 2);
                  const top3 = result.topThree.find((p) => p.rank === 3);
                  return (
                    <tr key={`comp-${result.keyword}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{result.keyword}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold ${
                          result.rank === null ? "bg-gray-100 text-gray-400" : isWinning ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {result.rank !== null ? `${result.rank}位` : "圏外"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CompetitorCell place={top1} businessName={result.businessName} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CompetitorCell place={top2} businessName={result.businessName} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CompetitorCell place={top3} businessName={result.businessName} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {competitors.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-4">
              <h4 className="font-bold text-gray-700 text-sm mb-3">競合出現頻度ランキング</h4>
              <div className="space-y-2">
                {competitors.slice(0, 10).map((comp, i) => (
                  <div key={comp.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? "bg-red-500 text-white" : i === 1 ? "bg-orange-400 text-white" : i === 2 ? "bg-amber-400 text-white" : "bg-gray-300 text-gray-700"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{comp.name}</p>
                      <p className="text-xs text-gray-400">
                        上位出現: {comp.count}回 / 最高{comp.bestRank}位
                        {comp.avgRating !== null && ` / 評価 ${comp.avgRating.toFixed(1)}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {comp.keywords.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-500">{kw}</span>
                      ))}
                      {comp.keywords.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 text-gray-400">+{comp.keywords.length - 3}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompetitorCell({ place, businessName }: { place?: TopPlace; businessName: string }) {
  if (!place) return <span className="text-xs text-gray-300">-</span>;
  const isSelf = place.name.includes(businessName);
  return (
    <div className={`text-xs px-1 ${isSelf ? "text-blue-700 font-bold" : "text-gray-600"}`}>
      <p className="truncate max-w-[120px] mx-auto" title={place.name}>
        {isSelf ? "★ 自院" : place.name}
      </p>
      {place.rating && (
        <p className="text-yellow-500 text-[10px]">{"★".repeat(Math.round(place.rating))} {place.rating.toFixed(1)}</p>
      )}
    </div>
  );
}

/** レポートをwindow.print()で出力する */
function openReportWindow(
  profile: BusinessProfile,
  comparisons: KeywordComparison[],
  history: RankingHistory[],
  keywords: string[]
) {
  const reportDate = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // 統計計算
  const ranked = comparisons.filter((c) => c.latestRank !== null);
  const improved = comparisons.filter((c) => c.diff !== null && c.diff > 0);
  const declined = comparisons.filter((c) => c.diff !== null && c.diff < 0);
  const avgRank =
    ranked.length > 0
      ? (ranked.reduce((sum, c) => sum + (c.latestRank ?? 0), 0) / ranked.length).toFixed(1)
      : "-";

  // グラフ用SVGデータ生成（シンプルな折れ線グラフ）
  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

  // 日付ごとのデータ整理
  const dateMap = new Map<string, Record<string, number | null>>();
  history.forEach((entry) => {
    const d = new Date(entry.checkedAt);
    const dateKey = `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
    dateMap.get(dateKey)![entry.keyword] = entry.rank;
  });
  const sortedDates = Array.from(dateMap.keys()).sort();

  // SVGグラフ生成
  let chartSvg = "";
  if (sortedDates.length >= 2) {
    const width = 700;
    const height = 300;
    const padding = { top: 30, right: 20, bottom: 40, left: 50 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    let maxRank = 20;
    dateMap.forEach((ranks) => {
      Object.values(ranks).forEach((r) => {
        if (r !== null && r > maxRank) maxRank = r;
      });
    });

    const xStep = sortedDates.length > 1 ? plotW / (sortedDates.length - 1) : plotW;

    // グリッドライン
    let gridLines = "";
    for (let r = 1; r <= maxRank; r += Math.max(1, Math.floor(maxRank / 5))) {
      const y = padding.top + (r - 1) / (maxRank - 1) * plotH;
      gridLines += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#f0f0f0" stroke-width="1"/>`;
      gridLines += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#94a3b8">${r}位</text>`;
    }

    // X軸ラベル
    let xLabels = "";
    sortedDates.forEach((date, i) => {
      const x = padding.left + i * xStep;
      xLabels += `<text x="${x}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#94a3b8">${date}</text>`;
    });

    // 各キーワードの折れ線
    let lines = "";
    let legendHtml = "";
    keywords.forEach((kw, kwIdx) => {
      const color = COLORS[kwIdx % COLORS.length];
      const points: string[] = [];
      sortedDates.forEach((date, dateIdx) => {
        const rank = dateMap.get(date)?.[kw];
        if (rank !== null && rank !== undefined) {
          const x = padding.left + dateIdx * xStep;
          const y = padding.top + (rank - 1) / (maxRank - 1) * plotH;
          points.push(`${x},${y}`);
        }
      });
      if (points.length >= 2) {
        lines += `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2"/>`;
        points.forEach((p) => {
          const [cx, cy] = p.split(",");
          lines += `<circle cx="${cx}" cy="${cy}" r="3" fill="${color}"/>`;
        });
      }
      legendHtml += `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:12px;color:#475569;"><span style="display:inline-block;width:12px;height:3px;background:${color};border-radius:2px;"></span>${kw}</span>`;
    });

    chartSvg = `
      <div class="chart-container">
        <h3 style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:8px;">順位推移グラフ</h3>
        <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:700px;">
          ${gridLines}
          ${xLabels}
          ${lines}
          <text x="${padding.left - 8}" y="${padding.top - 10}" font-size="11" fill="#64748b" text-anchor="end">順位</text>
        </svg>
        <div style="margin-top:8px;">${legendHtml}</div>
      </div>
    `;
  }

  // キーワード別テーブル行
  const tableRows = comparisons
    .sort((a, b) => (a.latestRank ?? 999) - (b.latestRank ?? 999))
    .map((comp) => {
      const rankText = comp.latestRank !== null ? `${comp.latestRank}位` : "圏外";
      const prevText = comp.previousRank !== null ? `${comp.previousRank}位` : comp.previousDate ? "圏外" : "-";
      let diffText = "-";
      let diffClass = "rank-same";
      if (comp.diff !== null) {
        if (comp.diff > 0) {
          diffText = `↑${comp.diff}`;
          diffClass = "rank-up";
        } else if (comp.diff < 0) {
          diffText = `↓${Math.abs(comp.diff)}`;
          diffClass = "rank-down";
        } else {
          diffText = "→ 変動なし";
        }
      }
      return `
        <tr>
          <td>${comp.keyword}</td>
          <td style="text-align:center;font-weight:700;">${rankText}</td>
          <td style="text-align:center;">${prevText}</td>
          <td style="text-align:center;" class="${diffClass}"><strong>${diffText}</strong></td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>MEO順位レポート - ${profile.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", sans-serif;
          padding: 32px;
          color: #1e293b;
          background: white;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header { margin-bottom: 24px; border-bottom: 3px solid #3b82f6; padding-bottom: 16px; }
        .header h1 { font-size: 22px; color: #1e293b; }
        .header .sub { font-size: 13px; color: #64748b; margin-top: 4px; }
        .header .area { font-size: 14px; color: #3b82f6; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #e2e8f0; padding: 10px 14px; font-size: 13px; }
        th { background: #f1f5f9; font-weight: 600; color: #334155; }
        .rank-up { color: #16a34a; }
        .rank-down { color: #dc2626; }
        .rank-same { color: #6b7280; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
        .summary-item { text-align: center; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        .summary-item .num { font-size: 28px; font-weight: 700; }
        .summary-item .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
        .chart-container { margin: 24px 0; page-break-inside: avoid; }
        .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center; }
        .print-btn {
          position: fixed; top: 16px; right: 16px;
          background: #3b82f6; color: white; border: none;
          padding: 10px 20px; border-radius: 8px;
          font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .print-btn:hover { background: #2563eb; }
        @media print {
          .print-btn { display: none; }
          body { padding: 16px; }
        }
      </style>
    </head>
    <body>
      <button class="print-btn" onclick="window.print()">印刷 / PDF保存</button>

      <div class="header">
        <h1>${profile.name} MEO順位レポート</h1>
        <p class="area">${profile.area}</p>
        <p class="sub">レポート日: ${reportDate}</p>
      </div>

      <div class="summary">
        <div class="summary-item">
          <div class="num" style="color:#1e293b;">${comparisons.length}</div>
          <div class="lbl">チェック数</div>
        </div>
        <div class="summary-item">
          <div class="num" style="color:#16a34a;">${improved.length}</div>
          <div class="lbl">順位UP</div>
        </div>
        <div class="summary-item">
          <div class="num" style="color:#dc2626;">${declined.length}</div>
          <div class="lbl">順位DOWN</div>
        </div>
        <div class="summary-item">
          <div class="num" style="color:#3b82f6;">${avgRank}</div>
          <div class="lbl">平均順位</div>
        </div>
      </div>

      <h3 style="font-size:15px;font-weight:700;margin-bottom:8px;">キーワード別順位一覧</h3>
      <table>
        <thead>
          <tr>
            <th>キーワード</th>
            <th style="text-align:center;">現在の順位</th>
            <th style="text-align:center;">前回の順位</th>
            <th style="text-align:center;">変動</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      ${chartSvg}

      <div class="footer">
        MEO勝ち上げくん - MEO + LLMO コンテンツ一括生成 for Business
      </div>
    </body>
    </html>
  `;

  const reportWindow = window.open("", "_blank");
  if (reportWindow) {
    reportWindow.document.write(html);
    reportWindow.document.close();
  }
}

export default function RankingChecker({ profile, onRegenerateKeyword }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("check");
  const [serpApiKey, setSerpApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [results, setResults] = useState<RankingResult[]>([]);
  const [history, setHistory] = useState<RankingHistory[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [contents, setContents] = useState<GeneratedContent[]>([]);

  useEffect(() => {
    getSerpApiKey().then(setSerpApiKey);
    getRankingHistory().then(setHistory);
    getContents().then(setContents);
  }, []);

  const handleSaveKey = async () => {
    await saveSerpApiKey(serpApiKey.trim());
  };

  /** 現在の結果に対して、履歴から前回比較を取得 */
  const resultComparisons = useMemo(() => {
    const map = new Map<string, KeywordComparison>();
    const comps = buildComparisons(history, results.map((r) => r.keyword));
    comps.forEach((c) => map.set(c.keyword, c));
    return map;
  }, [history, results]);

  /** 履歴タブ用：全キーワードの最新vs前回比較 */
  const historyComparisons = useMemo(() => {
    return buildComparisons(history, profile.keywords || []);
  }, [history, profile.keywords]);

  /** 順位変動アラート */
  const resultAlerts = useMemo(() => {
    const comps = Array.from(resultComparisons.values());
    return buildAlerts(comps);
  }, [resultComparisons]);

  /** 順位低下キーワード（3位以上下がったもの） */
  const declinedKeywords = useMemo(() => {
    return historyComparisons.filter((c) => c.diff !== null && c.diff <= -3);
  }, [historyComparisons]);

  /** レポート出力 */
  const handleReport = useCallback(() => {
    const comps = historyComparisons.length > 0
      ? historyComparisons
      : Array.from(resultComparisons.values());
    openReportWindow(profile, comps, history, profile.keywords || []);
  }, [profile, historyComparisons, resultComparisons, history]);

  const handleCheck = async () => {
    if (!profile.name) {
      setError("院名が登録されていません。「設定」タブを開いて、院名を入力してください。");
      return;
    }
    if (!profile.area) {
      setError("エリアが登録されていません。「設定」タブを開いて、エリア（例：新宿区）を入力してください。");
      return;
    }
    if (!profile.keywords || profile.keywords.length === 0) {
      setError("キーワードが登録されていません。「設定」タブを開いて、チェックしたい症状キーワード（例：腰痛、肩こり）を登録してください。");
      return;
    }

    const key = serpApiKey.trim();
    if (!key) {
      setError("SerpApi APIキーが入力されていません。上の入力欄にSerpApiのAPIキーを入力してください。");
      return;
    }

    setChecking(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch("/api/check-ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: profile.name,
          area: profile.area,
          keywords: profile.keywords,
          apiKey: key,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || "";
        if (errMsg.includes("API key") || errMsg.includes("Invalid")) {
          setError("SerpApiのAPIキーが正しくありません。入力内容を確認してください。");
        } else if (errMsg.includes("rate limit") || errMsg.includes("limit")) {
          setError("SerpApiの利用回数が上限に達しました。月の利用回数をserpapi.comで確認してください。");
        } else {
          setError("順位チェックに失敗しました。もう一度お試しください。");
        }
        return;
      }

      setResults(data.results);
      setLastChecked(new Date().toLocaleString("ja-JP"));

      // 履歴に保存
      const newEntries: RankingHistory[] = data.results.map((r: RankingResult) => ({
        id: `${r.keyword}-${Date.now()}`,
        keyword: r.keyword,
        rank: r.rank,
        businessName: r.businessName,
        checkedAt: r.checkedAt,
        topThree: r.topThree,
      }));
      await addRankingHistory(newEntries);
      setHistory(await getRankingHistory());
    } catch {
      setError("インターネット接続を確認して、もう一度お試しください。");
    } finally {
      setChecking(false);
    }
  };

  const stats = {
    total: results.length,
    ranked: results.filter((r) => r.rank !== null).length,
    top3: results.filter((r) => r.rank !== null && r.rank <= 3).length,
    top10: results.filter((r) => r.rank !== null && r.rank <= 10).length,
  };

  return (
    <div className="space-y-6">
      {/* SerpApi APIキー設定 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-3">SerpApi APIキー</h3>
        <div className="flex gap-2">
          <input
            type={showKey ? "text" : "password"}
            value={serpApiKey}
            onChange={(e) => setSerpApiKey(e.target.value)}
            placeholder="SerpApiのAPIキーを入力"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200"
          >
            {showKey ? "隠す" : "表示"}
          </button>
          <button
            onClick={handleSaveKey}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            保存
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          <a href="https://serpapi.com/" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">
            serpapi.com
          </a>
          で無料アカウント作成 → APIキーを取得（月100回まで無料）
        </p>
      </div>

      {/* サブタブ */}
      <div className="flex gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
        {([
          { key: "check" as SubTab, label: "ランキングチェック", icon: "🔍" },
          { key: "history" as SubTab, label: "順位推移", icon: "📊" },
          { key: "trend" as SubTab, label: "推移グラフ", icon: "📈" },
          { key: "competitor" as SubTab, label: "競合比較", icon: "🏢" },
          { key: "report" as SubTab, label: "レポート", icon: "📄" },
          { key: "strategy" as SubTab, label: "戦略分析", icon: "🎯" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              subTab === t.key
                ? "bg-orange-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* アラート通知（常時表示） */}
      <RankingAlerts />

      {subTab === "check" && (
        <div className="space-y-4">
          {/* チェック対象情報 */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800">{profile.name || "未設定"}</h3>
                <p className="text-sm text-gray-500">{profile.area || "エリア未設定"}</p>
              </div>
              <button
                onClick={handleCheck}
                disabled={checking}
                className={`px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                  checking
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-lg"
                }`}
              >
                {checking ? "チェック中..." : "一括チェック"}
              </button>
            </div>

            {profile.keywords && profile.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.keywords.map((kw) => (
                  <span key={kw} className="text-xs px-2 py-1 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {lastChecked && (
              <p className="text-xs text-gray-400 mt-2">最終チェック: {lastChecked}</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* チェック日 表示 + レポート出力 */}
          {results.length > 0 && lastChecked && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="text-sm font-bold text-orange-800">チェック日時</p>
                  <p className="text-lg font-bold text-orange-700">{lastChecked}</p>
                </div>
              </div>
              <button
                onClick={handleReport}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-orange-300 text-orange-700 rounded-xl text-sm font-bold hover:bg-orange-50 hover:border-orange-400 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                レポートを出力
              </button>
            </div>
          )}

          {/* 統計 */}
          {results.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                <p className="text-xs text-gray-500">チェック済み</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.ranked}</p>
                <p className="text-xs text-gray-500">ランクイン</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-green-600">{stats.top3}</p>
                <p className="text-xs text-gray-500">TOP3</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.top10}</p>
                <p className="text-xs text-gray-500">TOP10</p>
              </div>
            </div>
          )}

          {/* 順位変動アラート */}
          {results.length > 0 && resultAlerts.length > 0 && (
            <AlertBanners alerts={resultAlerts} />
          )}

          {/* 順位低下キーワード - コンテンツ再生成提案 */}
          {declinedKeywords.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-red-500">&#9660;</span>
                  順位低下キーワード（{declinedKeywords.length}件）
                </h3>
                <p className="text-xs text-gray-500 mt-1">前回より3位以上下がったキーワードです。コンテンツを再生成して順位回復を目指しましょう。</p>
              </div>
              <div className="divide-y divide-gray-50">
                {declinedKeywords.map((comp) => (
                  <div key={comp.keyword} className="flex items-center justify-between px-6 py-3 hover:bg-red-50/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-800 text-sm">{comp.keyword}</span>
                      <span className="text-xs text-red-600 font-bold">
                        {comp.previousRank}位 → {comp.latestRank !== null ? `${comp.latestRank}位` : "圏外"}（{Math.abs(comp.diff!)}位低下）
                      </span>
                    </div>
                    {onRegenerateKeyword && (
                      <button
                        onClick={() => onRegenerateKeyword(comp.keyword)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        コンテンツを再生成
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 結果テーブル（チェック日・前回比較付き） */}
          {results.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">検索結果一覧</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3 font-medium text-gray-600">キーワード</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-center">順位</th>
                      <th className="px-4 py-3 font-medium text-gray-600 text-center">前回比較</th>
                      <th className="px-4 py-3 font-medium text-gray-600">チェック日</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...results]
                      .sort((a, b) => {
                        if (a.rank === null && b.rank === null) return 0;
                        if (a.rank === null) return 1;
                        if (b.rank === null) return -1;
                        return a.rank - b.rank;
                      })
                      .map((result) => {
                        const comp = resultComparisons.get(result.keyword);
                        return (
                          <tr key={result.keyword} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-800">{result.keyword}</span>
                              <span className="text-xs text-gray-400 ml-1">({result.totalResults}件)</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {result.rank !== null ? (
                                <span
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                                    result.rank === 1
                                      ? "bg-yellow-400 text-white shadow"
                                      : result.rank === 2
                                      ? "bg-gray-300 text-white shadow"
                                      : result.rank === 3
                                      ? "bg-amber-600 text-white shadow"
                                      : result.rank <= 10
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {result.rank}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">圏外</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {comp ? (
                                <ComparisonIndicator comp={comp} />
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {formatDateTime(result.checkedAt)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 既存の詳細テーブル（TOP3表示付き） */}
          {results.length > 0 && <RankingTable results={results} />}

          {/* 競合分析パネル */}
          {results.length > 0 && (
            <CompetitorAnalysisPanel results={results} businessName={profile.name} />
          )}
        </div>
      )}

      {subTab === "strategy" && (
        <StrategyPanel
          history={history}
          keywords={profile.keywords || []}
          area={profile.area}
        />
      )}

      {subTab === "history" && (
        <div className="space-y-6">
          {/* レポート出力ボタン（履歴タブ） */}
          {historyComparisons.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={handleReport}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-blue-300 text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                レポートを出力
              </button>
            </div>
          )}

          {/* 最新 vs 前回 比較カード */}
          {historyComparisons.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4">最新 vs 前回 順位比較</h3>
              <div className="grid gap-3">
                {historyComparisons.map((comp) => (
                  <div
                    key={comp.keyword}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                      comp.diff !== null && comp.diff > 0
                        ? "bg-green-50 border-green-200"
                        : comp.diff !== null && comp.diff < 0
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 truncate block">{comp.keyword}</span>
                      <span className="text-xs text-gray-400">
                        最終: {formatDate(comp.latestDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <ComparisonBadge comp={comp} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <HistoryChart
            history={history}
            keywords={profile.keywords || []}
          />
        </div>
      )}

      {subTab === "trend" && (
        <RankingTrendChart
          history={history}
          keywords={profile.keywords || []}
        />
      )}

      {subTab === "competitor" && (
        <CompetitorDashboard
          businessName={profile.name}
          keywords={profile.keywords || []}
        />
      )}

      {subTab === "report" && (
        <ReportPdfExport
          profile={profile}
          history={history}
          contents={contents}
        />
      )}
    </div>
  );
}

/** A/B/C戦略分析パネル */
function StrategyPanel({ history, keywords, area }: { history: RankingHistory[]; keywords: string[]; area: string }) {
  const comparisons = buildComparisons(history, keywords);

  if (comparisons.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-4xl mb-3">📊</p>
        <h3 className="font-bold text-gray-800 mb-2">まだ順位データがありません</h3>
        <p className="text-sm text-gray-500">「ランキングチェック」タブで一括チェックを実行してください</p>
      </div>
    );
  }

  type Grade = "A" | "B" | "C";
  interface GradedKeyword {
    keyword: string;
    rank: number | null;
    grade: Grade;
    action: string;
    priority: number;
    diff: number | null;
  }

  const graded: GradedKeyword[] = comparisons.map((comp) => {
    const rank = comp.latestRank;
    if (rank !== null && rank <= 3) {
      return { keyword: comp.keyword, rank, grade: "A" as Grade, action: "維持：月1〜2回GBP投稿", priority: 3, diff: comp.diff };
    }
    if (rank !== null && rank <= 10) {
      return { keyword: comp.keyword, rank, grade: "B" as Grade, action: "集中攻め：週1〜2回GBP投稿＋ブログ＋FAQ", priority: 1, diff: comp.diff };
    }
    return { keyword: comp.keyword, rank, grade: "C" as Grade, action: "種まき：まずFAQ＋ブログ記事から", priority: 2, diff: comp.diff };
  }).sort((a, b) => a.priority - b.priority || (a.rank ?? 999) - (b.rank ?? 999));

  const countA = graded.filter(g => g.grade === "A").length;
  const countB = graded.filter(g => g.grade === "B").length;
  const countC = graded.filter(g => g.grade === "C").length;

  const gradeStyle: Record<Grade, { bg: string; border: string; badge: string; badgeText: string; icon: string; label: string }> = {
    A: { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-500", badgeText: "text-white", icon: "👑", label: "1〜3位（維持モード）" },
    B: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-500", badgeText: "text-white", icon: "🔥", label: "4〜10位（攻めモード）" },
    C: { bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-400", badgeText: "text-white", icon: "🌱", label: "圏外（種まきモード）" },
  };

  // B群の中から最優先3つを「次に攻めるキーワード」として提案
  const nextTargets = graded.filter(g => g.grade === "B").slice(0, 3);

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{countA}</p>
          <p className="text-xs text-green-600 font-medium mt-1">👑 TOP3 維持</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-700">{countB}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">🔥 攻めどき</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-gray-600">{countC}</p>
          <p className="text-xs text-gray-500 font-medium mt-1">🌱 種まき</p>
        </div>
      </div>

      {/* 次に攻めるべきキーワード */}
      {nextTargets.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-5">
          <h3 className="font-bold text-amber-800 text-lg mb-1">🎯 次に攻めるべきキーワード</h3>
          <p className="text-xs text-amber-600 mb-4">4〜10位のキーワードは、あと少しでTOP3に入れます。集中的にコンテンツを投下しましょう。</p>
          <div className="space-y-3">
            {nextTargets.map((target, i) => (
              <div key={target.keyword} className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">{i + 1}</span>
                    <div>
                      <p className="font-bold text-gray-800">{area} {target.keyword}</p>
                      <p className="text-xs text-gray-500">現在 {target.rank}位{target.diff !== null && target.diff > 0 ? ` (前回より${target.diff}つ改善中)` : ""}</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-amber-600">{target.rank}位</span>
                </div>
                <div className="mt-3 pt-3 border-t border-amber-100">
                  <p className="text-xs font-medium text-amber-700 mb-2">やること：</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">GBP投稿 週1〜2回</span>
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">ブログ記事作成</span>
                    <span className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full">FAQ作成</span>
                    <span className="text-xs px-2 py-1 bg-pink-100 text-pink-700 rounded-full">note記事</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 全キーワードA/B/C分類一覧 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">全キーワード分類</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {(["B", "A", "C"] as Grade[]).map((grade) => {
            const items = graded.filter(g => g.grade === grade);
            if (items.length === 0) return null;
            const style = gradeStyle[grade];
            return (
              <div key={grade}>
                <div className={`px-5 py-3 ${style.bg} ${style.border} border-l-4`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{style.icon}</span>
                    <span className="font-bold text-sm text-gray-800">グループ{grade}: {style.label}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${style.badge} ${style.badgeText}`}>{items.length}件</span>
                  </div>
                </div>
                {items.map((item) => (
                  <div key={item.keyword} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${style.badge} ${style.badgeText}`}>
                        {item.rank ?? "-"}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{item.keyword}</span>
                        {item.diff !== null && item.diff !== 0 && (
                          <span className={`ml-2 text-xs ${item.diff > 0 ? "text-green-600" : "text-red-600"}`}>
                            {item.diff > 0 ? `↑${item.diff}` : `↓${Math.abs(item.diff)}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{item.action}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* アクションプラン */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="font-bold text-gray-800 mb-4">📋 アクションプラン</h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold shrink-0">1</span>
            <div>
              <p className="font-bold text-sm text-gray-800">B群キーワードで一括コンテンツ生成</p>
              <p className="text-xs text-gray-500 mt-0.5">「コンテンツ生成」タブでB群キーワードを選択 → FAQ＋ブログ＋GBP＋noteを一括生成</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold shrink-0">2</span>
            <div>
              <p className="font-bold text-sm text-gray-800">GBP投稿を継続（B群は週1〜2回）</p>
              <p className="text-xs text-gray-500 mt-0.5">同じキーワードで角度を変えたGBP投稿を2〜3ヶ月続ける</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold shrink-0">3</span>
            <div>
              <p className="font-bold text-sm text-gray-800">2週間後に順位を再チェック</p>
              <p className="text-xs text-gray-500 mt-0.5">B→Aに上がったキーワードは維持モードに移行、停滞しているものは追加施策</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold shrink-0">4</span>
            <div>
              <p className="font-bold text-sm text-gray-800">口コミに症状名を含めてもらう</p>
              <p className="text-xs text-gray-500 mt-0.5">患者さんに「どんな症状で来院されましたか？」と聞く形で口コミを依頼</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** テーブル内の比較インジケーター（コンパクト版） */
function ComparisonIndicator({ comp }: { comp: KeywordComparison }) {
  if (comp.previousRank === null || comp.previousDate === null) {
    return <span className="text-xs text-gray-400">初回チェック</span>;
  }

  const prevText = comp.previousRank !== null ? `${comp.previousRank}位` : "圏外";

  if (comp.diff === null) {
    return <span className="text-xs text-gray-400">前回: {prevText}</span>;
  }

  if (comp.diff > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
        ↑{comp.diff} <span className="font-normal text-green-500">(前回{prevText})</span>
      </span>
    );
  }

  if (comp.diff < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
        ↓{Math.abs(comp.diff)} <span className="font-normal text-red-500">(前回{prevText})</span>
      </span>
    );
  }

  // diff === 0
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
      → 変動なし <span className="font-normal">(前回{prevText})</span>
    </span>
  );
}
