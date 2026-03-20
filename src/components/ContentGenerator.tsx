"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BusinessProfile, GeneratedContent } from "@/lib/types";
import { saveContent } from "@/lib/supabase-storage";
import {
  faqPrompt,
  blogPostPrompt,
  gbpPostPrompt,
  noteArticlePrompt,
  blogSeoPrompt,
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

  // SEO/OGP
  const [seoData, setSeoData] = useState<SeoData | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [autoSeo, setAutoSeo] = useState(true);

  const needsTopic = type === "blog" || type === "note";
  const canSeo = type === "blog" || type === "faq";
  const hasWordPress =
    type === "blog" &&
    profile.wordpress?.siteUrl &&
    profile.wordpress?.username &&
    profile.wordpress?.appPassword;

  function buildPrompt(): string {
    let prompt = "";
    switch (type) {
      case "faq":
        prompt = faqPrompt(profile, keyword);
        break;
      case "blog":
        prompt = blogPostPrompt(profile, keyword, topic);
        break;
      case "gbp":
        prompt = gbpPostPrompt(profile, keyword, gbpPostType);
        break;
      case "note":
        prompt = noteArticlePrompt(profile, keyword, topic);
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

    try {
      const prompt = buildPrompt();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, apiKey: profile.anthropicKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const content = data.content as string;
      setResult(content);

      // Save to history
      const generated: GeneratedContent = {
        id: `${type}-${Date.now()}`,
        type,
        title: `${TYPE_LABELS[type]}：${keyword}`,
        content,
        keyword,
        createdAt: new Date().toISOString(),
      };
      await saveContent(generated);

      // ブログ・FAQはSEO/OGP情報を自動生成（チェックONの場合のみ）
      if (canSeo && autoSeo) {
        generateSeoData();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "生成中にエラーが発生しました"
      );
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
      setWpResult({
        success: false,
        message:
          err instanceof Error ? err.message : "WordPress投稿に失敗しました",
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
          <div className="inline-block w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-3" />
          <p className="text-gray-600 text-sm">
            {TYPE_LABELS[type]}を生成しています...
          </p>
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
                  onClick={() => { setResult(editedResult); setEditing(false); }}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                >
                  保存
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
