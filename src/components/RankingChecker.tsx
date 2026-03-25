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

type SubTab = "check" | "history" | "strategy";

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
        <button
          onClick={() => setSubTab("strategy")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === "strategy"
              ? "bg-orange-600 text-white"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          🎯 戦略分析
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

      {subTab === "strategy" && (
        <StrategyPanel
          history={history}
          keywords={profile.keywords || []}
          area={profile.area}
        />
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
