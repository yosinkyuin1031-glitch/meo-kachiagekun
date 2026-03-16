"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { BusinessProfile, ClinicProfile, GeneratedContent } from "@/lib/types";
import {
  getBusinessProfile,
  getClinics,
  getContents,
  getSettings,
  saveSettings,
  addClinic,
  updateClinic,
  deleteClinic,
} from "@/lib/storage";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import ChecklistTab from "@/components/ChecklistTab";
import ContentGenerator from "@/components/ContentGenerator";
import BulkGenerator from "@/components/BulkGenerator";
import GbpImageGenerator from "@/components/GbpImageGenerator";
import SettingsTab from "@/components/SettingsTab";
import ContentCalendar from "@/components/ContentCalendar";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import RankingChecker from "@/components/RankingChecker";
import TaskManager from "@/components/TaskManager";


type Tab = "dashboard" | "tasks" | "bulk" | "ranking" | "checklist" | "note" | "gbp" | "gbp-image" | "llmo" | "wordpress" | "history" | "calendar" | "analytics" | "settings";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: "概要", icon: "📊" },
  { key: "tasks", label: "タスク管理", icon: "✅" },
  { key: "bulk", label: "一括生成", icon: "⚡" },
  { key: "ranking", label: "順位チェック", icon: "🔍" },
  { key: "checklist", label: "施策リスト", icon: "📋" },
  { key: "note", label: "note記事", icon: "📝" },
  { key: "gbp", label: "GBP投稿", icon: "📍" },
  { key: "gbp-image", label: "GBP画像", icon: "🖼️" },
  { key: "llmo", label: "LLMO対策", icon: "🤖" },
  { key: "wordpress", label: "WP投稿", icon: "📄" },
  { key: "history", label: "履歴", icon: "📜" },
  { key: "calendar", label: "カレンダー", icon: "📅" },
  { key: "analytics", label: "分析", icon: "📈" },
  { key: "settings", label: "設定", icon: "⚙️" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <span className="text-white text-xl font-black">M</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  MEO勝ち上げくん
                </h1>
                <p className="text-xs text-orange-100 mt-0.5">
                  治療院のMEO対策を完全サポート
                </p>
              </div>
            </div>

            {/* 院切り替えボタン */}
            {clinics.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowClinicSwitcher(!showClinicSwitcher)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/25 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-white text-orange-600 flex items-center justify-center text-sm font-bold">
                    {activeClinic?.name?.charAt(0) || "?"}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-medium text-white leading-tight">
                      {activeClinic?.name || "未選択"}
                    </p>
                    <p className="text-xs text-orange-100 leading-tight">
                      {activeClinic?.area}
                      {hasWordPress && " / WP連携済"}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-orange-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="flex gap-1 bg-white rounded-xl p-1.5 shadow-sm overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 py-2 px-2.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                tab === t.key
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <span className="text-sm sm:text-base">{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === "dashboard" && (
          <DashboardTab
            profile={profile}
            activeClinic={activeClinic}
            hasWordPress={hasWordPress}
            onNavigate={setTab}
          />
        )}

        {tab === "tasks" && <TaskManager />}

        {tab === "bulk" && <BulkGenerator profile={profile} />}

        {tab === "ranking" && <RankingChecker profile={profile} />}

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
              <h2 className="text-lg font-bold text-gray-800 mb-2">WordPress投稿</h2>
              <p className="text-sm text-gray-600 mb-4">
                SEO・LLMO最適化されたブログ記事やFAQを生成し、WordPressに投稿できます。
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-700">
                  ブログ記事はWordPressに直接投稿されます。FAQ（よくある質問）やSEO/OGP設定は、WordPressの環境によって自動投稿できない場合があります。その場合はコピー用のデータが表示されます。
                </p>
              </div>
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

        {tab === "history" && <HistoryTab />}

        {tab === "calendar" && <ContentCalendar />}

        {tab === "analytics" && <AnalyticsDashboard />}

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

// ─── 概要ダッシュボードタブ ──────────────────────
const PIE_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#06b6d4", "#ec4899", "#6366f1"];

const TYPE_LABELS: Record<string, string> = {
  blog: "ブログ",
  faq: "FAQ",
  gbp: "GBP投稿",
  note: "note記事",
  "faq-short": "FAQ(短)",
  "blog-seo": "SEO情報",
  "structured-data": "構造化データ",
};

function DashboardTab({
  profile,
  activeClinic,
  hasWordPress,
  onNavigate,
}: {
  profile: BusinessProfile;
  activeClinic: ClinicProfile | undefined;
  hasWordPress: boolean;
  onNavigate: (tab: Tab) => void;
}) {
  const [contents, setContents] = useState<GeneratedContent[]>([]);

  useEffect(() => {
    setContents(getContents());
  }, []);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const c of contents) {
      byType[c.type] = (byType[c.type] || 0) + 1;
    }
    const pieData = Object.entries(byType).map(([type, count]) => ({
      name: TYPE_LABELS[type] || type,
      value: count,
    }));
    const recent = contents.slice(0, 5);
    return {
      total: contents.length,
      noteCount: byType["note"] || 0,
      gbpCount: byType["gbp"] || 0,
      faqCount: (byType["faq"] || 0) + (byType["faq-short"] || 0),
      blogCount: (byType["blog"] || 0) + (byType["blog-seo"] || 0),
      pieData,
      recent,
    };
  }, [contents]);

  const statCards = [
    { label: "note記事", count: stats.noteCount, color: "orange", icon: "📝" },
    { label: "GBP投稿", count: stats.gbpCount, color: "red", icon: "📍" },
    { label: "FAQ", count: stats.faqCount, color: "green", icon: "💬" },
    { label: "ブログ", count: stats.blogCount, color: "blue", icon: "📄" },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  };

  return (
    <div className="space-y-6">
      {/* 院情報サマリ */}
      {activeClinic && (
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {activeClinic.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-800 truncate">{activeClinic.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {activeClinic.area} / {activeClinic.category}
                {activeClinic.ownerName && ` / 院長: ${activeClinic.ownerName}`}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {activeClinic.keywords.slice(0, 5).map((kw) => (
                  <span key={kw} className="text-[11px] px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                    {kw}
                  </span>
                ))}
                {hasWordPress && (
                  <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                    WP連携済
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 生成総数 + クイック統計 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const c = colorMap[card.color];
          return (
            <div
              key={card.label}
              className={`${c.bg} rounded-xl p-4 border ${c.border}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{card.icon}</span>
                <span className={`text-2xl font-bold ${c.text}`}>{card.count}</span>
              </div>
              <p className={`text-xs font-medium ${c.text}`}>{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* 全体統計カード */}
      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-gray-800">コンテンツ生成状況</h3>
          <span className="text-sm text-gray-400">合計 {stats.total} 件</span>
        </div>

        {stats.total === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm mb-4">まだコンテンツが生成されていません</p>
            <button
              onClick={() => onNavigate("bulk")}
              className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
            >
              一括生成を始める
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* 円グラフ */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-gray-400 mb-2">タイプ別内訳</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value}件`, name]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e5e7eb" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {stats.pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className="text-[11px] text-gray-500">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 最近の生成履歴 */}
            <div>
              <p className="text-xs text-gray-400 mb-3">最近の生成</p>
              <div className="space-y-2">
                {stats.recent.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <TypeBadge type={item.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{item.title}</p>
                      <p className="text-[11px] text-gray-400">{item.keyword}</p>
                    </div>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                    </span>
                  </div>
                ))}
              </div>
              {stats.total > 5 && (
                <button
                  onClick={() => onNavigate("history")}
                  className="mt-3 text-xs text-orange-600 font-medium hover:text-orange-700"
                >
                  すべての履歴を見る →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* クイックアクション */}
      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <h3 className="text-base font-bold text-gray-800 mb-4">クイックアクション</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "一括生成", icon: "⚡", tab: "bulk" as Tab, color: "bg-amber-50 text-amber-700 border-amber-200" },
            { label: "note記事", icon: "📝", tab: "note" as Tab, color: "bg-orange-50 text-orange-700 border-orange-200" },
            { label: "GBP投稿", icon: "📍", tab: "gbp" as Tab, color: "bg-red-50 text-red-700 border-red-200" },
            { label: "施策リスト", icon: "📋", tab: "checklist" as Tab, color: "bg-green-50 text-green-700 border-green-200" },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.tab)}
              className={`p-4 rounded-xl border text-center hover:shadow-md transition-all ${action.color}`}
            >
              <span className="text-2xl block mb-1">{action.icon}</span>
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── タイプバッジ共通コンポーネント ─────────────────
function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    blog: { label: "ブログ", cls: "bg-blue-100 text-blue-700" },
    faq: { label: "FAQ", cls: "bg-green-100 text-green-700" },
    gbp: { label: "GBP", cls: "bg-red-100 text-red-700" },
    note: { label: "note", cls: "bg-orange-100 text-orange-700" },
    "faq-short": { label: "FAQ短", cls: "bg-teal-100 text-teal-700" },
    "blog-seo": { label: "SEO", cls: "bg-purple-100 text-purple-700" },
    "structured-data": { label: "構造化", cls: "bg-indigo-100 text-indigo-700" },
  };
  const info = map[type] || { label: type, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${info.cls}`}>
      {info.label}
    </span>
  );
}

// ─── 履歴タブ（インライン）──────────────────────
function HistoryTab() {
  const [items, setItems] = useState<GeneratedContent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setItems(getContents());
  }, []);

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">生成コンテンツ履歴</h2>

        {/* Filter buttons */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: "all", label: "すべて" },
            { key: "blog", label: "ブログ" },
            { key: "faq", label: "FAQ" },
            { key: "gbp", label: "GBP" },
            { key: "note", label: "note" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-orange-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 mb-3">{filtered.length}件</p>

        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">履歴がありません</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <TypeBadge type={item.type} />
                  <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                    {item.keyword}
                  </span>
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                    {item.title}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                      expandedId === item.id ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Preview text (collapsed) */}
                {expandedId !== item.id && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {item.content.replace(/<[^>]*>/g, "").slice(0, 150)}...
                    </p>
                  </div>
                )}

                {/* Expanded content */}
                {expandedId === item.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 mt-3 mb-3">
                      <button
                        onClick={() => handleCopy(item.id, item.content)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          copiedId === item.id
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {copiedId === item.id ? "コピー完了" : "コピー"}
                      </button>
                      {item.wpPostUrl && (
                        <a
                          href={item.wpPostUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
                        >
                          WordPress記事を見る
                        </a>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                        {item.content}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
