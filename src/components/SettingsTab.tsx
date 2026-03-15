"use client";

import { useState, useEffect } from "react";
import { ClinicProfile, WordPressSettings, GoogleSettings } from "@/lib/types";
import { getGoogleSettings, saveGoogleSettings, clearGoogleSettings } from "@/lib/storage";

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

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* APIキー（共通） */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-gray-800 text-lg mb-4">APIキー（全院共通）</h3>
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <label className="block text-sm font-medium text-purple-800 mb-1">
            Anthropic APIキー
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 px-4 py-2.5 border border-purple-200 rounded-lg text-sm font-mono bg-white outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-xs hover:bg-purple-200"
            >
              {showKey ? "隠す" : "表示"}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-purple-600">
              <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline">
                Anthropic Console
              </a>
              で取得
            </p>
            <button
              onClick={handleSaveApiKey}
              disabled={keyStatus === "testing"}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                keyStatus === "valid" ? "bg-green-500 text-white"
                : keyStatus === "saved" ? "bg-green-500 text-white"
                : keyStatus === "invalid" ? "bg-red-500 text-white"
                : keyStatus === "testing" ? "bg-yellow-500 text-white animate-pulse"
                : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              {keyStatus === "testing" ? "接続テスト中..."
                : keyStatus === "valid" ? "接続OK・保存済み"
                : keyStatus === "saved" ? "保存済み"
                : keyStatus === "invalid" ? "再試行"
                : "保存＆接続テスト"}
            </button>
          </div>
          {keyStatus === "invalid" && keyError && (
            <p className="text-xs text-red-600 mt-1.5 bg-red-50 px-3 py-1.5 rounded">{keyError}</p>
          )}
          {keyStatus === "valid" && (
            <p className="text-xs text-green-600 mt-1.5 bg-green-50 px-3 py-1.5 rounded">APIキーの接続を確認しました</p>
          )}
        </div>
      </div>

      {/* 院一覧 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">登録院</h3>
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
          >
            + 院を追加
          </button>
        </div>

        {clinics.length === 0 && !showAddForm && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-3">まだ院が登録されていません</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
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
                      ? "bg-orange-50 border-orange-300"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                          clinic.id === activeClinicId
                            ? "bg-orange-600 text-white"
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
                          className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200"
                        >
                          切替
                        </button>
                      )}
                      {clinic.id === activeClinicId && (
                        <span className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-medium">
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
                  urls: data.urls,
                  wordpress: data.wordpress,
                };
                onAddClinic(newClinic);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}
      </div>

      {/* Google Business Profile連携 */}
      <GoogleSettingsSection />
    </div>
  );
}

// ─── Google Business Profile設定セクション ──────
function GoogleSettingsSection() {
  const [google, setGoogle] = useState<GoogleSettings | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSection, setShowSection] = useState(false);
  const [status, setStatus] = useState<"idle" | "authorizing" | "loading-locations" | "connected" | "error">("idle");
  const [error, setError] = useState("");
  const [locations, setLocations] = useState<Array<{ accountId: string; locationId: string; locationName: string; address: string }>>([]);
  const [checkResult, setCheckResult] = useState<{ valid?: boolean; email?: string; error?: string; accountCount?: number; accountError?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const saved = getGoogleSettings();
    if (saved) {
      setGoogle(saved);
      setClientId(saved.clientId || "");
      setClientSecret(saved.clientSecret || "");
      if (saved.accessToken && saved.locationId) {
        setStatus("connected");
      }
      setShowSection(true);
    }
  }, []);

  const startOAuth = async () => {
    if (!clientId || !clientSecret) {
      setError("Client IDとClient Secretを入力してください");
      return;
    }
    // 保存
    saveGoogleSettings({ clientId, clientSecret });
    setStatus("authorizing");
    setError("");

    try {
      const redirectUri = `${window.location.origin}/google-callback`;
      const res = await fetch("/api/google/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, redirectUri }),
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      setError("認証開始に失敗しました");
      setStatus("error");
    }
  };

  const selectLocation = (loc: { accountId: string; locationId: string; locationName: string }) => {
    if (!google) return;
    const updated = { ...google, accountId: loc.accountId, locationId: loc.locationId, locationName: loc.locationName };
    setGoogle(updated);
    saveGoogleSettings(updated);
    setStatus("connected");
    setLocations([]);
  };

  const disconnect = () => {
    clearGoogleSettings();
    setGoogle(null);
    setClientId("");
    setClientSecret("");
    setStatus("idle");
    setLocations([]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <button
        onClick={() => setShowSection(!showSection)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📍</span>
          <div className="text-left">
            <h3 className="font-bold text-gray-800 text-lg">GBP自動投稿（Google連携）</h3>
            <p className="text-xs text-gray-500">
              Googleビジネスプロフィールに自動で投稿します
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "connected" && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">連携済</span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${showSection ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {showSection && (
        <div className="mt-4 space-y-4">
          {status === "connected" && google?.locationName ? (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">Google連携済み</p>
                    <p className="text-xs text-green-600 mt-1">ビジネス: {google.locationName}</p>
                    <p className="text-xs text-gray-500 mt-1">一括生成時にGBPへ自動投稿されます</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!google?.accessToken) return;
                        setChecking(true);
                        setCheckResult(null);
                        try {
                          // トークン期限切れならリフレッシュ
                          let token = google.accessToken;
                          if (google.tokenExpiry && new Date(google.tokenExpiry) < new Date()) {
                            const refreshRes = await fetch("/api/google/token", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                refreshToken: google.refreshToken,
                                clientId: google.clientId,
                                clientSecret: google.clientSecret,
                              }),
                            });
                            const refreshData = await refreshRes.json();
                            if (refreshRes.ok && refreshData.accessToken) {
                              token = refreshData.accessToken;
                              const updated = {
                                ...google,
                                accessToken: token,
                                tokenExpiry: new Date(Date.now() + (refreshData.expiresIn || 3600) * 1000).toISOString(),
                              };
                              setGoogle(updated);
                              saveGoogleSettings(updated);
                            }
                          }
                          const res = await fetch("/api/google/check", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ accessToken: token }),
                          });
                          const data = await res.json();
                          setCheckResult(data);
                        } catch {
                          setCheckResult({ valid: false, error: "接続確認に失敗しました" });
                        } finally {
                          setChecking(false);
                        }
                      }}
                      disabled={checking}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs hover:bg-blue-100 disabled:opacity-50"
                    >
                      {checking ? "確認中..." : "接続確認"}
                    </button>
                    <button
                      onClick={disconnect}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100"
                    >
                      連携解除
                    </button>
                  </div>
                </div>
              </div>

              {/* 接続確認結果 */}
              {checkResult && (
                <div className={`p-4 rounded-lg border ${checkResult.valid ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
                  {checkResult.valid ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-800">接続OK</p>
                      {checkResult.email && <p className="text-xs text-blue-600">アカウント: {checkResult.email}</p>}
                      <p className="text-xs text-blue-600">GBPアカウント数: {checkResult.accountCount ?? 0}</p>
                      {checkResult.accountError && <p className="text-xs text-orange-600">API注意: {checkResult.accountError}</p>}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-red-800">接続エラー</p>
                      <p className="text-xs text-red-600">{checkResult.error}</p>
                      {checkResult.error?.includes("無効") && (
                        <p className="text-xs text-red-500 mt-1">トークンが期限切れの可能性があります。連携解除→再連携をお試しください。</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">設定手順</p>
                <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside">
                  <li>Google Cloud Console でプロジェクトを作成</li>
                  <li>「My Business Business Information API」を有効化</li>
                  <li>「OAuth同意画面」を設定（外部→テスト→自分のメールを追加）</li>
                  <li>「認証情報」→「OAuth 2.0 クライアント ID」を作成（Webアプリケーション）</li>
                  <li>リダイレクトURIに以下を追加（コピーしてそのまま貼り付け）：</li>
                </ol>
                <div className="mt-2 mb-2 p-2 bg-white border border-blue-300 rounded-lg">
                  <code className="text-xs text-blue-800 break-all select-all">
                    {typeof window !== "undefined" ? window.location.origin + "/google-callback" : "https://your-app.vercel.app/google-callback"}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(window.location.origin + "/google-callback")}
                    className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200"
                  >
                    コピー
                  </button>
                </div>
                <ol className="text-xs text-blue-700 space-y-1.5 list-decimal list-inside" start={6}>
                  <li>Client IDとClient Secretを下に入力</li>
                </ol>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Client Secret</label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={startOAuth}
                  disabled={status === "authorizing" || status === "loading-locations"}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  {status === "authorizing" ? "認証画面に移動中..." :
                   status === "loading-locations" ? "ビジネス情報取得中..." :
                   "Googleアカウントを連携する"}
                </button>
              </div>

              {/* ロケーション選択 */}
              {locations.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">ビジネスを選択してください：</p>
                  {locations.map((loc) => (
                    <button
                      key={loc.locationId}
                      onClick={() => selectLocation(loc)}
                      className="w-full p-3 text-left bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800">{loc.locationName}</p>
                      <p className="text-xs text-gray-500">{loc.address}</p>
                    </button>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </>
          )}
        </div>
      )}
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

  // WordPress
  const [wpSiteUrl, setWpSiteUrl] = useState(clinic?.wordpress?.siteUrl || "");
  const [wpUsername, setWpUsername] = useState(clinic?.wordpress?.username || "");
  const [wpAppPassword, setWpAppPassword] = useState(clinic?.wordpress?.appPassword || "");
  const [showWpSection, setShowWpSection] = useState(!!(clinic?.wordpress?.siteUrl));
  const [showWpPassword, setShowWpPassword] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
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

    const categories = selectedCategories.length > 0 ? selectedCategories : ["整体院"];
    const category = categories.join("・");

    onSave({ name, area, category, categories, description, ownerName, specialty, keywords, urls, wordpress });
  };

  const testWordPress = async () => {
    if (!wpSiteUrl || !wpUsername || !wpAppPassword) {
      setWpTestResult({ type: "error", message: "すべて入力してください" });
      return;
    }
    setWpTesting(true);
    setWpTestResult(null);
    try {
      const res = await fetch("/api/wordpress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: wpSiteUrl, username: wpUsername, appPassword: wpAppPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWpTestResult({ type: "error", message: data.error });
      } else {
        setWpTestResult({ type: "success", message: `接続OK: ${data.userName}` });
      }
    } catch {
      setWpTestResult({ type: "error", message: "接続失敗" });
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
        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
      />
    </div>
  );

  return (
    <div className="p-5 bg-white border-2 border-orange-300 rounded-xl space-y-4">
      <h4 className="font-bold text-gray-800">
        {clinic ? `${clinic.name} を編集` : "新しい院を追加"}
      </h4>

      {/* 院名・エリア（横並び） */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">院名 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="○○整体院"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">エリア</label>
          <input type="text" value={area} onChange={(e) => setArea(e.target.value)}
            placeholder="例：東京都渋谷区"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      </div>

      {/* 院長名・専門分野（横並び） */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">院長名</label>
          <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
            placeholder="例：山田太郎"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">専門分野</label>
          <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)}
            placeholder="例：腰痛・肩こり専門"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
      </div>

      {/* 業種（複数選択） */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          業種（複数選択可）
          {selectedCategories.length > 0 && (
            <span className="text-orange-600 ml-1">{selectedCategories.join("・")}</span>
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
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:bg-orange-50"
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
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
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
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
        {/* キーワード候補 */}
        {area && (
          <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs font-medium text-orange-800 mb-2">おすすめキーワード候補（タップでコピー or 追加）</p>
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
                            : "bg-white text-gray-700 border border-gray-200 hover:border-orange-300"
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
                          className="px-1.5 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
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
            <li>「エリア名＋症状」の組み合わせが基本（例：長居 腰痛）</li>
            <li>エリアは区名・駅名・地域名など複数パターンで入れると効果的</li>
            <li>症状だけ（腰痛）やエリアだけ（長居 整体）もOK</li>
            <li>MEOチェッカーで実際に順位を確認しながら調整しましょう</li>
          </ul>
        </div>
      </div>

      {/* URL設定（折りたたみ） */}
      <div>
        <button
          onClick={() => setShowUrlSection(!showUrlSection)}
          className="flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          <svg className={`w-4 h-4 transition-transform ${showUrlSection ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          各種URL設定 {websiteUrl ? "(設定済み)" : "(GBP投稿・ブログに自動埋め込み)"}
        </button>

        {showUrlSection && (
          <div className="mt-3 p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-2.5">
            <p className="text-xs text-orange-600 mb-1">設定したURLはGBP投稿やブログ記事に自動で埋め込まれます</p>
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
              <p className={`text-xs px-3 py-2 rounded-lg ${
                wpTestResult.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}>
                {wpTestResult.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 保存・キャンセル */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
