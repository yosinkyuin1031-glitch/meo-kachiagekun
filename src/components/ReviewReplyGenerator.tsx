"use client";

import { useState, useEffect, useCallback } from "react";
import { BusinessProfile } from "@/lib/types";
import { reviewReplyPrompt } from "@/lib/prompts";

interface Props {
  profile: BusinessProfile;
  clinicId?: string;
}

interface SavedReview {
  author: string;
  rating: number;
  text: string;
  date: string;
}

interface GeneratedReply {
  reviewIndex: number;
  patterns: string[];
  error?: string;
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

export default function ReviewReplyGenerator({ profile, clinicId }: Props) {
  // 取得済み口コミ
  const [savedReviews, setSavedReviews] = useState<SavedReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");

  // 返信生成結果（reviewIndex → GeneratedReply）
  const [generatedReplies, setGeneratedReplies] = useState<Record<number, GeneratedReply>>({});
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // 手動入力モード
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualRating, setManualRating] = useState(5);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualReplies, setManualReplies] = useState<string[]>([]);
  const [manualError, setManualError] = useState("");

  // ページ表示時にDB保存済み口コミを自動読み込み
  useEffect(() => {
    if (!clinicId) {
      setReviewsLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/fetch-reviews?clinicId=${clinicId}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.allReviews)) {
          setSavedReviews(data.allReviews);
        } else if (!res.ok) {
          setReviewsError(data.error || "口コミの読み込みに失敗しました");
        }
      } catch {
        setReviewsError("口コミの読み込みに失敗しました");
      } finally {
        setReviewsLoading(false);
      }
    })();
  }, [clinicId]);

  const generateReplyFor = useCallback(async (review: SavedReview, reviewIndex: number): Promise<GeneratedReply> => {
    try {
      const prompt = reviewReplyPrompt(profile, review.text, review.rating || 5);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey: profile.anthropicKey, type: "review-reply" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");

      const content = data.content as string;
      const patterns = content
        .split(/---パターン\d+---/)
        .map((s: string) => s.trim())
        .filter(Boolean);

      return { reviewIndex, patterns: patterns.length > 0 ? patterns : [content.trim()] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成に失敗しました";
      return { reviewIndex, patterns: [], error: msg };
    }
  }, [profile]);

  const handleGenerateOne = async (index: number) => {
    const review = savedReviews[index];
    if (!review) return;
    setGeneratingIndex(index);
    const result = await generateReplyFor(review, index);
    setGeneratedReplies((prev) => ({ ...prev, [index]: result }));
    setGeneratingIndex(null);
  };

  const handleBulkGenerate = async () => {
    if (savedReviews.length === 0) return;
    const targets = savedReviews
      .map((r, i) => ({ review: r, index: i }))
      .filter(({ index }) => !generatedReplies[index]);
    if (targets.length === 0) return;

    setBulkGenerating(true);
    setBulkProgress({ done: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const { review, index } = targets[i];
      const result = await generateReplyFor(review, index);
      setGeneratedReplies((prev) => ({ ...prev, [index]: result }));
      setBulkProgress({ done: i + 1, total: targets.length });
      // API負荷分散で少し間隔を空ける
      if (i < targets.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    setBulkGenerating(false);
  };

  const handleManualGenerate = async () => {
    if (!manualText.trim()) {
      setManualError("口コミ本文を入力してください");
      return;
    }
    setManualLoading(true);
    setManualError("");
    setManualReplies([]);
    try {
      const prompt = reviewReplyPrompt(profile, manualText, manualRating);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey: profile.anthropicKey, type: "review-reply" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成に失敗しました");
      const content = data.content as string;
      const patterns = content
        .split(/---パターン\d+---/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      setManualReplies(patterns.length > 0 ? patterns : [content.trim()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("API key") || msg.includes("api_key") || msg.includes("authentication")) {
        setManualError("APIキーが正しくありません。設定画面でAPIキーを確認してください。");
      } else if (msg.includes("rate limit") || msg.includes("429")) {
        setManualError("AIの利用回数が上限に達しました。しばらく時間をおいてから、もう一度お試しください。");
      } else {
        setManualError("返信文の生成に失敗しました。もう一度お試しください。");
      }
    } finally {
      setManualLoading(false);
    }
  };

  const remainingCount = savedReviews.filter((_, i) => !generatedReplies[i]).length;

  return (
    <div className="space-y-6">
      {/* 取得済み口コミセクション */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800">取得済みGoogle口コミから返信生成</h2>
          {savedReviews.length > 0 && (
            <span className="text-xs text-gray-500">{savedReviews.length}件</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          設定画面で取得したGoogle口コミに対して、AIが返信文を3パターンずつ生成します。
        </p>

        {reviewsLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">口コミを読み込み中...</div>
        ) : reviewsError ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{reviewsError}</div>
        ) : savedReviews.length === 0 ? (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            まだGoogle口コミが取得されていません。設定画面の「口コミ・患者の声」セクションで「Googleから取得」ボタンを押してください。
          </div>
        ) : (
          <>
            {/* 一括生成ボタン */}
            <div className="mb-4 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-amber-800">全件一括で返信生成</p>
                <p className="text-xs text-amber-700">
                  未生成 {remainingCount}件を一気に処理します
                </p>
              </div>
              <button
                onClick={handleBulkGenerate}
                disabled={bulkGenerating || remainingCount === 0}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
              >
                {bulkGenerating
                  ? `生成中 ${bulkProgress.done}/${bulkProgress.total}`
                  : remainingCount === 0
                  ? "全件生成済み"
                  : `一括生成（${remainingCount}件）`}
              </button>
            </div>

            {/* 口コミカード一覧 */}
            <div className="space-y-4">
              {savedReviews.map((review, index) => {
                const generated = generatedReplies[index];
                const isGenerating = generatingIndex === index;
                return (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* 口コミ本文 */}
                    <div className="p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-yellow-500 text-sm">
                          {"★".repeat(Math.max(0, Math.min(5, review.rating || 0)))}
                          {"☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, review.rating || 0))))}
                        </span>
                        <span className="text-xs font-medium text-gray-700">{review.author || "匿名"}</span>
                        {review.date && <span className="text-xs text-gray-400 ml-auto">{review.date}</span>}
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.text}</p>
                      {!generated && !isGenerating && (
                        <button
                          onClick={() => handleGenerateOne(index)}
                          className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg"
                        >
                          この口コミに返信を生成
                        </button>
                      )}
                      {isGenerating && (
                        <div className="mt-3 text-xs text-blue-600">返信を生成中...</div>
                      )}
                    </div>

                    {/* 生成結果 */}
                    {generated && (
                      <div className="p-4 bg-white border-t border-gray-100 space-y-3">
                        {generated.error ? (
                          <div className="text-xs text-red-600">{generated.error}</div>
                        ) : (
                          generated.patterns.map((reply, pi) => (
                            <div key={pi} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                  パターン {pi + 1}
                                </span>
                                <CopyButton text={reply} label="コピー" />
                              </div>
                              <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{reply}</div>
                            </div>
                          ))
                        )}
                        <button
                          onClick={() => handleGenerateOne(index)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          別パターンを再生成
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 手動入力（折りたたみ） */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <button
          onClick={() => setManualMode(!manualMode)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <svg
            className={`w-4 h-4 transition-transform ${manualMode ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          手動で口コミ本文を貼り付けて生成（他サイトの口コミ等）
        </button>

        {manualMode && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">星評価</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setManualRating(star)}
                    className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                  >
                    {star <= manualRating ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">口コミ本文</label>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={5}
                placeholder="口コミ本文をここに貼り付けてください"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm resize-y"
              />
            </div>
            {manualError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{manualError}</div>
            )}
            <button
              onClick={handleManualGenerate}
              disabled={manualLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors text-sm"
            >
              {manualLoading ? "生成中..." : "返信文を生成（3パターン）"}
            </button>
            {manualReplies.length > 0 && (
              <div className="space-y-3">
                {manualReplies.map((reply, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        パターン {i + 1}
                      </span>
                      <CopyButton text={reply} label="コピー" />
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">{reply}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
