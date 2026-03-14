"use client";

import { useState } from "react";
import { BusinessProfile, GeneratedContent } from "@/lib/types";
import { saveContent, getContents } from "@/lib/storage";
import {
  blogPostPrompt,
  blogPostWithFaqPrompt,
  bulkBlogSeoPrompt,
  faqWithBlogUrlPrompt,
  gbpWithBlogUrlPrompt,
  noteWithBlogUrlPrompt,
} from "@/lib/prompts";
import VoiceInput from "@/components/VoiceInput";

interface Props {
  profile: BusinessProfile;
}

interface SeoInfo {
  blogTitle: string;
  blogSummary: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogpTitle: string;
  ogpDescription: string;
  slug: string;
  faqSeoTitle: string;
  faqSeoDescription: string;
  faqOgpTitle: string;
  faqOgpDescription: string;
  faqSlug: string;
}

interface BulkResult {
  seoInfo: SeoInfo | null;
  blogHtml: string;
  blogWpUrl: string;
  faqHtml: string;
  faqWpUrl: string;
  gbpPost: string;
  noteArticle: string;
}

type Step = "idle" | "seo" | "faq" | "faq-wp" | "blog" | "blog-wp" | "gbp" | "note" | "done";

const STEP_LABELS: Record<Step, string> = {
  idle: "",
  seo: "SEO・OGP情報を生成中...",
  faq: "FAQ（よくある質問）を生成中...",
  "faq-wp": "FAQをWordPressに投稿中...",
  blog: "ブログ記事を生成中...",
  "blog-wp": "ブログをWordPressに投稿中...",
  gbp: "GBP投稿文を生成中...",
  note: "note記事を生成中...",
  done: "すべて完了！",
};

const STEPS_ORDER: Step[] = ["seo", "faq", "faq-wp", "blog", "blog-wp", "gbp", "note", "done"];

export default function BulkGenerator({ profile }: Props) {
  const [keyword, setKeyword] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [currentStep, setCurrentStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<"draft" | "publish">("draft");

  const hasWordPress = !!(
    profile.wordpress?.siteUrl &&
    profile.wordpress?.username &&
    profile.wordpress?.appPassword
  );

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
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.content as string;
  };

  const postToWordPress = async (title: string, content: string, slug?: string, categorySlug?: string) => {
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
        status: publishMode,
        slug,
        categorySlug,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { postUrl: data.postUrl as string, postId: data.postId as number };
  };

  const runBulkGeneration = async () => {
    if (!keyword) {
      setError("キーワードを選択してください");
      return;
    }

    setError("");
    setResult(null);

    const bulkResult: BulkResult = {
      seoInfo: null,
      blogHtml: "",
      blogWpUrl: "",
      faqHtml: "",
      faqWpUrl: "",
      gbpPost: "",
      noteArticle: "",
    };

    try {
      // Step 1: SEO・OGP情報を一括生成
      setCurrentStep("seo");
      const seoRaw = await callGenerate(bulkBlogSeoPrompt(profile, keyword), "blog-seo");
      let seoInfo: SeoInfo;
      try {
        const jsonMatch = seoRaw.match(/\{[\s\S]*\}/);
        seoInfo = JSON.parse(jsonMatch ? jsonMatch[0] : seoRaw);
      } catch {
        seoInfo = {
          blogTitle: `【${keyword}の原因と改善法】${profile.area}${profile.name}`,
          blogSummary: `${profile.area}の${profile.name}が${keyword}の原因・改善方法を解説`,
          seoTitle: `${keyword}の原因と改善法｜${profile.area}${profile.name}`,
          seoDescription: `${profile.name}が${keyword}の原因・改善方法を詳しく解説。`,
          seoKeywords: `${keyword},${profile.area},${profile.category}`,
          ogpTitle: `${keyword}でお悩みの方へ｜${profile.name}`,
          ogpDescription: `${keyword}の原因から改善策まで解説`,
          slug: "symptom-guide",
          faqSeoTitle: `${keyword}FAQ｜${profile.area}${profile.name}`,
          faqSeoDescription: `${keyword}のよくある質問`,
          faqOgpTitle: `${keyword}FAQ｜${profile.name}`,
          faqOgpDescription: `${keyword}のよくある質問まとめ`,
          faqSlug: "faq-" + Date.now(),
        };
      }
      bulkResult.seoInfo = seoInfo;
      setResult({ ...bulkResult });

      // Step 2: FAQ（よくある質問）を先に生成（ブログURLは後で追加）
      setCurrentStep("faq");
      const faqHtml = await callGenerate(
        faqWithBlogUrlPrompt(profile, keyword),
        "faq"
      );
      bulkResult.faqHtml = faqHtml;
      setResult({ ...bulkResult });

      // Step 3: FAQをWordPressに投稿（「よくある質問」カテゴリ）
      let faqWpPostId = 0;
      let faqWpUrl = "";
      if (hasWordPress) {
        setCurrentStep("faq-wp");
        const faqWpResult = await postToWordPress(
          seoInfo.faqSeoTitle || `【${keyword}】よくある質問｜${profile.name}`,
          faqHtml,
          seoInfo.faqSlug,
          "faq"
        );
        faqWpUrl = faqWpResult.postUrl;
        faqWpPostId = faqWpResult.postId;
        bulkResult.faqWpUrl = faqWpUrl;
      }
      // FAQ履歴を必ず保存（WP有無にかかわらず）
      saveContent({
        id: `faq-bulk-${Date.now()}`,
        type: "faq",
        title: seoInfo.faqSeoTitle || `【${keyword}】よくある質問`,
        content: faqHtml,
        keyword,
        createdAt: new Date().toISOString(),
        ...(faqWpPostId ? { wpPostId: faqWpPostId, wpPostUrl: faqWpUrl } : {}),
      });
      setResult({ ...bulkResult });

      // Step 4: ブログ記事を生成（FAQ内容を参考に）
      setCurrentStep("blog");
      const blogHtml = await callGenerate(
        blogPostWithFaqPrompt(profile, keyword, seoInfo.blogTitle, faqHtml),
        "blog"
      );
      bulkResult.blogHtml = blogHtml;
      setResult({ ...bulkResult });

      // Step 5: ブログをWordPressに投稿（「院内ブログ」カテゴリ）
      let blogUrl = "";
      let blogWpPostId = 0;
      if (hasWordPress) {
        setCurrentStep("blog-wp");
        const wpResult = await postToWordPress(seoInfo.blogTitle, blogHtml, seoInfo.slug, "blog");
        blogUrl = wpResult.postUrl;
        blogWpPostId = wpResult.postId;
        bulkResult.blogWpUrl = blogUrl;
      } else {
        blogUrl = `https://${profile.name.replace(/\s/g, "")}.com/blog/${seoInfo.slug}`;
        bulkResult.blogWpUrl = blogUrl;
      }
      // ブログ履歴を必ず保存（WP有無にかかわらず）
      saveContent({
        id: `blog-bulk-${Date.now()}`,
        type: "blog",
        title: seoInfo.blogTitle,
        content: blogHtml,
        keyword,
        createdAt: new Date().toISOString(),
        ...(blogWpPostId ? { wpPostId: blogWpPostId, wpPostUrl: blogUrl } : {}),
      });
      setResult({ ...bulkResult });

      // Step 6: GBP投稿（ブログURL埋め込み）
      setCurrentStep("gbp");
      const gbpPost = await callGenerate(
        gbpWithBlogUrlPrompt(profile, keyword, blogUrl),
        "gbp"
      );
      bulkResult.gbpPost = gbpPost;
      saveContent({
        id: `gbp-bulk-${Date.now()}`,
        type: "gbp",
        title: keyword,
        content: gbpPost,
        keyword,
        createdAt: new Date().toISOString(),
      });
      setResult({ ...bulkResult });

      // Step 7: note記事（ブログURL埋め込み・装飾付き）
      setCurrentStep("note");
      const noteArticle = await callGenerate(
        noteWithBlogUrlPrompt(profile, keyword, blogUrl),
        "note"
      );
      bulkResult.noteArticle = noteArticle;
      saveContent({
        id: `note-bulk-${Date.now()}`,
        type: "note",
        title: keyword,
        content: noteArticle,
        keyword,
        createdAt: new Date().toISOString(),
      });
      setResult({ ...bulkResult });

      setCurrentStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setCurrentStep("idle");
    }
  };

  const copySection = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<GeneratedContent[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  const loadHistory = () => {
    setHistoryItems(getContents());
    setShowHistory(!showHistory);
  };

  const filteredHistory = historyFilter === "all"
    ? historyItems
    : historyItems.filter((h) => h.type === historyFilter);

  const currentStepIndex = STEPS_ORDER.indexOf(currentStep);
  const isRunning = currentStep !== "idle" && currentStep !== "done";

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-2">一括コンテンツ生成</h2>
            <p className="text-sm opacity-90">
              キーワードを1つ選ぶだけで、FAQ・ブログ・GBP投稿・note記事をすべて一連の流れで生成します。
            </p>
          </div>
          <button
            onClick={loadHistory}
            className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {showHistory ? "閉じる" : "📜 生成履歴"}
          </button>
        </div>
      </div>

      {/* 生成履歴パネル */}
      {showHistory && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-3">生成履歴</h3>
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "blog", "faq", "gbp", "note"].map((f) => (
              <button
                key={f}
                onClick={() => setHistoryFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  historyFilter === f ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {f === "all" ? "すべて" : f === "blog" ? "ブログ" : f === "faq" ? "FAQ" : f === "gbp" ? "GBP" : "note"}
              </button>
            ))}
          </div>
          {filteredHistory.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">履歴がありません</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredHistory.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      item.type === "blog" ? "bg-blue-100 text-blue-700"
                      : item.type === "faq" ? "bg-green-100 text-green-700"
                      : item.type === "gbp" ? "bg-red-100 text-red-700"
                      : "bg-orange-100 text-orange-700"
                    }`}>
                      {item.type === "blog" ? "ブログ" : item.type === "faq" ? "FAQ" : item.type === "gbp" ? "GBP" : "note"}
                    </span>
                    <span className="text-xs text-gray-500">{item.keyword}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                    {item.content.replace(/<[^>]*>/g, "").slice(0, 100)}...
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(item.content);
                      }}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      コピー
                    </button>
                    {item.wpPostUrl && (
                      <a
                        href={item.wpPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                      >
                        WP記事を見る
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 入力フォーム */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              症状キーワード
            </label>
            <select
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={isRunning}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-100"
            >
              <option value="">キーワードを選択</option>
              {profile.keywords.map((kw) => (
                <option key={kw} value={kw}>{kw}</option>
              ))}
            </select>
          </div>

          {/* 追加情報（音声入力可） */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="block text-sm font-medium text-gray-700">
                追加情報（音声入力可）
              </label>
              <VoiceInput
                onResult={(text) => setAdditionalInfo((prev) => prev ? prev + " " + text : text)}
                placeholder="音声で追加情報を入力"
              />
            </div>
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              disabled={isRunning}
              placeholder="生成に含めたい追加情報を入力（例: 当院独自の施術法、特徴、患者の声など）"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-100 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">マイクボタンで音声入力できます。入力内容は生成プロンプトに追加されます。</p>
          </div>

          {hasWordPress && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">WordPress投稿:</label>
              <select
                value={publishMode}
                onChange={(e) => setPublishMode(e.target.value as "draft" | "publish")}
                disabled={isRunning}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="draft">下書き保存</option>
                <option value="publish">即時公開</option>
              </select>
              <span className="text-xs text-green-600">WP連携済み</span>
            </div>
          )}

          {!hasWordPress && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">
                WordPress未設定のため、コンテンツはコピー用に生成されます（ブログURLはダミーになります）。
                設定画面でWordPress連携を追加すると、自動投稿＋URL埋め込みが有効になります。
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          <button
            onClick={runBulkGeneration}
            disabled={isRunning || !keyword}
            className={`w-full py-3.5 rounded-lg font-bold text-sm transition-all ${
              isRunning
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:from-orange-700 hover:to-amber-600 shadow-lg"
            }`}
          >
            {isRunning ? "生成中..." : "一括生成スタート"}
          </button>
        </div>
      </div>

      {/* 進捗バー */}
      {currentStep !== "idle" && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-4">生成の進捗</h3>
          <div className="space-y-3">
            {STEPS_ORDER.map((step, i) => {
              const isActive = step === currentStep;
              const isDone = currentStepIndex > i || currentStep === "done";
              const isPending = currentStepIndex < i && currentStep !== "done";

              // WP未設定の場合、WP投稿ステップをスキップ表示
              if (!hasWordPress && (step === "blog-wp" || step === "faq-wp")) {
                return null;
              }

              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isDone ? "bg-green-500 text-white"
                    : isActive ? "bg-orange-500 text-white animate-pulse"
                    : "bg-gray-200 text-gray-500"
                  }`}>
                    {isDone ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-sm ${
                    isDone ? "text-green-700 font-medium"
                    : isActive ? "text-orange-700 font-medium"
                    : isPending ? "text-gray-400" : ""
                  }`}>
                    {STEP_LABELS[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 生成結果 */}
      {result && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-gray-800">生成結果</h3>

          {/* SEO情報 */}
          {result.seoInfo && (
            <ResultSection
              title="SEO・OGP情報"
              icon="🔍"
              color="purple"
              expanded={expandedSection === "seo"}
              onToggle={() => setExpandedSection(expandedSection === "seo" ? null : "seo")}
              onCopy={() => copySection("seo", JSON.stringify(result.seoInfo, null, 2))}
              copied={copiedSection === "seo"}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <InfoRow label="ブログタイトル" value={result.seoInfo.blogTitle} />
                <InfoRow label="要約文" value={result.seoInfo.blogSummary} />
                <InfoRow label="SEOタイトル" value={result.seoInfo.seoTitle} />
                <InfoRow label="メタディスクリプション" value={result.seoInfo.seoDescription} />
                <InfoRow label="メタキーワード" value={result.seoInfo.seoKeywords} />
                <InfoRow label="OGPタイトル" value={result.seoInfo.ogpTitle} />
                <InfoRow label="OGPディスクリプション" value={result.seoInfo.ogpDescription} />
                <InfoRow label="スラッグ" value={result.seoInfo.slug} />
                <div className="col-span-full border-t pt-2 mt-1">
                  <p className="text-xs text-gray-400 font-medium mb-1">FAQ用SEO</p>
                </div>
                <InfoRow label="FAQ SEOタイトル" value={result.seoInfo.faqSeoTitle} />
                <InfoRow label="FAQ メタディスクリプション" value={result.seoInfo.faqSeoDescription} />
                <InfoRow label="FAQ OGPタイトル" value={result.seoInfo.faqOgpTitle} />
                <InfoRow label="FAQ OGPディスクリプション" value={result.seoInfo.faqOgpDescription} />
              </div>
            </ResultSection>
          )}

          {/* ブログ記事 */}
          {result.blogHtml && (
            <ResultSection
              title="ブログ記事（WordPress）"
              icon="📄"
              color="blue"
              expanded={expandedSection === "blog"}
              onToggle={() => setExpandedSection(expandedSection === "blog" ? null : "blog")}
              onCopy={() => copySection("blog", result.blogHtml)}
              copied={copiedSection === "blog"}
              wpUrl={result.blogWpUrl}
            >
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[400px] overflow-y-auto">
                {result.blogHtml}
              </pre>
            </ResultSection>
          )}

          {/* FAQ */}
          {result.faqHtml && (
            <ResultSection
              title="FAQ（よくある質問）"
              icon="❓"
              color="green"
              expanded={expandedSection === "faq"}
              onToggle={() => setExpandedSection(expandedSection === "faq" ? null : "faq")}
              onCopy={() => copySection("faq", result.faqHtml)}
              copied={copiedSection === "faq"}
              wpUrl={result.faqWpUrl}
            >
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[400px] overflow-y-auto">
                {result.faqHtml}
              </pre>
            </ResultSection>
          )}

          {/* GBP投稿 */}
          {result.gbpPost && (
            <ResultSection
              title="GBP投稿（Googleマイビジネス）"
              icon="📍"
              color="red"
              expanded={expandedSection === "gbp"}
              onToggle={() => setExpandedSection(expandedSection === "gbp" ? null : "gbp")}
              onCopy={() => copySection("gbp", result.gbpPost)}
              copied={copiedSection === "gbp"}
            >
              {/* アイキャッチ画像エリア */}
              <div className="mb-4 p-4 border-2 border-dashed border-red-300 rounded-lg bg-red-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🖼️</span>
                  <span className="text-sm font-medium text-red-700">アイキャッチ画像</span>
                  <span className="text-xs text-red-500">（GBP投稿に必要）</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Googleマイビジネスの「最新情報」投稿には画像が必要です。
                  以下の画像を用意してGBP管理画面で投稿時に添付してください。
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 bg-white rounded p-2 border border-red-100">
                    <span>📏</span> 推奨サイズ: 1200×900px（4:3）
                  </div>
                  <div className="flex items-center gap-1.5 bg-white rounded p-2 border border-red-100">
                    <span>📷</span> 施術風景・院内写真・症状イメージ
                  </div>
                  <div className="flex items-center gap-1.5 bg-white rounded p-2 border border-red-100">
                    <span>📝</span> キーワード「{keyword}」に関連する画像
                  </div>
                  <div className="flex items-center gap-1.5 bg-white rounded p-2 border border-red-100">
                    <span>⚠️</span> 患者の顔が写らないよう注意
                  </div>
                </div>
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {result.gbpPost}
              </pre>
            </ResultSection>
          )}

          {/* note記事 */}
          {result.noteArticle && (
            <ResultSection
              title="note記事（装飾・図解付き）"
              icon="📝"
              color="orange"
              expanded={expandedSection === "note"}
              onToggle={() => setExpandedSection(expandedSection === "note" ? null : "note")}
              onCopy={() => copySection("note", result.noteArticle)}
              copied={copiedSection === "note"}
            >
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[400px] overflow-y-auto">
                {result.noteArticle}
              </pre>
            </ResultSection>
          )}
        </div>
      )}
    </div>
  );
}

// ─── サブコンポーネント ──────────────────────────

function ResultSection({
  title, icon, color, expanded, onToggle, onCopy, copied, wpUrl, children,
}: {
  title: string;
  icon: string;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
  wpUrl?: string;
  children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    purple: "border-purple-200 bg-purple-50",
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    red: "border-red-200 bg-red-50",
    orange: "border-orange-200 bg-orange-50",
  };
  const headerColor: Record<string, string> = {
    purple: "text-purple-800",
    blue: "text-blue-800",
    green: "text-green-800",
    red: "text-red-800",
    orange: "text-orange-800",
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${expanded ? "" : ""}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-4 ${colorMap[color]} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className={`font-bold text-sm ${headerColor[color]}`}>{title}</span>
          {wpUrl && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              WP投稿済
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={onCopy}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {copied ? "コピー完了" : "コピー"}
            </button>
            {wpUrl && (
              <a
                href={wpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
              >
                WordPress記事を見る →
              </a>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-4">{children}</div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-2 border border-gray-100">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value}</p>
    </div>
  );
}
