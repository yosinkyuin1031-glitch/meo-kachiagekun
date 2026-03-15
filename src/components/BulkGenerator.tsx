"use client";

import { useState } from "react";
import { BusinessProfile, GeneratedContent } from "@/lib/types";
import { saveContent, getContents } from "@/lib/storage";
import {
  blogPostWithFaqPrompt,
  faqIndividualListPrompt,
  gbpWithBlogUrlPrompt,
  noteWithBlogUrlPrompt,
} from "@/lib/prompts";
import VoiceInput from "@/components/VoiceInput";
import { generateGbpImageBase64 } from "@/lib/gbpCanvas";
import { getGoogleSettings } from "@/lib/storage";

interface Props {
  profile: BusinessProfile;
}

// 生成オプション
interface ContentOptions {
  faq: boolean;
  blog: boolean;
  gbp: boolean;
  gbpImage: boolean;
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

// 各FAQ単位の生成結果
interface FaqSetResult {
  faq: FaqItem;
  faqWpPostId?: number;
  faqWpUrl?: string;
  blogHtml?: string;
  blogWpUrl?: string;
  gbpPost?: string;
  gbpImageBase64?: string;
  gbpImageWpUrl?: string;
  gbpPosted?: boolean;
  gbpPostError?: string;
  noteArticle?: string;
}

interface BulkResult {
  sets: FaqSetResult[];
  overallProgress: string;
}

export default function BulkGenerator({ profile }: Props) {
  const [keyword, setKeyword] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [publishMode, setPublishMode] = useState<"draft" | "publish">("draft");
  const [blogCategory, setBlogCategory] = useState<"symptom" | "blog">("symptom");

  // 生成設定
  const [faqCount, setFaqCount] = useState(3);
  const [contentOptions, setContentOptions] = useState<ContentOptions>({
    faq: true,
    blog: true,
    gbp: true,
    gbpImage: true,
    note: true,
  });

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

  const postToWordPress = async (title: string, content: string, slug?: string, categorySlug?: string, postType?: string) => {
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
        postType,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { postUrl: data.postUrl as string, postId: data.postId as number };
  };

  const toggleOption = (key: keyof ContentOptions) => {
    setContentOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const runBulkGeneration = async () => {
    if (!keyword) {
      setError("キーワードを選択してください");
      return;
    }

    setError("");
    setResult(null);
    setIsRunning(true);

    const bulkResult: BulkResult = {
      sets: [],
      overallProgress: "",
    };

    try {
      // ── Step 1: FAQ一覧を生成 ──
      bulkResult.overallProgress = "FAQ（よくある質問）を生成中...";
      setResult({ ...bulkResult });

      const faqRaw = await callGenerate(
        faqIndividualListPrompt(profile, keyword, faqCount),
        "faq"
      );
      let faqItems: FaqItem[];
      try {
        const jsonMatch = faqRaw.match(/\[[\s\S]*\]/);
        faqItems = JSON.parse(jsonMatch ? jsonMatch[0] : faqRaw);
      } catch {
        faqItems = [{
          question: `${keyword}の原因は何ですか？`,
          answer: `<p>${keyword}の原因は様々です。${profile.name}にご相談ください。</p>`,
          seoTitle: `${keyword}の原因｜${profile.area}${profile.name}`,
          seoDescription: `${keyword}の原因について${profile.name}が解説します。`,
          slug: `faq-${keyword}-${Date.now()}`,
          blogTitle: `【${keyword}の原因と改善法】${profile.area}${profile.name}`,
          blogSlug: `${keyword}-cause-${Date.now()}`,
        }];
      }

      // 指定数に合わせる
      faqItems = faqItems.slice(0, faqCount);

      // 初期セットを作成
      bulkResult.sets = faqItems.map(faq => ({ faq }));
      setResult({ ...bulkResult });

      // ── Step 2: 各FAQに対してコンテンツを展開 ──
      for (let i = 0; i < faqItems.length; i++) {
        const faq = faqItems[i];
        const setResult_i = bulkResult.sets[i];
        const label = `[${i + 1}/${faqItems.length}]「${faq.question.slice(0, 20)}...」`;

        // ─ FAQ投稿 ─
        if (contentOptions.faq) {
          bulkResult.overallProgress = `${label} FAQをWordPressに投稿中...`;
          setResult({ ...bulkResult });

          const faqContent = `<div class="faq-item"><h3>${faq.question}</h3>${faq.answer}</div>`;

          if (hasWordPress) {
            try {
              const faqWpResult = await postToWordPress(
                faq.seoTitle || faq.question,
                faqContent,
                faq.slug,
                "faq",
                "faq"
              );
              setResult_i.faqWpPostId = faqWpResult.postId;
              setResult_i.faqWpUrl = faqWpResult.postUrl;
            } catch {
              // 投稿失敗は無視
            }
          }

          saveContent({
            id: `faq-bulk-${Date.now()}-${i}`,
            type: "faq",
            title: faq.seoTitle || faq.question,
            content: faqContent,
            keyword,
            createdAt: new Date().toISOString(),
            ...(setResult_i.faqWpPostId ? { wpPostId: setResult_i.faqWpPostId, wpPostUrl: setResult_i.faqWpUrl } : {}),
          });
          setResult({ ...bulkResult });
        }

        // ─ ブログ記事 ─
        let blogUrl = "";
        if (contentOptions.blog) {
          bulkResult.overallProgress = `${label} ブログ記事を生成中...`;
          setResult({ ...bulkResult });

          const faqHtmlForBlog = `<div class="faq-item"><h3>${faq.question}</h3>${faq.answer}</div>`;
          const blogHtml = await callGenerate(
            blogPostWithFaqPrompt(profile, keyword, faq.blogTitle, faqHtmlForBlog),
            "blog"
          );
          setResult_i.blogHtml = blogHtml;

          // ブログをWordPressに投稿
          if (hasWordPress) {
            bulkResult.overallProgress = `${label} ブログをWordPressに投稿中...`;
            setResult({ ...bulkResult });

            try {
              const wpResult = await postToWordPress(faq.blogTitle, blogHtml, faq.blogSlug, blogCategory);
              blogUrl = wpResult.postUrl;
              setResult_i.blogWpUrl = blogUrl;
            } catch {
              // 投稿失敗
            }
          } else {
            blogUrl = `https://${profile.name.replace(/\s/g, "")}.com/blog/${faq.blogSlug}`;
            setResult_i.blogWpUrl = blogUrl;
          }

          saveContent({
            id: `blog-bulk-${Date.now()}-${i}`,
            type: "blog",
            title: faq.blogTitle,
            content: blogHtml,
            keyword,
            createdAt: new Date().toISOString(),
            ...(setResult_i.blogWpUrl && hasWordPress ? { wpPostUrl: setResult_i.blogWpUrl } : {}),
          });
          setResult({ ...bulkResult });
        }

        // ─ GBP投稿 ─
        if (contentOptions.gbp) {
          bulkResult.overallProgress = `${label} GBP投稿文を生成中...`;
          setResult({ ...bulkResult });

          const gbpPost = await callGenerate(
            gbpWithBlogUrlPrompt(profile, keyword, blogUrl || ""),
            "gbp"
          );
          setResult_i.gbpPost = gbpPost;

          saveContent({
            id: `gbp-bulk-${Date.now()}-${i}`,
            type: "gbp",
            title: `${keyword} Q${i + 1}`,
            content: gbpPost,
            keyword,
            createdAt: new Date().toISOString(),
          });
          setResult({ ...bulkResult });

          // GBP画像
          if (contentOptions.gbpImage) {
            bulkResult.overallProgress = `${label} GBP画像を生成中...`;
            setResult({ ...bulkResult });

            const gbpImageBase64 = generateGbpImageBase64({
              keyword,
              clinicName: profile.name,
              area: profile.area,
              category: profile.category,
            });
            setResult_i.gbpImageBase64 = gbpImageBase64;

            // 画像をWPにアップロード
            let gbpImagePublicUrl = "";
            if (hasWordPress && gbpImageBase64) {
              try {
                const uploadRes = await fetch("/api/wordpress-media", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    siteUrl: profile.wordpress!.siteUrl,
                    username: profile.wordpress!.username,
                    appPassword: profile.wordpress!.appPassword,
                    imageBase64: gbpImageBase64,
                    filename: `gbp-${keyword}-q${i + 1}-${Date.now()}.png`,
                  }),
                });
                const uploadData = await uploadRes.json();
                if (uploadRes.ok) {
                  gbpImagePublicUrl = uploadData.mediaUrl;
                  setResult_i.gbpImageWpUrl = gbpImagePublicUrl;
                }
              } catch {
                // アップロード失敗は無視
              }
            }
            setResult({ ...bulkResult });

            // GBP自動投稿
            const googleSettings = getGoogleSettings();
            if (googleSettings?.accessToken && googleSettings?.locationId) {
              bulkResult.overallProgress = `${label} GBPに自動投稿中...`;
              setResult({ ...bulkResult });

              try {
                let accessToken = googleSettings.accessToken;
                if (googleSettings.tokenExpiry && new Date(googleSettings.tokenExpiry) < new Date()) {
                  const refreshRes = await fetch("/api/google/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      clientId: googleSettings.clientId,
                      clientSecret: googleSettings.clientSecret,
                      refreshToken: googleSettings.refreshToken,
                    }),
                  });
                  const refreshData = await refreshRes.json();
                  if (refreshRes.ok) {
                    accessToken = refreshData.accessToken;
                  }
                }

                const postRes = await fetch("/api/google/post-gbp", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    accessToken,
                    locationId: googleSettings.locationId,
                    summary: gbpPost,
                    imageUrl: gbpImagePublicUrl || undefined,
                    linkUrl: profile.urls?.websiteUrl || blogUrl || undefined,
                  }),
                });
                const postData = await postRes.json();
                if (postRes.ok) {
                  setResult_i.gbpPosted = true;
                } else {
                  setResult_i.gbpPostError = postData.error || "GBP投稿に失敗";
                }
              } catch (e) {
                setResult_i.gbpPostError = e instanceof Error ? e.message : "GBP投稿エラー";
              }
              setResult({ ...bulkResult });
            }
          }
        }

        // ─ note記事 ─
        if (contentOptions.note) {
          bulkResult.overallProgress = `${label} note記事を生成中...`;
          setResult({ ...bulkResult });

          const noteArticle = await callGenerate(
            noteWithBlogUrlPrompt(profile, keyword, blogUrl || ""),
            "note"
          );
          setResult_i.noteArticle = noteArticle;

          saveContent({
            id: `note-bulk-${Date.now()}-${i}`,
            type: "note",
            title: `${keyword} Q${i + 1}`,
            content: noteArticle,
            keyword,
            createdAt: new Date().toISOString(),
          });
          setResult({ ...bulkResult });
        }
      }

      bulkResult.overallProgress = `すべて完了！（FAQ ${faqItems.length}件 + 関連コンテンツ）`;
      setResult({ ...bulkResult });
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsRunning(false);
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

  // 生成されるコンテンツ数の計算
  const totalContentCount = faqCount * (
    (contentOptions.faq ? 1 : 0) +
    (contentOptions.blog ? 1 : 0) +
    (contentOptions.gbp ? 1 : 0) +
    (contentOptions.note ? 1 : 0)
  );

  const OPTION_ITEMS: { key: keyof ContentOptions; label: string; desc: string; color: string }[] = [
    { key: "faq", label: "FAQ投稿", desc: "WordPressの「よくある質問」に個別投稿", color: "green" },
    { key: "blog", label: "ブログ記事", desc: "FAQを深掘りしたブログ記事を生成・投稿", color: "blue" },
    { key: "gbp", label: "GBP投稿", desc: "Googleマイビジネスの投稿文を生成", color: "red" },
    { key: "gbpImage", label: "GBP画像", desc: "GBP投稿用の画像を自動生成・自動投稿", color: "red" },
    { key: "note", label: "note記事", desc: "noteに投稿するマークダウン記事を生成", color: "orange" },
  ];

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-2">一括コンテンツ生成</h2>
            <p className="text-sm opacity-90">
              キーワードからFAQを生成し、各FAQに対してブログ・GBP・noteを展開します。
            </p>
          </div>
          <button
            onClick={loadHistory}
            className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {showHistory ? "閉じる" : "生成履歴"}
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

          {/* FAQ生成数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              FAQ生成数
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFaqCount(n)}
                  disabled={isRunning}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    faqCount === n
                      ? "bg-orange-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {n}個
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              各FAQに対して選んだコンテンツが展開されます。まずは1〜3個がおすすめです。
            </p>
          </div>

          {/* コンテンツ選択チェックリスト */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生成するコンテンツ
            </label>
            <div className="space-y-2">
              {OPTION_ITEMS.map(({ key, label, desc, color }) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    contentOptions[key]
                      ? `border-${color}-300 bg-${color}-50/50`
                      : "border-gray-200 bg-gray-50/50"
                  } ${isRunning ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={contentOptions[key]}
                    onChange={() => toggleOption(key)}
                    disabled={isRunning}
                    className="mt-0.5 w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-2 p-2 bg-orange-50 rounded-lg">
              <p className="text-xs text-orange-700 font-medium">
                合計生成数: FAQ {faqCount}個 × 選択コンテンツ = 約{totalContentCount}件のコンテンツ
              </p>
            </div>
          </div>

          {hasWordPress && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
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
              {contentOptions.blog && (
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">ブログカテゴリ:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBlogCategory("symptom")}
                      disabled={isRunning}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        blogCategory === "symptom"
                          ? "bg-orange-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      症状ブログ
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlogCategory("blog")}
                      disabled={isRunning}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        blogCategory === "blog"
                          ? "bg-orange-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      院内ブログ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasWordPress && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">
                WordPress未設定のため、コンテンツはコピー用に生成されます。
                設定画面でWordPress連携を追加すると、自動投稿が有効になります。
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

      {/* 進捗表示 */}
      {result?.overallProgress && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3">
            {isRunning && (
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            <span className={`text-sm font-medium ${isRunning ? "text-orange-700" : "text-green-700"}`}>
              {result.overallProgress}
            </span>
          </div>
          {/* 進捗バー */}
          {result.sets.length > 0 && (
            <div className="mt-3">
              <div className="flex gap-1">
                {result.sets.map((s, i) => {
                  const hasSomeContent = s.faqWpUrl || s.blogHtml || s.gbpPost || s.noteArticle;
                  const isComplete = (
                    (!contentOptions.faq || s.faqWpUrl || !hasWordPress) &&
                    (!contentOptions.blog || s.blogHtml) &&
                    (!contentOptions.gbp || s.gbpPost) &&
                    (!contentOptions.note || s.noteArticle)
                  );
                  return (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full transition-all ${
                        isComplete ? "bg-green-500"
                        : hasSomeContent ? "bg-orange-400 animate-pulse"
                        : "bg-gray-200"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                FAQ {result.sets.filter(s => s.faqWpUrl || s.blogHtml || s.gbpPost || s.noteArticle).length}/{result.sets.length} 処理中
              </p>
            </div>
          )}
        </div>
      )}

      {/* 生成結果 */}
      {result && result.sets.length > 0 && (
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-gray-800">生成結果</h3>

          {result.sets.map((setItem, setIndex) => (
            <div key={setIndex} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* FAQ セットヘッダー */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 px-5 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    Q{setIndex + 1}
                  </span>
                  <h4 className="text-sm font-bold text-gray-800">{setItem.faq.question}</h4>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {setItem.faqWpUrl && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">FAQ投稿済</span>
                  )}
                  {setItem.blogHtml && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">ブログ生成済</span>
                  )}
                  {setItem.gbpPost && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">GBP生成済</span>
                  )}
                  {setItem.noteArticle && (
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">note生成済</span>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* FAQ回答 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-700">FAQ回答</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copySection(`faq-${setIndex}`, setItem.faq.answer.replace(/<[^>]*>/g, ""))}
                        className={`text-xs px-2 py-1 rounded ${copiedSection === `faq-${setIndex}` ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {copiedSection === `faq-${setIndex}` ? "コピー済" : "コピー"}
                      </button>
                      {setItem.faqWpUrl && (
                        <a href={setItem.faqWpUrl} target="_blank" rel="noopener noreferrer" className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">
                          WPで見る
                        </a>
                      )}
                    </div>
                  </div>
                  <div
                    className="text-sm text-gray-600 leading-relaxed bg-green-50/50 rounded-lg p-3"
                    dangerouslySetInnerHTML={{ __html: setItem.faq.answer }}
                  />
                  <div className="mt-1 text-xs text-gray-400">
                    SEO: {setItem.faq.seoTitle} | slug: {setItem.faq.slug}
                  </div>
                </div>

                {/* ブログ記事 */}
                {setItem.blogHtml && (
                  <ResultAccordion
                    title={`ブログ: ${setItem.faq.blogTitle}`}
                    color="blue"
                    expanded={expandedSection === `blog-${setIndex}`}
                    onToggle={() => setExpandedSection(expandedSection === `blog-${setIndex}` ? null : `blog-${setIndex}`)}
                    onCopy={() => copySection(`blog-${setIndex}`, setItem.blogHtml!)}
                    copied={copiedSection === `blog-${setIndex}`}
                    wpUrl={setItem.blogWpUrl}
                  >
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[300px] overflow-y-auto">
                      {setItem.blogHtml}
                    </pre>
                  </ResultAccordion>
                )}

                {/* GBP投稿 */}
                {setItem.gbpPost && (
                  <ResultAccordion
                    title="GBP投稿（Googleマイビジネス）"
                    color="red"
                    expanded={expandedSection === `gbp-${setIndex}`}
                    onToggle={() => setExpandedSection(expandedSection === `gbp-${setIndex}` ? null : `gbp-${setIndex}`)}
                    onCopy={() => copySection(`gbp-${setIndex}`, setItem.gbpPost!)}
                    copied={copiedSection === `gbp-${setIndex}`}
                  >
                    {setItem.gbpImageBase64 && (
                      <div className="mb-3 p-3 bg-red-50/50 rounded-lg border border-red-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-red-700">自動生成画像</span>
                          <div className="flex gap-2">
                            {setItem.gbpImageWpUrl && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">WPアップロード済</span>
                            )}
                            <a
                              href={setItem.gbpImageBase64}
                              download={`gbp-${keyword}-q${setIndex + 1}.png`}
                              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                            >
                              DL
                            </a>
                          </div>
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={setItem.gbpImageBase64} alt="GBP画像" className="w-full max-w-md rounded border border-red-200" />
                      </div>
                    )}
                    {setItem.gbpPosted && (
                      <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 font-medium">
                        GBPに自動投稿しました
                      </div>
                    )}
                    {setItem.gbpPostError && (
                      <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                        {setItem.gbpPostError}
                      </div>
                    )}
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {setItem.gbpPost}
                    </pre>
                  </ResultAccordion>
                )}

                {/* note記事 */}
                {setItem.noteArticle && (
                  <ResultAccordion
                    title="note記事"
                    color="orange"
                    expanded={expandedSection === `note-${setIndex}`}
                    onToggle={() => setExpandedSection(expandedSection === `note-${setIndex}` ? null : `note-${setIndex}`)}
                    onCopy={() => copySection(`note-${setIndex}`, setItem.noteArticle!)}
                    copied={copiedSection === `note-${setIndex}`}
                  >
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-[300px] overflow-y-auto">
                      {setItem.noteArticle}
                    </pre>
                  </ResultAccordion>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── サブコンポーネント ──────────────────────────

function ResultAccordion({
  title, color, expanded, onToggle, onCopy, copied, wpUrl, children,
}: {
  title: string;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
  wpUrl?: string;
  children: React.ReactNode;
}) {
  const colorStyles: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
    green: { bg: "bg-green-50", text: "text-green-800", border: "border-green-200" },
    red: { bg: "bg-red-50", text: "text-red-800", border: "border-red-200" },
    orange: { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200" },
  };
  const cs = colorStyles[color] || colorStyles.blue;

  return (
    <div className={`rounded-lg border ${cs.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 ${cs.bg} transition-colors text-left`}
      >
        <span className={`font-medium text-xs ${cs.text}`}>{title}</span>
        <div className="flex items-center gap-2">
          {wpUrl && (
            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">WP投稿済</span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={onCopy}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                copied ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {copied ? "コピー済" : "コピー"}
            </button>
            {wpUrl && (
              <a
                href={wpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200"
              >
                WordPress記事を見る
              </a>
            )}
          </div>
          <div className="bg-gray-50 rounded-lg p-3">{children}</div>
        </div>
      )}
    </div>
  );
}
