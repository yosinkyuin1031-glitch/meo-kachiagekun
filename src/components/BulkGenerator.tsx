"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BusinessProfile, GeneratedContent } from "@/lib/types";
import { saveContent, updateContent, getContentsByKeyword } from "@/lib/supabase-storage";
import {
  blogPostWithFaqPrompt,
  faqIndividualListPrompt,
  gbpWithBlogUrlPrompt,
  noteWithBlogUrlPrompt,
  bulkBlogSeoPrompt,
} from "@/lib/prompts";

interface Props {
  profile: BusinessProfile;
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
export default function BulkGenerator({ profile }: Props) {
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
      throw new Error(`API応答の解析に失敗しました（${type}）: ${text.slice(0, 100)}`);
    }
    if (!res.ok) throw new Error(data.error || `APIエラー（${res.status}）`);
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
      throw new Error(`WordPress応答の解析に失敗: ${text.slice(0, 100)}`);
    }
    if (!res.ok) throw new Error(data.error || "WordPress投稿に失敗しました");
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
    setIsRunning(true);
    setProgressMessage("");

    let generatedFaqItems: FaqItem[] = [];
    let generatedBlogHtml = "";
    let blogUrl = "";

    try {
      // ── Step 1: FAQ生成 ──
      if (contentOptions.faq || contentOptions.blog) {
        setProgressMessage("FAQ（よくある質問）を生成中...");

        const faqPrompt = faqIndividualListPrompt(profile, keyword, faqCount) + ANTI_AI_INSTRUCTION;
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
          setProgressMessage("ブログ記事を生成中...");

          const faqContentForBlog = generatedFaqItems
            .map((f) => `Q: ${f.question}\nA: ${f.answer.replace(/<[^>]*>/g, "")}`)
            .join("\n\n");

          const blogTopic = topic || `${keyword}の原因と改善法`;
          const blogPrompt =
            blogPostWithFaqPrompt(profile, keyword, blogTopic, faqContentForBlog) +
            ANTI_AI_INSTRUCTION;
          generatedBlogHtml = await callGenerate(blogPrompt, "blog");
          setBlogHtml(generatedBlogHtml);

          // SEO data（autoSeo ONの場合のみ）
          let seoData: SeoData = {};
          if (autoSeo) {
          setProgressMessage("ブログSEO情報を生成中...");
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
            setProgressMessage("WordPressに下書き投稿中...");
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
              const errMsg = wpErr instanceof Error ? wpErr.message : "ブログ投稿に失敗しました";
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
          const errMsg = blogErr instanceof Error ? blogErr.message : "ブログ生成に失敗しました";
          setError((prev) => prev ? `${prev}\nブログ: ${errMsg}` : `ブログ: ${errMsg}`);
        }
      }

      // ── Step 4: GBP投稿文生成 ──
      if (contentOptions.gbp) {
        try {
          setProgressMessage("GBP投稿文を生成中...");
          const gbpPrompt =
            gbpWithBlogUrlPrompt(profile, keyword, blogUrl || "") + ANTI_AI_INSTRUCTION;
          const generatedGbp = await callGenerate(gbpPrompt, "gbp");
          setGbpPost(generatedGbp);

          await saveContent({
            id: `gbp-bulk-${Date.now()}`,
            type: "gbp",
            title: `${keyword} GBP投稿`,
            content: generatedGbp,
            keyword,
            createdAt: new Date().toISOString(),
          });
        } catch (gbpErr) {
          const errMsg = gbpErr instanceof Error ? gbpErr.message : "GBP生成に失敗しました";
          setError((prev) => prev ? `${prev}\nGBP: ${errMsg}` : `GBP: ${errMsg}`);
        }
      }

      // ── Step 5: note記事生成 ──
      if (contentOptions.note) {
        try {
          setProgressMessage("note記事を生成中...");
          const notePrompt =
            noteWithBlogUrlPrompt(profile, keyword, blogUrl || "") + ANTI_AI_INSTRUCTION;
          const generatedNote = await callGenerate(notePrompt, "note");
          setNoteArticle(generatedNote);

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
          const errMsg = noteErr instanceof Error ? noteErr.message : "note生成に失敗しました";
          setError((prev) => prev ? `${prev}\nnote: ${errMsg}` : `note: ${errMsg}`);
        }
      }

      setProgressMessage("完了！");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
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
        </div>
      </div>

      {/* 進捗表示 */}
      {progressMessage && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3">
            {isRunning && (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            <span
              className={`text-sm font-medium ${
                isRunning ? "text-blue-700" : "text-green-700"
              }`}
            >
              {progressMessage}
            </span>
          </div>
          {/* Step indicators */}
          {isRunning && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {contentOptions.faq && (
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    faqItems.length > 0
                      ? "bg-green-100 text-green-700"
                      : progressMessage.includes("FAQ")
                      ? "bg-blue-100 text-blue-700 animate-pulse"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  FAQ
                </span>
              )}
              {contentOptions.blog && (
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    blogHtml
                      ? "bg-green-100 text-green-700"
                      : progressMessage.includes("ブログ") || progressMessage.includes("WordPress") || progressMessage.includes("SEO")
                      ? "bg-blue-100 text-blue-700 animate-pulse"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  ブログ
                </span>
              )}
              {contentOptions.gbp && (
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    gbpPost
                      ? "bg-green-100 text-green-700"
                      : progressMessage.includes("GBP")
                      ? "bg-blue-100 text-blue-700 animate-pulse"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  GBP
                </span>
              )}
              {contentOptions.note && (
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    noteArticle
                      ? "bg-green-100 text-green-700"
                      : progressMessage.includes("note")
                      ? "bg-blue-100 text-blue-700 animate-pulse"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  note
                </span>
              )}
            </div>
          )}
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
                      __html: faq.answer,
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
                  <button
                    onClick={() => { setEditBlogValue(blogHtml); setEditingBlog(true); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                  >
                    編集する
                  </button>
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
                  <p className="text-xs text-red-600">WP投稿エラー: {blogWpError}</p>
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
                    <button onClick={() => { setBlogHtml(editBlogValue); setEditingBlog(false); }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">保存</button>
                    <button onClick={() => setEditingBlog(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">キャンセル</button>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <div
                    className="prose prose-sm max-w-none text-gray-700 prose-headings:mt-8 prose-headings:mb-4 prose-p:my-4 prose-p:leading-7 prose-li:my-1 prose-ul:my-4 prose-h2:text-lg prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2"
                    dangerouslySetInnerHTML={{ __html: blogHtml }}
                  />
                </div>
              )}
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
                  <button
                    onClick={() => { setEditGbpValue(gbpPost); setEditingGbp(true); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                  >
                    編集する
                  </button>
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
                    <button onClick={() => { setGbpPost(editGbpValue); setEditingGbp(false); }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">保存</button>
                    <button onClick={() => setEditingGbp(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">キャンセル</button>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{gbpPost}</p>
                </div>
              )}
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
                  <button
                    onClick={() => { setEditNoteValue(noteArticle); setEditingNote(true); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                  >
                    編集する
                  </button>
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
                    <button onClick={() => { setNoteArticle(editNoteValue); setEditingNote(false); }} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">保存</button>
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
            </div>
          </Accordion>
        )}
      </div>
    </div>
  );
}
