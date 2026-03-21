"use client";

import { useState, useEffect } from "react";
import { ClinicProfile, WordPressSettings, NoteProfile } from "@/lib/types";
import { getSerpApiKey, saveSerpApiKey } from "@/lib/supabase-storage";

interface Props {
  clinics: ClinicProfile[];
  activeClinicId: string;
  anthropicKey: string;
  onAddClinic: (clinic: ClinicProfile) => void;
  onUpdateClinic: (id: string, updates: Partial<ClinicProfile>) => void;
  onDeleteClinic: (id: string) => void;
  onSwitchClinic: (id: string) => void;
  onSaveApiKey: (key: string) => void;
}

export default function SettingsTab({
  clinics,
  activeClinicId,
  anthropicKey,
  onAddClinic,
  onUpdateClinic,
  onDeleteClinic,
  onSwitchClinic,
  onSaveApiKey,
}: Props) {
  const [apiKey, setApiKey] = useState(anthropicKey);
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "testing" | "valid" | "invalid" | "saved">("idle");
  const [keyError, setKeyError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(clinics.length === 0);

  // SerpApi
  const [serpApiKey, setSerpApiKey] = useState("");
  const [showSerpKey, setShowSerpKey] = useState(false);
  const [serpSaved, setSerpSaved] = useState(false);

  useEffect(() => {
    getSerpApiKey().then(setSerpApiKey);
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setKeyStatus("invalid");
      setKeyError("APIキーを入力してください");
      return;
    }
    if (!apiKey.trim().startsWith("sk-ant-")) {
      setKeyStatus("invalid");
      setKeyError("「sk-ant-」で始まるキーを入力してください");
      return;
    }

    // 保存してから接続テスト
    onSaveApiKey(apiKey.trim());
    setKeyStatus("testing");
    setKeyError("");

    try {
      const res = await fetch("/api/generate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setKeyStatus("valid");
        setTimeout(() => setKeyStatus("saved"), 2000);
      } else {
        setKeyStatus("invalid");
        setKeyError(data.error || "接続できませんでした");
      }
    } catch {
      // テスト失敗してもキー自体は保存済み
      setKeyStatus("saved");
    }
  };

  const handleSaveSerpApiKey = async () => {
    await saveSerpApiKey(serpApiKey.trim());
    setSerpSaved(true);
    setTimeout(() => setSerpSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* AI設定（共通） */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="font-bold text-gray-800 text-lg mb-4">AI設定（全院共通）</h3>

        {/* サーバー側APIキーのステータス表示 */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-blue-800">サーバー設定</span>
          </div>
          <p className="text-xs text-blue-700">
            Anthropic APIキーはサーバー側の環境変数で管理されています。
            BtoB運用では管理者がサーバーで一括管理するため、個別のキー入力は不要です。
          </p>
          <button
            onClick={async () => {
              setKeyStatus("testing");
              setKeyError("");
              try {
                const res = await fetch("/api/generate", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
                const data = await res.json();
                if (data.valid) {
                  setKeyStatus("valid");
                  setTimeout(() => setKeyStatus("idle"), 3000);
                } else {
                  setKeyStatus("invalid");
                  setKeyError(data.error || "サーバーAPIキーが未設定または無効です");
                }
              } catch {
                setKeyStatus("invalid");
                setKeyError("接続テストに失敗しました");
              }
            }}
            disabled={keyStatus === "testing"}
            className={`mt-3 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              keyStatus === "valid" ? "bg-green-500 text-white"
              : keyStatus === "invalid" ? "bg-red-500 text-white"
              : keyStatus === "testing" ? "bg-yellow-500 text-white animate-pulse"
              : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {keyStatus === "testing" ? "接続テスト中..."
              : keyStatus === "valid" ? "接続OK"
              : keyStatus === "invalid" ? "再テスト"
              : "接続テスト"}
          </button>
          {keyStatus === "invalid" && keyError && (
            <p className="text-xs text-red-600 mt-2 bg-red-50 px-3 py-1.5 rounded">{keyError}</p>
          )}
          {keyStatus === "valid" && (
            <p className="text-xs text-green-600 mt-2 bg-green-50 px-3 py-1.5 rounded">サーバーAPIキーの接続を確認しました</p>
          )}
        </div>

        {/* 予備：個別APIキー入力（折りたたみ） */}
        <details className="group">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            詳細設定（個別APIキーを使用する場合）
          </summary>
          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Anthropic APIキー（個別設定・オプション）
            </label>
            <p className="text-xs text-gray-400 mb-2">
              サーバーのキーが使えない場合のフォールバック用です。通常は空欄のままでOKです。
            </p>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono bg-white outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200"
              >
                {showKey ? "隠す" : "表示"}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">
                <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                  Anthropic Console
                </a>
                で取得
              </p>
              <button
                onClick={handleSaveApiKey}
                disabled={keyStatus === "testing"}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-gray-600 text-white hover:bg-gray-700"
              >
                保存＆テスト
              </button>
            </div>
          </div>
        </details>
      </div>

      {/* 院一覧 */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">登録院</h3>
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + 院を追加
          </button>
        </div>

        {clinics.length === 0 && !showAddForm && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-3">まだ院が登録されていません</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              最初の院を登録する
            </button>
          </div>
        )}

        {/* 院カード一覧 */}
        <div className="space-y-3">
          {clinics.map((clinic) => (
            <div key={clinic.id}>
              {editingId === clinic.id ? (
                <ClinicEditForm
                  clinic={clinic}
                  onSave={(updates) => {
                    onUpdateClinic(clinic.id, updates);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div
                  className={`p-4 rounded-lg border transition-colors ${
                    clinic.id === activeClinicId
                      ? "bg-blue-50 border-blue-300"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                          clinic.id === activeClinicId
                            ? "bg-blue-600 text-white"
                            : "bg-gray-300 text-gray-600"
                        }`}
                      >
                        {clinic.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{clinic.name}</p>
                        <p className="text-xs text-gray-500">
                          {clinic.area} / {clinic.category}
                          {clinic.wordpress?.siteUrl && (
                            <span className="ml-2 text-green-600">WP連携済</span>
                          )}
                          {clinic.keywords.length > 0 && (
                            <span className="ml-2">KW: {clinic.keywords.length}個</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {clinic.id !== activeClinicId && (
                        <button
                          onClick={() => onSwitchClinic(clinic.id)}
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
                        >
                          切替
                        </button>
                      )}
                      {clinic.id === activeClinicId && (
                        <span className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">
                          使用中
                        </span>
                      )}
                      <button
                        onClick={() => setEditingId(clinic.id)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200"
                      >
                        編集
                      </button>
                      {clinics.length > 1 && (
                        <button
                          onClick={() => {
                            if (confirm(`「${clinic.name}」を削除しますか？`)) {
                              onDeleteClinic(clinic.id);
                            }
                          }}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 新規追加フォーム */}
        {showAddForm && (
          <div className="mt-4">
            <ClinicEditForm
              clinic={null}
              onSave={(data) => {
                const newClinic: ClinicProfile = {
                  id: `clinic-${Date.now()}`,
                  name: data.name || "",
                  area: data.area || "",
                  keywords: data.keywords || [],
                  description: data.description || "",
                  category: data.category || "整体院",
                  ownerName: data.ownerName,
                  specialty: data.specialty,
                  noteProfile: data.noteProfile,
                  urls: data.urls,
                  wordpress: data.wordpress,
                  strengths: data.strengths,
                  experience: data.experience,
                  reviews: data.reviews,
                };
                onAddClinic(newClinic);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}
      </div>

      {/* SerpApiキー */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="font-bold text-gray-800 text-lg mb-4">SerpApi設定</h3>
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <label className="block text-sm font-medium text-amber-800 mb-1">
            SerpApi APIキー
          </label>
          <div className="flex gap-2">
            <input
              type={showSerpKey ? "text" : "password"}
              value={serpApiKey}
              onChange={(e) => setSerpApiKey(e.target.value)}
              placeholder="SerpApi APIキー"
              className="flex-1 px-4 py-2.5 border border-amber-200 rounded-lg text-sm font-mono bg-white outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={() => setShowSerpKey(!showSerpKey)}
              className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs hover:bg-amber-200"
            >
              {showSerpKey ? "隠す" : "表示"}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-amber-600">
              <a href="https://serpapi.com/" target="_blank" rel="noopener noreferrer" className="underline">
                SerpApi
              </a>
              で取得（MEO順位チェックに使用）
            </p>
            <button
              onClick={handleSaveSerpApiKey}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                serpSaved
                  ? "bg-green-500 text-white"
                  : "bg-amber-600 text-white hover:bg-amber-700"
              }`}
            >
              {serpSaved ? "保存済み" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 院の編集フォーム ─────────────────────────
function ClinicEditForm({
  clinic,
  onSave,
  onCancel,
}: {
  clinic: ClinicProfile | null;
  onSave: (data: Partial<ClinicProfile>) => void;
  onCancel: () => void;
}) {
  const [copiedKw, setCopiedKw] = useState<string | null>(null);
  const [name, setName] = useState(clinic?.name || "");
  const [area, setArea] = useState(clinic?.area || "");
  // 複数業種チェック（後方互換: 旧categoryから移行）
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    clinic?.categories?.length ? clinic.categories
    : clinic?.category ? [clinic.category]
    : []
  );
  const [description, setDescription] = useState(clinic?.description || "");
  const [ownerName, setOwnerName] = useState(clinic?.ownerName || "");
  const [specialty, setSpecialty] = useState(clinic?.specialty || "");
  const [keywordsText, setKeywordsText] = useState(clinic?.keywords.join("\n") || "");
  const [strengths, setStrengths] = useState(clinic?.strengths || "");
  const [experience, setExperience] = useState(clinic?.experience || "");
  const [reviews, setReviews] = useState(clinic?.reviews || "");

  const CATEGORY_OPTIONS = [
    "整体院", "鍼灸院", "整骨院", "接骨院",
    "カイロプラクティック", "マッサージ", "リラクゼーション", "美容整体",
  ];

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // URL設定
  const [websiteUrl, setWebsiteUrl] = useState(clinic?.urls?.websiteUrl || "");
  const [bookingUrl, setBookingUrl] = useState(clinic?.urls?.bookingUrl || "");
  const [googleMapUrl, setGoogleMapUrl] = useState(clinic?.urls?.googleMapUrl || "");
  const [youtubeChannelUrl, setYoutubeChannelUrl] = useState(clinic?.urls?.youtubeChannelUrl || "");
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState(clinic?.urls?.youtubePlaylistUrl || "");
  const [instagramUrl, setInstagramUrl] = useState(clinic?.urls?.instagramUrl || "");
  const [lineUrl, setLineUrl] = useState(clinic?.urls?.lineUrl || "");
  const [noteUrl, setNoteUrl] = useState(clinic?.urls?.noteUrl || "");
  const [showUrlSection, setShowUrlSection] = useState(!!(clinic?.urls?.websiteUrl));

  // note設定
  const [noteDisplayName, setNoteDisplayName] = useState(clinic?.noteProfile?.displayName || "");
  const [noteId, setNoteId] = useState(clinic?.noteProfile?.noteId || "");
  const [noteBio, setNoteBio] = useState(clinic?.noteProfile?.bio || "");
  const [noteLongBio, setNoteLongBio] = useState(clinic?.noteProfile?.longBio || "");
  const [noteArticleFooter, setNoteArticleFooter] = useState(clinic?.noteProfile?.articleFooter || "");
  const [noteHashtags, setNoteHashtags] = useState(clinic?.noteProfile?.hashtags?.join(", ") || "");
  const [noteWritingTone, setNoteWritingTone] = useState(clinic?.noteProfile?.writingTone || "");
  const [showNoteSection, setShowNoteSection] = useState(!!(clinic?.noteProfile?.displayName));

  // WordPress
  const [wpSiteUrl, setWpSiteUrl] = useState(clinic?.wordpress?.siteUrl || "");
  const [wpUsername, setWpUsername] = useState(clinic?.wordpress?.username || "");
  const [wpAppPassword, setWpAppPassword] = useState(clinic?.wordpress?.appPassword || "");
  const [showWpSection, setShowWpSection] = useState(!!(clinic?.wordpress?.siteUrl));
  const [showWpPassword, setShowWpPassword] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<{
    type: "success" | "error";
    message: string;
    details?: {
      userName?: string;
      roles?: string[];
      hasFaqPostType?: boolean;
      faqEndpoint?: string;
      seoPlugin?: string;
    };
  } | null>(null);
  const [wpTesting, setWpTesting] = useState(false);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const keywords = keywordsText
      .split("\n")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const urls = {
      websiteUrl, bookingUrl, googleMapUrl,
      youtubeChannelUrl, youtubePlaylistUrl,
      instagramUrl, lineUrl, noteUrl,
    };

    const wordpress: WordPressSettings | undefined =
      wpSiteUrl && wpUsername && wpAppPassword
        ? { siteUrl: wpSiteUrl, username: wpUsername, appPassword: wpAppPassword }
        : undefined;

    const noteProfile: NoteProfile | undefined = noteDisplayName ? {
      displayName: noteDisplayName,
      noteId: noteId || undefined,
      bio: noteBio || undefined,
      longBio: noteLongBio || undefined,
      articleFooter: noteArticleFooter || undefined,
      hashtags: noteHashtags ? noteHashtags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
      writingTone: noteWritingTone || undefined,
    } : undefined;

    const categories = selectedCategories.length > 0 ? selectedCategories : ["整体院"];
    const category = categories.join("・");

    onSave({ name, area, category, categories, description, ownerName, specialty, keywords, urls, wordpress, noteProfile, strengths: strengths || undefined, experience: experience || undefined, reviews: reviews || undefined });
  };

  const testWordPress = async () => {
    if (!wpSiteUrl || !wpUsername || !wpAppPassword) {
      setWpTestResult({ type: "error", message: "サイトURL・ユーザー名・アプリケーションパスワードをすべて入力してください" });
      return;
    }

    // URLの正規化
    let normalizedUrl = wpSiteUrl.trim();
    if (!normalizedUrl.startsWith("http")) {
      normalizedUrl = "https://" + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, "");
    if (normalizedUrl !== wpSiteUrl) {
      setWpSiteUrl(normalizedUrl);
    }

    setWpTesting(true);
    setWpTestResult(null);
    try {
      const res = await fetch("/api/wordpress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: normalizedUrl,
          username: wpUsername.trim(),
          appPassword: wpAppPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let errorMsg = data.error || `接続エラー (${res.status})`;
        if (res.status === 401 || res.status === 403) {
          errorMsg += "\nユーザー名またはアプリケーションパスワードを確認してください。パスワードはスペースを含めてそのまま入力してください。";
        } else if (res.status === 404) {
          errorMsg = "WordPress REST APIが見つかりません。サイトURLを確認してください（例: https://your-site.com）";
        } else if (res.status >= 500) {
          errorMsg = "WordPressサーバーでエラーが発生しました。しばらく待ってから再試行してください。";
        }
        setWpTestResult({ type: "error", message: errorMsg });
      } else {
        const details = {
          userName: data.userName,
          roles: data.roles,
          hasFaqPostType: data.hasFaqPostType,
          faqEndpoint: data.faqEndpoint,
          seoPlugin: data.seoPlugin,
        };
        setWpTestResult({
          type: "success",
          message: `接続OK: ${data.userName}`,
          details,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
        setWpTestResult({ type: "error", message: "ネットワークエラー: サイトURLが正しいか確認してください。" });
      } else {
        setWpTestResult({ type: "error", message: `接続失敗: ${msg || "不明なエラー"}` });
      }
    } finally {
      setWpTesting(false);
    }
  };

  const urlField = (value: string, setter: (v: string) => void, placeholder: string, icon: string) => (
    <div className="flex items-center gap-2">
      <span className="text-sm w-5 text-center">{icon}</span>
      <input
        type="url"
        value={value}
        onChange={(e) => setter(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="p-5 bg-white border-2 border-blue-300 rounded-xl space-y-4">
      <h4 className="font-bold text-gray-800">
        {clinic ? `${clinic.name} を編集` : "新しい院を追加"}
      </h4>

      {/* 院名・エリア（横並び） */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">院名 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="○○整体院"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">エリア</label>
          <input type="text" value={area} onChange={(e) => setArea(e.target.value)}
            placeholder="例：東京都渋谷区"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* 院長名・専門分野（横並び） */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">院長名</label>
          <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
            placeholder="例：山田太郎"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">専門分野</label>
          <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)}
            placeholder="例：腰痛・肩こり専門"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* 業種（複数選択） */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          業種（複数選択可）
          {selectedCategories.length > 0 && (
            <span className="text-blue-600 ml-1">{selectedCategories.join("・")}</span>
          )}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                selectedCategories.includes(cat)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {selectedCategories.includes(cat) && "✓ "}{cat}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">例：「鍼灸院」と「整骨院」を選択 → 鍼灸整骨院</p>
      </div>

      {/* 説明 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">院の説明</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          placeholder="例：渋谷区で肩こり・腰痛を専門にしている整体院"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      {/* 院の強み */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">院の強み・差別化ポイント</label>
        <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3}
          placeholder={"例：\n・骨格矯正×筋膜リリースの独自メソッド\n・完全予約制で1人60分じっくり対応\n・肩こり・腰痛の根本改善に特化"}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        <p className="text-xs text-gray-400 mt-0.5">記事生成時に自動で反映されます</p>
      </div>

      {/* 経験・実績 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">経験・実績・資格</label>
        <textarea value={experience} onChange={(e) => setExperience(e.target.value)} rows={3}
          placeholder={"例：\n・施術歴15年、延べ30,000人以上の施術実績\n・柔道整復師・鍼灸師 国家資格保有\n・○○セミナー認定講師"}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      {/* 口コミ */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">代表的な口コミ・患者の声</label>
        <textarea value={reviews} onChange={(e) => setReviews(e.target.value)} rows={4}
          placeholder={"例：\n「どこに行っても変わらなかった腰痛が3回で楽になりました」（60代女性）\n「丁寧な説明で安心して施術を受けられました」（40代男性）\n「長年の頭痛が嘘のように改善」（30代女性）"}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        <p className="text-xs text-gray-400 mt-0.5">Googleマップの口コミから代表的なものを入力すると、記事の信頼性が向上します</p>
      </div>

      {/* キーワード */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          MEOキーワード（1行1つ）
          <span className="text-gray-400 ml-1">
            {keywordsText.split("\n").filter((k) => k.trim()).length}個
          </span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Googleマップで順位を上げたい「エリア＋症状」のキーワードを入力してください。
        </p>
        <textarea value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} rows={6}
          placeholder={"渋谷区 腰痛\n渋谷 肩こり\n渋谷区 整体\n恵比寿 骨盤矯正\n渋谷 頭痛\n渋谷区 猫背矯正"}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        {/* キーワード候補 */}
        {area && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-medium text-blue-800 mb-2">おすすめキーワード候補（タップでコピー or 追加）</p>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const areaName = area.replace(/[都道府県市区町村].*$/, '') || area;
                const symptoms = ["整体", "腰痛", "坐骨神経痛", "脊柱管狭窄症", "神経痛", "しびれ", "自律神経", "頭痛"];
                const candidates = symptoms.map(s => `${areaName} ${s}`);
                return candidates.map((kw) => {
                  const isAdded = keywordsText.split("\n").some(k => k.trim() === kw);
                  return (
                    <div key={kw} className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(kw);
                          setCopiedKw(kw);
                          setTimeout(() => setCopiedKw(null), 1500);
                        }}
                        className={`px-2 py-1 rounded text-xs transition-all ${
                          copiedKw === kw
                            ? "bg-green-500 text-white"
                            : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        {copiedKw === kw ? "コピー済" : kw}
                      </button>
                      {!isAdded && (
                        <button
                          type="button"
                          onClick={() => {
                            setKeywordsText(prev => prev.trim() ? prev.trim() + "\n" + kw : kw);
                          }}
                          className="px-1.5 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          title="キーワード欄に追加"
                        >
                          +
                        </button>
                      )}
                      {isAdded && (
                        <span className="text-xs text-green-600 px-1">✓</span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-medium text-amber-800 mb-1">キーワードの入れ方のコツ</p>
          <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
            <li>「エリア名＋症状」の組み合わせが基本（例：渋谷 腰痛）</li>
            <li>エリアは区名・駅名・地域名など複数パターンで入れると効果的</li>
            <li>症状だけ（腰痛）やエリアだけ（渋谷 整体）もOK</li>
            <li>MEOチェッカーで実際に順位を確認しながら調整しましょう</li>
          </ul>
        </div>
      </div>

      {/* URL設定（折りたたみ） */}
      <div>
        <button
          onClick={() => setShowUrlSection(!showUrlSection)}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <svg className={`w-4 h-4 transition-transform ${showUrlSection ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          各種URL設定 {websiteUrl ? "(設定済み)" : "(GBP投稿・ブログに自動埋め込み)"}
        </button>

        {showUrlSection && (
          <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
            <p className="text-xs text-slate-600 mb-1">設定したURLはGBP投稿文やブログ記事の生成時に埋め込まれます</p>
            {urlField(websiteUrl, setWebsiteUrl, "ホームページURL", "🏠")}
            {urlField(bookingUrl, setBookingUrl, "予約ページURL", "📅")}
            {urlField(googleMapUrl, setGoogleMapUrl, "Googleマップ口コミURL", "📍")}
            {urlField(youtubeChannelUrl, setYoutubeChannelUrl, "YouTubeチャンネルURL", "🎬")}
            {urlField(youtubePlaylistUrl, setYoutubePlaylistUrl, "YouTube再生リスト（インタビュー等）", "▶️")}
            {urlField(instagramUrl, setInstagramUrl, "Instagram URL", "📱")}
            {urlField(lineUrl, setLineUrl, "LINE公式URL", "🟩")}
            {urlField(noteUrl, setNoteUrl, "noteアカウントURL", "📝")}
          </div>
        )}
      </div>

      {/* note設定（折りたたみ） */}
      <div>
        <button
          onClick={() => setShowNoteSection(!showNoteSection)}
          className="flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700"
        >
          <svg className={`w-4 h-4 transition-transform ${showNoteSection ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          note設定 {noteDisplayName ? "(設定済み)" : "(noteプロフィール・記事生成設定)"}
        </button>

        {showNoteSection && (
          <div className="mt-3 p-4 bg-green-50 rounded-lg border border-green-200 space-y-3">
            <p className="text-xs text-green-600 mb-1">noteの記事生成時にプロフィール情報・定型文・ハッシュタグが自動で反映されます</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">note表示名（引用名）</label>
                <input type="text" value={noteDisplayName} onChange={(e) => setNoteDisplayName(e.target.value)}
                  placeholder="例：山田太郎｜やまだ整体院"
                  className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">noteアカウントID</label>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-1">@</span>
                  <input type="text" value={noteId} onChange={(e) => setNoteId(e.target.value)}
                    placeholder="例：yamada_seitai"
                    className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">自己紹介文（140文字以内）</label>
              <textarea value={noteBio} onChange={(e) => setNoteBio(e.target.value)} rows={2}
                placeholder="例：東京・世田谷で整体院を経営。肩こり・腰痛専門。根本改善を目指す施術で、慢性的なお悩みに向き合っています。"
                className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              <p className="text-xs text-gray-400 mt-0.5">{noteBio.length}/140文字</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">詳細自己紹介（記事末尾の著者情報等に使用）</label>
              <textarea value={noteLongBio} onChange={(e) => setNoteLongBio(e.target.value)} rows={3}
                placeholder="例：やまだ整体院 院長・山田太郎。骨格矯正×筋膜リリースを組み合わせた独自の施術で、肩こり・腰痛・姿勢の改善に取り組んでいます。完全予約制で一人ひとりに丁寧に向き合います。"
                className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">記事のトーン</label>
              <input type="text" value={noteWritingTone} onChange={(e) => setNoteWritingTone(e.target.value)}
                placeholder="例：専門的だが親しみやすい。患者の悩みに寄り添いつつ、根拠ある情報を発信"
                className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">記事末尾の定型文</label>
              <textarea value={noteArticleFooter} onChange={(e) => setNoteArticleFooter(e.target.value)} rows={3}
                placeholder={"例：\n---\nこの記事を書いた人\n山田太郎｜やまだ整体院 院長\n東京都世田谷区\n完全予約制\nホームページはこちら → https://..."}
                className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">よく使うハッシュタグ（カンマ区切り）</label>
              <input type="text" value={noteHashtags} onChange={(e) => setNoteHashtags(e.target.value)}
                placeholder="例：整体, 腰痛, 肩こり, 骨盤矯正, 世田谷整体"
                className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
        )}
      </div>

      {/* WordPress連携（折りたたみ） */}
      <div>
        <button
          onClick={() => setShowWpSection(!showWpSection)}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showWpSection ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          WordPress連携 {clinic?.wordpress?.siteUrl ? "(設定済み)" : "(任意)"}
        </button>

        {showWpSection && (
          <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
            <p className="text-xs text-blue-600">
              WordPress管理画面 → ユーザー → プロフィール →「アプリケーションパスワード」で発行
            </p>
            <input
              type="url"
              value={wpSiteUrl}
              onChange={(e) => setWpSiteUrl(e.target.value)}
              placeholder="サイトURL（https://your-clinic.com）"
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={wpUsername}
                onChange={(e) => setWpUsername(e.target.value)}
                placeholder="ユーザー名"
                className="px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-1">
                <input
                  type={showWpPassword ? "text" : "password"}
                  value={wpAppPassword}
                  onChange={(e) => setWpAppPassword(e.target.value)}
                  placeholder="アプリパスワード"
                  className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setShowWpPassword(!showWpPassword)}
                  className="px-2 bg-blue-100 text-blue-700 rounded-lg text-xs hover:bg-blue-200"
                >
                  {showWpPassword ? "隠" : "表"}
                </button>
              </div>
            </div>
            <button
              onClick={testWordPress}
              disabled={wpTesting}
              className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 disabled:opacity-50"
            >
              {wpTesting ? "テスト中..." : "接続テスト"}
            </button>
            {wpTestResult && (
              <div className={`text-xs px-3 py-2 rounded-lg space-y-1.5 ${
                wpTestResult.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}>
                <p className="font-medium whitespace-pre-line">{wpTestResult.message}</p>
                {wpTestResult.details && (
                  <div className="space-y-1 pt-1 border-t border-green-200">
                    <p>ブログ記事投稿: <span className="font-medium text-green-800">対応</span></p>
                    <p>
                      FAQ投稿タイプ: {wpTestResult.details.hasFaqPostType
                        ? <span className="font-medium text-green-800">対応（自動投稿可能）</span>
                        : <span className="font-medium text-yellow-700">非対応（ブログ記事として投稿＋手動コピー用データ表示）</span>
                      }
                    </p>
                    <p>
                      SEOプラグイン: <span className="font-medium text-green-800">
                        {wpTestResult.details.seoPlugin === "selfull" ? "selfullテーマ" :
                         wpTestResult.details.seoPlugin === "ssp" ? "SEO SIMPLE PACK" :
                         wpTestResult.details.seoPlugin === "yoast" ? "Yoast SEO" :
                         wpTestResult.details.seoPlugin === "aioseo" ? "All in One SEO" :
                         wpTestResult.details.seoPlugin || "検出中..."}
                      </span>
                    </p>
                    {wpTestResult.details.roles && (
                      <p>権限: {wpTestResult.details.roles.join(", ")}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 保存・キャンセル */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {clinic ? "更新" : "追加"}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
