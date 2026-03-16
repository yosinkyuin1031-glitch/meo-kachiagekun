"use client";

import { useState, useEffect } from "react";
import { BusinessProfile } from "@/lib/types";
import { RankingResult, RankingHistory } from "@/lib/ranking-types";
import { getRankingHistory, addRankingHistory, getSerpApiKey, saveSerpApiKey } from "@/lib/storage";
import RankingTable from "./RankingTable";
import HistoryChart from "./HistoryChart";

interface Props {
  profile: BusinessProfile;
}

type SubTab = "check" | "history";

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
    setSerpApiKey(getSerpApiKey());
    setHistory(getRankingHistory());
  }, []);

  const handleSaveKey = () => {
    saveSerpApiKey(serpApiKey.trim());
  };

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
      addRankingHistory(newEntries);
      setHistory(getRankingHistory());
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

          {/* 結果テーブル */}
          {results.length > 0 && <RankingTable results={results} />}
        </div>
      )}

      {subTab === "history" && (
        <HistoryChart
          history={history}
          keywords={profile.keywords || []}
        />
      )}
    </div>
  );
}
