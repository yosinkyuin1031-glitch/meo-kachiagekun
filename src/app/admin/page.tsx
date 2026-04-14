"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

// ===== 型定義 =====
interface BusinessSearchResult {
  title: string;
  address?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  phone?: string;
}

interface SetupResult {
  success: boolean;
  email: string;
  businessName: string;
  area: string;
  keywords: string[];
  message: string;
}

interface CustomerClinic {
  id: string;
  name: string;
  area: string;
  category: string;
  keywords: string[];
  strengths: string;
  specialty: string;
  experience: string;
  urls: Record<string, string>;
}

interface Customer {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  clinic: CustomerClinic | null;
  stats: {
    monthlyChecks: number;
    totalChecks: number;
    totalContents: number;
    lastCheckAt: string | null;
  };
}

interface Application {
  id: string;
  clinic_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  homepage: string;
  wordpress: string;
  note_url: string;
  message: string;
  status: string;
  created_at: string;
}

interface UsageStats {
  monthlyApiCalls: number;
  estimatedCost: number;
  totalUsers: number;
  totalContents: number;
  totalRankings: number;
  pendingApplications: number;
}

const ADMIN_EMAILS = ["ooguchiyouhei@gmail.com"];
type Tab = "dashboard" | "customers" | "applications" | "setup";

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  // ダッシュボード
  const [usage, setUsage] = useState<UsageStats | null>(null);

  // 顧客一覧
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
  const [editKeywords, setEditKeywords] = useState("");

  // 申込み一覧
  const [applications, setApplications] = useState<Application[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  // 新規顧客セットアップ
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BusinessSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessSearchResult | null>(null);
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupArea, setSetupArea] = useState("");
  const [setupCategory, setSetupCategory] = useState("整体院");
  const [settingUp, setSettingUp] = useState(false);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [setupError, setSetupError] = useState("");

  // ===== データ取得 =====
  const fetchUsage = useCallback(async () => {
    const res = await fetch("/api/admin/usage");
    if (res.ok) setUsage(await res.json());
  }, []);

  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    const res = await fetch("/api/admin/customers");
    if (res.ok) {
      const data = await res.json();
      setCustomers(data.customers || []);
    }
    setCustomersLoading(false);
  }, []);

  const fetchApplications = useCallback(async () => {
    setAppsLoading(true);
    const res = await fetch("/api/admin/applications");
    if (res.ok) {
      const data = await res.json();
      setApplications(data.applications || []);
    }
    setAppsLoading(false);
  }, []);

  // ===== 管理者チェック =====
  useEffect(() => {
    if (authLoading) return;
    if (!user) { window.location.href = "/login"; return; }
    if (ADMIN_EMAILS.includes(user.email || "")) setIsAdmin(true);
    setChecking(false);
  }, [user, authLoading]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsage();
  }, [isAdmin, fetchUsage]);

  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "customers") fetchCustomers();
    if (activeTab === "applications") fetchApplications();
  }, [isAdmin, activeTab, fetchCustomers, fetchApplications]);

  // ===== セットアップハンドラー =====
  const handleSearchBusiness = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSelectedBusiness(null);
    setSetupError("");
    try {
      const res = await fetch("/api/admin/search-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      if (!res.ok) { setSetupError(data.error || "検索に失敗しました"); return; }
      setSearchResults(data.results || []);
    } catch { setSetupError("検索に失敗しました"); }
    finally { setSearching(false); }
  };

  const handleSelectBusiness = (biz: BusinessSearchResult) => {
    setSelectedBusiness(biz);
    const addr = biz.address || "";
    const areaMatch = addr.match(/(東京都|北海道|(?:大阪|京都)府|.+?県)?\s*(.+?[市区町村])/);
    if (areaMatch) setSetupArea(areaMatch[2] || areaMatch[0]);
    const name = biz.title || "";
    if (name.includes("鍼灸")) setSetupCategory("鍼灸院");
    else if (name.includes("接骨")) setSetupCategory("接骨院");
    else if (name.includes("治療")) setSetupCategory("治療院");
    else setSetupCategory("整体院");
    setSetupPassword(generatePassword());
  };

  const handleSetupCustomer = async () => {
    if (!selectedBusiness || !setupEmail || !setupPassword || !setupArea) {
      setSetupError("全ての項目を入力してください");
      return;
    }
    setSettingUp(true);
    setSetupError("");
    setSetupResult(null);
    try {
      const res = await fetch("/api/admin/setup-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: setupEmail,
          password: setupPassword,
          businessName: selectedBusiness.title,
          address: selectedBusiness.address,
          area: setupArea,
          category: setupCategory,
          website: selectedBusiness.website,
          phone: selectedBusiness.phone,
          rating: selectedBusiness.rating,
          reviews: selectedBusiness.reviews,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSetupError(data.error || "セットアップに失敗しました"); return; }
      setSetupResult(data);
    } catch { setSetupError("セットアップに失敗しました"); }
    finally { setSettingUp(false); }
  };

  // ===== 申込みステータス更新 =====
  const handleAppStatus = async (id: string, status: string) => {
    await fetch("/api/admin/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchApplications();
  };

  // ===== キーワード編集 =====
  const handleSaveKeywords = async (clinicId: string) => {
    const keywords = editKeywords.split(/[,、\n]/).map(k => k.trim()).filter(Boolean);
    await fetch("/api/admin/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, updates: { keywords } }),
    });
    setEditingClinicId(null);
    fetchCustomers();
  };

  // ===== ローディング・権限チェック =====
  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-sm border p-8 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">アクセス権限がありません</h2>
          <a href="/" className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            ダッシュボードに戻る
          </a>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "dashboard", label: "ダッシュボード" },
    { id: "customers", label: "顧客一覧", badge: customers.length || undefined },
    { id: "applications", label: "申込み", badge: applications.filter(a => a.status === "pending").length || undefined },
    { id: "setup", label: "新規セットアップ" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-900 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-400/30">
                <svg className="w-5 h-5 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">管理画面</h1>
                <p className="text-xs text-red-200/80">MEO勝ち上げくん v2</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href="/" className="px-3 py-2 text-xs text-blue-200/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                アプリへ
              </a>
              <button onClick={signOut} className="px-3 py-2 text-xs text-red-200/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* タブナビ */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-red-500 text-red-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* ===== ダッシュボード ===== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: "登録顧客数", value: usage?.totalUsers ?? "-", sub: "院", color: "blue" },
                { label: "今月のAPI使用量", value: usage?.monthlyApiCalls ?? "-", sub: "回", color: "purple" },
                { label: "推定コスト", value: usage ? `${usage.estimatedCost}円` : "-", sub: "今月", color: "amber" },
                { label: "生成コンテンツ", value: usage?.totalContents ?? "-", sub: "累計", color: "emerald" },
                { label: "順位チェック", value: usage?.totalRankings ?? "-", sub: "累計", color: "indigo" },
                { label: "未対応申込み", value: usage?.pendingApplications ?? "-", sub: "件", color: "red" },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl shadow-sm border p-5">
                  <p className="text-xs text-gray-400 font-medium mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* コスト目安 */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">SerpApi コスト目安</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>1回の順位チェック = キーワード数 x 1クレジット（約1.5円/回）</p>
                <p>月4回制限 x 10キーワード x {usage?.totalUsers || 0}顧客 = 最大 {(usage?.totalUsers || 0) * 40}回/月</p>
                <p className="font-medium text-gray-800">
                  最大月額: 約{(usage?.totalUsers || 0) * 40 * 1.5}円
                  （Developerプラン $50/月 = 5,000回まで）
                </p>
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>使用量</span>
                    <span>{usage?.monthlyApiCalls || 0} / 5,000</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(((usage?.monthlyApiCalls || 0) / 5000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== 顧客一覧 ===== */}
        {activeTab === "customers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">顧客一覧</h2>
              <button
                onClick={fetchCustomers}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                更新
              </button>
            </div>

            {customersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl border p-6 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/3" /></div>)}
              </div>
            ) : customers.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
                顧客がまだ登録されていません
              </div>
            ) : (
              <div className="space-y-3">
                {customers.map(c => (
                  <div key={c.id} className="bg-white rounded-xl shadow-sm border p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-800">
                            {c.clinic?.name || "未設定"}
                          </h3>
                          {c.clinic?.category && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              {c.clinic.category}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{c.email}</p>
                        {c.clinic?.area && (
                          <p className="text-xs text-gray-400 mt-0.5">エリア: {c.clinic.area}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-gray-400 space-y-1">
                        <p>登録: {new Date(c.created_at).toLocaleDateString("ja-JP")}</p>
                        <p>最終ログイン: {c.last_sign_in_at ? new Date(c.last_sign_in_at).toLocaleDateString("ja-JP") : "-"}</p>
                      </div>
                    </div>

                    {/* 利用統計 */}
                    <div className="mt-3 flex gap-4 text-xs">
                      <div className="px-3 py-1.5 bg-purple-50 rounded-lg">
                        <span className="text-purple-500">今月チェック</span>
                        <span className="ml-1 font-bold text-purple-700">{c.stats.monthlyChecks}/4</span>
                      </div>
                      <div className="px-3 py-1.5 bg-emerald-50 rounded-lg">
                        <span className="text-emerald-500">コンテンツ</span>
                        <span className="ml-1 font-bold text-emerald-700">{c.stats.totalContents}</span>
                      </div>
                      <div className="px-3 py-1.5 bg-gray-50 rounded-lg">
                        <span className="text-gray-500">最終チェック</span>
                        <span className="ml-1 font-medium text-gray-700">
                          {c.stats.lastCheckAt ? new Date(c.stats.lastCheckAt).toLocaleDateString("ja-JP") : "-"}
                        </span>
                      </div>
                    </div>

                    {/* 設定状況 */}
                    {c.clinic && (
                      <div className="mt-3 border-t pt-3">
                        <div className="flex gap-2 flex-wrap text-xs">
                          <span className={`px-2 py-1 rounded ${c.clinic.strengths ? "bg-green-100 text-green-700" : "bg-red-50 text-red-500"}`}>
                            {c.clinic.strengths ? "強み設定済" : "強み未設定"}
                          </span>
                          <span className={`px-2 py-1 rounded ${c.clinic.specialty ? "bg-green-100 text-green-700" : "bg-red-50 text-red-500"}`}>
                            {c.clinic.specialty ? "専門設定済" : "専門未設定"}
                          </span>
                          <span className={`px-2 py-1 rounded ${c.clinic.experience ? "bg-green-100 text-green-700" : "bg-red-50 text-red-500"}`}>
                            {c.clinic.experience ? "経歴設定済" : "経歴未設定"}
                          </span>
                          <span className={`px-2 py-1 rounded ${c.clinic.urls?.homepage ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {c.clinic.urls?.homepage ? "HP有" : "HP未設定"}
                          </span>
                        </div>

                        {/* キーワード */}
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-500">キーワード ({c.clinic.keywords.length})</span>
                            <button
                              onClick={() => {
                                if (editingClinicId === c.clinic!.id) {
                                  setEditingClinicId(null);
                                } else {
                                  setEditingClinicId(c.clinic!.id);
                                  setEditKeywords(c.clinic!.keywords.join("、"));
                                }
                              }}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              {editingClinicId === c.clinic.id ? "キャンセル" : "編集"}
                            </button>
                          </div>
                          {editingClinicId === c.clinic.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editKeywords}
                                onChange={(e) => setEditKeywords(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                rows={2}
                                placeholder="キーワードをカンマ区切りで入力"
                              />
                              <button
                                onClick={() => handleSaveKeywords(c.clinic!.id)}
                                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                              >
                                保存
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {c.clinic.keywords.map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 申込み一覧 ===== */}
        {activeTab === "applications" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">申込み一覧</h2>
              <button
                onClick={fetchApplications}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                更新
              </button>
            </div>

            {appsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="bg-white rounded-xl border p-6 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/3" /></div>)}
              </div>
            ) : applications.length === 0 ? (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
                申込みはまだありません
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map(app => (
                  <div key={app.id} className={`bg-white rounded-xl shadow-sm border p-5 ${app.status === "pending" ? "border-l-4 border-l-amber-400" : ""}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-800">{app.clinic_name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            app.status === "pending" ? "bg-amber-100 text-amber-700" :
                            app.status === "approved" ? "bg-green-100 text-green-700" :
                            app.status === "completed" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {app.status === "pending" ? "未対応" :
                             app.status === "approved" ? "承認済" :
                             app.status === "completed" ? "セットアップ完了" :
                             app.status}
                          </span>
                        </div>
                        {app.owner_name && <p className="text-sm text-gray-600">代表: {app.owner_name}</p>}
                        <p className="text-sm text-gray-500">{app.email}</p>
                        {app.phone && <p className="text-xs text-gray-400">{app.phone}</p>}
                        <p className="text-xs text-gray-400 mt-1">{app.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {new Date(app.created_at).toLocaleDateString("ja-JP")}
                        </p>
                      </div>
                    </div>

                    {/* 追加情報 */}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {app.homepage && (
                        <a href={app.homepage} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                          HP
                        </a>
                      )}
                      {app.note_url && (
                        <a href={app.note_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">
                          note
                        </a>
                      )}
                    </div>

                    {app.message && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                        {app.message}
                      </div>
                    )}

                    {/* アクションボタン */}
                    {app.status === "pending" && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleAppStatus(app.id, "approved")}
                          className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => {
                            handleAppStatus(app.id, "approved");
                            setActiveTab("setup");
                            setSearchQuery(app.clinic_name + " " + app.address.split("市")[0] + "市");
                            setSetupEmail(app.email);
                          }}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                        >
                          承認してセットアップへ
                        </button>
                      </div>
                    )}
                    {app.status === "approved" && (
                      <div className="mt-3">
                        <button
                          onClick={() => {
                            setActiveTab("setup");
                            setSearchQuery(app.clinic_name + " " + app.address.split("市")[0] + "市");
                            setSetupEmail(app.email);
                          }}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                        >
                          セットアップへ進む
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== 新規セットアップ ===== */}
        {activeTab === "setup" && (
          <div className="max-w-3xl space-y-6">
            <h2 className="text-lg font-bold text-gray-800">新規顧客セットアップ</h2>

            {/* STEP 1: 院名検索 */}
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">STEP 1: Google Mapsで院を検索</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchBusiness()}
                  placeholder="院名を入力（例：○○整体院 大阪）"
                  className="flex-1 px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearchBusiness}
                  disabled={searching}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {searching ? "検索中..." : "検索"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {searchResults.slice(0, 5).map((biz, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectBusiness(biz)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedBusiness?.title === biz.title
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium text-gray-800">{biz.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{biz.address}</div>
                      <div className="flex gap-3 mt-1">
                        {biz.rating && <span className="text-xs text-amber-600">★ {biz.rating}</span>}
                        {biz.reviews && <span className="text-xs text-gray-400">口コミ {biz.reviews}件</span>}
                        {biz.website && <span className="text-xs text-blue-500">HP有</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 2: アカウント情報入力 */}
            {selectedBusiness && (
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-3">STEP 2: アカウント情報</h3>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                  <div className="text-sm font-bold text-blue-800">{selectedBusiness.title}</div>
                  <div className="text-xs text-blue-600">{selectedBusiness.address}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">メールアドレス</label>
                    <input
                      type="email"
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      placeholder="customer@example.com"
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">パスワード</label>
                    <input
                      type="text"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">エリア</label>
                    <input
                      type="text"
                      value={setupArea}
                      onChange={(e) => setSetupArea(e.target.value)}
                      placeholder="例：大阪市北区"
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">業種</label>
                    <select
                      value={setupCategory}
                      onChange={(e) => setSetupCategory(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="整体院">整体院</option>
                      <option value="鍼灸院">鍼灸院</option>
                      <option value="接骨院">接骨院</option>
                      <option value="治療院">治療院</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleSetupCustomer}
                  disabled={settingUp}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-300 transition-all shadow-md"
                >
                  {settingUp ? "セットアップ中..." : "アカウント作成 + 院情報セットアップ"}
                </button>
              </div>
            )}

            {/* エラー */}
            {setupError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{setupError}</p>
              </div>
            )}

            {/* 完了 */}
            {setupResult && (
              <div className="bg-white rounded-xl shadow-sm border border-green-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-green-800">セットアップ完了</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-[80px_1fr] gap-1">
                    <span className="text-gray-500">院名</span>
                    <span className="font-medium">{setupResult.businessName}</span>
                    <span className="text-gray-500">メール</span>
                    <span className="font-medium">{setupResult.email}</span>
                    <span className="text-gray-500">パスワード</span>
                    <span className="font-mono bg-gray-100 px-2 py-0.5 rounded w-fit">{setupPassword}</span>
                    <span className="text-gray-500">エリア</span>
                    <span>{setupResult.area}</span>
                    <span className="text-gray-500">キーワード</span>
                    <span>{setupResult.keywords.join("、")}</span>
                  </div>
                </div>

                {/* コピー用テキスト */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-2">顧客に送るログイン情報（コピー用）</p>
                  <div
                    className="text-sm text-gray-700 whitespace-pre-wrap cursor-pointer hover:bg-gray-100 rounded p-2 transition-colors"
                    onClick={(e) => {
                      const text = (e.currentTarget as HTMLDivElement).innerText;
                      navigator.clipboard.writeText(text);
                      alert("コピーしました");
                    }}
                  >
{`【MEO勝ち上げくん ログイン情報】

ログインURL: https://meo-kachiagekun-v2.vercel.app/login
メールアドレス: ${setupResult.email}
パスワード: ${setupPassword}

ログイン後「設定」タブから、院の強み・得意施術・経歴を入力してください。`}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
