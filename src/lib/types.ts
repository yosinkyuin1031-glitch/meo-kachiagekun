export interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
}

export interface WordPressSettings {
  siteUrl: string;
  username: string;
  appPassword: string;
}

// 院の各種URL
export interface ClinicUrls {
  websiteUrl?: string;        // ホームページURL
  bookingUrl?: string;        // 予約ページURL
  googleMapUrl?: string;      // Googleマップ口コミURL
  youtubeChannelUrl?: string; // YouTubeチャンネルURL
  youtubePlaylistUrl?: string;// YouTube再生リスト（インタビュー等）
  instagramUrl?: string;      // Instagram URL
  lineUrl?: string;           // LINE公式URL
  noteUrl?: string;           // noteアカウントURL
}

// 院ごとの情報
export interface ClinicProfile {
  id: string;
  name: string;
  area: string;
  keywords: string[];
  description: string;
  category: string;
  ownerName?: string;         // 院長名
  specialty?: string;         // 専門分野（例: 重症な慢性痛・神経痛）
  urls?: ClinicUrls;
  wordpress?: WordPressSettings;
}

// アプリ全体の共通設定
export interface AppSettings {
  anthropicKey: string;
  activeClinicId: string;
}

// 後方互換用（ContentGenerator等で使う統合型）
export interface BusinessProfile {
  name: string;
  area: string;
  keywords: string[];
  description: string;
  category: string;
  anthropicKey: string;
  ownerName?: string;
  specialty?: string;
  urls?: ClinicUrls;
  wordpress?: WordPressSettings;
}

export type ContentType = "note" | "gbp" | "faq" | "faq-short" | "blog" | "blog-seo" | "structured-data";

export interface GeneratedContent {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  keyword: string;
  createdAt: string;
  clinicId?: string;
  wpPostId?: number;
  wpPostUrl?: string;
}

export interface GenerationFeedback {
  id: string;
  contentId: string;
  type: "good" | "bad" | "edit";
  originalContent: string;
  editedContent?: string;
  note?: string;
  createdAt: string;
}
