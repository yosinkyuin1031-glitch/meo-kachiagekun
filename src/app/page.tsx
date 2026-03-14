"use client";

import { useState, useEffect, useCallback } from "react";
import { BusinessProfile, ClinicProfile } from "@/lib/types";
import {
  getBusinessProfile,
  getClinics,
  getSettings,
  saveSettings,
  addClinic,
  updateClinic,
  deleteClinic,
} from "@/lib/storage";
import ChecklistTab from "@/components/ChecklistTab";
import ContentGenerator from "@/components/ContentGenerator";
import BulkGenerator from "@/components/BulkGenerator";
import GbpImageGenerator from "@/components/GbpImageGenerator";
import SettingsTab from "@/components/SettingsTab";

type Tab = "bulk" | "checklist" | "note" | "gbp" | "gbp-image" | "llmo" | "wordpress" | "settings";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "bulk", label: "一括生成", icon: "⚡" },
  { key: "checklist", label: "施策リスト", icon: "📋" },
  { key: "note", label: "note記事", icon: "📝" },
  { key: "gbp", label: "GBP投稿", icon: "📍" },
  { key: "gbp-image", label: "GBP画像", icon: "🖼️" },
  { key: "llmo", label: "LLMO対策", icon: "🤖" },
  { key: "wordpress", label: "WP投稿", icon: "📄" },
  { key: "settings", label: "設定", icon: "⚙️" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("bulk");
  const [profile, setProfile] = useState<BusinessProfile>({
    name: "", area: "", keywords: [], description: "", category: "整体院", anthropicKey: "",
  });
  const [clinics, setClinics] = useState<ClinicProfile[]>([]);
  const [activeClinicId, setActiveClinicId] = useState("");
  const [showClinicSwitcher, setShowClinicSwitcher] = useState(false);

  const refreshState = useCallback(() => {
    const p = getBusinessProfile();
    setProfile(p);
    setClinics(getClinics());
    const s = getSettings();
    setActiveClinicId(s.activeClinicId || getClinics()[0]?.id || "");
  }, []);

  useEffect(() => {
    refreshState();
    const clinicList = getClinics();
    if (clinicList.length === 0) setTab("settings");
  }, [refreshState]);

  const switchClinic = (clinicId: string) => {
    const settings = getSettings();
    settings.activeClinicId = clinicId;
    saveSettings(settings);
    setActiveClinicId(clinicId);
    setProfile(getBusinessProfile());
    setShowClinicSwitcher(false);
  };

  const handleAddClinic = (clinic: ClinicProfile) => {
    addClinic(clinic);
    switchClinic(clinic.id);
    refreshState();
  };

  const handleUpdateClinic = (id: string, updates: Partial<ClinicProfile>) => {
    updateClinic(id, updates);
    refreshState();
  };

  const handleDeleteClinic = (id: string) => {
    deleteClinic(id);
    const remaining = getClinics();
    if (remaining.length > 0) {
      switchClinic(remaining[0].id);
    }
    refreshState();
  };

  const handleSaveApiKey = (key: string) => {
    const settings = getSettings();
    settings.anthropicKey = key;
    saveSettings(settings);
    refreshState();
  };

  const hasWordPress = !!(
    profile.wordpress?.siteUrl &&
    profile.wordpress?.username &&
    profile.wordpress?.appPassword
  );

  const activeClinic = clinics.find((c) => c.id === activeClinicId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-orange-100">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-orange-800">
                MEO勝ち上げくん
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                治療院のMEO対策を完全サポート
              </p>
            </div>

            {/* 院切り替えボタン */}
            {clinics.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowClinicSwitcher(!showClinicSwitcher)}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-bold">
                    {activeClinic?.name?.charAt(0) || "?"}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-gray-800 leading-tight">
                      {activeClinic?.name || "未選択"}
                    </p>
                    <p className="text-xs text-gray-400 leading-tight">
                      {activeClinic?.area}
                      {hasWordPress && " / WP連携済"}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* ドロップダウン */}
                {showClinicSwitcher && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowClinicSwitcher(false)} />
                    <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                      <div className="p-2">
                        <p className="text-xs text-gray-400 px-2 py-1 font-medium">院を切り替え</p>
                        {clinics.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => switchClinic(c.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              c.id === activeClinicId
                                ? "bg-orange-50 border border-orange-200"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              c.id === activeClinicId
                                ? "bg-orange-600 text-white"
                                : "bg-gray-200 text-gray-600"
                            }`}>
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                              <p className="text-xs text-gray-400 truncate">
                                {c.area} / {c.category}
                                {c.wordpress?.siteUrl && " / WP"}
                              </p>
                            </div>
                            {c.id === activeClinicId && (
                              <span className="text-orange-600 text-xs font-medium">使用中</span>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="border-t border-gray-100 p-2">
                        <button
                          onClick={() => {
                            setShowClinicSwitcher(false);
                            setTab("settings");
                          }}
                          className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg text-left font-medium"
                        >
                          + 新しい院を追加
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* タブ */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 px-3 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.key
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === "bulk" && <BulkGenerator profile={profile} />}

        {tab === "checklist" && <ChecklistTab />}

        {tab === "note" && <ContentGenerator profile={profile} type="note" />}

        {tab === "gbp" && <ContentGenerator profile={profile} type="gbp" />}

        {tab === "gbp-image" && <GbpImageGenerator profile={profile} />}

        {tab === "llmo" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-2">
                LLMO（大規模言語モデル最適化）とは？
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                ChatGPTやGeminiなどのAI検索で「{profile.area || "○○"}でおすすめの
                {profile.category || "整体院"}は？」と聞かれたときに、あなたの院が回答に含まれるようにする対策です。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-800 text-sm mb-1">FAQ生成</h4>
                  <p className="text-xs text-purple-600">AI検索で引用されやすいQ&A形式のコンテンツを生成</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 text-sm mb-1">構造化データ</h4>
                  <p className="text-xs text-blue-600">Schema.org準拠のJSON-LDでAIが理解しやすい情報構造に</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 text-sm mb-1">E-E-A-T強化</h4>
                  <p className="text-xs text-green-600">経験・専門性・権威性・信頼性をコンテンツに反映</p>
                </div>
              </div>
            </div>
            <ContentGenerator profile={profile} type="faq" />
            <ContentGenerator profile={profile} type="faq-short" />
            <ContentGenerator profile={profile} type="structured-data" />
          </div>
        )}

        {tab === "wordpress" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-2">WordPress自動投稿</h2>
              <p className="text-sm text-gray-600 mb-4">
                SEO・LLMO最適化されたブログ記事やFAQをWordPressに自動投稿します。
              </p>
              {!hasWordPress && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-xs text-yellow-700">
                    「設定」タブでWordPress接続情報を入力してください。
                  </p>
                  <button onClick={() => setTab("settings")} className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded-lg text-xs font-medium hover:bg-yellow-700">
                    設定画面へ
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h4 className="font-medium text-blue-800 text-sm mb-1">ブログ記事</h4>
                  <p className="text-xs text-blue-600">症状別の詳細ブログ記事（HTML形式・SEO最適化済み）</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <h4 className="font-medium text-purple-800 text-sm mb-1">SEO情報一括生成</h4>
                  <p className="text-xs text-purple-600">タイトル・メタディスクリプション・OGP・スラッグを一括生成</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <h4 className="font-medium text-green-800 text-sm mb-1">note記事も投稿可</h4>
                  <p className="text-xs text-green-600">note記事タブで生成した記事もWordPressに投稿できます</p>
                </div>
              </div>
            </div>
            <ContentGenerator profile={profile} type="blog" />
            <ContentGenerator profile={profile} type="blog-seo" />
          </div>
        )}

        {tab === "settings" && (
          <SettingsTab
            clinics={clinics}
            activeClinicId={activeClinicId}
            anthropicKey={getSettings().anthropicKey}
            onAddClinic={handleAddClinic}
            onUpdateClinic={handleUpdateClinic}
            onDeleteClinic={handleDeleteClinic}
            onSwitchClinic={switchClinic}
            onSaveApiKey={handleSaveApiKey}
          />
        )}
      </main>
    </div>
  );
}
