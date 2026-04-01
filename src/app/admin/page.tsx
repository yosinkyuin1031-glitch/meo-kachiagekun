"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface UserInfo {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  clinicCount: number;
  contentCount: number;
}

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

// 管理者メールアドレスのリスト
const ADMIN_EMAILS = [
  "ooguchiyouhei@gmail.com",
];

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
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClinics: 0,
    totalContents: 0,
    totalRankingChecks: 0,
  });
  const [dataLoading, setDataLoading] = useState(true);

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
      if (!res.ok) {
        setSetupError(data.error || "検索に失敗しました");
        return;
      }
      setSearchResults(data.results || []);
    } catch {
      setSetupError("検索に失敗しました");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectBusiness = (biz: BusinessSearchResult) => {
    setSelectedBusiness(biz);
    // 住所からエリアを自動抽出（「〇〇県〇〇市」or「〇〇市」部分）
    const addr = biz.address || "";
    const areaMatch = addr.match(/(東京都|北海道|(?:大阪|京都)府|.+?県)?\s*(.+?[市区町村])/);
    if (areaMatch) {
      setSetupArea(areaMatch[2] || areaMatch[0]);
    }
    // 業種を自動判定
    const name = biz.title || "";
    if (name.includes("鍼灸")) setSetupCategory("鍼灸院");
    else if (name.includes("接骨")) setSetupCategory("接骨院");
    else if (name.includes("治療")) setSetupCategory("治療院");
    else setSetupCategory("整体院");

    // パスワードを自動生成
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
      if (!res.ok) {
        setSetupError(data.error || "セットアップに失敗しました");
        return;
      }
      setSetupResult(data);
    } catch {
      setSetupError("セットアップに失敗しました");
    } finally {
      setSettingUp(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // 管理者権限チェック
    const email = user.email || "";
    if (ADMIN_EMAILS.includes(email)) {
      setIsAdmin(true);
    }
    setChecking(false);
  }, [user, authLoading]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAdminData = async () => {
      const supabase = createClient();

      try {
        // 統計情報を取得（RLSがあるため、管理者用のDB関数を使うか、自分のデータのみ表示）
        const [clinicsRes, contentsRes, rankingsRes] = await Promise.all([
          supabase.from("meo_clinics").select("user_id, name", { count: "exact" }),
          supabase.from("meo_contents").select("user_id", { count: "exact" }),
          supabase.from("meo_ranking_history").select("user_id", { count: "exact" }),
        ]);

        // RLSにより自分のデータのみ取得可能
        setStats({
          totalUsers: 1, // RLSで自分のみ
          totalClinics: clinicsRes.count || 0,
          totalContents: contentsRes.count || 0,
          totalRankingChecks: rankingsRes.count || 0,
        });

        // ユーザーリスト（RLSにより管理者自身のデータのみ）
        const userInfo: UserInfo = {
          id: user!.id,
          email: user!.email || "",
          created_at: user!.created_at || "",
          last_sign_in_at: user!.last_sign_in_at || null,
          clinicCount: clinicsRes.count || 0,
          contentCount: contentsRes.count || 0,
        };
        setUsers([userInfo]);
      } catch (error) {
        console.error("Admin data fetch error:", error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchAdminData();
  }, [isAdmin, user]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-900 shadow-lg border-b border-slate-600/20">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl animate-pulse" />
              <div>
                <div className="h-5 w-24 bg-white/10 rounded animate-pulse" />
                <div className="h-3 w-40 bg-white/5 rounded animate-pulse mt-1" />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-pulse">
                <div className="h-4 w-20 bg-gray-200 rounded mb-3" />
                <div className="h-8 w-16 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-gray-500 mb-6">
            この管理画面は管理者のみアクセスできます。
          </p>
          <a
            href="/"
            className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            ダッシュボードに戻る
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-red-900 shadow-lg border-b border-slate-600/20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-red-400/30">
                <svg className="w-5 h-5 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">管理画面</h1>
                <p className="text-xs text-red-200/80">MEO勝ち上げくん Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href="/" className="px-3 py-2 text-xs text-blue-200/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                ダッシュボードへ
              </a>
              <button
                onClick={signOut}
                className="px-3 py-2 text-xs text-red-200/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "登録院数", value: stats.totalClinics, icon: "🏥", color: "blue" },
            { label: "生成コンテンツ", value: stats.totalContents, icon: "📝", color: "emerald" },
            { label: "順位チェック回数", value: stats.totalRankingChecks, icon: "📊", color: "purple" },
            { label: "ログイン中", value: user?.email || "", icon: "👤", color: "slate", isText: true },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{card.icon}</span>
                <span className="text-xs text-gray-400 font-medium">{card.label}</span>
              </div>
              {card.isText ? (
                <p className="text-sm font-medium text-gray-700 truncate">{card.value}</p>
              ) : (
                <p className="text-3xl font-bold text-gray-800">{card.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* 新規顧客セットアップ */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">新規顧客セットアップ</h2>

          {/* STEP 1: 院名検索 */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-2">STEP 1: Google Mapsで院を検索</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchBusiness()}
                placeholder="院名を入力（例：○○整体院 大阪）"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearchBusiness}
                disabled={searching}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300"
              >
                {searching ? "検索中..." : "検索"}
              </button>
            </div>

            {/* 検索結果 */}
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
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-bold text-gray-700 mb-3">STEP 2: アカウント情報</h3>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">パスワード（自動生成）</label>
                    <input
                      type="text"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">エリア</label>
                    <input
                      type="text"
                      value={setupArea}
                      onChange={(e) => setSetupArea(e.target.value)}
                      placeholder="例：大阪市北区"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">業種</label>
                    <select
                      value={setupCategory}
                      onChange={(e) => setSetupCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-300 transition-all shadow-md"
                >
                  {settingUp ? "セットアップ中..." : "アカウント作成＋院情報セットアップ"}
                </button>
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {setupError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-sm text-red-700">{setupError}</p>
            </div>
          )}

          {/* セットアップ完了 */}
          {setupResult && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-bold text-green-800 mb-2">セットアップ完了</h3>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium text-gray-600">院名:</span> {setupResult.businessName}</p>
                <p><span className="font-medium text-gray-600">メール:</span> {setupResult.email}</p>
                <p><span className="font-medium text-gray-600">パスワード:</span> <span className="font-mono bg-white px-2 py-0.5 rounded">{setupPassword}</span></p>
                <p><span className="font-medium text-gray-600">エリア:</span> {setupResult.area}</p>
                <p><span className="font-medium text-gray-600">キーワード:</span> {setupResult.keywords.join("、")}</p>
              </div>
              <p className="text-xs text-green-600 mt-3">
                このログイン情報を顧客に送ってください。ログイン後すぐに利用開始できます。
              </p>
            </div>
          )}
        </div>

        {/* ユーザー情報 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">アカウント情報</h2>
          {dataLoading ? (
            <div className="py-4 space-y-3 animate-pulse">
              <div className="h-8 bg-gray-100 rounded w-full" />
              <div className="h-12 bg-gray-50 rounded w-full" />
              <div className="h-12 bg-gray-50 rounded w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">メール</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium">登録日</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium">最終ログイン</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium">院数</th>
                    <th className="text-center py-2 px-3 text-gray-500 font-medium">コンテンツ数</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-700">{u.email}</td>
                      <td className="py-2.5 px-3 text-center text-gray-500">
                        {new Date(u.created_at).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="py-2.5 px-3 text-center text-gray-500">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString("ja-JP")
                          : "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-blue-600">
                        {u.clinicCount}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                        {u.contentCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* セキュリティ情報 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">セキュリティ設定</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-green-800">Supabase Auth認証</span>
              </div>
              <span className="text-xs text-green-600 font-medium">有効</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-green-800">RLS（行レベルセキュリティ）</span>
              </div>
              <span className="text-xs text-green-600 font-medium">有効</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-green-800">Middleware認証ガード</span>
              </div>
              <span className="text-xs text-green-600 font-medium">有効</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-green-800">管理画面アクセス制御</span>
              </div>
              <span className="text-xs text-green-600 font-medium">管理者メールのみ</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
