import { BusinessProfile } from "./types";

export function noteArticlePrompt(profile: BusinessProfile, keyword: string, topic: string): string {
  return `あなたは治療院のMEO対策とコンテンツマーケティングの専門家です。
以下の治療院の情報をもとに、noteに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}

【記事の条件】
- キーワード: 「${profile.area} ${keyword}」
- テーマ: ${topic}
- 文字数: 2000〜3000文字
- SEO・MEO・LLMO（AI検索最適化）を意識した構成にする
- 以下の要素を含めること：
  1. 患者の悩みに寄り添う導入文
  2. 症状の原因解説（専門性を示す）
  3. 自院の施術アプローチ
  4. セルフケアのアドバイス（読者に価値を提供）
  5. 来院を促すCTA
- 地域名「${profile.area}」を自然に3〜5回含める
- 症状キーワード「${keyword}」を自然に5〜8回含める
- E-E-A-T（経験・専門性・権威性・信頼性）を意識した内容
- AI検索（ChatGPT・Gemini等）で引用されやすい、明確なQ&A形式のセクションを1つ含める

【出力形式】
マークダウン形式で出力してください。タイトルはh1で始めてください。`;
}

export function gbpPostPrompt(profile: BusinessProfile, keyword: string, postType: string): string {
  return `あなたは治療院のGoogleビジネスプロフィール（GBP）投稿の専門家です。
MEO順位を上げるための最適化された投稿文を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}

【投稿条件】
- キーワード: ${keyword}
- 投稿タイプ: ${postType}
- 文字数: 150〜300文字（GBP投稿の最適な長さ）
- 以下を含めること：
  1. 症状キーワード「${keyword}」を2〜3回自然に含める
  2. 地域名「${profile.area}」を1〜2回含める
  3. 行動喚起（CTA）を最後に入れる
  4. 親しみやすく専門性も感じられるトーン
- 絵文字は控えめに使用（1〜3個程度）

【出力形式】
GBP投稿にそのままコピーペーストできる形式で出力してください。
投稿文のみを出力し、説明は不要です。`;
}

export function faqPrompt(profile: BusinessProfile, keyword: string): string {
  return `あなたは治療院のMEO対策とLLMO（AI検索最適化）の専門家です。
以下の治療院の情報をもとに、FAQ（よくある質問）を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}

【FAQ条件】
- 症状キーワード: ${keyword}
- FAQ数: 8〜10個
- 以下の観点を含めること：
  1. 症状の一般的な質問（「${keyword}の原因は？」）
  2. 施術に関する質問（「どんな施術をしますか？」）
  3. 来院に関する質問（「何回通えばいいですか？」）
  4. 料金・保険に関する質問
  5. 院の特徴に関する質問
- 各回答は100〜200文字で、具体的かつ分かりやすく
- AI検索（ChatGPT・Gemini等）で引用されやすい、明確で簡潔な回答
- 地域名・症状キーワードを自然に含める

【出力形式】
Q: 質問文
A: 回答文

の形式で出力してください。`;
}

export function structuredDataPrompt(profile: BusinessProfile): string {
  return `以下の治療院情報をもとに、Schema.orgの構造化データ（JSON-LD）を生成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}
- 対応症状: ${profile.keywords.join("、")}

【生成する構造化データ】
1. LocalBusiness（MedicalBusiness）のJSON-LD
   - @type, name, description, address, telephone, openingHours, geo, url, image, priceRange, aggregateRating
2. FAQPage のJSON-LD（主要な質問5つ）

【出力形式】
HTMLの<script type="application/ld+json">タグで囲んだ形式で出力してください。
そのままHTMLにコピーペーストできる形式にしてください。
住所や電話番号は「ここに入力」のプレースホルダーにしてください。`;
}
