"use client";

import { useState, useEffect, useMemo } from "react";
import { BusinessProfile } from "@/lib/types";
import { RankingResult, RankingHistory } from "@/lib/ranking-types";
import { getRankingHistory, addRankingHistory, getSerpApiKey, saveSerpApiKey } from "@/lib/supabase-storage";
import RankingTable from "./RankingTable";
import HistoryChart from "./HistoryChart";

interface Props {
  profile: BusinessProfile;
}

type SubTab = "check" | "history";

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

export default function RankingChecker({ profile }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("check");
  const [serpApiKey, setSerpApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [results, setResults] = useState<RankingResult[]>([]);
  const [history, setHistory] = useState<RankingHistory[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    getSerpApiKey().then(setSerpApiKey);
    getRankingHistory().then(setHistory);
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

  const handleCheck = async () => {
    if (!profile.name) {
      setError("設定画面で院名を登録してください");
      return;
    }
    if (!profile.area) {
      setError("設定画面でエリアを登録してください");
      return;
    }
    if (!profile.keywords || profile.keywords.length === 0) {
      setError("設定画面でMEOキーワードを登録してください");
      return;
    }

    const key = serpApiKey.trim();
    if (!key) {
      setError("SerpApi APIキーを入力してください");
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
        setError(data.error || "チェックに失敗しました");
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
      setError("通信エラーが発生しました");
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
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("check")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === "check"
              ? "bg-orange-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          🔍 ランキングチェック
        </button>
        <button
          onClick={() => setSubTab("history")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === "history"
              ? "bg-orange-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          📊 順位推移
        </button>
      </div>

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

          {/* チェック日 表示 */}
          {results.length > 0 && lastChecked && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <p className="text-sm font-bold text-orange-800">チェック日時</p>
                <p className="text-lg font-bold text-orange-700">{lastChecked}</p>
              </div>
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
        </div>
      )}

      {subTab === "history" && (
        <div className="space-y-6">
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
