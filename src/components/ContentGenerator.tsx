"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BusinessProfile, GeneratedContent } from "@/lib/types";
import { saveContent, updateContent, getContentInsight, getRankingInsight, saveFeedback, GenerationFeedback } from "@/lib/supabase-storage";
import { checkMedicalGuidelines, GuidelineCheckResult } from "@/lib/medical-guidelines";
import {
  faqPrompt,
  blogPostPrompt,
  gbpPostPrompt,
  noteArticlePrompt,
  blogSeoPrompt,
  AccumulatedContext,
} from "@/lib/prompts";

interface Props {
  profile: BusinessProfile;
  type: "faq" | "gbp" | "note" | "blog";
}

interface SeoData {
  seoTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  ogpTitle?: string;
  ogpDescription?: string;
  slug?: string;
}

const ANTI_AI_INSTRUCTION =
  "\n\n【重要：文体について】\n自然な日本語で書いてください。AIっぽい表現（「〜ですね！」「いかがでしたか？」「それでは」「さあ」「ぜひ」の多用等）は避けてください。実際の治療家が書いたような、温かみがありつつも専門的な文体にしてください。読者に語りかけるような過剰な表現は不要です。";

const TYPE_LABELS: Record<Props["type"], string> = {
  faq: "よくある質問（FAQ）",
  blog: "ブログ記事",
  gbp: "Googleマイビジネス投稿文",
  note: "note記事",
};

// GBP投稿タイプ
const GBP_POST_TYPES = ["情報発信", "症状解説", "施術紹介", "院内紹介", "スタッフ紹介", "お知らせ", "セルフケア"];

// HTMLを改行付きテキストに変換（コピペ時に改行が消えない）
function htmlToReadableText(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "・")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/ul>|<\/ol>/gi, "\n")
    .replace(/<ul[^>]*>|<ol[^>]*>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n───────────\n")
    .replace(/<!--[^>]*-->/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function CopyButton({
  text,
  label = "コピー",
  isHtml = false,
}: {
  text: string;
  label?: string;
  isHtml?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const copyText = isHtml ? htmlToReadableText(text) : text;
    navigator.clipboard.writeText(copyText);
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

export default function ContentGenerator({ profile, type }: Props) {
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [gbpPostType, setGbpPostType] = useState("情報発信");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wpPosting, setWpPosting] = useState(false);
  const [wpResult, setWpResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedResult, setEditedResult] = useState("");
  const [contentId, setContentId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // SEO/OGP
  const [seoData, setSeoData] = useState<SeoData | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [autoSeo, setAutoSeo] = useState(true);

  // 医療広告ガイドラインチェック
  const [guidelineCheck, setGuidelineCheck] = useState<GuidelineCheckResult | null>(null);

  // フィードバック評価
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"good" | "needs_improvement" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showFeedbackComment, setShowFeedbackComment] = useState(false);

  const needsTopic = type === "blog" || type === "note";
  const canSeo = type === "blog" || type === "faq";
  const hasWordPress =
    type === "blog" &&
    profile.wordpress?.siteUrl &&
    profile.wordpress?.username &&
    profile.wordpress?.appPassword;

  async function buildPrompt(): Promise<string> {
    // 蓄積データを取得してコンテキストに含める
    const [contentInsight, rankingInsight] = await Promise.all([
      getContentInsight(keyword),
      getRankingInsight(keyword),
    ]);
    const accCtx: AccumulatedContext = { contentInsight, rankingInsight };

    let prompt = "";
    switch (type) {
      case "faq":
        prompt = faqPrompt(profile, keyword, accCtx);
        break;
      case "blog":
        prompt = blogPostPrompt(profile, keyword, topic, accCtx);
        break;
      case "gbp":
        prompt = gbpPostPrompt(profile, keyword, gbpPostType, accCtx);
        break;
      case "note":
        prompt = noteArticlePrompt(profile, keyword, topic, accCtx);
        break;
    }
    return prompt + ANTI_AI_INSTRUCTION;
  }

  async function generateSeoData() {
    if (!canSeo || !profile.anthropicKey) return;

    setSeoLoading(true);
    try {
      const seoPromptText = blogSeoPrompt(profile, keyword, topic || keyword);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: seoPromptText, apiKey: profile.anthropicKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const content = data.content as string;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setSeoData(parsed);
      }
    } catch {
      // SEO生成失敗は無視（メインコンテンツは生成済み）
    } finally {
      setSeoLoading(false);
    }
  }

  async function handleGenerate() {
    if (!keyword.trim()) {
      setError("キーワードを入力してください");
      return;
    }
    if (needsTopic && !topic.trim()) {
      setError("テーマを入力してください");
      return;
    }
    if (!profile.anthropicKey) {
      setError("APIキーが設定されていません。設定画面で入力してください。");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setWpResult(null);
    setSeoData(null);
    setGuidelineCheck(null);
    setFeedbackSent(false);
    setFeedbackType(null);
    setFeedbackComment("");
    setShowFeedbackComment(false);

    try {
      const prompt = await buildPrompt();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey: profile.anthropicKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const content = data.content as string;
      setResult(content);

      // 医療広告ガイドラインチェック
      const checkResult = checkMedicalGuidelines(content);
      setGuidelineCheck(checkResult);

      // Save to history
      const newId = `${type}-${Date.now()}`;
      const generated: GeneratedContent = {
        id: newId,
        type,
        title: `${TYPE_LABELS[type]}：${keyword}`,
        content,
        keyword,
        createdAt: new Date().toISOString(),
      };
      await saveContent(generated);
      setContentId(newId);

      // ブログ・FAQはSEO/OGP情報を自動生成（チェックONの場合のみ）
      if (canSeo && autoSeo) {
        generateSeoData();
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
        setError("コンテンツの生成に失敗しました。もう一度お試しください。それでも解決しない場合は、設定画面でAPIキーをご確認ください。");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleWordPressPost() {
    if (!result || !hasWordPress) return;

    setWpPosting(true);
    setWpResult(null);

    try {
      const title = `${keyword} - ${topic || TYPE_LABELS[type]}`;
      const wpRes = await fetch("/api/wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: profile.wordpress!.siteUrl,
          username: profile.wordpress!.username,
          appPassword: profile.wordpress!.appPassword,
          title,
          content: result,
          status: "draft",
        }),
      });
      const data = await wpRes.json();
      if (!wpRes.ok) throw new Error(data.error || "WordPress投稿に失敗しました");
      setWpResult({
        success: true,
        message: `下書きとして投稿しました${data.url ? `：${data.url}` : ""}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      let wpErrMsg = "WordPress投稿に失敗しました。設定画面でWordPressの接続情報を確認してください。";
      if (msg.includes("401") || msg.includes("403") || msg.includes("auth")) {
        wpErrMsg = "WordPressのユーザー名またはパスワードが正しくありません。設定画面で接続情報を確認してください。";
      } else if (msg.includes("404")) {
        wpErrMsg = "WordPressのサイトURLが正しくありません。設定画面でURLを確認してください。";
      } else if (msg.includes("fetch") || msg.includes("network")) {
        wpErrMsg = "WordPressサイトに接続できません。インターネット接続とサイトURLを確認してください。";
      }
      setWpResult({
        success: false,
        message: wpErrMsg,
      });
    } finally {
      setWpPosting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          {TYPE_LABELS[type]}を生成
        </h2>

        {/* GBP投稿タイプ選択 */}
        {type === "gbp" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              投稿タイプ
            </label>
            <div className="flex flex-wrap gap-2">
              {GBP_POST_TYPES.map((pt) => (
                <button
                  key={pt}
                  onClick={() => setGbpPostType(pt)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    gbpPostType === pt
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Keyword selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            キーワード
          </label>
          {profile.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {profile.keywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => setKeyword(kw)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    keyword === kw
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                  }`}
                >
                  {kw}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="キーワードを入力または上から選択"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
          />
        </div>

        {/* Topic input (blog / note only) */}
        {needsTopic && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              テーマ・トピック
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={`例：${keyword || "腰痛"}の原因と改善方法`}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
            />
          </div>
        )}

        {/* SEO自動生成チェック（ブログ・FAQ） */}
        {canSeo && (
          <div className="mb-4">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={autoSeo}
                onChange={(e) => setAutoSeo(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">SEO・OGP情報も自動生成する</span>
                <p className="text-xs text-gray-500">SEOタイトル・メタディスクリプション・OGP設定・スラッグを自動生成します</p>
              </div>
            </label>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium rounded-lg transition-colors text-sm"
        >
          {loading ? "生成中..." : `${TYPE_LABELS[type]}を生成`}
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-b-orange-300 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
            </div>
            <div className="space-y-2">
              <p className="text-gray-800 text-sm font-medium animate-pulse">
                AIが文章を作成しています...
              </p>
              <p className="text-gray-500 text-xs">
                しばらくお待ちください（30秒〜1分程度）
              </p>
            </div>
            <div className="flex gap-1.5 mt-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">生成結果</h3>
            <div className="flex gap-2">
              <CopyButton text={result} isHtml={type === "blog"} label={type === "blog" ? "テキストコピー" : "コピー"} />
              {type === "blog" && <CopyButton text={result} label="HTMLコピー" />}
              <button
                onClick={() => { setEditedResult(result); setEditing(true); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  editing
                    ? "bg-orange-100 text-orange-700 border border-orange-300"
                    : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                }`}
              >
                {editing ? "編集中" : "編集する"}
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 disabled:opacity-50"
              >
                再生成
              </button>
              {hasWordPress && (
                <button
                  onClick={handleWordPressPost}
                  disabled={wpPosting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 disabled:opacity-50"
                >
                  {wpPosting ? "投稿中..." : "WordPressに下書き投稿"}
                </button>
              )}
            </div>
          </div>

          {/* WordPress posting result */}
          {wpResult && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                wpResult.success
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {wpResult.message}
            </div>
          )}

          {/* Content display */}
          {editing ? (
            <div>
              <textarea
                value={editedResult}
                onChange={(e) => setEditedResult(e.target.value)}
                className="w-full min-h-[300px] px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-orange-400 outline-none resize-y"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={async () => {
                    setSavingEdit(true);
                    setResult(editedResult);
                    if (contentId) {
                      try {
                        await updateContent(contentId, { content: editedResult });
                      } catch {
                        // ローカル保存は完了しているので無視
                      }
                    }
                    setSavingEdit(false);
                    setEditing(false);
                  }}
                  disabled={savingEdit}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {savingEdit ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-gray-100 rounded-lg p-4 bg-gray-50">
              {type === "blog" ? (
                <div
                  className="prose prose-sm max-w-none prose-headings:mt-8 prose-headings:mb-4 prose-p:my-4 prose-p:leading-7 prose-li:my-1 prose-ul:my-4 prose-h2:text-lg prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2"
                  dangerouslySetInnerHTML={{ __html: result }}
                />
              ) : type === "note" ? (
                <div className="prose prose-sm max-w-none prose-headings:mt-8 prose-headings:mb-4 prose-p:my-4 prose-p:leading-7 prose-li:my-1 prose-ul:my-4 prose-h2:text-lg prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-blockquote:border-l-orange-400 prose-blockquote:bg-orange-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-strong:text-orange-700 prose-hr:my-6">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                  {result}
                </div>
              )}
            </div>
          )}

          {/* 医療広告ガイドラインチェック結果 */}
          {guidelineCheck && (
            <div className={`mt-4 rounded-lg p-4 ${
              guidelineCheck.hasViolation
                ? "bg-yellow-50 border border-yellow-300"
                : "bg-green-50 border border-green-200"
            }`}>
              {guidelineCheck.hasViolation ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-600 font-bold text-sm">&#9888; 医療広告ガイドライン注意</span>
                  </div>
                  <div className="space-y-1">
                    {guidelineCheck.suggestions.map((s, i) => (
                      <p key={i} className="text-xs text-yellow-800">{s}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-700">ガイドラインチェック: OK</span>
                </div>
              )}
            </div>
          )}

          {/* フィードバック評価 */}
          {result && !loading && (
            <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
              <p className="text-xs font-medium text-gray-600 mb-2">この生成結果を評価してください</p>
              {feedbackSent ? (
                <p className="text-sm text-green-600 font-medium">評価を送信しました。ありがとうございます。</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setFeedbackType("good");
                        const fb: GenerationFeedback = {
                          id: `fb-${Date.now()}`,
                          contentId,
                          type: "good",
                          originalContent: result,
                          createdAt: new Date().toISOString(),
                        };
                        try { await saveFeedback(fb); } catch { /* localStorage fallback handled in saveFeedback */ }
                        setFeedbackSent(true);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        feedbackType === "good"
                          ? "bg-green-500 text-white"
                          : "bg-green-100 text-green-700 border border-green-200 hover:bg-green-200"
                      }`}
                    >
                      良い
                    </button>
                    <button
                      onClick={() => {
                        setFeedbackType("needs_improvement");
                        setShowFeedbackComment(true);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        feedbackType === "needs_improvement"
                          ? "bg-orange-500 text-white"
                          : "bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200"
                      }`}
                    >
                      改善が必要
                    </button>
                  </div>
                  {showFeedbackComment && (
                    <div className="space-y-2">
                      <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="改善点をご記入ください（任意）"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 outline-none resize-y min-h-[60px]"
                      />
                      <button
                        onClick={async () => {
                          const fb: GenerationFeedback = {
                            id: `fb-${Date.now()}`,
                            contentId,
                            type: "bad",
                            originalContent: result,
                            note: feedbackComment || undefined,
                            createdAt: new Date().toISOString(),
                          };
                          try { await saveFeedback(fb); } catch { /* fallback */ }
                          setFeedbackSent(true);
                        }}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                      >
                        送信
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SEO/OGP再生成ボタン（ブログ・FAQ） */}
          {canSeo && seoData && !seoLoading && (
            <div className="mt-4">
              <button
                onClick={generateSeoData}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 font-medium rounded-lg transition-colors text-xs"
              >
                SEO・OGP情報を再生成
              </button>
            </div>
          )}

          {/* SEO loading */}
          {seoLoading && (
            <div className="mt-4 p-4 text-center">
              <div className="inline-block w-6 h-6 border-3 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-2" />
              <p className="text-gray-500 text-xs">SEO・OGP情報を生成中...</p>
            </div>
          )}

          {/* SEO/OGP Result */}
          {seoData && (
            <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-5">
              <h4 className="text-sm font-bold text-indigo-800 mb-3">SEO・OGP情報</h4>
              <div className="space-y-3">
                {seoData.seoTitle && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-indigo-600 font-medium mb-0.5">SEOタイトル</p>
                      <p className="text-sm text-gray-800 break-all">{seoData.seoTitle}</p>
                    </div>
                    <CopyButton text={seoData.seoTitle} label="コピー" />
                  </div>
                )}
                {seoData.metaDescription && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-indigo-600 font-medium mb-0.5">メタディスクリプション</p>
                      <p className="text-sm text-gray-800 break-all">{seoData.metaDescription}</p>
                    </div>
                    <CopyButton text={seoData.metaDescription} label="コピー" />
                  </div>
                )}
                {seoData.metaKeywords && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-indigo-600 font-medium mb-0.5">メタキーワード</p>
                      <p className="text-sm text-gray-800 break-all">{seoData.metaKeywords}</p>
                    </div>
                    <CopyButton text={seoData.metaKeywords} label="コピー" />
                  </div>
                )}
                {seoData.ogpTitle && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-indigo-600 font-medium mb-0.5">OGPタイトル</p>
                      <p className="text-sm text-gray-800 break-all">{seoData.ogpTitle}</p>
                    </div>
                    <CopyButton text={seoData.ogpTitle} label="コピー" />
                  </div>
                )}
                {seoData.ogpDescription && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-indigo-600 font-medium mb-0.5">OGPディスクリプション</p>
                      <p className="text-sm text-gray-800 break-all">{seoData.ogpDescription}</p>
                    </div>
                    <CopyButton text={seoData.ogpDescription} label="コピー" />
                  </div>
                )}
                {seoData.slug && (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-indigo-600 font-medium mb-0.5">スラッグ</p>
                      <p className="text-sm text-gray-800 font-mono break-all">{seoData.slug}</p>
                    </div>
                    <CopyButton text={seoData.slug} label="コピー" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
