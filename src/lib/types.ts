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

// 院長の声（音声入力＋質問形式で収集）
export interface OwnerVoice {
  philosophy?: string;       // 治療哲学：なぜこの仕事をしているのか
  passion?: string;          // 患者への想い：患者さんにどうなってほしいか
  approach?: string;         // 施術のこだわり：治療で大事にしていること
  difference?: string;       // 他院との違い：自分だけの考え方・やり方
  origin?: string;           // 開業の原点：この道を選んだきっかけ
  writingSamples?: string;   // 文体サンプル：実際に書いたFB投稿やメッセージ
}

// 院ごとの情報
export interface ClinicProfile {
  id: string;
  name: string;
  area: string;
  nearestStation?: string;    // 最寄り駅（例: 渋谷駅 徒歩5分）
  coverageAreas?: string[];   // 対応エリア（例: ["渋谷区", "目黒区", "港区"]）
  keywords: string[];
  description: string;
  category: string;           // 後方互換（表示用に結合した文字列）
  categories?: string[];      // 複数業種チェック（例: ["整体院", "鍼灸院"]）
  ownerName?: string;         // 院長名
  specialty?: string;         // 専門分野（例: 腰痛・肩こり専門）
  noteProfile?: NoteProfile;  // noteプロフィール設定
  urls?: ClinicUrls;
  wordpress?: WordPressSettings;
  strengths?: string;          // 院の強み・差別化ポイント
  experience?: string;         // 経験・実績・資格
  reviews?: string;            // 代表的な口コミ内容
  ownerVoice?: OwnerVoice;     // 院長の声（音声入力で収集）
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
  nearestStation?: string;
  coverageAreas?: string[];
  keywords: string[];
  description: string;
  category: string;
  anthropicKey: string;
  ownerName?: string;
  specialty?: string;
  noteProfile?: NoteProfile;
  urls?: ClinicUrls;
  wordpress?: WordPressSettings;
  strengths?: string;
  experience?: string;
  reviews?: string;
  ownerVoice?: OwnerVoice;
}

export type ContentType = "note" | "gbp" | "faq" | "faq-short" | "blog" | "blog-seo" | "structured-data" | "review-reply";

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

// Google Search Console連携
export interface SearchConsoleSettings {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  siteUrl?: string;       // 連携対象サイトURL
  siteName?: string;       // 表示用
}

export interface SearchConsoleQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// GBP投稿用の素材画像
export type ImageCategory = "施術風景" | "院内風景" | "スタッフ" | "外観" | "その他";

export interface GbpMaterialImage {
  id: string;
  category: ImageCategory;
  dataUrl: string;       // base64 data URL (リサイズ済み)
  name: string;
  addedAt: string;
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
