"use client";

import { useState } from "react";
import { BusinessProfile, GeneratedContent } from "@/lib/types";
import { saveContent, getContents } from "@/lib/storage";
import { noteArticlePrompt, gbpPostPrompt, faqPrompt, structuredDataPrompt } from "@/lib/prompts";

interface Props {
  profile: BusinessProfile;
  type: "note" | "gbp" | "faq" | "structured-data";
}

const TYPE_CONFIG = {
  note: {
    title: "note記事を生成",
    description: "MEO・SEO・LLMO最適化されたnote記事を自動生成します",
    icon: "📝",
    needsKeyword: true,
    needsTopic: true,
    topicLabel: "記事テーマ",
    topicPlaceholder: "例: 腰痛のセルフケア方法",
  },
  gbp: {
    title: "GBP投稿を生成",
    description: "Googleビジネスプロフィールに投稿するMEO最適化テキストを生成します",
    icon: "📍",
    needsKeyword: true,
    needsTopic: true,
    topicLabel: "投稿タイプ",
    topicPlaceholder: "例: 症状解説 / キャンペーン / 季節の健康情報",
  },
  faq: {
    title: "FAQ（よくある質問）を生成",
    description: "AI検索で引用されやすいFAQコンテンツを生成します（LLMO対策）",
    icon: "❓",
    needsKeyword: true,
    needsTopic: false,
    topicLabel: "",
    topicPlaceholder: "",
  },
  "structured-data": {
    title: "構造化データを生成",
    description: "Schema.org準拠のJSON-LDを生成します（LLMO対策）",
    icon: "🔧",
    needsKeyword: false,
    needsTopic: false,
    topicLabel: "",
    topicPlaceholder: "",
  },
};

export default function ContentGenerator({ profile, type }: Props) {
  const config = TYPE_CONFIG[type];
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<GeneratedContent[]>(() =>
    getContents().filter((c) => c.type === type).slice(0, 5)
  );

  const generate = async () => {
    if (!profile.anthropicKey) {
      setError("設定画面でAnthropic APIキーを入力してください");
      return;
    }
    if (config.needsKeyword && !keyword) {
      setError("キーワードを入力してください");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    let prompt = "";
    if (type === "note") {
      prompt = noteArticlePrompt(profile, keyword, topic || keyword);
    } else if (type === "gbp") {
      prompt = gbpPostPrompt(profile, keyword, topic || "最新情報");
    } else if (type === "faq") {
      prompt = faqPrompt(profile, keyword);
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

      const newContent: GeneratedContent = {
        id: `${type}-${Date.now()}`,
        type,
        title: keyword || profile.name,
        content: data.content,
        keyword,
        createdAt: new Date().toISOString(),
      };
      saveContent(newContent);
      setHistory([newContent, ...history.slice(0, 4)]);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
                  <option key={kw} value={kw}>{kw}</option>
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
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
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
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
            <button
              onClick={copyToClipboard}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                copied ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {result}
            </pre>
          </div>
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
                onClick={() => setResult(item.content)}
                className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {item.keyword || item.title}
                  </span>
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
