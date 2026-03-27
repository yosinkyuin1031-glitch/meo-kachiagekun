"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import { BusinessProfile, GeneratedContent } from "@/lib/types";
import { saveContent, updateContent, getContentsByKeyword, getContentInsight, getRankingInsight, saveFeedback, GenerationFeedback } from "@/lib/supabase-storage";
import { checkMedicalGuidelines, GuidelineCheckResult } from "@/lib/medical-guidelines";
import {
  blogPostWithFaqPrompt,
  faqIndividualListPrompt,
  gbpWithBlogUrlPrompt,
  noteWithBlogUrlPrompt,
  bulkBlogSeoPrompt,
  AccumulatedContext,
} from "@/lib/prompts";

interface Props {
  profile: BusinessProfile;
  initialKeyword?: string;
  onKeywordConsumed?: () => void;
}

// Anti-AI writing instruction
const ANTI_AI_INSTRUCTION = "\n\n【重要：文体について】\n自然な日本語で書いてください。AIっぽい表現（「〜ですね！」「いかがでしたか？」「それでは」「さあ」「ぜひ」の多用等）は避けてください。実際の治療家が書いたような、温かみがありつつも専門的な文体にしてください。読者に語りかけるような過剰な表現は不要です。";

// 生成オプション
interface ContentOptions {
  faq: boolean;
  blog: boolean;
  gbp: boolean;
  note: boolean;
}

// 各FAQアイテム（AI生成結果）
interface FaqItem {
  question: string;
  answer: string;
  seoTitle: string;
  seoDescription: string;
  slug: string;
  blogTitle: string;
  blogSlug: string;
}

interface SeoData {
  seoTitle?: string;
  seoDescription?: string;
  metaKeywords?: string;
  ogpTitle?: string;
  ogpDescription?: string;
}

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

// ---------- CopyButton ----------
function CopyButton({ text, label = "コピー", isHtml = false }: { text: string; label?: string; isHtml?: boolean }) {
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

// ---------- GuidelineCheckDisplay ----------
function GuidelineCheckDisplay({ check }: { check: GuidelineCheckResult | null }) {
  if (!check) return null;
  return (
    <div className={`mt-3 rounded-lg p-3 ${
      check.hasViolation
        ? "bg-yellow-50 border border-yellow-300"
        : "bg-green-50 border border-green-200"
    }`}>
      {check.hasViolation ? (
        <div>
          <p className="text-yellow-600 font-bold text-xs mb-1">&#9888; 医療広告ガイドライン注意</p>
          {check.suggestions.map((s, i) => (
            <p key={i} className="text-xs text-yellow-800">{s}</p>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-xs font-medium text-green-700">ガイドラインチェック: OK</span>
        </div>
      )}
    </div>
  );
}

// ---------- FeedbackPanel ----------
function FeedbackPanel({
  contentId,
  content,
  feedbackSent,
  setFeedbackSent,
  feedbackType,
  setFeedbackType,
  feedbackComment,
  setFeedbackComment,
  showComment,
  setShowComment,
}: {
  contentId: string;
  content: string;
  feedbackSent: boolean;
  setFeedbackSent: (v: boolean) => void;
  feedbackType: "good" | "needs_improvement" | null;
  setFeedbackType: (v: "good" | "needs_improvement" | null) => void;
  feedbackComment: string;
  setFeedbackComment: (v: string) => void;
  showComment: boolean;
  setShowComment: (v: boolean) => void;
}) {
  return (
    <div className="mt-3 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
      <p className="text-xs font-medium text-gray-600 mb-2">この生成結果を評価してください</p>
      {feedbackSent ? (
        <p className="text-sm text-green-600 font-medium">評価を送信しました。</p>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setFeedbackType("good");
                const fb: GenerationFeedback = {
                  id: `fb-${Date.now()}`,
                  contentId,
                  type: "good",
                  originalContent: content,
                  createdAt: new Date().toISOString(),
                };
                try { await saveFeedback(fb); } catch { /* fallback */ }
                setFeedbackSent(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
                setShowComment(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                feedbackType === "needs_improvement"
                  ? "bg-orange-500 text-white"
                  : "bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200"
              }`}
            >
              改善が必要
            </button>
          </div>
          {showComment && (
            <div className="space-y-2">
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="改善点をご記入ください（任意）"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-400 outline-none resize-y min-h-[50px]"
              />
              <button
                onClick={async () => {
                  const fb: GenerationFeedback = {
                    id: `fb-${Date.now()}`,
                    contentId,
                    type: "bad",
                    originalContent: content,
                    note: feedbackComment || undefined,
                    createdAt: new Date().toISOString(),
                  };
                  try { await saveFeedback(fb); } catch { /* fallback */ }
                  setFeedbackSent(true);
                }}
                className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600"
              >
                送信
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Accordion ----------
function Accordion({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">{title}</span>
          {badge}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

// ---------- Main Component ----------
export default function BulkGenerator({ profile, initialKeyword, onKeywordConsumed }: Props) {
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [faqCount, setFaqCount] = useState(5);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [progressMessage, setProgressMessage] = useState("");

  // Options
  const [contentOptions, setContentOptions] = useState<ContentOptions>({
    faq: true,
    blog: true,
    gbp: true,
    note: true,
  });

  // SEO自動生成
  const [autoSeo, setAutoSeo] = useState(true);

  // WordPress auto-post
  const hasWordPress = !!(
    profile.wordpress?.siteUrl &&
    profile.wordpress?.username &&
    profile.wordpress?.appPassword
  );
  const [wpAutoPost, setWpAutoPost] = useState(true);

  // Results
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [blogHtml, setBlogHtml] = useState("");
  const [blogWpUrl, setBlogWpUrl] = useState("");
  const [blogWpError, setBlogWpError] = useState("");
  const [blogSeoData, setBlogSeoData] = useState<SeoData>({});
  const [gbpPost, setGbpPost] = useState("");
  const [noteArticle, setNoteArticle] = useState("");

  // 医療広告ガイドラインチェック
  const [blogGuidelineCheck, setBlogGuidelineCheck] = useState<GuidelineCheckResult | null>(null);
  const [gbpGuidelineCheck, setGbpGuidelineCheck] = useState<GuidelineCheckResult | null>(null);
  const [noteGuidelineCheck, setNoteGuidelineCheck] = useState<GuidelineCheckResult | null>(null);

  // フィードバック評価
  const [blogFeedbackSent, setBlogFeedbackSent] = useState(false);
  const [gbpFeedbackSent, setGbpFeedbackSent] = useState(false);
  const [noteFeedbackSent, setNoteFeedbackSent] = useState(false);
  const [blogFeedbackType, setBlogFeedbackType] = useState<"good" | "needs_improvement" | null>(null);
  const [gbpFeedbackType, setGbpFeedbackType] = useState<"good" | "needs_improvement" | null>(null);
  const [noteFeedbackType, setNoteFeedbackType] = useState<"good" | "needs_improvement" | null>(null);
  const [blogFeedbackComment, setBlogFeedbackComment] = useState("");
  const [gbpFeedbackComment, setGbpFeedbackComment] = useState("");
  const [noteFeedbackComment, setNoteFeedbackComment] = useState("");
  const [showBlogFeedbackComment, setShowBlogFeedbackComment] = useState(false);
  const [showGbpFeedbackComment, setShowGbpFeedbackComment] = useState(false);
  const [showNoteFeedbackComment, setShowNoteFeedbackComment] = useState(false);

  // 重複チェック
  const [existingContent, setExistingContent] = useState<{ type: string; title: string; createdAt: string }[]>([]);
  const [duplicateChecked, setDuplicateChecked] = useState(false);

  // Inline editing state
  const [editingBlog, setEditingBlog] = useState(false);
  const [editingGbp, setEditingGbp] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [editBlogValue, setEditBlogValue] = useState("");
  const [editGbpValue, setEditGbpValue] = useState("");
  const [editNoteValue, setEditNoteValue] = useState("");

  // initialKeyword から自動入力
  useEffect(() => {
    if (initialKeyword) {
      setKeyword(initialKeyword);
      setDuplicateChecked(false);
      setExistingContent([]);
      onKeywordConsumed?.();
    }
  }, [initialKeyword, onKeywordConsumed]);

  const toggleOption = (key: keyof ContentOptions) => {
    setContentOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ---------- API helpers ----------
  const callGenerate = async (prompt: string, type: string, maxTokens?: number) => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: profile.anthropicKey,
        prompt,
        type,
        maxTokens,
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("AIからの応答を処理できませんでした。もう一度お試しください。");
    }
    if (!res.ok) {
      const errMsg = data.error || "";
      if (errMsg.includes("API key") || errMsg.includes("api_key") || errMsg.includes("authentication")) {
        throw new Error("APIキーが正しくありません。設定画面でAnthropicのAPIキーを確認してください。");
      } else if (errMsg.includes("rate limit") || res.status === 429) {
        throw new Error("AIの利用回数が上限に達しました。しばらく時間をおいてから、もう一度お試しください。");
      } else if (errMsg.includes("overloaded") || res.status === 529) {
        throw new Error("AIサーバーが混み合っています。1〜2分後にもう一度お試しください。");
      } else {
        throw new Error("コンテンツの生成に失敗しました。もう一度お試しください。");
      }
    }
    return data.content as string;
  };

  const postToWordPress = async (
    title: string,
    content: string,
    slug?: string,
    seo?: SeoData
  ) => {
    if (!hasWordPress) return { postUrl: "", postId: 0 };
    const res = await fetch("/api/wordpress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteUrl: profile.wordpress!.siteUrl,
        username: profile.wordpress!.username,
        appPassword: profile.wordpress!.appPassword,
        title,
        content,
        status: "draft",
        slug,
        ...(seo ? { seo } : {}),
      }),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("WordPressからの応答を処理できませんでした。WordPressサイトが正常に動作しているか確認してください。");
    }
    if (!res.ok) {
      const errMsg = data.error || "";
      if (res.status === 401 || res.status === 403) {
        throw new Error("WordPressのユーザー名またはパスワードが正しくありません。設定画面で接続情報を確認してください。");
      } else if (res.status === 404) {
        throw new Error("WordPressのサイトURLが正しくありません。設定画面でURLを確認してください。");
      } else {
        throw new Error(errMsg || "WordPress投稿に失敗しました。設定画面でWordPressの接続情報を確認してください。");
      }
    }
    return { postUrl: data.postUrl as string, postId: data.postId as number };
  };

  // ---------- 重複チェック ----------
  const checkDuplicates = async () => {
    if (!keyword) return;
    const existing = await getContentsByKeyword(keyword);
    const mapped = existing.map((c) => ({
      type: c.type,
      title: c.title,
      createdAt: c.createdAt,
    }));
    setExistingContent(mapped);
    setDuplicateChecked(true);
  };

  // ---------- Main generation flow ----------
  const runBulkGeneration = async () => {
    if (!keyword) {
      setError("キーワードを入力してください");
      return;
    }

    // 重複チェック（未チェックの場合）
    if (!duplicateChecked) {
      await checkDuplicates();
    }

    setError("");
    setFaqItems([]);
    setBlogHtml("");
    setBlogWpUrl("");
    setBlogWpError("");
    setBlogSeoData({});
    setGbpPost("");
    setNoteArticle("");
    setBlogGuidelineCheck(null);
    setGbpGuidelineCheck(null);
    setNoteGuidelineCheck(null);
    setBlogFeedbackSent(false);
    setGbpFeedbackSent(false);
    setNoteFeedbackSent(false);
    setBlogFeedbackType(null);
    setGbpFeedbackType(null);
    setNoteFeedbackType(null);
    setBlogFeedbackComment("");
    setGbpFeedbackComment("");
    setNoteFeedbackComment("");
    setShowBlogFeedbackComment(false);
    setShowGbpFeedbackComment(false);
    setShowNoteFeedbackComment(false);
    setIsRunning(true);
    setProgressMessage("");

    let generatedFaqItems: FaqItem[] = [];
    let generatedBlogHtml = "";
    let blogUrl = "";

    // 蓄積データを取得（順位変動・フィードバック・過去記事）
    const [contentInsight, rankingInsight] = await Promise.all([
      getContentInsight(keyword),
      getRankingInsight(keyword),
    ]);
    const accCtx: AccumulatedContext = { contentInsight, rankingInsight };

    // 生成ステップ数を計算
    const totalSteps = [
      contentOptions.faq || contentOptions.blog,
      contentOptions.blog,
      contentOptions.blog && hasWordPress && wpAutoPost,
      contentOptions.gbp,
      contentOptions.note,
    ].filter(Boolean).length;
    let currentStep = 0;

    try {
      // ── Step 1: FAQ生成 ──
      if (contentOptions.faq || contentOptions.blog) {
        currentStep++;
        setProgressMessage(`${currentStep}/${totalSteps}件目：FAQ（よくある質問）を生成中...`);

        const faqPrompt = faqIndividualListPrompt(profile, keyword, faqCount, accCtx) + ANTI_AI_INSTRUCTION;
        const faqRaw = await callGenerate(faqPrompt, "faq");

        try {
          const jsonMatch = faqRaw.match(/\[[\s\S]*\]/);
          generatedFaqItems = JSON.parse(jsonMatch ? jsonMatch[0] : faqRaw);
        } catch {
          generatedFaqItems = [
            {
              question: `${keyword}の原因は何ですか？`,
              answer: `<p>${keyword}の原因は様々です。${profile.name}にご相談ください。</p>`,
              seoTitle: `${keyword}の原因｜${profile.area}${profile.name}`,
              seoDescription: `${keyword}の原因について${profile.name}が解説します。`,
              slug: `faq-${keyword}-${Date.now()}`,
              blogTitle: `【${keyword}の原因と改善法】${profile.area}${profile.name}`,
              blogSlug: `${keyword}-cause-${Date.now()}`,
            },
          ];
        }

        generatedFaqItems = generatedFaqItems.slice(0, faqCount);
        setFaqItems([...generatedFaqItems]);

        // FAQ保存
        if (contentOptions.faq) {
          for (let i = 0; i < generatedFaqItems.length; i++) {
            const faq = generatedFaqItems[i];
            await saveContent({
              id: `faq-bulk-${Date.now()}-${i}`,
              type: "faq",
              title: faq.seoTitle || faq.question,
              content: `<div class="faq-item"><h3>${faq.question}</h3>${faq.answer}</div>`,
              keyword,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      // ── Step 2: ブログ生成 ──
      if (contentOptions.blog) {
        try {
          currentStep++;
          setProgressMessage(`${currentStep}/${totalSteps}件目：ブログ記事を生成中...`);

          const faqContentForBlog = generatedFaqItems
            .map((f) => `Q: ${f.question}\nA: ${f.answer.replace(/<[^>]*>/g, "")}`)
            .join("\n\n");

          const blogTopic = topic || `${keyword}の原因と改善法`;
          const blogPrompt =
            blogPostWithFaqPrompt(profile, keyword, blogTopic, faqContentForBlog, accCtx) +
            ANTI_AI_INSTRUCTION;
          generatedBlogHtml = await callGenerate(blogPrompt, "blog");
          setBlogHtml(generatedBlogHtml);
          setBlogGuidelineCheck(checkMedicalGuidelines(generatedBlogHtml));

          // SEO data（autoSeo ONの場合のみ）
          let seoData: SeoData = {};
          if (autoSeo) {
          setProgressMessage(`${currentStep}/${totalSteps}件目：ブログSEO情報を生成中...`);
          try {
            const seoRaw = await callGenerate(
              bulkBlogSeoPrompt(profile, keyword),
              "blog-seo",
              500
            );
            const jsonMatch = seoRaw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              seoData = {
                seoTitle: parsed.seoTitle,
                seoDescription: parsed.seoDescription || parsed.metaDescription,
                metaKeywords: parsed.seoKeywords || parsed.metaKeywords,
                ogpTitle: parsed.ogpTitle,
                ogpDescription: parsed.ogpDescription,
              };
            }
          } catch {
            seoData = {
              seoTitle: `${keyword}の原因と改善法｜${profile.area}${profile.name}`.slice(0, 32),
              seoDescription: `${profile.area}の${profile.name}が${keyword}の原因と改善方法を解説。`.slice(0, 120),
              metaKeywords: `${keyword},${keyword} 原因,${keyword} 改善,${profile.area} ${profile.category},${profile.name}`,
              ogpTitle: `${keyword}の原因と改善法｜${profile.name}`.slice(0, 40),
              ogpDescription: `${profile.area}の${profile.name}が${keyword}について解説します。`.slice(0, 90),
            };
          }
          } // end autoSeo
          setBlogSeoData(seoData);

          // ── Step 3: WordPress投稿 ──
          if (hasWordPress && wpAutoPost) {
            currentStep++;
            setProgressMessage(`${currentStep}/${totalSteps}件目：WordPressに下書き投稿中...`);
            try {
              const blogTitle = topic || generatedFaqItems[0]?.blogTitle || `${keyword}の原因と改善法`;
              const slug = generatedFaqItems[0]?.blogSlug || `${keyword}-guide-${Date.now()}`;
              const wpResult = await postToWordPress(blogTitle, generatedBlogHtml, slug, seoData);
              blogUrl = wpResult.postUrl;
              setBlogWpUrl(blogUrl);

              await saveContent({
                id: `blog-bulk-${Date.now()}`,
                type: "blog",
                title: blogTitle,
                content: generatedBlogHtml,
                keyword,
                createdAt: new Date().toISOString(),
                wpPostUrl: blogUrl,
                wpPostId: wpResult.postId,
              });
            } catch (wpErr) {
              const errMsg = wpErr instanceof Error ? wpErr.message : "WordPressへのブログ投稿に失敗しました。設定画面で接続情報を確認してください。";
              setBlogWpError(errMsg);

              await saveContent({
                id: `blog-bulk-${Date.now()}`,
                type: "blog",
                title: topic || `${keyword}の原因と改善法`,
                content: generatedBlogHtml,
                keyword,
                createdAt: new Date().toISOString(),
              });
            }
          } else {
            await saveContent({
              id: `blog-bulk-${Date.now()}`,
              type: "blog",
              title: topic || `${keyword}の原因と改善法`,
              content: generatedBlogHtml,
              keyword,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (blogErr) {
          const errMsg = blogErr instanceof Error ? blogErr.message : "ブログ記事の生成に失敗しました。もう一度お試しください。";
          setError((prev) => prev ? `${prev}\nブログ: ${errMsg}` : `ブログ: ${errMsg}`);
        }
      }

      // ── Step 4: GBP投稿文生成 ──
      if (contentOptions.gbp) {
        try {
          currentStep++;
          setProgressMessage(`${currentStep}/${totalSteps}件目：GBP投稿文を生成中...`);
          const gbpPrompt =
            gbpWithBlogUrlPrompt(profile, keyword, blogUrl || "", accCtx) + ANTI_AI_INSTRUCTION;
          const generatedGbp = await callGenerate(gbpPrompt, "gbp");
          setGbpPost(generatedGbp);
          setGbpGuidelineCheck(checkMedicalGuidelines(generatedGbp));

          await saveContent({
            id: `gbp-bulk-${Date.now()}`,
            type: "gbp",
            title: `${keyword} GBP投稿`,
            content: generatedGbp,
            keyword,
            createdAt: new Date().toISOString(),
          });
        } catch (gbpErr) {
          const errMsg = gbpErr instanceof Error ? gbpErr.message : "GBP投稿文の生成に失敗しました。もう一度お試しください。";
          setError((prev) => prev ? `${prev}\nGBP投稿: ${errMsg}` : `GBP投稿: ${errMsg}`);
        }
      }

      // ── Step 5: note記事生成 ──
      if (contentOptions.note) {
        try {
          currentStep++;
          setProgressMessage(`${currentStep}/${totalSteps}件目：note記事を生成中...`);
          const notePrompt =
            noteWithBlogUrlPrompt(profile, keyword, blogUrl || "", accCtx) + ANTI_AI_INSTRUCTION;
          const generatedNote = await callGenerate(notePrompt, "note");
          setNoteArticle(generatedNote);
          setNoteGuidelineCheck(checkMedicalGuidelines(generatedNote));

          const h1Match = generatedNote.match(/^#\s+(.+)$/m);
          const noteTitle = h1Match ? h1Match[1] : `${keyword} note記事`;

          await saveContent({
            id: `note-bulk-${Date.now()}`,
            type: "note",
            title: noteTitle,
            content: generatedNote,
            keyword,
            createdAt: new Date().toISOString(),
          });
        } catch (noteErr) {
          const errMsg = noteErr instanceof Error ? noteErr.message : "note記事の生成に失敗しました。もう一度お試しください。";
          setError((prev) => prev ? `${prev}\nnote記事: ${errMsg}` : `note記事: ${errMsg}`);
        }
      }

      setProgressMessage("完了！");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("API key") || msg.includes("api_key") || msg.includes("authentication")) {
        setError("APIキーが正しくありません。設定画面でAnthropicのAPIキーを確認してください。");
      } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
        setError("インターネット接続を確認して、もう一度お試しください。");
      } else {
        setError(msg || "コンテンツの一括生成に失敗しました。もう一度お試しください。");
      }
      setProgressMessage("");
    } finally {
      setIsRunning(false);
    }
  };

  // ---------- Option items config ----------
  const OPTION_ITEMS: { key: keyof ContentOptions; label: string; desc: string }[] = [
    { key: "faq", label: "FAQ（よくある質問）", desc: "個別のQ&Aを生成（生成後に手動コピーでWPに貼り付け）" },
    { key: "blog", label: "ブログ記事", desc: "FAQを参考にしたSEOブログ記事を生成（WP自動投稿対応）" },
    { key: "gbp", label: "GBP投稿文", desc: "Googleビジネスプロフィール用の投稿文を生成（コピーして投稿）" },
    { key: "note", label: "note記事", desc: "noteに投稿するマークダウン記事を生成（コピーして投稿）" },
  ];

  // FAQ全文テキスト（コピー用）
  const allFaqText = faqItems
    .map((f, i) => `Q${i + 1}. ${f.question}\nA. ${f.answer.replace(/<[^>]*>/g, "")}`)
    .join("\n\n");

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-800 rounded-xl shadow-lg p-6 text-white">
        <h2 className="text-xl font-bold mb-2">一括コンテンツ生成</h2>
        <p className="text-sm text-blue-100/80">
          キーワードからFAQ → ブログ → WP投稿 → GBP → noteの順に一括生成します。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-[11px] px-2.5 py-1 bg-white/10 border border-white/20 rounded-full text-blue-100">ブログ: WP自動投稿</span>
          <span className="text-[11px] px-2.5 py-1 bg-white/10 border border-white/20 rounded-full text-blue-100">FAQ: 生成→手動コピー</span>
          <span className="text-[11px] px-2.5 py-1 bg-white/10 border border-white/20 rounded-full text-blue-100">SEO/OGP: 手動コピー</span>
        </div>
      </div>

      {/* 入力フォーム */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="space-y-4">
          {/* キーワード入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              症状キーワード
            </label>
            {profile.keywords.length > 0 ? (
              <select
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setDuplicateChecked(false); setExistingContent([]); }}
                disabled={isRunning}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
              >
                <option value="">キーワードを選択</option>
                {profile.keywords.map((kw) => (
                  <option key={kw} value={kw}>
                    {kw}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setDuplicateChecked(false); setExistingContent([]); }}
                disabled={isRunning}
                placeholder="例: 腰痛、肩こり、頭痛"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
              />
            )}
          </div>

          {/* トピック入力（任意） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              テーマ・トピック（任意）
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isRunning}
              placeholder="例: 腰痛の原因と改善法（未入力の場合は自動設定）"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
            />
          </div>

          {/* FAQ生成数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              FAQ生成数
            </label>
            <div className="flex gap-2">
              {[3, 5, 8, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFaqCount(n)}
                  disabled={isRunning}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    faqCount === n
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {n}個
                </button>
              ))}
            </div>
          </div>

          {/* コンテンツ選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生成するコンテンツ
            </label>
            <div className="space-y-2">
              {OPTION_ITEMS.map(({ key, label, desc }) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    contentOptions[key]
                      ? "border-blue-300 bg-blue-50/50"
                      : "border-gray-200 bg-gray-50/50"
                  } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={contentOptions[key]}
                    onChange={() => toggleOption(key)}
                    disabled={isRunning}
                    className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* SEO自動生成トグル */}
          {(contentOptions.faq || contentOptions.blog) && (
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={autoSeo}
                onChange={(e) => setAutoSeo(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-800">SEO・OGP情報も自動生成する</span>
                <p className="text-xs text-gray-500">SEOタイトル・メタディスクリプション・OGP設定・スラッグを自動生成します</p>
              </div>
            </label>
          )}

          {/* WordPress自動投稿トグル */}
          {hasWordPress && contentOptions.blog && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wpAutoPost}
                  onChange={(e) => setWpAutoPost(e.target.checked)}
                  disabled={isRunning}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-800">
                    WordPressに自動投稿（下書き）
                  </span>
                  <p className="text-xs text-gray-500">
                    ブログ記事をWordPressに下書きとして自動投稿します
                  </p>
                </div>
              </label>
              <p className="text-xs text-green-600 mt-2 ml-7">WordPress連携済み</p>
            </div>
          )}

          {!hasWordPress && contentOptions.blog && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">
                WordPress未設定のため、コンテンツはコピー用に生成されます。
                設定画面でWordPress連携を追加すると、下書き自動投稿が可能になります。
              </p>
            </div>
          )}

          {/* 重複警告 */}
          {existingContent.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800 mb-2">
                「{keyword}」で既に生成済みのコンテンツがあります
              </p>
              <div className="space-y-1 mb-3">
                {existingContent.slice(0, 5).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      c.type === "faq" ? "bg-green-100 text-green-700" :
                      c.type === "blog" ? "bg-blue-100 text-blue-700" :
                      c.type === "gbp" ? "bg-red-100 text-red-700" :
                      "bg-orange-100 text-orange-700"
                    }`}>{c.type.toUpperCase()}</span>
                    <span className="truncate">{c.title}</span>
                    <span className="text-amber-500 flex-shrink-0">{new Date(c.createdAt).toLocaleDateString("ja-JP")}</span>
                  </div>
                ))}
                {existingContent.length > 5 && (
                  <p className="text-xs text-amber-600">他 {existingContent.length - 5}件</p>
                )}
              </div>
              <p className="text-xs text-amber-600">
                重複して生成すると同じキーワードのコンテンツが複数作成されます。新しく生成する場合は下のボタンを押してください。
              </p>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {/* 重複チェックボタン + 生成ボタン */}
          {keyword && !duplicateChecked && !isRunning && (
            <button
              onClick={checkDuplicates}
              className="w-full py-3 rounded-lg font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all border border-gray-200"
            >
              重複チェック
            </button>
          )}
          <button
            onClick={runBulkGeneration}
            disabled={isRunning || !keyword}
            className={`w-full py-3.5 rounded-lg font-bold text-sm transition-all ${
              isRunning
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-lg"
            }`}
          >
            {isRunning ? "生成中..." : "一括生成スタート"}
          </button>

          {/* 生成中のインライン案内 */}
          {isRunning && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-xs text-blue-700">
                AIが文章を作成しています...しばらくお待ちください（30秒〜1分程度）
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 進捗表示 */}
      {progressMessage && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            {isRunning ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
            )}
            <span className={`text-sm font-medium ${isRunning ? "text-blue-700" : "text-green-700"}`}>
              {progressMessage}
            </span>
          </div>

          {/* ステップ別プログレス */}
          {(() => {
            const steps = [
              ...(contentOptions.faq ? [{ key: "faq", label: "FAQ生成", done: faqItems.length > 0, active: progressMessage.includes("FAQ") }] : []),
              ...(contentOptions.blog ? [{ key: "blog", label: "ブログ記事", done: !!blogHtml, active: progressMessage.includes("ブログ") || progressMessage.includes("SEO") }] : []),
              ...(contentOptions.blog && hasWordPress && wpAutoPost ? [{ key: "wp", label: "WordPress投稿", done: !!blogWpUrl, active: progressMessage.includes("WordPress") }] : []),
              ...(contentOptions.gbp ? [{ key: "gbp", label: "GBP投稿文", done: !!gbpPost, active: progressMessage.includes("GBP") }] : []),
              ...(contentOptions.note ? [{ key: "note", label: "note記事", done: !!noteArticle, active: progressMessage.includes("note") }] : []),
            ];
            const doneCount = steps.filter(s => s.done).length;
            const progress = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

            return (
              <div className="space-y-3">
                {/* プログレスバー */}
                {isRunning && (
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max(progress, isRunning ? 5 : 0)}%` }}
                    />
                  </div>
                )}

                {/* ステップ一覧 */}
                <div className="grid gap-2">
                  {steps.map((step, i) => (
                    <div key={step.key} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                      step.done ? "bg-green-50" : step.active ? "bg-blue-50" : "bg-gray-50"
                    }`}>
                      {step.done ? (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      ) : step.active ? (
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] text-gray-400 font-bold">{i + 1}</span>
                        </div>
                      )}
                      <span className={`font-medium ${
                        step.done ? "text-green-700" : step.active ? "text-blue-700" : "text-gray-400"
                      }`}>{step.label}</span>
                      {step.done && <span className="text-xs text-green-500 ml-auto">完了</span>}
                      {step.active && <span className="text-xs text-blue-500 ml-auto animate-pulse">処理中...</span>}
                    </div>
                  ))}
                </div>

                {/* 完了時のサマリー */}
                {!isRunning && progressMessage === "完了！" && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 font-medium">
                      全{doneCount}件のコンテンツを生成しました。下にスクロールして結果を確認してください。
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========== 結果表示 ========== */}
      <div className="space-y-4">
        {/* FAQ結果 */}
        {faqItems.length > 0 && (
          <Accordion
            title={`FAQ（${faqItems.length}件）`}
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                生成済み
              </span>
            }
            defaultOpen={true}
          >
            <div className="space-y-4">
              {/* FAQ手動コピーの案内 */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800 font-medium mb-1">FAQ投稿について</p>
                <p className="text-xs text-amber-700">
                  selfullテーマではFAQの自動投稿に対応していないため、下のコピーボタンからWordPressの管理画面に手動で貼り付けてください。
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <CopyButton text={allFaqText} label="全FAQをコピー（テキスト）" />
                <CopyButton text={faqItems.map((f, i) => `<div class="faq-item"><h3>Q${i+1}. ${f.question}</h3>${f.answer}</div>`).join("\n")} label="全FAQをコピー（HTML）" />
              </div>
              {faqItems.map((faq, i) => (
                <div
                  key={i}
                  className="border border-gray-100 rounded-lg p-4 bg-gray-50/50"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-gray-800">
                      Q{i + 1}. {faq.question}
                    </h4>
                    <CopyButton
                      text={`Q. ${faq.question}\nA. ${faq.answer.replace(/<[^>]*>/g, "")}`}
                    />
                  </div>
                  <div
                    className="text-sm text-gray-700 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(faq.answer),
                    }}
                  />
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                      SEO: {faq.seoTitle}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                      slug: {faq.slug}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Accordion>
        )}

        {/* ブログ結果 */}
        {blogHtml && (
          <Accordion
            title="ブログ記事"
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                生成済み
              </span>
            }
            defaultOpen={true}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <CopyButton text={blogHtml} isHtml={true} label="テキストコピー" />
                <CopyButton text={blogHtml} label="HTMLコピー" />
                {!editingBlog && (
                  <>
                    <button
                      onClick={() => { setEditBlogValue(blogHtml); setEditingBlog(true); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                    >
                      編集する
                    </button>
                    <button
                      onClick={() => { if (!isRunning) runBulkGeneration(); }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 disabled:opacity-50"
                    >
                      再生成
                    </button>
                  </>
                )}
              </div>

              {/* WP投稿結果 */}
              {blogWpUrl && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <span className="text-xs text-green-700 font-medium">
                    WordPress下書き投稿済み
                  </span>
                  <a
                    href={blogWpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline hover:text-blue-800"
                  >
                    記事を確認
                  </a>
                  <CopyButton text={blogWpUrl} label="URLをコピー" />
                </div>
              )}
              {blogWpError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-600">WordPress投稿: {blogWpError}</p>
                </div>
              )}

              {/* ブログHTML表示 */}
              {editingBlog ? (
                <div className="space-y-2">
                  <textarea
                    value={editBlogValue}
                    onChange={(e) => setEditBlogValue(e.target.value)}
                    className="w-full min-h-[300px] px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-400 outline-none resize-y"
                  />
                  <div className="flex gap-2">
                    <button onClick={async () => { setBlogHtml(editBlogValue); setEditingBlog(false); try { await updateContent(`blog-bulk-${keyword}`, { content: editBlogValue }); } catch {} }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">保存</button>
                    <button onClick={() => setEditingBlog(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">キャンセル</button>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <div
                    className="prose prose-sm max-w-none text-gray-700 prose-headings:mt-8 prose-headings:mb-4 prose-p:my-4 prose-p:leading-7 prose-li:my-1 prose-ul:my-4 prose-h2:text-lg prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blogHtml) }}
                  />
                </div>
              )}

              <GuidelineCheckDisplay check={blogGuidelineCheck} />
              <FeedbackPanel
                contentId={`blog-bulk-${keyword}`}
                content={blogHtml}
                feedbackSent={blogFeedbackSent}
                setFeedbackSent={setBlogFeedbackSent}
                feedbackType={blogFeedbackType}
                setFeedbackType={setBlogFeedbackType}
                feedbackComment={blogFeedbackComment}
                setFeedbackComment={setBlogFeedbackComment}
                showComment={showBlogFeedbackComment}
                setShowComment={setShowBlogFeedbackComment}
              />
            </div>
          </Accordion>
        )}

        {/* ブログSEO情報 */}
        {blogHtml && Object.keys(blogSeoData).length > 0 && (
          <Accordion
            title="ブログSEO情報"
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                SEO
              </span>
            }
          >
            <div className="space-y-3">
              {blogSeoData.seoTitle && (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">SEOタイトル</p>
                    <p className="text-sm text-gray-800">{blogSeoData.seoTitle}</p>
                  </div>
                  <CopyButton text={blogSeoData.seoTitle} />
                </div>
              )}
              {blogSeoData.seoDescription && (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      メタディスクリプション
                    </p>
                    <p className="text-sm text-gray-800">{blogSeoData.seoDescription}</p>
                  </div>
                  <CopyButton text={blogSeoData.seoDescription} />
                </div>
              )}
              {blogSeoData.metaKeywords && (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">メタキーワード</p>
                    <p className="text-sm text-gray-800">{blogSeoData.metaKeywords}</p>
                  </div>
                  <CopyButton text={blogSeoData.metaKeywords} />
                </div>
              )}
              {blogSeoData.ogpTitle && (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">OGPタイトル</p>
                    <p className="text-sm text-gray-800">{blogSeoData.ogpTitle}</p>
                  </div>
                  <CopyButton text={blogSeoData.ogpTitle} />
                </div>
              )}
              {blogSeoData.ogpDescription && (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">OGP説明文</p>
                    <p className="text-sm text-gray-800">{blogSeoData.ogpDescription}</p>
                  </div>
                  <CopyButton text={blogSeoData.ogpDescription} />
                </div>
              )}
              <div className="pt-2">
                <CopyButton
                  text={JSON.stringify(blogSeoData, null, 2)}
                  label="SEO情報をまとめてコピー（JSON）"
                />
              </div>
            </div>
          </Accordion>
        )}

        {/* GBP結果 */}
        {gbpPost && (
          <Accordion
            title="GBP投稿文"
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                生成済み
              </span>
            }
            defaultOpen={true}
          >
            <div className="space-y-3">
              <div className="flex justify-end gap-2">
                <CopyButton text={gbpPost} label="GBP投稿文をコピー" />
                {!editingGbp && (
                  <>
                    <button
                      onClick={() => { setEditGbpValue(gbpPost); setEditingGbp(true); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                    >
                      編集する
                    </button>
                    <button
                      onClick={() => { if (!isRunning) runBulkGeneration(); }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 disabled:opacity-50"
                    >
                      再生成
                    </button>
                  </>
                )}
              </div>
              {editingGbp ? (
                <div className="space-y-2">
                  <textarea
                    value={editGbpValue}
                    onChange={(e) => setEditGbpValue(e.target.value)}
                    className="w-full min-h-[300px] px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-400 outline-none resize-y"
                  />
                  <div className="flex gap-2">
                    <button onClick={async () => { setGbpPost(editGbpValue); setEditingGbp(false); try { await updateContent(`gbp-bulk-${keyword}`, { content: editGbpValue }); } catch {} }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">保存</button>
                    <button onClick={() => setEditingGbp(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">キャンセル</button>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{gbpPost}</p>
                </div>
              )}

              <GuidelineCheckDisplay check={gbpGuidelineCheck} />
              <FeedbackPanel
                contentId={`gbp-bulk-${keyword}`}
                content={gbpPost}
                feedbackSent={gbpFeedbackSent}
                setFeedbackSent={setGbpFeedbackSent}
                feedbackType={gbpFeedbackType}
                setFeedbackType={setGbpFeedbackType}
                feedbackComment={gbpFeedbackComment}
                setFeedbackComment={setGbpFeedbackComment}
                showComment={showGbpFeedbackComment}
                setShowComment={setShowGbpFeedbackComment}
              />
            </div>
          </Accordion>
        )}

        {/* note結果 */}
        {noteArticle && (
          <Accordion
            title="note記事"
            badge={
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                生成済み
              </span>
            }
            defaultOpen={true}
          >
            <div className="space-y-3">
              <div className="flex justify-end gap-2">
                <CopyButton text={noteArticle} label="note記事をコピー" />
                {!editingNote && (
                  <>
                    <button
                      onClick={() => { setEditNoteValue(noteArticle); setEditingNote(true); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                    >
                      編集する
                    </button>
                    <button
                      onClick={() => { if (!isRunning) runBulkGeneration(); }}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 disabled:opacity-50"
                    >
                      再生成
                    </button>
                  </>
                )}
              </div>
              {editingNote ? (
                <div className="space-y-2">
                  <textarea
                    value={editNoteValue}
                    onChange={(e) => setEditNoteValue(e.target.value)}
                    className="w-full min-h-[300px] px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-400 outline-none resize-y"
                  />
                  <div className="flex gap-2">
                    <button onClick={async () => { setNoteArticle(editNoteValue); setEditingNote(false); try { await updateContent(`note-bulk-${keyword}`, { content: editNoteValue }); } catch {} }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">保存</button>
                    <button onClick={() => setEditingNote(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">キャンセル</button>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 max-h-[500px] overflow-y-auto">
                  <div className="prose prose-sm max-w-none prose-headings:mt-8 prose-headings:mb-4 prose-p:my-4 prose-p:leading-7 prose-li:my-1 prose-ul:my-4 prose-h2:text-lg prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-strong:text-blue-700 prose-hr:my-6">
                    <ReactMarkdown>{noteArticle}</ReactMarkdown>
                  </div>
                </div>
              )}

              <GuidelineCheckDisplay check={noteGuidelineCheck} />
              <FeedbackPanel
                contentId={`note-bulk-${keyword}`}
                content={noteArticle}
                feedbackSent={noteFeedbackSent}
                setFeedbackSent={setNoteFeedbackSent}
                feedbackType={noteFeedbackType}
                setFeedbackType={setNoteFeedbackType}
                feedbackComment={noteFeedbackComment}
                setFeedbackComment={setNoteFeedbackComment}
                showComment={showNoteFeedbackComment}
                setShowComment={setShowNoteFeedbackComment}
              />
            </div>
          </Accordion>
        )}
      </div>
    </div>
  );
}
