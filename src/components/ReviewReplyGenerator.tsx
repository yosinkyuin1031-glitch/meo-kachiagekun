"use client";

import { useState } from "react";
import { BusinessProfile } from "@/lib/types";
import { reviewReplyPrompt } from "@/lib/prompts";

interface Props {
  profile: BusinessProfile;
}

function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied
          ? "bg-green-100 text-green-700 border border-green-300"
          : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
      }`}
    >
      {copied ? "コピー完了" : label}
    </button>
  );
}

export default function ReviewReplyGenerator({ profile }: Props) {
  const [reviewText, setReviewText] = useState("");
  const [starRating, setStarRating] = useState(5);
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!reviewText.trim()) {
      setError("口コミ本文を入力してください");
      return;
    }
    if (!profile.anthropicKey) {
      setError("APIキーが設定されていません。設定画面で入力してください。");
      return;
    }

    setLoading(true);
    setError("");
    setReplies([]);

    try {
      const prompt = reviewReplyPrompt(profile, reviewText, starRating);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey: profile.anthropicKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const content = data.content as string;

      // パターン分割
      const patterns = content
        .split(/---パターン\d+---/)
        .map((s: string) => s.trim())
        .filter(Boolean);

      if (patterns.length > 0) {
        setReplies(patterns);
      } else {
        // フォールバック: 全体を1パターンとして扱う
        setReplies([content.trim()]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("API key") || msg.includes("api_key") || msg.includes("authentication")) {
        setError("APIキーが正しくありません。設定画面でAnthropicのAPIキーを確認してください。");
      } else if (msg.includes("rate limit") || msg.includes("429")) {
        setError("AIの利用回数が上限に達しました。しばらく時間をおいてから、もう一度お試しください。");
      } else if (msg.includes("overloaded") || msg.includes("529")) {
        setError("AIサーバーが混み合っています。1〜2分後にもう一度お試しください。");
      } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
        setError("インターネット接続を確認して、もう一度お試しください。");
      } else {
        setError("返信文の生成に失敗しました。もう一度お試しください。それでも解決しない場合は、設定画面でAPIキーをご確認ください。");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 入力フォーム */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          口コミ返信を生成
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Googleの口コミ本文を貼り付けて、AIが返信文を3パターン生成します。そのままコピーしてGBPに貼り付けてください。
        </p>

        {/* 星評価 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            星評価
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setStarRating(star)}
                className="text-3xl transition-transform hover:scale-110 focus:outline-none"
              >
                {star <= starRating ? "★" : "☆"}
              </button>
            ))}
            <span className="ml-3 text-sm text-gray-500 self-center">
              {starRating === 5 && "最高評価"}
              {starRating === 4 && "高評価"}
              {starRating === 3 && "普通"}
              {starRating === 2 && "低評価"}
              {starRating === 1 && "最低評価"}
            </span>
          </div>
        </div>

        {/* 口コミ本文 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            口コミ本文
          </label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Googleマップの口コミ本文をここに貼り付けてください"
            rows={5}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm resize-y"
          />
          <p className="text-xs text-gray-400 mt-1">
            {reviewText.length > 0 ? `${reviewText.length}文字` : ""}
          </p>
        </div>

        {/* エラー */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 生成ボタン */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {loading ? "返信文を生成中..." : "返信文を生成（3パターン）"}
        </button>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-3" />
          <p className="text-gray-600 text-sm">返信文を生成しています...</p>
        </div>
      )}

      {/* 結果 */}
      {replies.length > 0 && !loading && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-800">生成結果（3パターン）</h3>
          <p className="text-xs text-gray-500">気に入ったパターンの「コピー」ボタンを押して、GBPの口コミ返信に貼り付けてください。</p>
          {replies.map((reply, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  パターン {i + 1}
                </span>
                <CopyButton text={reply} label="この返信をコピー" />
              </div>
              <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100">
                {reply}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
