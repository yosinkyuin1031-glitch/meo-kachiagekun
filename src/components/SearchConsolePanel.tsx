"use client";

import { useState, useEffect, useCallback } from "react";
import { BusinessProfile, SearchConsoleSettings, SearchConsoleQuery } from "@/lib/types";
import {
  getSearchConsoleSettings,
  saveSearchConsoleSettings,
  clearSearchConsoleSettings,
} from "@/lib/supabase-storage";

// ─── PKCE Helper ──────────────────────────────────
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── CopyButton ───────────────────────────────────
function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied
          ? "bg-green-100 text-green-700"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {copied ? "コピー完了" : label}
    </button>
  );
}

// ─── Types ────────────────────────────────────────
interface Props {
  profile: BusinessProfile;
  onKeywordsImport: (keywords: string[]) => void;
}

type SortKey = "query" | "clicks" | "impressions" | "ctr" | "position";
type SortDir = "asc" | "desc";
type DateRange = "7" | "28" | "90";

// ─── Main Component ──────────────────────────────
export default function SearchConsolePanel({ profile, onKeywordsImport }: Props) {
  // Connection state
  const [settings, setSettings] = useState<SearchConsoleSettings | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Setup form
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [setupError, setSetupError] = useState("");

  // Site selection
  const [sites, setSites] = useState<{ siteUrl: string; permissionLevel: string }[]>([]);
  const [showSiteSelect, setShowSiteSelect] = useState(false);

  // Query data
  const [queries, setQueries] = useState<SearchConsoleQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("28");

  // Table state
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // ─── Load settings on mount ─────────────────────
  useEffect(() => {
    getSearchConsoleSettings().then((saved) => {
      if (saved) {
        setSettings(saved);
        setClientId(saved.clientId || "");
        setClientSecret(saved.clientSecret || "");
        if (saved.accessToken && saved.siteUrl) {
          setIsConnected(true);
        }
      }
    });
  }, []);

  // ─── Token refresh helper ──────────────────────
  const refreshAccessToken = useCallback(
    async (currentSettings: SearchConsoleSettings): Promise<SearchConsoleSettings | null> => {
      if (!currentSettings.refreshToken) return null;
      try {
        const res = await fetch("/api/search-console/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "refresh_token",
            refresh_token: currentSettings.refreshToken,
            client_id: currentSettings.clientId,
            client_secret: currentSettings.clientSecret,
          }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const updated: SearchConsoleSettings = {
          ...currentSettings,
          accessToken: data.access_token,
          tokenExpiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        };
        await saveSearchConsoleSettings(updated);
        setSettings(updated);
        return updated;
      } catch {
        return null;
      }
    },
    []
  );

  // ─── Authenticated fetch with auto-refresh ─────
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}, currentSettings: SearchConsoleSettings) => {
      const doFetch = (token: string) =>
        fetch(url, {
          ...options,
          headers: {
            ...((options.headers as Record<string, string>) || {}),
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

      let res = await doFetch(currentSettings.accessToken!);
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === "TOKEN_EXPIRED" || res.status === 401) {
          const refreshed = await refreshAccessToken(currentSettings);
          if (refreshed) {
            res = await doFetch(refreshed.accessToken!);
          } else {
            await clearSearchConsoleSettings();
            setSettings(null);
            setIsConnected(false);
            setFetchError("再認証が必要です。接続を再設定してください。");
            return null;
          }
        }
      }
      return res;
    },
    [refreshAccessToken]
  );

  // ─── OAuth Flow (PKCE対応) ─────────────────────
  // ─── OAuth: Full-page redirect flow ─────────────
  const handleAuth = useCallback(async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setSetupError("Client IDとClient Secretの両方を入力してください。");
      return;
    }
    setSetupError("");

    // Save credentials
    const newSettings: SearchConsoleSettings = {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    };
    await saveSearchConsoleSettings(newSettings);
    setSettings(newSettings);

    // PKCE: Generate code_verifier and code_challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store code_verifier and return path for after redirect
    sessionStorage.setItem("gsc_code_verifier", codeVerifier);
    sessionStorage.setItem("gsc_return_path", window.location.pathname + window.location.search);

    // Build OAuth URL with PKCE - full page redirect (not popup)
    const redirectUri = `${window.location.origin}/gsc-callback`;
    const scope = "https://www.googleapis.com/auth/webmasters.readonly";
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId.trim())}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256`;

    // Full page redirect instead of popup
    window.location.href = authUrl;
  }, [clientId, clientSecret]);

  // ─── Handle OAuth callback code (after redirect back) ─────
  const handleOAuthCode = useCallback(async (code: string) => {
    const storedVerifier = sessionStorage.getItem("gsc_code_verifier") || "";
    sessionStorage.removeItem("gsc_code_verifier");
    const redirectUri = `${window.location.origin}/gsc-callback`;

    try {
      const tokenRes = await fetch("/api/search-console/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          clientId: clientId.trim() || settings?.clientId,
          clientSecret: clientSecret.trim() || settings?.clientSecret,
          code_verifier: storedVerifier,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        setSetupError(err?.error || "トークンの取得に失敗しました。");
        return;
      }

      const tokenData = await tokenRes.json();
      const updatedSettings: SearchConsoleSettings = {
        clientId: clientId.trim() || settings?.clientId || "",
        clientSecret: clientSecret.trim() || settings?.clientSecret || "",
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        tokenExpiry: new Date(Date.now() + tokenData.expiresIn * 1000).toISOString(),
      };
      await saveSearchConsoleSettings(updatedSettings);
      setSettings(updatedSettings);

      // Fetch verified sites
      const sitesRes = await fetch("/api/search-console/sites", {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      });

      if (!sitesRes.ok) {
        setSetupError("サイト一覧の取得に失敗しました。");
        return;
      }

      const sitesData = await sitesRes.json();
      const siteList: { siteUrl: string; permissionLevel: string }[] =
        sitesData.siteEntry || [];

      if (siteList.length === 0) {
        setSetupError(
          "Search Consoleに登録されたサイトが見つかりません。Google Search Consoleでサイトを追加してください。"
        );
        return;
      }

      // Auto-select if only one site or one matches the clinic website
      const clinicUrl = profile.urls?.websiteUrl;
      const matchingSite = clinicUrl
        ? siteList.find(
            (s) =>
              clinicUrl.includes(s.siteUrl.replace(/\/$/, "")) ||
              s.siteUrl.includes(clinicUrl.replace(/\/$/, ""))
          )
        : null;

      if (siteList.length === 1 || matchingSite) {
        const chosen = matchingSite || siteList[0];
        const finalSettings: SearchConsoleSettings = {
          ...updatedSettings,
          siteUrl: chosen.siteUrl,
          siteName: chosen.siteUrl,
        };
        await saveSearchConsoleSettings(finalSettings);
        setSettings(finalSettings);
        setIsConnected(true);
      } else {
        setSites(siteList);
        setShowSiteSelect(true);
      }
    } catch {
      setSetupError("認証処理中にエラーが発生しました。");
    }
  }, [clientId, clientSecret, settings, profile.urls?.websiteUrl]);

  // Check for OAuth callback code in localStorage (set by gsc-callback page)
  useEffect(() => {
    const code = localStorage.getItem("gsc_auth_code");
    if (code) {
      localStorage.removeItem("gsc_auth_code");
      handleOAuthCode(code);
    }
  }, [handleOAuthCode]);

  // ─── Site selection ─────────────────────────────
  const handleSiteSelect = (siteUrl: string) => {
    if (!settings) return;
    const finalSettings: SearchConsoleSettings = {
      ...settings,
      siteUrl,
      siteName: siteUrl,
    };
    saveSearchConsoleSettings(finalSettings);
    setSettings(finalSettings);
    setShowSiteSelect(false);
    setIsConnected(true);
  };

  // ─── Disconnect ─────────────────────────────────
  const handleDisconnect = () => {
    clearSearchConsoleSettings();
    setSettings(null);
    setIsConnected(false);
    setQueries([]);
    setSelectedKeys(new Set());
    setSites([]);
    setShowSiteSelect(false);
    setClientId("");
    setClientSecret("");
  };

  // ─── Fetch search data ─────────────────────────
  const fetchSearchData = useCallback(async () => {
    if (!settings?.accessToken || !settings?.siteUrl) return;
    setLoading(true);
    setFetchError("");

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    try {
      const res = await authFetch(
        "/api/search-console/query",
        {
          method: "POST",
          body: JSON.stringify({
            siteUrl: settings.siteUrl,
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            dimensions: ["query"],
            rowLimit: 100,
          }),
        },
        settings
      );

      if (!res) return;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setFetchError(errData?.error || "データの取得に失敗しました。");
        return;
      }

      const data = await res.json();
      const rows: SearchConsoleQuery[] = (data.rows || []).map(
        (row: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
          query: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        })
      );
      setQueries(rows);
      setSelectedKeys(new Set());
    } catch {
      setFetchError("データ取得中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }, [settings, dateRange, authFetch]);

  // ─── Sorting ────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "query" ? "asc" : "desc");
    }
  };

  const sortedQueries = [...queries].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "query") {
      return a.query.localeCompare(b.query) * dir;
    }
    return (a[sortKey] - b[sortKey]) * dir;
  });

  // ─── Selection ──────────────────────────────────
  const toggleSelect = (query: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(query)) {
        next.delete(query);
      } else {
        next.add(query);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedKeys.size === queries.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(queries.map((q) => q.query)));
    }
  };

  const handleImport = () => {
    const keywords = Array.from(selectedKeys);
    if (keywords.length > 0) {
      onKeywordsImport(keywords);
    }
  };

  // ─── Sort indicator ─────────────────────────────
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span className="ml-1 text-gray-300">&#x2195;</span>;
    return <span className="ml-1">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  };

  const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/gsc-callback` : "";

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Google Search Console</h2>
          <p className="text-sm text-gray-500 mt-1">
            実際の検索キーワードを取得してMEO対策に活用
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              isConnected
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            {isConnected ? "接続済み" : "未接続"}
          </span>
        </div>
      </div>

      {/* ─── Connected View ─────────────────────── */}
      {isConnected && settings?.siteUrl && (
        <>
          {/* Connection info card with clear site label */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">接続中のサイト</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-bold text-green-800">
                      現在の対象サイト: {settings.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{settings.siteUrl}</p>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                接続を解除
              </button>
            </div>
          </div>

          {/* Data fetch controls */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">期間:</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
                >
                  <option value="7">過去7日間</option>
                  <option value="28">過去28日間</option>
                  <option value="90">過去90日間</option>
                </select>
              </div>
              <button
                onClick={fetchSearchData}
                disabled={loading}
                className="px-5 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "取得中..." : "データ取得"}
              </button>
            </div>

            {fetchError && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                {fetchError}
              </p>
            )}
          </div>

          {/* Results table */}
          {queries.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Table toolbar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-600">
                  {queries.length}件のキーワード
                  {selectedKeys.size > 0 && (
                    <span className="ml-2 text-orange-600 font-medium">
                      ({selectedKeys.size}件選択中)
                    </span>
                  )}
                </p>
                <button
                  onClick={handleImport}
                  disabled={selectedKeys.size === 0}
                  className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  選択したキーワードをインポート
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={queries.length > 0 && selectedKeys.size === queries.length}
                          onChange={toggleAll}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400 accent-orange-500"
                        />
                      </th>
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-800 select-none"
                        onClick={() => handleSort("query")}
                      >
                        キーワード
                        <SortIcon column="query" />
                      </th>
                      <th
                        className="px-4 py-3 text-right font-medium text-gray-600 cursor-pointer hover:text-gray-800 select-none"
                        onClick={() => handleSort("clicks")}
                      >
                        クリック数
                        <SortIcon column="clicks" />
                      </th>
                      <th
                        className="px-4 py-3 text-right font-medium text-gray-600 cursor-pointer hover:text-gray-800 select-none"
                        onClick={() => handleSort("impressions")}
                      >
                        表示回数
                        <SortIcon column="impressions" />
                      </th>
                      <th
                        className="px-4 py-3 text-right font-medium text-gray-600 cursor-pointer hover:text-gray-800 select-none"
                        onClick={() => handleSort("ctr")}
                      >
                        CTR
                        <SortIcon column="ctr" />
                      </th>
                      <th
                        className="px-4 py-3 text-right font-medium text-gray-600 cursor-pointer hover:text-gray-800 select-none"
                        onClick={() => handleSort("position")}
                      >
                        平均掲載順位
                        <SortIcon column="position" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedQueries.map((q, i) => (
                      <tr
                        key={q.query}
                        className={`border-b border-gray-100 hover:bg-orange-50 transition-colors ${
                          i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(q.query)}
                            onChange={() => toggleSelect(q.query)}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400 accent-orange-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{q.query}</td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {q.clicks.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {q.impressions.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {(q.ctr * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {q.position.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state after fetch */}
          {queries.length === 0 && !loading && !fetchError && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
              <p className="text-gray-400 text-sm">
                「データ取得」ボタンを押して検索キーワードを取得してください。
              </p>
            </div>
          )}
        </>
      )}

      {/* ─── Site Selection Modal ──────────────── */}
      {showSiteSelect && sites.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-bold text-gray-800 mb-3">サイトを選択</h3>
          <p className="text-sm text-gray-500 mb-4">
            Search Consoleに複数のサイトが登録されています。連携するサイトを選択してください。
          </p>
          <div className="space-y-2">
            {sites.map((site) => (
              <button
                key={site.siteUrl}
                onClick={() => handleSiteSelect(site.siteUrl)}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all"
              >
                <p className="font-medium text-gray-800">{site.siteUrl}</p>
                <p className="text-xs text-gray-500 mt-0.5">権限: {site.permissionLevel}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Setup View (Not Connected) ────────── */}
      {!isConnected && !showSiteSelect && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Search Console連携の設定</h3>

          {/* Instructions */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-5">
            <p className="text-sm text-orange-800 leading-relaxed">
              Google Cloud Consoleで「Search Console API」を有効にし、OAuth 2.0クライアントIDを作成してください。
              リダイレクトURIには以下を設定してください。
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="bg-white px-3 py-1.5 rounded border border-orange-200 text-xs text-orange-900 flex-1 overflow-x-auto">
                {redirectUri}
              </code>
              <CopyButton text={redirectUri} />
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxx.apps.googleusercontent.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Client Secret
              </label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-xxxxx"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none transition-all"
              />
            </div>

            {setupError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{setupError}</p>
            )}

            <button
              onClick={handleAuth}
              className="w-full py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Googleで認証
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
