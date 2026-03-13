"use client";

import { useState, useEffect } from "react";
import { BusinessProfile } from "@/lib/types";
import { getProfile, saveProfile } from "@/lib/storage";
import ChecklistTab from "@/components/ChecklistTab";
import ContentGenerator from "@/components/ContentGenerator";
import SettingsTab from "@/components/SettingsTab";

type Tab = "checklist" | "note" | "gbp" | "llmo" | "settings";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "checklist", label: "施策リスト", icon: "📋" },
  { key: "note", label: "note記事", icon: "📝" },
  { key: "gbp", label: "GBP投稿", icon: "📍" },
  { key: "llmo", label: "LLMO対策", icon: "🤖" },
  { key: "settings", label: "設定", icon: "⚙️" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("checklist");
  const [profile, setProfile] = useState<BusinessProfile>({
    name: "", area: "", keywords: [], description: "", category: "整体院", anthropicKey: "",
  });

  useEffect(() => {
    const p = getProfile();
    setProfile(p);
    if (!p.name) setTab("settings");
  }, []);

  const handleSaveProfile = (p: BusinessProfile) => {
    saveProfile(p);
    setProfile(p);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-orange-100">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-orange-800">
                MEO勝ち上げくん
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                治療院のMEO対策を完全サポート
              </p>
            </div>
            {profile.name && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">{profile.name}</p>
                <p className="text-xs text-gray-400">{profile.area} / {profile.category}</p>
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
        {tab === "checklist" && <ChecklistTab />}

        {tab === "note" && (
          <ContentGenerator profile={profile} type="note" />
        )}

        {tab === "gbp" && (
          <ContentGenerator profile={profile} type="gbp" />
        )}

        {tab === "llmo" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-2">LLMO（大規模言語モデル最適化）とは？</h2>
              <p className="text-sm text-gray-600 mb-4">
                ChatGPTやGeminiなどのAI検索で「{profile.area || "○○"}でおすすめの{profile.category || "整体院"}は？」と聞かれたときに、
                あなたの院が回答に含まれるようにする対策です。2026年以降、AI検索の利用は20〜30%に拡大すると予測されています。
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
            <ContentGenerator profile={profile} type="structured-data" />
          </div>
        )}

        {tab === "settings" && (
          <SettingsTab profile={profile} onSave={handleSaveProfile} />
        )}
      </main>
    </div>
  );
}
