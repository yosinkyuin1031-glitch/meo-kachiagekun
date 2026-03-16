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

export interface NoteLoginSettings {
  email: string;
  password: string;
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

// noteプロフィール設定
export interface NoteProfile {
  displayName?: string;       // note表示名（引用名）
  noteId?: string;            // noteアカウントID（@以降）
  bio?: string;               // 自己紹介文（140文字以内）
  longBio?: string;           // 詳細自己紹介（記事末尾等で使用）
  headerImageGuide?: string;  // ヘッダー画像の説明・指示
  iconGuide?: string;         // アイコン画像の説明・指示
  articleFooter?: string;     // 記事末尾の定型文
  hashtags?: string[];        // よく使うハッシュタグ
  writingTone?: string;       // 記事のトーン（例: 専門的だが親しみやすい）
}

// 院ごとの情報
export interface ClinicProfile {
  id: string;
  name: string;
  area: string;
  keywords: string[];
  description: string;
  category: string;           // 後方互換（表示用に結合した文字列）
  categories?: string[];      // 複数業種チェック（例: ["整体院", "鍼灸院"]）
  ownerName?: string;         // 院長名
  specialty?: string;         // 専門分野（例: 腰痛・肩こり専門）
  noteProfile?: NoteProfile;  // noteプロフィール設定
  noteLogin?: NoteLoginSettings; // noteログイン情報
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
  noteProfile?: NoteProfile;
  noteLogin?: NoteLoginSettings;
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
  notePostUrl?: string;
}

// Google Business Profile API連携
export interface GoogleSettings {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  accountId?: string;      // accounts/{id}
  locationId?: string;     // locations/{id}
  locationName?: string;   // 表示用のビジネス名
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

// タスク管理
export type TaskType = "approval" | "owner-task";
export type TaskStatus = "pending" | "in-progress" | "completed";
export type TaskPriority = "high" | "medium" | "low";
export type TaskCategory = "経営判断" | "契約・支払い" | "スタッフ管理" | "集客・広告" | "施術・技術" | "設備・備品" | "その他";

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  requestedBy?: string;
  createdAt: string;
  completedAt?: string;
  memo?: string;
}
