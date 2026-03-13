import { ChecklistItem, BusinessProfile, GeneratedContent } from "./types";

const CHECKLIST_KEY = "meo_checklist";
const PROFILE_KEY = "meo_profile";
const CONTENT_KEY = "meo_content";

// チェックリスト
export function getChecklist(): ChecklistItem[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(CHECKLIST_KEY);
  return data ? JSON.parse(data) : getDefaultChecklist();
}

export function saveChecklist(items: ChecklistItem[]) {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(items));
}

// プロフィール
export function getProfile(): BusinessProfile {
  if (typeof window === "undefined") {
    return { name: "", area: "", keywords: [], description: "", category: "整体院", anthropicKey: "" };
  }
  const data = localStorage.getItem(PROFILE_KEY);
  return data ? JSON.parse(data) : { name: "", area: "", keywords: [], description: "", category: "整体院", anthropicKey: "" };
}

export function saveProfile(profile: BusinessProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// 生成コンテンツ
export function getContents(): GeneratedContent[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(CONTENT_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveContent(content: GeneratedContent) {
  const existing = getContents();
  localStorage.setItem(CONTENT_KEY, JSON.stringify([content, ...existing]));
}

// デフォルトチェックリスト
function getDefaultChecklist(): ChecklistItem[] {
  return [
    // GBP最適化
    { id: "gbp-1", category: "GBP最適化", title: "NAP情報（店名・住所・電話）を正確に登録", description: "ウェブサイト・ポータルサイト・SNSすべてで完全一致させる", priority: "high", completed: false },
    { id: "gbp-2", category: "GBP最適化", title: "営業時間を正確に設定", description: "営業中の店舗がアルゴリズムで優遇される", priority: "high", completed: false },
    { id: "gbp-3", category: "GBP最適化", title: "ビジネスの説明文を最適化", description: "750文字以内で地域名+症状キーワードを自然に含める", priority: "high", completed: false },
    { id: "gbp-4", category: "GBP最適化", title: "メインカテゴリを最適に設定", description: "業態に合ったカテゴリを1つ選択（整体院・鍼灸院等）", priority: "high", completed: false },
    { id: "gbp-5", category: "GBP最適化", title: "追加カテゴリを設定（最大9つ）", description: "関連カテゴリを追加（カイロ・マッサージ・リハビリ等）", priority: "medium", completed: false },
    { id: "gbp-6", category: "GBP最適化", title: "サービス内容を詳細に登録", description: "施術メニュー・料金・所要時間を細かく設定", priority: "medium", completed: false },
    { id: "gbp-7", category: "GBP最適化", title: "予約リンク・ウェブサイトURLを設定", description: "予約導線を整備する", priority: "high", completed: false },
    { id: "gbp-8", category: "GBP最適化", title: "Q&Aを自分で投稿・回答（5件以上）", description: "駐車場・予約・保険など よくある質問をFAQ化", priority: "medium", completed: false },

    // 写真・動画
    { id: "photo-1", category: "写真・動画", title: "院内の雰囲気写真を追加（5枚以上）", description: "清潔感・明るさが伝わるもの", priority: "high", completed: false },
    { id: "photo-2", category: "写真・動画", title: "施術風景の写真を追加", description: "患者の安心感につながるもの", priority: "medium", completed: false },
    { id: "photo-3", category: "写真・動画", title: "スタッフの顔写真を追加", description: "信頼感の向上に効果的", priority: "medium", completed: false },
    { id: "photo-4", category: "写真・動画", title: "外観・アクセス写真を追加", description: "来院のハードルを下げる", priority: "medium", completed: false },
    { id: "photo-5", category: "写真・動画", title: "30秒以内の紹介動画を追加", description: "院内案内・施術風景の動画", priority: "low", completed: false },

    // 口コミ
    { id: "review-1", category: "口コミ戦略", title: "口コミ依頼用QRコードカードを作成", description: "会計時に渡せるカードを準備", priority: "high", completed: false },
    { id: "review-2", category: "口コミ戦略", title: "院内に口コミ投稿の案内を掲示", description: "ポスターやPOPで導線整備", priority: "medium", completed: false },
    { id: "review-3", category: "口コミ戦略", title: "既存の口コミすべてに返信", description: "感謝+症状キーワードを含めた返信", priority: "high", completed: false },
    { id: "review-4", category: "口コミ戦略", title: "LINE/メールで口コミ依頼フロー構築", description: "施術後のフォローアップで口コミリンクを案内", priority: "medium", completed: false },

    // 投稿
    { id: "post-1", category: "GBP投稿", title: "週1〜2回のGBP投稿を開始", description: "写真付き・症状キーワード含む投稿を継続", priority: "high", completed: false },
    { id: "post-2", category: "GBP投稿", title: "季節に合わせた投稿テーマを準備", description: "花粉症・冷え性・年末疲れなど季節施策", priority: "medium", completed: false },

    // サイテーション
    { id: "cite-1", category: "サイテーション", title: "エキテンに登録", description: "登録519万店、月間960万人の大型ポータル", priority: "high", completed: false },
    { id: "cite-2", category: "サイテーション", title: "EPARK接骨・鍼灸に登録", description: "会員4,000万人超の国内最大級サイト", priority: "high", completed: false },
    { id: "cite-3", category: "サイテーション", title: "ヘルモアに登録", description: "治療院特化の口コミサイト（無料）", priority: "medium", completed: false },
    { id: "cite-4", category: "サイテーション", title: "しんきゅうコンパスに登録", description: "鍼灸院特化（31,000件超登録）", priority: "medium", completed: false },
    { id: "cite-5", category: "サイテーション", title: "Yahoo!プレイスに登録", description: "Yahoo!マップ連携", priority: "medium", completed: false },
    { id: "cite-6", category: "サイテーション", title: "Apple Business Connectに登録", description: "Appleマップ連携", priority: "low", completed: false },

    // ウェブサイト
    { id: "web-1", category: "ウェブサイト", title: "症状別ページを作成（主要5症状以上）", description: "腰痛・肩こり・頭痛等の専用ページ", priority: "high", completed: false },
    { id: "web-2", category: "ウェブサイト", title: "構造化データ（LocalBusiness）を実装", description: "JSON-LD形式でSchema.orgマークアップ", priority: "high", completed: false },
    { id: "web-3", category: "ウェブサイト", title: "FAQページを作成＋構造化データ", description: "FAQPage schemaでマークアップ", priority: "medium", completed: false },
    { id: "web-4", category: "ウェブサイト", title: "タイトルタグを最適化", description: "「地域名+症状+業態」の形式に", priority: "high", completed: false },
    { id: "web-5", category: "ウェブサイト", title: "モバイル表示速度を改善", description: "Core Web Vitals対応", priority: "medium", completed: false },
    { id: "web-6", category: "ウェブサイト", title: "患者の声・症例ページを作成", description: "写真付きの改善事例を掲載", priority: "medium", completed: false },

    // 外部施策
    { id: "ext-1", category: "外部施策", title: "noteアカウントを開設", description: "院長の想い・症状解説・セルフケア記事を投稿", priority: "medium", completed: false },
    { id: "ext-2", category: "外部施策", title: "Instagramを開設・運用開始", description: "施術ビフォーアフター・院内雰囲気の投稿", priority: "medium", completed: false },
    { id: "ext-3", category: "外部施策", title: "YouTubeでセルフケア動画を投稿", description: "ストレッチ・セルフケア動画で信頼獲得", priority: "low", completed: false },

    // LLMO対策
    { id: "llmo-1", category: "LLMO対策", title: "FAQ構造化データを実装", description: "AI検索でFAQが引用されやすくなる", priority: "high", completed: false },
    { id: "llmo-2", category: "LLMO対策", title: "症状別の詳細コンテンツを作成", description: "ChatGPT・Geminiが参照する情報源になる", priority: "medium", completed: false },
    { id: "llmo-3", category: "LLMO対策", title: "E-E-A-T（経験・専門性・権威性・信頼性）を強化", description: "資格情報・経歴・実績をサイトに明記", priority: "medium", completed: false },
  ];
}
