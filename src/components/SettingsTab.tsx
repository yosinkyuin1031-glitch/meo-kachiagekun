"use client";

import { useState, useEffect } from "react";
import { ClinicProfile, WordPressSettings, NoteProfile, OwnerVoice } from "@/lib/types";
import VoiceInput from "./VoiceInput";
import { getClinics, getContents, getRankingHistory, getChecklist } from "@/lib/supabase-storage";
import { ConfirmDialog, useConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";

interface Props {
  clinics: ClinicProfile[];
  activeClinicId: string;
  anthropicKey: string;
  onAddClinic: (clinic: ClinicProfile) => Promise<void> | void;
  onUpdateClinic: (id: string, updates: Partial<ClinicProfile>) => Promise<void> | void;
  onDeleteClinic: (id: string) => Promise<void> | void;
  onSwitchClinic: (id: string) => Promise<void> | void;
  onSaveApiKey: (key: string) => Promise<void> | void;
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
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState(anthropicKey);
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "testing" | "valid" | "invalid" | "saved">("idle");
  const [keyError, setKeyError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(clinics.length === 0);
  const { confirmingId: deletingClinicId, requestConfirm: requestDeleteClinic, cancelConfirm: cancelDeleteClinic, isConfirming: isConfirmingDeleteClinic } = useConfirmDialog();

  // データエクスポート
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const handleExportData = async () => {
    setExporting(true);
    setExportDone(false);
    try {
      const [clinicData, contentData, rankingData] = await Promise.all([
        getClinics(),
        getContents(),
        getRankingHistory(),
      ]);

      // チェックリストは院ごとに取得
      const checklistData: Record<string, unknown[]> = {};
      for (const clinic of clinicData) {
        const items = await getChecklist(clinic.id);
        checklistData[clinic.id] = items;
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        service: "MEO勝ち上げくん",
        clinics: clinicData,
        contents: contentData,
        rankingHistory: rankingData,
        checklists: checklistData,
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().split("T")[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = `MEO勝ち上げくん_データ_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      console.error("エクスポートエラー:", err);
      showToast("データのエクスポートに失敗しました。もう一度お試しください。", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setKeyStatus("invalid");
      setKeyError("APIキーが入力されていません。AnthropicのAPIキーを入力してください。");
      return;
    }
    if (!apiKey.trim().startsWith("sk-ant-")) {
      setKeyStatus("invalid");
      setKeyError("APIキーの形式が正しくありません。「sk-ant-」で始まるAnthropicのAPIキーを入力してください。");
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
        setKeyError(data.error || "APIキーの接続テストに失敗しました。キーが正しいか確認してください。");
      }
    } catch {
      // テスト失敗してもキー自体は保存済み
      setKeyStatus("saved");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* セットアップ完了ガイド */}
      {clinics.length > 0 && (() => {
        const activeClinic = clinics.find(c => c.id === activeClinicId) || clinics[0];
        const missing: string[] = [];
        if (!activeClinic?.strengths) missing.push("院の強み・特徴");
        if (!activeClinic?.specialty) missing.push("得意な施術・専門分野");
        if (!activeClinic?.experience) missing.push("院長の経歴・資格");
        if (missing.length > 0) {
          return (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl shadow-sm p-5 border border-amber-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">💡</span>
                </div>
                <div>
                  <h3 className="font-bold text-amber-800 text-sm mb-1">
                    あと{missing.length}項目入力するとコンテンツの質がアップします
                  </h3>
                  <ul className="text-xs text-amber-700 space-y-0.5">
                    {missing.map((m) => (
                      <li key={m}>・{m}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-600 mt-2">
                    下の院情報から編集できます。入力すると、生成されるブログ・GBP投稿・FAQ記事にあなたの院独自の情報が反映されます。
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

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
                  anthropicKey={anthropicKey}
                  onSave={async (updates) => {
                    try {
                      await onUpdateClinic(clinic.id, updates);
                      setEditingId(null);
                      showToast("院情報を保存しました", "success");
                    } catch {
                      showToast("保存に失敗しました。もう一度お試しください。", "error");
                    }
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
                            <span className="ml-2">症状KW: {clinic.keywords.length}個</span>
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
                      {clinics.length > 1 && !isConfirmingDeleteClinic(clinic.id) && (
                        <button
                          onClick={() => requestDeleteClinic(clinic.id)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100"
                        >
                          削除
                        </button>
                      )}
                    </div>
                    {isConfirmingDeleteClinic(clinic.id) && (
                      <div className="mt-3">
                        <ConfirmDialog
                          message={`「${clinic.name}」を削除しますか？この操作は取り消せません。`}
                          onConfirm={() => { onDeleteClinic(clinic.id); cancelDeleteClinic(); }}
                          onCancel={cancelDeleteClinic}
                        />
                      </div>
                    )}
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
              anthropicKey={anthropicKey}
              onSave={async (data) => {
                const newClinic: ClinicProfile = {
                  id: `clinic-${Date.now()}`,
                  name: data.name || "",
                  area: data.area || "",
                  nearestStation: data.nearestStation,
                  coverageAreas: data.coverageAreas,
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
                try {
                  await onAddClinic(newClinic);
                  setShowAddForm(false);
                  showToast("院を追加しました", "success");
                } catch {
                  showToast("院の追加に失敗しました。もう一度お試しください。", "error");
                }
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}
      </div>


      {/* データエクスポート */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 className="font-bold text-gray-800 text-lg mb-2">データエクスポート</h3>
        <p className="text-xs text-gray-500 mb-4">
          登録している院情報、生成コンテンツ、順位履歴、チェックリストをJSON形式でダウンロードできます。
          解約前のバックアップや、データの確認にご利用ください。
        </p>
        <button
          onClick={handleExportData}
          disabled={exporting}
          className={`w-full py-3 rounded-lg text-sm font-medium transition-all ${
            exportDone
              ? "bg-green-500 text-white"
              : exporting
              ? "bg-gray-400 text-white cursor-not-allowed"
              : "bg-gray-800 text-white hover:bg-gray-900"
          }`}
        >
          {exporting ? "データを準備中..." : exportDone ? "ダウンロード完了" : "全データをダウンロード（JSON）"}
        </button>
      </div>

      {/* リンク */}
      <div className="text-center space-x-4 pb-4">
        <a href="/terms" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">利用規約</a>
        <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">プライバシーポリシー</a>
      </div>
    </div>
  );
}

// ─── 院の編集フォーム ─────────────────────────
// 質問＋音声入力の統合テキストエリア
function VoiceTextArea({ label, hint, value, onChange, placeholder }: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="block text-xs font-bold text-gray-700">{label}</label>
        <VoiceInput onResult={(text) => onChange(value ? value + "\n" + text : text)} placeholder="話した内容が追加されます" />
      </div>
      <p className="text-xs text-gray-400 mb-1">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 resize-none"
      />
    </div>
  );
}

function ClinicEditForm({
  clinic,
  onSave,
  onCancel,
  anthropicKey,
}: {
  clinic: ClinicProfile | null;
  onSave: (data: Partial<ClinicProfile>) => Promise<void> | void;
  onCancel: () => void;
  anthropicKey?: string;
}) {
  const [copiedKw, setCopiedKw] = useState<string | null>(null);
  const [keywordError, setKeywordError] = useState("");
  const [wpUrlError, setWpUrlError] = useState("");
  const [saving, setSaving] = useState(false);
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
  const [nearestStation, setNearestStation] = useState(clinic?.nearestStation || "");
  const [coverageAreasText, setCoverageAreasText] = useState(clinic?.coverageAreas?.join(", ") || "");
  const [keywordsText, setKeywordsText] = useState(clinic?.keywords.join("\n") || "");
  const [strengths, setStrengths] = useState(clinic?.strengths || "");
  const [experience, setExperience] = useState(clinic?.experience || "");
  const [reviews, setReviews] = useState(clinic?.reviews || "");

  // 院長の声
  const [ownerPhilosophy, setOwnerPhilosophy] = useState(clinic?.ownerVoice?.philosophy || "");
  const [ownerPassion, setOwnerPassion] = useState(clinic?.ownerVoice?.passion || "");
  const [ownerApproach, setOwnerApproach] = useState(clinic?.ownerVoice?.approach || "");
  const [ownerDifference, setOwnerDifference] = useState(clinic?.ownerVoice?.difference || "");
  const [ownerOrigin, setOwnerOrigin] = useState(clinic?.ownerVoice?.origin || "");
  const [writingSamples, setWritingSamples] = useState(clinic?.ownerVoice?.writingSamples || "");

  // Google口コミ自動取得
  const [reviewMaxCount, setReviewMaxCount] = useState(30);
  const [fetchingReviews, setFetchingReviews] = useState(false);
  const [reviewFetchResult, setReviewFetchResult] = useState<{ success: boolean; message: string; summary?: { summaryOverall: string; symptomTags: Record<string, string[]>; representativeReviews: { text: string; rating: number; pattern: string }[] } } | null>(null);

  async function handleFetchReviews() {
    if (!name || !area) {
      setReviewFetchResult({ success: false, message: "院名・エリアを先に保存してください" });
      return;
    }
    if (!confirm(`Google口コミを最大${reviewMaxCount}件取得します。\n月4回まで取得可能です。\n実行しますか？`)) return;

    setFetchingReviews(true);
    setReviewFetchResult(null);
    try {
      const res = await fetch("/api/fetch-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId: clinic?.id,
          businessName: name,
          area,
          maxCount: reviewMaxCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "取得に失敗しました");

      // 代表的な口コミをテキストエリアに自動反映
      if (data.summary?.representativeReviews?.length > 0) {
        const reviewLines = data.summary.representativeReviews
          .map((r: { text: string; rating: number; pattern: string }) => `「${r.text}」（${r.pattern}・★${r.rating}）`)
          .join("\n");
        setReviews(reviewLines);
      }

      setReviewFetchResult({
        success: true,
        message: `口コミ${data.reviewCount}件を取得し、AIで要約しました（平均★${data.avgRating?.toFixed(1)}）`,
        summary: data.summary,
      });
    } catch (e) {
      setReviewFetchResult({ success: false, message: e instanceof Error ? e.message : "取得に失敗しました" });
    } finally {
      setFetchingReviews(false);
    }
  }

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

  // キーワードバリデーション: 特殊文字のみのキーワードを拒否
  const isValidKeyword = (kw: string): boolean => {
    // 空文字チェック
    if (!kw.trim()) return false;
    // 特殊文字のみ（英数字・日本語が含まれていない）を拒否
    const stripped = kw.replace(/[^a-zA-Z0-9\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff00-\uffef]/g, "");
    return stripped.length > 0;
  };

  // WordPress URL バリデーション
  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return true; // 空欄はOK（任意入力）
    return /^https?:\/\//.test(url.trim());
  };

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await handleSubmitInner();
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitInner = async () => {
    if (!name.trim()) return;

    // キーワードバリデーション
    const rawKeywords = keywordsText
      .split("\n")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const invalidKeywords = rawKeywords.filter((k) => !isValidKeyword(k));
    if (invalidKeywords.length > 0) {
      setKeywordError("有効なキーワードを入力してください");
      return;
    }
    setKeywordError("");

    // WordPress URL バリデーション
    if (wpSiteUrl.trim() && !isValidUrl(wpSiteUrl)) {
      setWpUrlError("URLはhttps://から始まる形式で入力してください");
      return;
    }
    setWpUrlError("");

    const keywords = rawKeywords;

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

    const ownerVoice: OwnerVoice | undefined = (ownerPhilosophy || ownerPassion || ownerApproach || ownerDifference || ownerOrigin || writingSamples)
      ? {
          philosophy: ownerPhilosophy || undefined,
          passion: ownerPassion || undefined,
          approach: ownerApproach || undefined,
          difference: ownerDifference || undefined,
          origin: ownerOrigin || undefined,
          writingSamples: writingSamples || undefined,
        }
      : undefined;

    await onSave({ name, area, nearestStation: nearestStation || undefined, coverageAreas: coverageAreasText ? coverageAreasText.split(",").map(a => a.trim()).filter(Boolean) : undefined, category, categories, description, ownerName, specialty, keywords, urls, wordpress, noteProfile, strengths: strengths || undefined, experience: experience || undefined, reviews: reviews || undefined, ownerVoice });
  };

  const testWordPress = async () => {
    if (!wpSiteUrl || !wpUsername || !wpAppPassword) {
      setWpTestResult({ type: "error", message: "WordPress接続に必要な情報が不足しています。サイトURL、ユーザー名、アプリケーションパスワードの3つをすべて入力してください。" });
      return;
    }

    // URL形式チェック
    if (wpSiteUrl.trim() && !isValidUrl(wpSiteUrl)) {
      setWpUrlError("URLはhttps://から始まる形式で入力してください");
      setWpTestResult({ type: "error", message: "WordPress URLが正しくありません。https://を含めてください" });
      return;
    }
    setWpUrlError("");

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
          errorMsg = "ユーザー名またはアプリケーションパスワードが正しくありません";
        } else if (res.status === 404) {
          errorMsg = "WordPress URLが正しくありません。https://を含めてください";
        } else if (res.status === 502) {
          // サイト自体に接続できない場合
          errorMsg = "WordPress URLが正しくありません。https://を含めてください";
        } else if (res.status >= 500) {
          errorMsg = "WordPressサーバーで問題が発生しました。しばらく時間をおいてから、もう一度お試しください。";
        }
        // REST API無効の場合を検出
        if (data.error && (data.error.includes("REST API") || data.error.includes("rest_api"))) {
          errorMsg = "WordPressのREST APIが無効になっています。プラグイン設定を確認してください";
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
        setWpTestResult({ type: "error", message: "インターネット接続を確認してください。また、サイトURLが正しいかもご確認ください。" });
      } else {
        setWpTestResult({ type: "error", message: "WordPressへの接続に失敗しました。サイトURL、ユーザー名、パスワードを確認して、もう一度お試しください。" });
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

      {/* 最寄り駅・対応エリア */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">最寄り駅</label>
          <input type="text" value={nearestStation} onChange={(e) => setNearestStation(e.target.value)}
            placeholder="例：渋谷駅 徒歩5分"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">対応エリア（カンマ区切り）</label>
          <input type="text" value={coverageAreasText} onChange={(e) => setCoverageAreasText(e.target.value)}
            placeholder="例：渋谷区, 目黒区, 港区"
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

      {/* ──── 院長の声セクション ──── */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🎙️</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800">院長の声</h3>
            <p className="text-xs text-gray-500">マイクボタンで話すだけ。先生の言葉がそのまま記事に反映されます</p>
          </div>
        </div>

        {/* Q1: 治療哲学 */}
        <VoiceTextArea
          label="なぜこの仕事をしていますか？"
          hint="治療を通じて実現したいこと、大事にしている考え方を教えてください"
          value={ownerPhilosophy}
          onChange={setOwnerPhilosophy}
          placeholder="例：「痛みを取るだけじゃなく、患者さんが自分の体に自信を持てるようにしたいんです。だから原因をしっかり説明して…」"
        />

        {/* Q2: 患者への想い */}
        <VoiceTextArea
          label="患者さんにどうなってほしいですか？"
          hint="施術後、どんな生活を送ってほしいか"
          value={ownerPassion}
          onChange={setOwnerPassion}
          placeholder="例：「朝起きた時に『今日も体が軽い』って思える毎日を送ってほしい。そのために…」"
        />

        {/* Q3: 施術のこだわり */}
        <VoiceTextArea
          label="治療で一番大事にしていることは？"
          hint="他の先生と違うこだわり、絶対に譲れないポイント"
          value={ownerApproach}
          onChange={setOwnerApproach}
          placeholder="例：「初回のカウンセリングに30分かけるのは、痛みの本当の原因を見つけるため。表面的な施術はしたくないんです」"
        />

        {/* Q4: 他院との違い */}
        <VoiceTextArea
          label="他の院と何が違いますか？"
          hint="自分だけの考え方・やり方"
          value={ownerDifference}
          onChange={setOwnerDifference}
          placeholder="例：「うちは筋肉じゃなくて神経にアプローチする。なぜかというと…」"
        />

        {/* Q5: 開業の原点 */}
        <VoiceTextArea
          label="この道を選んだきっかけは？"
          hint="治療家を目指した理由、開業を決意したエピソード"
          value={ownerOrigin}
          onChange={setOwnerOrigin}
          placeholder="例：「学生時代にケガをして、治してくれた先生に憧れて…」"
        />

        {/* 文体サンプル */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="block text-xs font-medium text-gray-600">普段書いている文章（FB投稿やLINEメッセージなど）</label>
            <VoiceInput onResult={(text) => setWritingSamples((prev) => prev ? prev + "\n" + text : text)} placeholder="話した内容が追加されます" />
          </div>
          <textarea
            value={writingSamples}
            onChange={(e) => setWritingSamples(e.target.value)}
            rows={5}
            placeholder="実際に書いたFacebook投稿やLINEメッセージを2〜3個貼り付けてください。AIがこの口調を真似して記事を作ります。"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
          <p className="text-xs text-gray-400 mt-0.5">AIが先生の口調・言い回しを学習します。多いほど精度が上がります</p>
        </div>
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
        <p className="text-xs text-gray-400 mt-0.5">手動入力した口コミは、記事生成時の補足として使われます</p>
      </div>

      {/* Google口コミ自動取得 */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🔍</span>
          <h3 className="text-sm font-bold text-gray-800">Google口コミの自動取得（おすすめ）</h3>
        </div>
        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
          Googleマップに投稿されている口コミを自動で取得し、AIで要約します。<br />
          記事生成時、症状キーワードに合わせて関連する口コミだけが自動でプロンプトに反映されます。
        </p>
        <div className="flex items-center gap-3 mb-3">
          <label className="text-xs font-medium text-gray-600">取得件数：</label>
          <select
            value={reviewMaxCount}
            onChange={(e) => setReviewMaxCount(parseInt(e.target.value))}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
            disabled={fetchingReviews}
          >
            <option value={30}>30件（標準）</option>
            <option value={50}>50件</option>
            <option value={100}>100件（大量）</option>
          </select>
          <button
            onClick={handleFetchReviews}
            disabled={fetchingReviews}
            className="ml-auto px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {fetchingReviews ? "取得中..." : "Google口コミを取得"}
          </button>
        </div>
        {reviewFetchResult && (
          <div className={`text-xs p-2 rounded ${reviewFetchResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {reviewFetchResult.message}
          </div>
        )}
        {reviewFetchResult?.summary && (
          <div className="mt-3 space-y-2">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-gray-700 mb-1">全体の傾向</h4>
              <p className="text-xs text-gray-600 leading-relaxed">{reviewFetchResult.summary.summaryOverall}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-gray-700 mb-1">症状別タグ</h4>
              <div className="flex flex-wrap gap-1">
                {Object.keys(reviewFetchResult.summary.symptomTags).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{tag}（{reviewFetchResult.summary!.symptomTags[tag].length}件）</span>
                ))}
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          ※ 月4回まで取得可能。利用料の負担はありません。<br />
          ※ 取得した口コミはAIで要約され、症状別にタグ付けされます。
        </p>
      </div>

      {/* 症状キーワード */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          症状キーワード（1行1つ）
          <span className="text-gray-400 ml-1">
            {keywordsText.split("\n").filter((k) => k.trim()).length}個
          </span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          症状キーワードのみ入力してください。地域名は上の「エリア」「対応エリア」設定から自動で組み合わせます。
        </p>
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
          <p className="text-xs font-medium text-green-800 mb-1">キーワードの自動組み合わせ</p>
          <p className="text-xs text-green-700">
            地域設定「{area || '(未設定)'}」× 症状キーワード → 記事・FAQ・GBP投稿を自動生成
          </p>
          {coverageAreasText && (
            <p className="text-xs text-green-600 mt-1">
              対応エリア: {coverageAreasText} もコンテンツに含まれます
            </p>
          )}
        </div>
        <textarea value={keywordsText} onChange={(e) => { setKeywordsText(e.target.value); setKeywordError(""); }} rows={6}
          placeholder={"腰痛\n肩こり\n坐骨神経痛\n脊柱管狭窄症\n頭痛\n猫背矯正\n骨盤矯正"}
          className={`w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
            keywordError ? "border-red-300 bg-red-50/50" : "border-gray-200"
          }`} />
        {keywordError && (
          <p className="text-xs text-red-600 mt-1 bg-red-50 px-3 py-1.5 rounded" role="alert">{keywordError}</p>
        )}
        {/* キーワード候補 */}
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-medium text-blue-800 mb-2">おすすめキーワード候補（タップでコピー or 追加）</p>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const symptoms = ["整体", "腰痛", "肩こり", "坐骨神経痛", "脊柱管狭窄症", "神経痛", "しびれ", "自律神経失調症", "頭痛", "猫背矯正", "骨盤矯正", "ぎっくり腰", "ストレートネック", "四十肩", "五十肩"];
              const candidates = symptoms;
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
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-medium text-amber-800 mb-1">キーワードの入れ方のコツ</p>
          <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
            <li>症状名のみを入力（地域名は不要）</li>
            <li>記事生成時に地域名が自動で組み合わされます</li>
            <li>具体的な症状名ほど専門性の高い記事が生成されます</li>
            <li>「腰痛」より「坐骨神経痛」のように具体的な方が効果的</li>
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
              onChange={(e) => { setWpSiteUrl(e.target.value); setWpUrlError(""); }}
              placeholder="サイトURL（https://your-clinic.com）"
              className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                wpUrlError ? "border-red-300 bg-red-50/50" : "border-blue-200"
              }`}
            />
            {wpUrlError && (
              <p className="text-xs text-red-600 mt-1 bg-red-50 px-3 py-1.5 rounded" role="alert">{wpUrlError}</p>
            )}
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
          disabled={!name.trim() || saving}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {saving ? "保存中..." : clinic ? "更新" : "追加"}
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
