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
  deleteContent,
  getRankingHistory,
} from "@/lib/supabase-storage";
import { RankingHistory } from "@/lib/ranking-types";
import { useAuth } from "@/contexts/AuthContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import BulkGenerator from "@/components/BulkGenerator";
import ContentGenerator from "@/components/ContentGenerator";
import GbpImageGenerator from "@/components/GbpImageGenerator";
import SettingsTab from "@/components/SettingsTab";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import RankingChecker from "@/components/RankingChecker";
import SearchConsolePanel from "@/components/SearchConsolePanel";
import ChecklistTab from "@/components/ChecklistTab";
import ReviewReplyGenerator from "@/components/ReviewReplyGenerator";
import LocalDataMigration, { hasLocalData } from "@/components/LocalDataMigration";
import WeeklyReminder from "@/components/WeeklyReminder";
import PlanTab from "@/components/PlanTab";

type Tab = "dashboard" | "bulk" | "checklist" | "ranking" | "history" | "plan" | "settings";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: "ダッシュボード", icon: "📊" },
  { key: "bulk", label: "コンテンツ生成", icon: "⚡" },
  { key: "checklist", label: "施策チェック", icon: "✅" },
  { key: "ranking", label: "順位チェック", icon: "🔍" },
  { key: "history", label: "履歴", icon: "📜" },
  { key: "plan", label: "プラン", icon: "💎" },
  { key: "settings", label: "設定", icon: "⚙️" },
];

type ContentSubTab = "bulk" | "faq" | "blog" | "gbp" | "image" | "note" | "review";

const CONTENT_SUB_TABS: { key: ContentSubTab; label: string; icon: string }[] = [
  { key: "bulk", label: "一括生成", icon: "⚡" },
  { key: "faq", label: "よくある質問", icon: "💬" },
  { key: "blog", label: "ブログ記事", icon: "📄" },
  { key: "gbp", label: "GBP投稿", icon: "📍" },
  { key: "review", label: "口コミ返信", icon: "⭐" },
  { key: "image", label: "画像生成", icon: "🖼️" },
  { key: "note", label: "note記事", icon: "📝" },
];

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [contentSubTab, setContentSubTab] = useState<ContentSubTab>("bulk");
  const [regenerateKeyword, setRegenerateKeyword] = useState("");
  const [profile, setProfile] = useState<BusinessProfile>({
    name: "", area: "", keywords: [], description: "", category: "整体院", anthropicKey: "",
  });
  const [clinics, setClinics] = useState<ClinicProfile[]>([]);
  const [activeClinicId, setActiveClinicId] = useState("");
  const [showClinicSwitcher, setShowClinicSwitcher] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [showMigration, setShowMigration] = useState(false);

  const refreshState = useCallback(async () => {
    try {
      const [p, cls, s] = await Promise.all([
        getBusinessProfile(),
        getClinics(),
        getSettings(),
      ]);
      setProfile(p);
      setClinics(cls);
      setActiveClinicId(s.activeClinicId || cls[0]?.id || "");
    } catch {
      // 未認証時
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      await refreshState();
      const cls = await getClinics();
      if (cls.length === 0) setTab("settings");
      setDataLoading(false);
      // Check for local data to migrate
      if (hasLocalData() && localStorage.getItem("meo_migrated_to_supabase") !== "true") {
        setShowMigration(true);
      }
    })();
  }, [refreshState, user]);

  const switchClinic = async (clinicId: string) => {
    const settings = await getSettings();
    settings.activeClinicId = clinicId;
    await saveSettings(settings);
    setActiveClinicId(clinicId);
    const p = await getBusinessProfile();
    setProfile(p);
    setShowClinicSwitcher(false);
  };

  const handleAddClinic = async (clinic: ClinicProfile) => {
    await addClinic(clinic);
    await switchClinic(clinic.id);
    await refreshState();
  };

  const handleUpdateClinic = async (id: string, updates: Partial<ClinicProfile>) => {
    await updateClinic(id, updates);
    await refreshState();
  };

  const handleDeleteClinic = async (id: string) => {
    await deleteClinic(id);
    const remaining = await getClinics();
    if (remaining.length > 0) {
      await switchClinic(remaining[0].id);
    }
    await refreshState();
  };

  const handleSaveApiKey = async (key: string) => {
    const settings = await getSettings();
    settings.anthropicKey = key;
    await saveSettings(settings);
    await refreshState();
  };

  const handleKeywordsImport = async (newKeywords: string[]) => {
    const clinic = clinics.find((c) => c.id === activeClinicId);
    if (!clinic) return;
    const existing = new Set(clinic.keywords.map((k) => k.toLowerCase()));
    const unique = newKeywords.filter((k) => !existing.has(k.toLowerCase()));
    if (unique.length === 0) return;
    const updated = [...clinic.keywords, ...unique];
    await updateClinic(clinic.id, { keywords: updated });
    await refreshState();
  };

  const hasWordPress = !!(
    profile.wordpress?.siteUrl &&
    profile.wordpress?.username &&
    profile.wordpress?.appPassword
  );

  const activeClinic = clinics.find((c) => c.id === activeClinicId);

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
        {/* Skeleton header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-blue-800 shadow-lg border-b border-slate-600/20">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl animate-pulse" />
                <div>
                  <div className="h-6 w-40 bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-56 bg-white/5 rounded animate-pulse mt-1.5" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-32 bg-white/10 rounded-lg animate-pulse" />
                <div className="h-8 w-20 bg-white/10 rounded-lg animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        {/* Skeleton tabs */}
        <div className="max-w-5xl mx-auto px-4 pt-4 hidden md:block">
          <div className="flex gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 flex-1 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        {/* Skeleton content cards */}
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
                <div className="flex gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100 animate-pulse">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-gray-200 rounded" />
                  <div className="w-8 h-8 bg-gray-200 rounded" />
                </div>
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100 space-y-4">
            <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
      {showMigration && (
        <LocalDataMigration onComplete={() => { setShowMigration(false); refreshState(); }} />
      )}
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-slate-800 via-slate-700 to-blue-800 shadow-lg border-b border-slate-600/20">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-blue-400/30">
                <span className="text-blue-300 text-xl font-black">M</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  MEO勝ち上げくん
                </h1>
                <p className="text-xs text-blue-200/80 mt-0.5">
                  MEO + LLMO コンテンツ一括生成 for Business
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 院切り替えボタン */}
              {clinics.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowClinicSwitcher(!showClinicSwitcher)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-lg hover:bg-white/20 transition-colors"
                    aria-label="院を切り替え"
                    aria-expanded={showClinicSwitcher}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                      {activeClinic?.name?.charAt(0) || "?"}
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-sm font-medium text-white leading-tight">
                        {activeClinic?.name || "未選択"}
                      </p>
                      <p className="text-xs text-blue-200/70 leading-tight">
                        {activeClinic?.area}
                        {hasWordPress && " / WP連携済"}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-blue-200/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                  ? "bg-blue-50 border border-blue-200"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                c.id === activeClinicId
                                  ? "bg-blue-600 text-white"
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
                                <span className="text-blue-600 text-xs font-medium">使用中</span>
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

              {/* ログアウトボタン */}
              <button
                onClick={signOut}
                className="px-3 py-2 text-xs text-blue-200/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="ログアウト"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 週次リマインドバナー */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <WeeklyReminder />
      </div>

      {/* タブ（PC版：md以上で表示） */}
      <div className="max-w-5xl mx-auto px-4 pt-4 hidden md:block">
        <nav aria-label="メインナビゲーション" className="flex gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              role="tab"
              aria-selected={tab === t.key}
              aria-label={`${t.label}タブ`}
              className={`flex items-center gap-1.5 py-2.5 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                tab === t.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <span className="text-base" aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* クリニック未登録時のガイドメッセージ */}
      {clinics.length === 0 && tab !== "settings" && (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">🏥</div>
            <h3 className="text-base font-bold text-amber-800 mb-2">診療所情報が未登録です</h3>
            <p className="text-sm text-amber-700 mb-4">
              まず診療所情報を登録してください。院名・エリア・キーワードを設定すると、コンテンツ生成や順位チェックが使えるようになります。
            </p>
            <button
              onClick={() => setTab("settings")}
              className="px-6 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              設定画面で登録する
            </button>
          </div>
        </div>
      )}

      {/* コンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6" role="main" aria-label="メインコンテンツ">
        {tab === "dashboard" && (
          <div className="space-y-8">
            <DashboardTab
              profile={profile}
              activeClinic={activeClinic}
              hasWordPress={hasWordPress}
              onNavigate={setTab}
              onRegenerateKeyword={(kw) => {
                setRegenerateKeyword(kw);
                setContentSubTab("bulk");
                setTab("bulk");
              }}
            />
            <AnalyticsDashboard />
          </div>
        )}

        {tab === "bulk" && (
          <div className="space-y-4">
            <div className="flex gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
              {CONTENT_SUB_TABS.map((st) => (
                <button
                  key={st.key}
                  onClick={() => setContentSubTab(st.key)}
                  className={`flex items-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    contentSubTab === st.key
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  <span>{st.icon}</span>
                  <span>{st.label}</span>
                </button>
              ))}
            </div>

            <div style={{ display: contentSubTab === "bulk" ? "block" : "none" }}>
              <BulkGenerator profile={profile} initialKeyword={regenerateKeyword} onKeywordConsumed={() => setRegenerateKeyword("")} />
            </div>
            {contentSubTab === "faq" && <ContentGenerator profile={profile} type="faq" />}
            {contentSubTab === "blog" && <ContentGenerator profile={profile} type="blog" />}
            {contentSubTab === "gbp" && <ContentGenerator profile={profile} type="gbp" />}
            {contentSubTab === "review" && <ReviewReplyGenerator profile={profile} />}
            {contentSubTab === "image" && <GbpImageGenerator profile={profile} />}
            {contentSubTab === "note" && <ContentGenerator profile={profile} type="note" />}
          </div>
        )}

        {tab === "checklist" && <ChecklistTab />}

        {tab === "ranking" && (
          <div className="space-y-8">
            <SearchConsolePanel profile={profile} onKeywordsImport={handleKeywordsImport} />
            <RankingChecker
              profile={profile}
              onRegenerateKeyword={(kw) => {
                setRegenerateKeyword(kw);
                setContentSubTab("bulk");
                setTab("bulk");
              }}
            />
          </div>
        )}

        {tab === "history" && <HistoryTab onNavigate={setTab} />}

        {tab === "plan" && <PlanTab />}

        {tab === "settings" && (
          <SettingsTab
            clinics={clinics}
            activeClinicId={activeClinicId}
            anthropicKey={profile.anthropicKey}
            onAddClinic={handleAddClinic}
            onUpdateClinic={handleUpdateClinic}
            onDeleteClinic={handleDeleteClinic}
            onSwitchClinic={switchClinic}
            onSaveApiKey={handleSaveApiKey}
          />
        )}
      </main>

      {/* モバイル用ボトムナビゲーション（md未満で表示） */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] md:hidden" aria-label="モバイルナビゲーション">
        <div className="grid grid-cols-7 h-[68px]" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              role="tab"
              aria-selected={tab === t.key}
              aria-label={`${t.label}タブ`}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                tab === t.key
                  ? "text-blue-600"
                  : "text-gray-400"
              }`}
            >
              <span className={`text-xl leading-none ${tab === t.key ? "scale-110" : ""} transition-transform`} aria-hidden="true">{t.icon}</span>
              <span className={`text-[10px] font-medium leading-tight ${
                tab === t.key ? "text-blue-600" : "text-gray-400"
              }`}>{t.label}</span>
            </button>
          ))}
        </div>
        {/* セーフエリア対応（iPhoneのホームバー） */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}

// ─── 概要ダッシュボードタブ ──────────────────────
const PIE_COLORS = ["#3b82f6", "#6366f1", "#10b981", "#0ea5e9", "#8b5cf6", "#14b8a6", "#475569"];

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
  onRegenerateKeyword,
}: {
  profile: BusinessProfile;
  activeClinic: ClinicProfile | undefined;
  hasWordPress: boolean;
  onNavigate: (tab: Tab) => void;
  onRegenerateKeyword?: (keyword: string) => void;
}) {
  const [contents, setContents] = useState<GeneratedContent[]>([]);
  const [rankingHistory, setRankingHistory] = useState<RankingHistory[]>([]);

  useEffect(() => {
    getContents().then(setContents);
    getRankingHistory().then(setRankingHistory);
  }, []);

  // 順位低下キーワード計算
  const declinedKeywords = useMemo(() => {
    if (!profile.keywords || profile.keywords.length === 0) return [];
    const declined: { keyword: string; previousRank: number; latestRank: number | null; diff: number }[] = [];
    for (const kw of profile.keywords) {
      const kwHistory = rankingHistory
        .filter((h) => h.keyword === kw)
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
      if (kwHistory.length < 2) continue;
      const latest = kwHistory[0];
      const latestDateStr = new Date(latest.checkedAt).toLocaleDateString("ja-JP");
      const previous = kwHistory.find((h) => new Date(h.checkedAt).toLocaleDateString("ja-JP") !== latestDateStr);
      if (!previous || previous.rank === null || latest.rank === null) continue;
      const diff = previous.rank - latest.rank; // positive = improvement
      if (diff <= -3) {
        declined.push({ keyword: kw, previousRank: previous.rank, latestRank: latest.rank, diff: Math.abs(diff) });
      }
    }
    return declined;
  }, [profile.keywords, rankingHistory]);

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
    { label: "note記事", count: stats.noteCount, color: "slate", icon: "📝" },
    { label: "GBP投稿", count: stats.gbpCount, color: "blue", icon: "📍" },
    { label: "FAQ", count: stats.faqCount, color: "emerald", icon: "💬" },
    { label: "ブログ", count: stats.blogCount, color: "indigo", icon: "📄" },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    slate: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  };

  // 初回ユーザー向けセットアップ状態
  const setupSteps = useMemo(() => {
    if (!activeClinic) return null;
    const steps = [
      { label: "院情報を登録", done: !!activeClinic.name, action: "settings" as Tab },
      { label: "キーワードを設定", done: activeClinic.keywords.length > 0, action: "settings" as Tab },
      { label: "コンテンツを生成", done: stats.total > 0, action: "bulk" as Tab },
    ];
    const allDone = steps.every(s => s.done);
    return allDone ? null : steps;
  }, [activeClinic, stats.total]);

  return (
    <div className="space-y-6">
      {/* 初回セットアップガイド */}
      {setupSteps && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
          <h3 className="text-base font-bold text-blue-800 mb-1">はじめてのセットアップ</h3>
          <p className="text-xs text-blue-600 mb-4">以下の手順を順番に進めてください。10分程度で完了します。</p>
          <div className="space-y-2">
            {setupSteps.map((step, i) => (
              <button
                key={i}
                onClick={() => onNavigate(step.action)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                  step.done
                    ? "bg-white/60 border border-green-200"
                    : "bg-white border border-blue-200 hover:border-blue-400 shadow-sm"
                }`}
              >
                {step.done ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-blue-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blue-500">{i + 1}</span>
                  </div>
                )}
                <span className={`text-sm font-medium ${step.done ? "text-green-700 line-through" : "text-gray-800"}`}>
                  {step.label}
                </span>
                {!step.done && (
                  <span className="ml-auto text-xs text-blue-500 font-medium">設定へ →</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 順位低下アラート */}
      {declinedKeywords.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-500 font-bold text-lg">&#9660;</span>
            <h3 className="text-sm font-bold text-red-800">
              {declinedKeywords.length}個のキーワードで順位が下がっています
            </h3>
          </div>
          <div className="space-y-2">
            {declinedKeywords.map((d) => (
              <div key={d.keyword} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-red-100">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-800">{d.keyword}</span>
                  <span className="text-xs text-red-600 font-bold">
                    {d.previousRank}位 → {d.latestRank !== null ? `${d.latestRank}位` : "圏外"}（{d.diff}位低下）
                  </span>
                </div>
                {onRegenerateKeyword && (
                  <button
                    onClick={() => onRegenerateKeyword(d.keyword)}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                  >
                    再生成
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeClinic && (
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
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
                  <span key={kw} className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const c = colorMap[card.color];
          return (
            <div key={card.label} className={`${c.bg} rounded-xl p-4 border ${c.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{card.icon}</span>
                <span className={`text-2xl font-bold ${c.text}`}>{card.count}</span>
              </div>
              <p className={`text-xs font-medium ${c.text}`}>{card.label}</p>
            </div>
          );
        })}
      </div>

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
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              コンテンツ生成を始める
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="flex flex-col items-center">
              <p className="text-xs text-gray-400 mb-2">タイプ別内訳</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">
                    {stats.pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}件`, name]} contentStyle={{ borderRadius: "8px", fontSize: "12px", border: "1px solid #e5e7eb" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {stats.pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="text-[11px] text-gray-500">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-3">最近の生成</p>
              <div className="space-y-2">
                {stats.recent.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
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
                <button onClick={() => onNavigate("history")} className="mt-3 text-xs text-blue-600 font-medium hover:text-blue-700">
                  すべての履歴を見る →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <h3 className="text-base font-bold text-gray-800 mb-4">クイックアクション</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "コンテンツ生成", icon: "⚡", tab: "bulk" as Tab, color: "bg-blue-50 text-blue-700 border-blue-200" },
            { label: "順位チェック", icon: "🔍", tab: "ranking" as Tab, color: "bg-slate-50 text-slate-700 border-slate-200" },
            { label: "生成履歴", icon: "📜", tab: "history" as Tab, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
          ].map((action) => (
            <button key={action.label} onClick={() => onNavigate(action.tab)} className={`p-4 rounded-xl border text-center hover:shadow-md transition-all ${action.color}`}>
              <span className="text-2xl block mb-1">{action.icon}</span>
              <span className="text-xs font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    blog: { label: "ブログ", cls: "bg-blue-100 text-blue-700" },
    faq: { label: "FAQ", cls: "bg-green-100 text-green-700" },
    gbp: { label: "GBP", cls: "bg-red-100 text-red-700" },
    note: { label: "note", cls: "bg-orange-100 text-orange-700" },
    "faq-short": { label: "FAQ短", cls: "bg-teal-100 text-teal-700" },
    "blog-seo": { label: "SEO", cls: "bg-purple-100 text-purple-700" },
    "structured-data": { label: "構造化", cls: "bg-indigo-100 text-indigo-700" },
    "review-reply": { label: "口コミ返信", cls: "bg-yellow-100 text-yellow-700" },
  };
  const info = map[type] || { label: type, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${info.cls}`}>
      {info.label}
    </span>
  );
}

function HistoryTab({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [items, setItems] = useState<GeneratedContent[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getContents().then(setItems);
  }, []);

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteContent = async (id: string) => {
    await deleteContent(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setDeletingId(null);
    setExpandedId(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">生成コンテンツ履歴</h2>

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
                filter === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400 mb-3">{filtered.length}件</p>

        {filtered.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-500 text-sm mb-4">コンテンツを生成するとここに表示されます</p>
            <button
              onClick={() => onNavigate("bulk")}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              最初のコンテンツを生成する
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <TypeBadge type={item.type} />
                  <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{item.keyword}</span>
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{item.title}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{new Date(item.createdAt).toLocaleDateString("ja-JP")}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expandedId === item.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedId !== item.id && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {item.content.replace(/<[^>]*>/g, "").slice(0, 150)}...
                    </p>
                  </div>
                )}

                {expandedId === item.id && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 mt-3 mb-3">
                      <button
                        onClick={() => handleCopy(item.id, item.content)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          copiedId === item.id ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {copiedId === item.id ? "コピー完了" : "コピー"}
                      </button>
                      {item.wpPostUrl && (
                        <a href={item.wpPostUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200">
                          WordPress記事を見る
                        </a>
                      )}
                      <button
                        onClick={() => setDeletingId(item.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors ml-auto"
                      >
                        削除
                      </button>
                    </div>
                    {deletingId === item.id && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3 animate-in fade-in duration-200">
                        <p className="text-sm text-red-700 flex-1">このコンテンツを削除しますか？この操作は取り消せません。</p>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-200"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={() => handleDeleteContent(item.id)}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
                        >
                          削除する
                        </button>
                      </div>
                    )}
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
