"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LS_KEYS = {
  settings: "meo_settings",
  clinics: "meo_clinics",
  content: "meo_content",
  feedback: "meo_generation_feedback",
  rankingHistory: "meo_ranking_history",
  serpApiKey: "meo_serpapi_key",
  searchConsole: "meo_search_console",
  oldProfile: "meo_profile",
  oldChecklist: "meo_checklist",
};

function getLocalData(key: string) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function hasLocalData(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    localStorage.getItem(LS_KEYS.clinics) ||
    localStorage.getItem(LS_KEYS.content) ||
    localStorage.getItem(LS_KEYS.settings) ||
    localStorage.getItem(LS_KEYS.oldProfile)
  );
}

export default function LocalDataMigration({ onComplete }: { onComplete: () => void }) {
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const handleMigrate = async () => {
    setMigrating(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("ログインが必要です"); setMigrating(false); return; }
      const userId = user.id;

      // 1. Settings
      setProgress("設定を移行中...");
      const settings = getLocalData(LS_KEYS.settings);
      if (settings) {
        await supabase.from("meo_user_settings").upsert({
          user_id: userId,
          anthropic_key: settings.anthropicKey || "",
          active_clinic_id: settings.activeClinicId || "",
        }, { onConflict: "user_id" });
      }

      // 2. Clinics
      setProgress("院情報を移行中...");
      const clinics = getLocalData(LS_KEYS.clinics) || [];
      for (const c of clinics) {
        await supabase.from("meo_clinics").upsert({
          id: c.id,
          user_id: userId,
          name: c.name || "",
          area: c.area || "",
          keywords: c.keywords || [],
          description: c.description || "",
          category: c.category || "整体院",
          owner_name: c.ownerName || null,
          specialty: c.specialty || null,
          note_profile: c.noteProfile || null,
          urls: c.urls || null,
          wordpress: c.wordpress || null,
        }, { onConflict: "id,user_id" });
      }

      // 3. Contents
      setProgress("生成コンテンツを移行中...");
      const contents = getLocalData(LS_KEYS.content) || [];
      for (const c of contents) {
        await supabase.from("meo_contents").upsert({
          id: c.id,
          user_id: userId,
          clinic_id: c.clinicId || "",
          type: c.type,
          keyword: c.keyword || "",
          title: c.title || "",
          content: c.content || "",
          wp_post_id: c.wpPostId || null,
          wp_post_url: c.wpPostUrl || c.wpUrl || null,
          note_post_url: c.notePostUrl || null,
          created_at: c.createdAt,
        }, { onConflict: "id,user_id" });
      }

      // 4. Feedbacks
      setProgress("フィードバックを移行中...");
      const feedbacks = getLocalData(LS_KEYS.feedback) || [];
      for (const f of feedbacks) {
        await supabase.from("meo_feedbacks").upsert({
          id: f.id,
          user_id: userId,
          content_id: f.contentId,
          type: f.type,
          original_content: f.originalContent,
          edited_content: f.editedContent || null,
          note: f.note || null,
          created_at: f.createdAt,
        }, { onConflict: "id,user_id" });
      }

      // 5. Ranking History
      setProgress("ランキング履歴を移行中...");
      const rankings = getLocalData(LS_KEYS.rankingHistory) || [];
      for (const r of rankings) {
        await supabase.from("meo_ranking_history").upsert({
          id: r.id || crypto.randomUUID(),
          user_id: userId,
          keyword: r.keyword,
          rank: r.rank,
          business_name: r.businessName || "",
          top_three: r.topThree || [],
          checked_at: r.checkedAt,
        }, { onConflict: "id,user_id" });
      }

      // 6. SerpAPI Key
      const serpKey = localStorage.getItem(LS_KEYS.serpApiKey);
      if (serpKey) {
        await supabase.from("meo_user_settings").upsert({
          user_id: userId,
          serp_api_key: serpKey,
        }, { onConflict: "user_id" });
      }

      // 7. Search Console Settings
      setProgress("Search Console設定を移行中...");
      const gsc = getLocalData(LS_KEYS.searchConsole);
      if (gsc) {
        await supabase.from("meo_search_console_settings").upsert({
          user_id: userId,
          client_id: gsc.clientId || "",
          client_secret: gsc.clientSecret || "",
          access_token: gsc.accessToken || null,
          refresh_token: gsc.refreshToken || null,
          token_expiry: gsc.tokenExpiry || null,
          site_url: gsc.siteUrl || null,
          site_name: gsc.siteName || null,
        }, { onConflict: "user_id" });
      }

      // 8. Checklists (per-clinic)
      setProgress("チェックリストを移行中...");
      for (const c of clinics) {
        const clKey = `meo_checklist_${c.id}`;
        const items = getLocalData(clKey);
        if (items) {
          await supabase.from("meo_checklists").upsert({
            user_id: userId,
            clinic_id: c.id,
            items: items,
          }, { onConflict: "user_id,clinic_id" });
        }
      }
      // Also check old generic checklist
      const oldChecklist = getLocalData(LS_KEYS.oldChecklist);
      if (oldChecklist && clinics.length > 0) {
        await supabase.from("meo_checklists").upsert({
          user_id: userId,
          clinic_id: clinics[0].id,
          items: oldChecklist,
        }, { onConflict: "user_id,clinic_id" });
      }

      setProgress("移行完了！");

      // Mark migration as done
      localStorage.setItem("meo_migrated_to_supabase", "true");

      setTimeout(onComplete, 1500);
    } catch (e) {
      setError(`移行エラー: ${e instanceof Error ? e.message : String(e)}`);
      setMigrating(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("meo_migrated_to_supabase", "true");
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">ローカルデータの移行</h2>
        <p className="text-sm text-gray-600 mb-4">
          このブラウザに保存されているMEOデータが見つかりました。
          クラウドに移行すると、どのデバイスからでもアクセスできるようになります。
        </p>

        {error && (
          <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4">{error}</div>
        )}

        {progress && (
          <div className="bg-blue-50 text-blue-700 rounded-lg p-3 text-sm mb-4 flex items-center gap-2">
            {!progress.includes("完了") && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {progress}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="flex-1 bg-indigo-600 text-white rounded-xl px-4 py-3 font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {migrating ? "移行中..." : "データを移行する"}
          </button>
          <button
            onClick={handleSkip}
            disabled={migrating}
            className="px-4 py-3 text-gray-500 hover:text-gray-700 text-sm disabled:opacity-50"
          >
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}
