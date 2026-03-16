"use client";

import { useState } from "react";
import { BusinessProfile, GeneratedContent, ContentType } from "@/lib/types";
import { saveContent, getContents, updateContent } from "@/lib/storage";
import {
  noteArticlePrompt,
  gbpPostPrompt,
  faqPrompt,
  faqShortPrompt,
  blogPostPrompt,
  blogSeoPrompt,
  structuredDataPrompt,
} from "@/lib/prompts";

interface Props {
  profile: BusinessProfile;
  type: ContentType;
}

const TYPE_CONFIG: Record<
  ContentType,
  {
    title: string;
    description: string;
    icon: string;
    needsKeyword: boolean;
    needsTopic: boolean;
    topicLabel: string;
    topicPlaceholder: string;
    canPublishToWP: boolean;
    wpPostType: "post" | "page";
  }
> = {
  note: {
    title: "note記事を生成",
    description:
      "MEO・SEO・LLMO最適化されたnote記事を自動生成します（太字・図解・装飾付き）",
    icon: "📝",
    needsKeyword: true,
    needsTopic: true,
    topicLabel: "記事テーマ",
    topicPlaceholder: "例: 腰痛のセルフケア方法",
    canPublishToWP: true,
    wpPostType: "post",
  },
  gbp: {
    title: "GBP投稿を生成",
    description:
      "Googleビジネスプロフィールに投稿するMEO最適化テキストを生成します",
    icon: "📍",
    needsKeyword: true,
    needsTopic: true,
    topicLabel: "投稿タイプ",
    topicPlaceholder: "例: 症状解説 / キャンペーン / 季節の健康情報",
    canPublishToWP: false,
    wpPostType: "post",
  },
  faq: {
    title: "FAQ（よくある質問）を生成",
    description:
      "AI検索で引用されやすいFAQコンテンツを生成します（LLMO対策）",
    icon: "❓",
    needsKeyword: true,
    needsTopic: false,
    topicLabel: "",
    topicPlaceholder: "",
    canPublishToWP: true,
    wpPostType: "post",
  },
  "faq-short": {
    title: "FAQ簡潔版を生成",
    description: "サイドバーやサイト掲載用の簡潔なFAQを生成します",
    icon: "💬",
    needsKeyword: true,
    needsTopic: false,
    topicLabel: "",
    topicPlaceholder: "",
    canPublishToWP: true,
    wpPostType: "post",
  },
  blog: {
    title: "ブログ記事を生成（WordPress用）",
    description:
      "SEO・LLMO最適化されたブログ記事をHTML形式で生成します。WordPress連携済みなら投稿も可能",
    icon: "📄",
    needsKeyword: true,
    needsTopic: true,
    topicLabel: "記事テーマ",
    topicPlaceholder: "例: 腰痛改善ガイド / 肩こりの原因と対策",
    canPublishToWP: true,
    wpPostType: "post",
  },
  "blog-seo": {
    title: "ブログSEO情報を生成",
    description:
      "SEOタイトル・メタディスクリプション・OGP・スラッグを一括生成",
    icon: "🔍",
    needsKeyword: true,
    needsTopic: true,
    topicLabel: "記事テーマ",
    topicPlaceholder: "例: 腰痛改善ガイド",
    canPublishToWP: false,
    wpPostType: "post",
  },
  "structured-data": {
    title: "構造化データを生成",
    description: "Schema.org準拠のJSON-LDを生成します（LLMO対策）",
    icon: "🔧",
    needsKeyword: false,
    needsTopic: false,
    topicLabel: "",
    topicPlaceholder: "",
    canPublishToWP: false,
    wpPostType: "post",
  },
};

export default function ContentGenerator({ profile, type }: Props) {
  const config = TYPE_CONFIG[type];
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notePublishing, setNotePublishing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [wpStatus, setWpStatus] = useState<{
    type: "success" | "error";
    message: string;
    url?: string;
  } | null>(null);
  const [noteStatus, setNoteStatus] = useState<{
    type: "success" | "error";
    message: string;
    url?: string;
  } | null>(null);
  const [notePublishAs, setNotePublishAs] = useState<"publish" | "draft">("draft");
  const [currentContentId, setCurrentContentId] = useState<string | null>(null);
  const [publishAs, setPublishAs] = useState<"publish" | "draft">("draft");
  const [history, setHistory] = useState<GeneratedContent[]>(() =>
    getContents()
      .filter((c) => c.type === type)
      .slice(0, 5)
  );

  const generate = async () => {
    if (config.needsKeyword && !keyword) {
      setError("キーワードを入力してください");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setWpStatus(null);

    let prompt = "";
    if (type === "note") {
      prompt = noteArticlePrompt(profile, keyword, topic || keyword);
    } else if (type === "gbp") {
      prompt = gbpPostPrompt(profile, keyword, topic || "最新情報");
    } else if (type === "faq") {
      prompt = faqPrompt(profile, keyword);
    } else if (type === "faq-short") {
      prompt = faqShortPrompt(profile, keyword);
    } else if (type === "blog") {
      prompt = blogPostPrompt(profile, keyword, topic || keyword);
    } else if (type === "blog-seo") {
      prompt = blogSeoPrompt(profile, keyword, topic || keyword);
    } else {
      prompt = structuredDataPrompt(profile);
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: profile.anthropicKey,
          prompt,
          type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      setResult(data.content);

      const contentId = `${type}-${Date.now()}`;
      const newContent: GeneratedContent = {
        id: contentId,
        type,
        title: topic || keyword || profile.name,
        content: data.content,
        keyword,
        createdAt: new Date().toISOString(),
      };
      saveContent(newContent);
      setCurrentContentId(contentId);
      setHistory([newContent, ...history.slice(0, 4)]);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const publishToWordPress = async () => {
    if (!profile.wordpress?.siteUrl) {
      setWpStatus({
        type: "error",
        message: "設定画面でWordPress接続情報を入力してください。",
      });
      return;
    }

    if (!result) {
      setWpStatus({ type: "error", message: "先にコンテンツを生成してください。" });
      return;
    }

    setPublishing(true);
    setWpStatus(null);

    // タイトルを生成（FAQの場合は自動タイトル）
    let postTitle = "";
    if (type === "faq" || type === "faq-short") {
      postTitle = `【${keyword}】よくある質問まとめ｜${profile.area}${profile.name}`;
    } else if (type === "blog") {
      postTitle =
        topic || `【${keyword}の原因と改善法】${profile.area}${profile.name}`;
    } else if (type === "note") {
      // noteの場合は最初のh1を抽出
      const h1Match = result.match(/^#\s+(.+)$/m);
      postTitle = h1Match ? h1Match[1] : topic || keyword;
    } else {
      postTitle = topic || keyword || profile.name;
    }

    // コンテンツをHTML変換（Markdownの場合）
    let htmlContent = result;
    if (type === "note" || type === "faq" || type === "faq-short") {
      htmlContent = markdownToHtml(result);
    }

    // FAQ/faq-short の場合はカスタム投稿タイプとして投稿
    const isFaqType = type === "faq" || type === "faq-short";

    // ブログ記事の場合はSEOデータを自動生成
    let seoData: Record<string, string> | undefined;
    if (type === "blog" || type === "note") {
      try {
        const seoRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey: profile.anthropicKey,
            prompt: blogSeoPrompt(profile, keyword, topic || keyword),
            type: "blog-seo",
            maxTokens: 500,
          }),
        });
        const seoJson = await seoRes.json();
        if (seoRes.ok && seoJson.content) {
          const jsonMatch = seoJson.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            seoData = {
              seoTitle: parsed.seoTitle || "",
              seoDescription: parsed.metaDescription || parsed.seoDescription || "",
              metaKeywords: parsed.metaKeywords || "",
              ogpTitle: parsed.ogpTitle || "",
              ogpDescription: parsed.ogpDescription || "",
            };
          }
        }
      } catch {
        // SEO生成失敗 → デフォルト値
        seoData = {
          seoTitle: postTitle.slice(0, 32),
          seoDescription: `${profile.area}の${profile.name}が${keyword}について解説。`.slice(0, 120),
          metaKeywords: `${keyword},${profile.area},${profile.name}`,
          ogpTitle: postTitle.slice(0, 40),
          ogpDescription: `${profile.area}の${profile.name}が${keyword}について詳しく解説します。`.slice(0, 90),
        };
      }
    }

    try {
      const res = await fetch("/api/wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: profile.wordpress.siteUrl,
          username: profile.wordpress.username,
          appPassword: profile.wordpress.appPassword,
          title: postTitle,
          content: htmlContent,
          status: publishAs,
          ...(isFaqType ? { categorySlug: "faq", postType: "faq" } : {}),
          ...(seoData ? { seo: seoData } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setWpStatus({ type: "error", message: data.error });
        return;
      }

      setWpStatus({
        type: "success",
        message:
          publishAs === "publish"
            ? "WordPressに公開しました！"
            : "下書きとして保存しました！",
        url: data.postUrl,
      });

      // コンテンツにWP情報を保存
      if (currentContentId) {
        updateContent(currentContentId, {
          wpPostId: data.postId,
          wpPostUrl: data.postUrl,
        });
      }
    } catch {
      setWpStatus({ type: "error", message: "WordPress接続エラーが発生しました" });
    } finally {
      setPublishing(false);
    }
  };

  const publishToNote = async () => {
    if (!profile.noteLogin?.email || !profile.noteLogin?.password) {
      setNoteStatus({
        type: "error",
        message: "設定画面でnoteのログイン情報を入力してください。",
      });
      return;
    }

    if (!result) {
      setNoteStatus({ type: "error", message: "先にコンテンツを生成してください。" });
      return;
    }

    setNotePublishing(true);
    setNoteStatus(null);

    // タイトルを抽出
    const h1Match = result.match(/^#\s+(.+)$/m);
    const postTitle = h1Match ? h1Match[1] : topic || keyword;

    // ハッシュタグ
    const hashtags = profile.noteProfile?.hashtags || [];

    try {
      const res = await fetch("/api/note-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: profile.noteLogin.email,
          password: profile.noteLogin.password,
          title: postTitle,
          content: result,
          status: notePublishAs,
          hashtags,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNoteStatus({ type: "error", message: data.error });
        return;
      }

      setNoteStatus({
        type: "success",
        message: data.message,
        url: data.postUrl,
      });

      // コンテンツにnote情報を保存
      if (currentContentId) {
        updateContent(currentContentId, {
          notePostUrl: data.postUrl,
        });
      }
    } catch {
      setNoteStatus({ type: "error", message: "note投稿エラーが発生しました" });
    } finally {
      setNotePublishing(false);
    }
  };

  const hasNoteLogin = !!(profile.noteLogin?.email && profile.noteLogin?.password);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasWordPress = !!(
    profile.wordpress?.siteUrl &&
    profile.wordpress?.username &&
    profile.wordpress?.appPassword
  );

  return (
    <div className="space-y-6">
      {/* 生成フォーム */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">
          {config.icon} {config.title}
        </h2>
        <p className="text-sm text-gray-500 mb-4">{config.description}</p>

        <div className="space-y-4">
          {config.needsKeyword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                症状キーワード
              </label>
              <select
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">キーワードを選択</option>
                {profile.keywords.map((kw) => (
                  <option key={kw} value={kw}>
                    {kw}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.needsTopic && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {config.topicLabel}
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={config.topicPlaceholder}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
              loading
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                AI生成中...
              </span>
            ) : (
              `${config.icon} コンテンツを生成`
            )}
          </button>
        </div>
      </div>

      {/* 生成結果 */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">生成結果</h3>
            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {copied ? "コピー完了" : "コピー"}
              </button>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {result}
            </pre>
          </div>

          {/* note投稿ボタン */}
          {type === "note" && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {!hasNoteLogin ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    noteに自動投稿するには、設定画面でnoteのログイン情報を入力してください。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">
                      note投稿:
                    </label>
                    <select
                      value={notePublishAs}
                      onChange={(e) =>
                        setNotePublishAs(e.target.value as "publish" | "draft")
                      }
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="draft">下書き保存</option>
                      <option value="publish">即時公開</option>
                    </select>
                    <button
                      onClick={publishToNote}
                      disabled={notePublishing}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
                        notePublishing
                          ? "bg-gray-400 cursor-not-allowed text-white"
                          : "bg-green-600 text-white hover:bg-green-700 shadow-md"
                      }`}
                    >
                      {notePublishing ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          noteに投稿中...
                        </span>
                      ) : (
                        `📝 noteに${notePublishAs === "publish" ? "公開" : "下書き保存"}`
                      )}
                    </button>
                  </div>

                  {noteStatus && (
                    <div
                      className={`px-4 py-3 rounded-lg text-sm ${
                        noteStatus.type === "success"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-red-50 text-red-600 border border-red-200"
                      }`}
                    >
                      <p>{noteStatus.message}</p>
                      {noteStatus.url && noteStatus.url !== "about:blank" && (
                        <a
                          href={noteStatus.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-medium mt-1 inline-block"
                        >
                          noteで確認する →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* WordPress投稿ボタン */}
          {config.canPublishToWP && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {!hasWordPress ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    WordPressに投稿するには、設定画面でWordPress接続情報を入力してください。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">
                      投稿方法:
                    </label>
                    <select
                      value={publishAs}
                      onChange={(e) =>
                        setPublishAs(e.target.value as "publish" | "draft")
                      }
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="draft">下書き保存</option>
                      <option value="publish">即時公開</option>
                    </select>
                    <button
                      onClick={publishToWordPress}
                      disabled={publishing}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
                        publishing
                          ? "bg-gray-400 cursor-not-allowed text-white"
                          : "bg-green-600 text-white hover:bg-green-700 shadow-md"
                      }`}
                    >
                      {publishing ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          投稿中...
                        </span>
                      ) : (
                        `WordPressに${publishAs === "publish" ? "公開" : "下書き保存"}`
                      )}
                    </button>
                  </div>

                  {wpStatus && (
                    <div
                      className={`px-4 py-3 rounded-lg text-sm ${
                        wpStatus.type === "success"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-red-50 text-red-600 border border-red-200"
                      }`}
                    >
                      <p>{wpStatus.message}</p>
                      {wpStatus.url && (
                        <a
                          href={wpStatus.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-medium mt-1 inline-block"
                        >
                          投稿を確認する →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 履歴 */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-gray-800 mb-3">生成履歴</h3>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setResult(item.content);
                  setCurrentContentId(item.id);
                }}
                className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 truncate">
                      {item.keyword || item.title}
                    </span>
                    {item.wpPostUrl && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        WP投稿済
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 簡易Markdown→HTML変換
function markdownToHtml(md: string): string {
  let html = md;

  // 見出し
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // 太字
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // イタリック
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // 引用
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // 区切り線
  html = html.replace(/^---$/gm, "<hr />");

  // 箇条書き
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // 番号付きリスト
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // 段落
  html = html.replace(/^(?!<[hublop]|<\/[hublop]|<hr)(.+)$/gm, "<p>$1</p>");

  // 空の段落を除去
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}
