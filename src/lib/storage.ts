import { ChecklistItem, ClinicProfile, AppSettings, BusinessProfile, GeneratedContent } from "./types";

const CLINICS_KEY = "meo_clinics";
const SETTINGS_KEY = "meo_settings";
const CONTENT_KEY = "meo_content";

// ─── 共通設定（APIキー・アクティブ院） ──────────
export function getSettings(): AppSettings {
  if (typeof window === "undefined") return { anthropicKey: "", activeClinicId: "" };
  const data = localStorage.getItem(SETTINGS_KEY);
  if (data) return JSON.parse(data);

  // 旧データからの移行
  const oldProfile = localStorage.getItem("meo_profile");
  if (oldProfile) {
    const old = JSON.parse(oldProfile);
    if (old.anthropicKey) {
      const settings: AppSettings = { anthropicKey: old.anthropicKey, activeClinicId: "" };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return settings;
    }
  }

  return { anthropicKey: "", activeClinicId: "" };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── 院リスト ────────────────────────────────
export function getClinics(): ClinicProfile[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(CLINICS_KEY);
  if (data) return JSON.parse(data);

  // 旧データからの移行
  const oldProfile = localStorage.getItem("meo_profile");
  if (oldProfile) {
    const old = JSON.parse(oldProfile);
    if (old.name) {
      const clinic: ClinicProfile = {
        id: "clinic-1",
        name: old.name,
        area: old.area || "",
        keywords: old.keywords || [],
        description: old.description || "",
        category: old.category || "整体院",
        wordpress: old.wordpress,
      };
      localStorage.setItem(CLINICS_KEY, JSON.stringify([clinic]));

      // アクティブ院も設定
      const settings = getSettings();
      settings.activeClinicId = clinic.id;
      saveSettings(settings);

      return [clinic];
    }
  }

  return [];
}

export function saveClinics(clinics: ClinicProfile[]) {
  localStorage.setItem(CLINICS_KEY, JSON.stringify(clinics));
}

export function addClinic(clinic: ClinicProfile) {
  const clinics = getClinics();
  clinics.push(clinic);
  saveClinics(clinics);
}

export function updateClinic(id: string, updates: Partial<ClinicProfile>) {
  const clinics = getClinics();
  const updated = clinics.map((c) => (c.id === id ? { ...c, ...updates } : c));
  saveClinics(updated);
}

export function deleteClinic(id: string) {
  const clinics = getClinics().filter((c) => c.id !== id);
  saveClinics(clinics);
}

export function getActiveClinic(): ClinicProfile | null {
  const settings = getSettings();
  const clinics = getClinics();
  if (!settings.activeClinicId && clinics.length > 0) {
    return clinics[0];
  }
  return clinics.find((c) => c.id === settings.activeClinicId) || clinics[0] || null;
}

// ─── 統合プロフィール（ContentGenerator用） ─────
export function getBusinessProfile(): BusinessProfile {
  const settings = getSettings();
  const clinic = getActiveClinic();
  if (!clinic) {
    return { name: "", area: "", keywords: [], description: "", category: "整体院", anthropicKey: settings.anthropicKey };
  }
  return {
    name: clinic.name,
    area: clinic.area,
    keywords: clinic.keywords,
    description: clinic.description,
    category: clinic.category,
    anthropicKey: settings.anthropicKey,
    ownerName: clinic.ownerName,
    specialty: clinic.specialty,
    urls: clinic.urls,
    wordpress: clinic.wordpress,
  };
}

// 後方互換（旧コードでも動くように）
export function getProfile(): BusinessProfile {
  return getBusinessProfile();
}

export function saveProfile(profile: BusinessProfile) {
  // 共通設定を更新
  const settings = getSettings();
  settings.anthropicKey = profile.anthropicKey;
  saveSettings(settings);

  // アクティブ院を更新
  const clinic = getActiveClinic();
  if (clinic) {
    updateClinic(clinic.id, {
      name: profile.name,
      area: profile.area,
      keywords: profile.keywords,
      description: profile.description,
      category: profile.category,
      wordpress: profile.wordpress,
    });
  }
}

// ─── チェックリスト（院ごと）────────────────────
function checklistKey(clinicId: string): string {
  return `meo_checklist_${clinicId}`;
}

export function getChecklist(clinicId?: string): ChecklistItem[] {
  if (typeof window === "undefined") return [];
  const id = clinicId || getActiveClinic()?.id || "";
  if (!id) return getDefaultChecklist();

  const data = localStorage.getItem(checklistKey(id));
  if (data) return JSON.parse(data);

  // 旧データからの移行
  const oldData = localStorage.getItem("meo_checklist");
  if (oldData) {
    const items = JSON.parse(oldData);
    localStorage.setItem(checklistKey(id), JSON.stringify(items));
    return items;
  }

  return getDefaultChecklist();
}

export function saveChecklist(items: ChecklistItem[], clinicId?: string) {
  const id = clinicId || getActiveClinic()?.id || "";
  if (!id) return;
  localStorage.setItem(checklistKey(id), JSON.stringify(items));
}

// ─── 生成コンテンツ ──────────────────────────
export function getContents(): GeneratedContent[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(CONTENT_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveContent(content: GeneratedContent) {
  const existing = getContents();
  localStorage.setItem(CONTENT_KEY, JSON.stringify([content, ...existing]));
}

export function updateContent(id: string, updates: Partial<GeneratedContent>) {
  const existing = getContents();
  const updated = existing.map((c) => (c.id === id ? { ...c, ...updates } : c));
  localStorage.setItem(CONTENT_KEY, JSON.stringify(updated));
}

// ─── 生成フィードバック（学習用）──────────────────
const FEEDBACK_KEY = "meo_generation_feedback";

export interface GenerationFeedback {
  id: string;
  contentId: string;
  type: "good" | "bad" | "edit";
  originalContent: string;
  editedContent?: string;
  note?: string;
  createdAt: string;
}

export function getFeedbacks(): GenerationFeedback[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(FEEDBACK_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveFeedback(feedback: GenerationFeedback) {
  const existing = getFeedbacks();
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify([feedback, ...existing]));
}

// ─── Google Business Profile 設定 ───────────────
import { GoogleSettings } from "./types";

const GOOGLE_KEY = "meo_google_settings";

export function getGoogleSettings(): GoogleSettings | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(GOOGLE_KEY);
  return data ? JSON.parse(data) : null;
}

export function saveGoogleSettings(settings: GoogleSettings) {
  localStorage.setItem(GOOGLE_KEY, JSON.stringify(settings));
}

export function clearGoogleSettings() {
  localStorage.removeItem(GOOGLE_KEY);
}

// ─── MEOランキング履歴 ──────────────────────────
import { RankingHistory } from "./ranking-types";

const RANKING_HISTORY_KEY = "meo_ranking_history";
const SERPAPI_KEY = "meo_serpapi_key";

export function getRankingHistory(): RankingHistory[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(RANKING_HISTORY_KEY);
  return data ? JSON.parse(data) : [];
}

export function addRankingHistory(entries: RankingHistory[]) {
  const existing = getRankingHistory();
  const combined = [...existing, ...entries];
  localStorage.setItem(RANKING_HISTORY_KEY, JSON.stringify(combined));
}

export function getSerpApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SERPAPI_KEY) || "";
}

export function saveSerpApiKey(key: string) {
  localStorage.setItem(SERPAPI_KEY, key);
}

// ─── デフォルトチェックリスト ────────────────────
function getDefaultChecklist(): ChecklistItem[] {
  return [
    { id: "gbp-1", category: "GBP最適化", title: "NAP情報（店名・住所・電話）を正確に登録", description: "ウェブサイト・ポータルサイト・SNSすべてで完全一致させる", priority: "high", completed: false },
    { id: "gbp-2", category: "GBP最適化", title: "営業時間を正確に設定", description: "営業中の店舗がアルゴリズムで優遇される", priority: "high", completed: false },
    { id: "gbp-3", category: "GBP最適化", title: "ビジネスの説明文を最適化", description: "750文字以内で地域名+症状キーワードを自然に含める", priority: "high", completed: false },
    { id: "gbp-4", category: "GBP最適化", title: "メインカテゴリを最適に設定", description: "業態に合ったカテゴリを1つ選択（整体院・鍼灸院等）", priority: "high", completed: false },
    { id: "gbp-5", category: "GBP最適化", title: "追加カテゴリを設定（最大9つ）", description: "関連カテゴリを追加（カイロ・マッサージ・リハビリ等）", priority: "medium", completed: false },
    { id: "gbp-6", category: "GBP最適化", title: "サービス内容を詳細に登録", description: "施術メニュー・料金・所要時間を細かく設定", priority: "medium", completed: false },
    { id: "gbp-7", category: "GBP最適化", title: "予約リンク・ウェブサイトURLを設定", description: "予約導線を整備する", priority: "high", completed: false },
    { id: "gbp-8", category: "GBP最適化", title: "Q&Aを自分で投稿・回答（5件以上）", description: "駐車場・予約・保険など よくある質問をFAQ化", priority: "medium", completed: false },
    { id: "photo-1", category: "写真・動画", title: "院内の雰囲気写真を追加（5枚以上）", description: "清潔感・明るさが伝わるもの", priority: "high", completed: false },
    { id: "photo-2", category: "写真・動画", title: "施術風景の写真を追加", description: "患者の安心感につながるもの", priority: "medium", completed: false },
    { id: "photo-3", category: "写真・動画", title: "スタッフの顔写真を追加", description: "信頼感の向上に効果的", priority: "medium", completed: false },
    { id: "photo-4", category: "写真・動画", title: "外観・アクセス写真を追加", description: "来院のハードルを下げる", priority: "medium", completed: false },
    { id: "photo-5", category: "写真・動画", title: "30秒以内の紹介動画を追加", description: "院内案内・施術風景の動画", priority: "low", completed: false },
    { id: "review-1", category: "口コミ戦略", title: "口コミ依頼用QRコードカードを作成", description: "会計時に渡せるカードを準備", priority: "high", completed: false },
    { id: "review-2", category: "口コミ戦略", title: "院内に口コミ投稿の案内を掲示", description: "ポスターやPOPで導線整備", priority: "medium", completed: false },
    { id: "review-3", category: "口コミ戦略", title: "既存の口コミすべてに返信", description: "感謝+症状キーワードを含めた返信", priority: "high", completed: false },
    { id: "review-4", category: "口コミ戦略", title: "LINE/メールで口コミ依頼フロー構築", description: "施術後のフォローアップで口コミリンクを案内", priority: "medium", completed: false },
    { id: "post-1", category: "GBP投稿", title: "週1〜2回のGBP投稿を開始", description: "写真付き・症状キーワード含む投稿を継続", priority: "high", completed: false },
    { id: "post-2", category: "GBP投稿", title: "季節に合わせた投稿テーマを準備", description: "花粉症・冷え性・年末疲れなど季節施策", priority: "medium", completed: false },
    { id: "cite-1", category: "サイテーション", title: "エキテンに登録", description: "登録519万店、月間960万人の大型ポータル", priority: "high", completed: false },
    { id: "cite-2", category: "サイテーション", title: "EPARK接骨・鍼灸に登録", description: "会員4,000万人超の国内最大級サイト", priority: "high", completed: false },
    { id: "cite-3", category: "サイテーション", title: "ヘルモアに登録", description: "治療院特化の口コミサイト（無料）", priority: "medium", completed: false },
    { id: "cite-4", category: "サイテーション", title: "しんきゅうコンパスに登録", description: "鍼灸院特化（31,000件超登録）", priority: "medium", completed: false },
    { id: "cite-5", category: "サイテーション", title: "Yahoo!プレイスに登録", description: "Yahoo!マップ連携", priority: "medium", completed: false },
    { id: "cite-6", category: "サイテーション", title: "Apple Business Connectに登録", description: "Appleマップ連携", priority: "low", completed: false },
    { id: "web-1", category: "ウェブサイト", title: "症状別ページを作成（主要5症状以上）", description: "腰痛・肩こり・頭痛等の専用ページ", priority: "high", completed: false },
    { id: "web-2", category: "ウェブサイト", title: "構造化データ（LocalBusiness）を実装", description: "Googleが院の情報（名前・住所・電話番号・営業時間・施術内容）を正しく認識するための設定。HTMLの<head>内にJSON-LD形式のコードを貼り付けるだけでOK。MEO勝ち上げくんの「LLMO対策」タブで自動生成できます。これを設置すると、Google検索結果に営業時間や評価が表示されやすくなります。", priority: "high", completed: false },
    { id: "web-3", category: "ウェブサイト", title: "FAQページを作成＋構造化データ", description: "よくある質問ページを作り、FAQPage形式の構造化データを追加する設定。Google検索結果にQ&Aが直接表示（リッチリザルト）されるようになり、クリック率が大幅UP。ChatGPTやGeminiのAI検索でも引用されやすくなります。MEO勝ち上げくんでFAQを生成→WordPressに投稿→構造化データを追加の流れで対応。", priority: "medium", completed: false },
    { id: "web-4", category: "ウェブサイト", title: "タイトルタグを最適化", description: "「地域名+症状+業態」の形式に", priority: "high", completed: false },
    { id: "web-5", category: "ウェブサイト", title: "モバイル表示速度を改善", description: "Core Web Vitals対応", priority: "medium", completed: false },
    { id: "web-6", category: "ウェブサイト", title: "患者の声・症例ページを作成", description: "写真付きの改善事例を掲載", priority: "medium", completed: false },
    { id: "ext-1", category: "外部施策", title: "noteアカウントを開設", description: "院長の想い・症状解説・セルフケア記事を投稿", priority: "medium", completed: false },
    { id: "ext-2", category: "外部施策", title: "Instagramを開設・運用開始", description: "施術ビフォーアフター・院内雰囲気の投稿", priority: "medium", completed: false },
    { id: "ext-3", category: "外部施策", title: "YouTubeでセルフケア動画を投稿", description: "ストレッチ・セルフケア動画で信頼獲得", priority: "low", completed: false },
    { id: "llmo-1", category: "LLMO対策", title: "FAQ構造化データを実装", description: "ChatGPT・Gemini・PerplexityなどのAI検索で「○○でおすすめの整体院は？」と聞かれた時に、あなたの院のFAQが回答に引用されるための設定。FAQページにJSON-LDコードを追加するだけで対応可能。MEO勝ち上げくんの「LLMO対策」タブで構造化データを自動生成できます。", priority: "high", completed: false },
    { id: "llmo-2", category: "LLMO対策", title: "症状別の詳細コンテンツを作成", description: "ChatGPT・Geminiが参照する情報源になる", priority: "medium", completed: false },
    { id: "llmo-3", category: "LLMO対策", title: "E-E-A-T（経験・専門性・権威性・信頼性）を強化", description: "資格情報・経歴・実績をサイトに明記", priority: "medium", completed: false },
    { id: "wp-1", category: "WordPress投稿", title: "症状別ブログ記事を投稿（主要キーワード）", description: "各症状について1500〜2500字の記事をWordPressに投稿", priority: "high", completed: false },
    { id: "wp-2", category: "WordPress投稿", title: "FAQ記事をWordPressに投稿", description: "よくある質問をブログ記事として投稿（LLMO対策）", priority: "high", completed: false },
    { id: "wp-3", category: "WordPress投稿", title: "構造化データをサイトに実装", description: "WordPressのテーマ（header.php）にJSON-LDコードを貼り付ける作業。LocalBusiness（院情報）とFAQPage（よくある質問）の2種類を設置。プラグイン「Insert Headers and Footers」を使えばテーマ編集なしでも設置可能。", priority: "medium", completed: false },
  ];
}
