import { BusinessProfile } from "./types";

// ─── 医療広告NGワード ─────────────────────────
const MEDICAL_NG_NOTE = `
【厳守事項：医療広告ガイドライン】
以下の表現は絶対に使用しないでください：
- 「完治」「治ります」「必ず治る」「100%改善」「絶対に効く」
- 「完全に治る」「確実に効果」「必ず効果」「治療効果保証」
代わりに「改善を目指す」「緩和を期待できる」「多くの方が変化を実感」等を使用。`;

// ─── URL相互リンク構築ヘルパー ──────────────────
function buildUrlFooter(profile: BusinessProfile, blogUrl?: string): string {
  const urls = profile.urls || {};
  const lines = [
    blogUrl ? `📖 詳しくはブログをご覧ください\n${blogUrl}` : "",
    urls.youtubePlaylistUrl ? `▶️ 患者様インタビュー\n${urls.youtubePlaylistUrl}` : "",
    urls.youtubeChannelUrl ? `🎬 YouTubeチャンネル\n${urls.youtubeChannelUrl}` : "",
    urls.instagramUrl ? `📱 Instagram\n${urls.instagramUrl}` : "",
    urls.lineUrl ? `🟩 LINE公式\n${urls.lineUrl}` : "",
    urls.websiteUrl ? `🏠 ホームページ\n${urls.websiteUrl}` : "",
    urls.bookingUrl ? `📅 ご予約はこちら\n${urls.bookingUrl}` : "",
    urls.googleMapUrl ? `⭐ 口コミを書く\n${urls.googleMapUrl}` : "",
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n\n") : "";
}

function buildUrlLinksForHtml(profile: BusinessProfile, blogUrl?: string): string {
  const urls = profile.urls || {};
  const links = [
    blogUrl ? `<a href="${blogUrl}">詳しいブログ記事はこちら</a>` : "",
    urls.websiteUrl ? `<a href="${urls.websiteUrl}">${profile.name} ホームページ</a>` : "",
    urls.bookingUrl ? `<a href="${urls.bookingUrl}">ご予約はこちら</a>` : "",
    urls.googleMapUrl ? `<a href="${urls.googleMapUrl}">Googleマップで口コミを見る</a>` : "",
    urls.youtubeChannelUrl ? `<a href="${urls.youtubeChannelUrl}">YouTubeチャンネル</a>` : "",
    urls.youtubePlaylistUrl ? `<a href="${urls.youtubePlaylistUrl}">患者様インタビュー動画</a>` : "",
    urls.instagramUrl ? `<a href="${urls.instagramUrl}">Instagram</a>` : "",
    urls.lineUrl ? `<a href="${urls.lineUrl}">LINE公式アカウント</a>` : "",
    urls.noteUrl ? `<a href="${urls.noteUrl}">noteアカウント</a>` : "",
  ].filter(Boolean);
  return links.length > 0 ? links.join(" / ") : "";
}

function buildUrlLinksForMarkdown(profile: BusinessProfile, blogUrl?: string): string {
  const urls = profile.urls || {};
  const links = [
    blogUrl ? `- 📖 [詳しいブログ記事はこちら](${blogUrl})` : "",
    urls.websiteUrl ? `- 🏠 [${profile.name} ホームページ](${urls.websiteUrl})` : "",
    urls.bookingUrl ? `- 📅 [ご予約はこちら](${urls.bookingUrl})` : "",
    urls.googleMapUrl ? `- ⭐ [Googleマップで口コミを見る](${urls.googleMapUrl})` : "",
    urls.youtubeChannelUrl ? `- 🎬 [YouTubeチャンネル](${urls.youtubeChannelUrl})` : "",
    urls.youtubePlaylistUrl ? `- ▶️ [患者様インタビュー動画](${urls.youtubePlaylistUrl})` : "",
    urls.instagramUrl ? `- 📱 [Instagram](${urls.instagramUrl})` : "",
    urls.lineUrl ? `- 🟩 [LINE公式アカウント](${urls.lineUrl})` : "",
  ].filter(Boolean);
  return links.length > 0 ? links.join("\n") : "";
}

function buildOwnerInfo(profile: BusinessProfile): string {
  const parts = [];
  if (profile.ownerName) parts.push(`- 院長名: ${profile.ownerName}`);
  if (profile.specialty) parts.push(`- 専門: ${profile.specialty}`);
  return parts.length > 0 ? "\n" + parts.join("\n") : "";
}

function buildCrossLinkRule(contentType: string, profile: BusinessProfile, blogUrl?: string): string {
  const urls = profile.urls || {};
  const hasAnyUrl = blogUrl || urls.websiteUrl || urls.youtubeChannelUrl || urls.instagramUrl || urls.lineUrl || urls.bookingUrl || urls.googleMapUrl;
  if (!hasAnyUrl) return "";

  const rules: Record<string, string> = {
    blog: `
【相互リンク・LLMO強化ルール（重要）】
記事内の適切な箇所に、以下のリンクを自然に埋め込んでください：
${urls.bookingUrl ? `- 予約導線: 記事末尾のCTAに予約ページリンク <a href="${urls.bookingUrl}">ご予約はこちら</a>` : ""}
${urls.googleMapUrl ? `- 口コミ誘導: まとめセクションに <a href="${urls.googleMapUrl}">患者様の声はこちら</a>` : ""}
${urls.youtubeChannelUrl ? `- 動画誘導: セルフケアセクションに <a href="${urls.youtubeChannelUrl}">動画でも解説しています</a>` : ""}
${urls.youtubePlaylistUrl ? `- インタビュー: 施術アプローチセクションに <a href="${urls.youtubePlaylistUrl}">患者様の声を動画で見る</a>` : ""}
${urls.instagramUrl ? `- SNS誘導: <a href="${urls.instagramUrl}">Instagramで日々の情報を発信中</a>` : ""}
${urls.lineUrl ? `- LINE: CTAに <a href="${urls.lineUrl}">LINEでお気軽にご相談</a>` : ""}
- リンクは記事内の文脈に合わせて自然に配置すること（無理に全部入れなくてよい）
- 記事末尾に関連リンクまとめセクションを設置`,
    note: `
【相互リンク・LLMO強化ルール（重要）】
記事内の適切な箇所に、以下のリンクをマークダウン形式で埋め込んでください：
${blogUrl ? `- ブログ記事: 冒頭・中盤・CTAの3箇所に [詳しくはこちらの記事](${blogUrl})` : ""}
${urls.websiteUrl ? `- ホームページ: [${profile.name}公式サイト](${urls.websiteUrl})` : ""}
${urls.bookingUrl ? `- 予約: CTAに [ご予約はこちら](${urls.bookingUrl})` : ""}
${urls.googleMapUrl ? `- 口コミ: [Googleマップで口コミを見る](${urls.googleMapUrl})` : ""}
${urls.youtubeChannelUrl ? `- YouTube: セルフケア部分に [動画で解説](${urls.youtubeChannelUrl})` : ""}
${urls.youtubePlaylistUrl ? `- インタビュー: [患者様の声](${urls.youtubePlaylistUrl})` : ""}
${urls.instagramUrl ? `- Instagram: [日々の情報を発信中](${urls.instagramUrl})` : ""}
${urls.lineUrl ? `- LINE: CTAに [LINEで相談](${urls.lineUrl})` : ""}
- 記事末尾に「## 🔗 関連リンク」セクションを作り、上記リンクをまとめて掲載`,
    faq: `
【相互リンク・LLMO強化ルール（重要）】
FAQ回答内に以下のリンクを自然に埋め込んでください：
${blogUrl ? `- ブログ記事: 最低2箇所に <a href="${blogUrl}">こちらの記事で詳しく解説</a>` : ""}
${urls.bookingUrl ? `- 予約関連の回答に <a href="${urls.bookingUrl}">ご予約はこちら</a>` : ""}
${urls.googleMapUrl ? `- 口コミ関連の回答に <a href="${urls.googleMapUrl}">患者様の口コミを見る</a>` : ""}
${urls.youtubePlaylistUrl ? `- 施術の質問回答に <a href="${urls.youtubePlaylistUrl}">患者様インタビュー動画</a>` : ""}
${urls.websiteUrl ? `- 最後のFAQの回答に <a href="${urls.websiteUrl}">詳しくはホームページ</a>` : ""}
- FAQ末尾に関連リンクまとめを <div class="related-links"> で追加`,
    gbp: "", // GBPはフッター方式で別処理
  };

  return rules[contentType] || "";
}


// ─── noteプロフィール情報ヘルパー ─────────────────
function buildNoteProfileInfo(profile: BusinessProfile): string {
  const np = profile.noteProfile;
  if (!np) return "";
  const parts = [];
  if (np.displayName) parts.push(`- 著者名（note表示名）: ${np.displayName}`);
  if (np.noteId) parts.push(`- noteアカウント: @${np.noteId}`);
  if (np.writingTone) parts.push(`- 記事トーン: ${np.writingTone}`);
  if (np.bio) parts.push(`- 著者紹介: ${np.bio}`);
  return parts.length > 0 ? "\n" + parts.join("\n") : "";
}

function buildNoteArticleFooter(profile: BusinessProfile): string {
  const np = profile.noteProfile;
  if (!np?.articleFooter) return "";
  return `\n【記事末尾の定型文（必ず最後に挿入）】\n${np.articleFooter}`;
}

function buildNoteHashtags(profile: BusinessProfile): string {
  const np = profile.noteProfile;
  if (!np?.hashtags?.length) return "";
  return `\n【ハッシュタグ（記事末尾に付与）】\n${np.hashtags.map(t => `#${t}`).join(" ")}`;
}

// ─── note記事 ─────────────────────────────────
export function noteArticlePrompt(profile: BusinessProfile, keyword: string, topic: string): string {
  const urlLinks = buildUrlLinksForMarkdown(profile);
  const crossLinkRule = buildCrossLinkRule("note", profile);

  return `あなたは治療院のMEO対策とコンテンツマーケティングの専門家です。
以下の治療院の情報をもとに、noteに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}${buildNoteProfileInfo(profile)}

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
${MEDICAL_NG_NOTE}
${crossLinkRule}
${urlLinks ? `\n【記事末尾の関連リンク】\n記事の最後に「## 🔗 関連リンク」セクションを作り、以下を掲載：\n${urlLinks}` : ""}

【装飾・読みやすさの指示（重要）】
noteの記事は読みやすさが非常に大切です。以下のルールを必ず守ってください：

1. **太字（ボールド）**: 重要なポイント・結論・キーワードは必ず **太字** にする
2. **大きい見出し**: 各セクションの見出しは ## で大きく表示
3. **赤文字・強調**: 特に重要な注意点やポイントは 🔴 や ⚠️ アイコンで強調
4. **箇条書き**: 情報の羅列は必ず箇条書き（- や 1. 2. 3.）にする
5. **区切り線**: セクションの区切りには --- を使う
6. **引用ブロック**: 患者の声や重要な概念は > を使って引用形式にする
7. **画像・図解の挿入ガイド**: 以下の箇所に画像挿入ガイドを明記する
   - 記事冒頭（タイトル直後）: 📷【アイキャッチ画像】${keyword}に関連する写真（施術風景・院内の様子など）
   - 症状解説セクション: 📊【図解】${keyword}が起こるメカニズム（原因→影響→症状の流れ）
   - 施術アプローチセクション: 📷【写真】施術の様子・カウンセリング風景
   - セルフケアセクション: 📷【写真】セルフケア・ストレッチの実践写真 / 📊【図解】セルフケア3ステップ
   - まとめ直前: 📷【写真】院の外観またはスタッフの写真
   - 画像ガイドは「📷【写真】○○」「📊【図解】○○」の形式で本文中に明記する
8. **目次（もくじ）**: 記事冒頭に目次を入れる
9. **短い段落**: 1つの段落は3行以内にする（スマホで読みやすくするため）
10. **絵文字の活用**: 各見出しや重要ポイントに適切な絵文字を1つ付ける

${buildNoteArticleFooter(profile)}${buildNoteHashtags(profile)}

【出力形式】
マークダウン形式で出力してください。タイトルはh1で始めてください。
noteにコピペしてそのまま公開できる品質にしてください。`;
}

// ─── GBP投稿 ──────────────────────────────────
export function gbpPostPrompt(profile: BusinessProfile, keyword: string, postType: string): string {
  const urlFooter = buildUrlFooter(profile);

  return `あなたは治療院のGoogleビジネスプロフィール（GBP）投稿の専門家です。
MEO順位を上げるための最適化された投稿文を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}${buildOwnerInfo(profile)}

【投稿条件】
- キーワード: ${keyword}
- 投稿タイプ: ${postType}
- 文字数: 300〜500文字（本文部分）
- 以下を含めること：
  1. ${profile.ownerName ? `院長の自己紹介（「${profile.area}の${profile.name} 院長の${profile.ownerName}です。」）` : "院の簡単な紹介"}
  2. 症状キーワード「${keyword}」を2〜3回自然に含める
  3. 地域名「${profile.area}」を1〜2回含める
  4. 行動喚起（CTA）を最後に入れる
  5. 親しみやすく専門性も感じられるトーン
- 絵文字は控えめに使用（1〜3個程度）
${MEDICAL_NG_NOTE}
${urlFooter ? `\n【重要：フッターリンク】\n本文の後に、以下のリンクを改行区切りでそのまま記載してください（省略しないこと）：\n\n${urlFooter}` : ""}

【出力形式】
GBP投稿にそのままコピーペーストできる形式で出力してください。
投稿文のみを出力し、説明は不要です。
- 各段落・セクションの間には必ず空行（改行）を入れてください
- 読みやすさのため、1文ごとに改行を入れてください
- フッターリンク部分も各リンクの間に空行を入れてください`;
}

// ─── FAQ（よくある質問）─ クリニックマーク準拠 ─────
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
- 以下の観点を必ず含めること：
  1. 症状の一般的な質問（「${keyword}の原因は？」）
  2. 施術に関する質問（「どんな施術をしますか？」「何回で変化を感じますか？」）
  3. 来院に関する質問（「初めてでも大丈夫？」「予約は必要？」）
  4. 料金・保険に関する質問（「保険は使えますか？」）
  5. 院の特徴に関する質問（「子ども連れOK？」「駐車場は？」）
  6. 再発予防に関する質問（「${keyword}の再発を防ぐには？」）
- 各回答は100〜200文字で、具体的かつ分かりやすく
- AI検索（ChatGPT・Gemini・Perplexity等）で引用されやすい、明確で簡潔な回答
- 地域名「${profile.area}」・症状キーワード「${keyword}」を自然に含める
${MEDICAL_NG_NOTE}

【出力形式】
Q: 質問文
A: 回答文

の形式で出力してください。各Q&Aの間に空行を入れてください。`;
}

// ─── FAQ簡潔版 ────────────────────────────────
export function faqShortPrompt(profile: BusinessProfile, keyword: string): string {
  return `あなたは治療院のLLMO（AI検索最適化）の専門家です。
以下の治療院向けに、簡潔なFAQ（よくある質問）を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}

【条件】
- 症状キーワード: ${keyword}
- FAQ数: 10個
- 形式: 「Q. 質問 → 1行の簡潔な回答」
- WordPress投稿やサイトのサイドバーに掲載しやすいコンパクトな形式
- 以下のカテゴリをバランスよく含める：
  1. 症状について（原因・対象者）
  2. 施術について（内容・時間・回数）
  3. 予約・料金について
  4. アクセス・設備について
  5. 初回の方へ
${MEDICAL_NG_NOTE}

【出力形式】
Q. 質問文 → 回答文（1行）

の形式で出力してください。`;
}

// ─── ブログ記事（WordPress投稿用）─ クリニックマーク準拠 ─
export function blogPostPrompt(profile: BusinessProfile, keyword: string, topic: string): string {
  const crossLinkRule = buildCrossLinkRule("blog", profile);
  const htmlLinks = buildUrlLinksForHtml(profile);

  return `あなたは日本の治療院マーケティングとSEO・LLMO対策の専門家です。
以下の治療院のWordPressブログに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}

【記事の条件】
- テーマ: ${topic}
- 症状キーワード: ${keyword}
- 文字数: 1500〜2500文字
- 地域名「${profile.area}」を自然に3〜5回含める
- 症状キーワード「${keyword}」を自然に5〜8回含める

【重要：記事の書き出し】
記事本文は必ず以下の挨拶文から始めてください：
「こんにちは、${profile.name}の${profile.ownerName || '院長'}です。今回は」

【記事構成】
以下の構成で記事を作成してください：

## はじめに
- 上記の挨拶文から始め、${keyword}で悩む方への共感を示す導入文へ続ける
- この記事で分かることの概要

## ${keyword}の主な原因
- 骨格・筋肉・神経の観点から解説
- 日常生活の姿勢が与える影響

## よくある誤った対処法
- 痛み止めだけでは根本解決にならない理由
- 自己流ケアのリスク

## ${profile.name}の施術アプローチ
- 独自の施術方法を紹介
- カウンセリングから施術までの流れ

## ご自宅でできるセルフケア
- 推奨ストレッチ・ケア方法
- 日常生活で気をつけること

## まとめ
- ${keyword}は早めのケアが大切
- ${profile.area}で${keyword}なら${profile.name}へ

【SEO・LLMO対策】
- E-E-A-T（経験・専門性・権威性・信頼性）を意識した内容
- AI検索（ChatGPT・Gemini・Perplexity）で引用されやすい構造
- 各セクションの冒頭に結論を置く（PREP法）
${MEDICAL_NG_NOTE}
${crossLinkRule}
${htmlLinks ? `\n【記事末尾の関連リンク】\nまとめセクションの後に、以下のリンクを掲載する関連リンクセクションを追加：\n<div class="related-links"><h3>関連リンク</h3><p>${htmlLinks}</p></div>` : ""}

【画像挿入ガイド（重要）】
各セクションの適切な箇所に、以下の形式で画像挿入ガイドを含めてください：
<!-- 📷 画像挿入: ○○の写真（例：施術風景、院内の様子など） -->
具体的に挿入すべき箇所：
1. 「はじめに」の直後 → <!-- 📷 画像挿入: ${keyword}で悩む方のイメージ写真、または院内の施術風景 -->
2. 「施術アプローチ」セクション内 → <!-- 📷 画像挿入: 施術の様子・カウンセリング風景の写真 -->
3. 「セルフケア」セクション内 → <!-- 📷 画像挿入: セルフケア・ストレッチの実践写真 -->
4. 「まとめ」の前 → <!-- 📷 画像挿入: 院の外観写真またはスタッフ集合写真 -->
- HTMLコメント形式で挿入し、実際の表示には影響しないようにする
- WordPressで後から画像を差し替えられるようにする

【改行・読みやすさの指示（非常に重要）】
- 1つの段落（<p>タグ）は2〜3文以内にしてください。長い段落は分割すること
- 各<p>タグの間には十分な余白が出るように、段落を細かく分けること
- セクション見出し（<h2>）の前には十分な間隔を持たせること
- 箇条書き（<ul><li>）の各項目は1〜2文で簡潔に
- スマートフォンで読みやすいよう、1画面に文字が詰まりすぎないこと

【出力形式】
HTML形式で出力してください（WordPressに直接投稿できる形式）。
- h2, h3タグで見出しを構造化
- pタグで段落を分ける（1段落2〜3文以内）
- ul/liタグでリスト化
- strongタグで重要ワードを強調
- タイトル（h1）は含めないでください（WordPressのタイトル欄で別途入力するため）
- 画像挿入ガイドはHTMLコメント <!-- 📷 画像挿入: ... --> 形式で含める`;
}

// ─── ブログ記事（FAQ参照付き）─ 一括生成用 ──────────
export function blogPostWithFaqPrompt(profile: BusinessProfile, keyword: string, topic: string, faqContent: string): string {
  const crossLinkRule = buildCrossLinkRule("blog", profile);
  const htmlLinks = buildUrlLinksForHtml(profile);

  return `あなたは日本の治療院マーケティングとSEO・LLMO対策の専門家です。
以下の治療院のWordPressブログに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}

【記事の条件】
- テーマ: ${topic}
- 症状キーワード: ${keyword}
- 文字数: 1500〜2500文字
- 地域名「${profile.area}」を自然に3〜5回含める
- 症状キーワード「${keyword}」を自然に5〜8回含める

【重要：FAQとの連携】
以下のFAQの内容を参考に、より詳しいブログ記事を作成してください。FAQの内容はブログに含めないでください（別記事として投稿済み）。
FAQで触れている質問の回答を深掘りする形で、ブログ記事の各セクションを充実させてください。

--- FAQ内容（参考） ---
${faqContent}
--- FAQ内容ここまで ---

【重要：記事の書き出し】
記事本文は必ず以下の挨拶文から始めてください：
「こんにちは、${profile.name}の${profile.ownerName || '院長'}です。今回は」

【記事構成】
以下の構成で記事を作成してください：

## はじめに
- 上記の挨拶文から始め、${keyword}で悩む方への共感を示す導入文へ続ける
- この記事で分かることの概要

## ${keyword}の主な原因
- 骨格・筋肉・神経の観点から解説
- 日常生活の姿勢が与える影響

## よくある誤った対処法
- 痛み止めだけでは根本解決にならない理由
- 自己流ケアのリスク

## ${profile.name}の施術アプローチ
- 独自の施術方法を紹介
- カウンセリングから施術までの流れ

## ご自宅でできるセルフケア
- 推奨ストレッチ・ケア方法
- 日常生活で気をつけること

## まとめ
- ${keyword}は早めのケアが大切
- ${profile.area}で${keyword}なら${profile.name}へ

【SEO・LLMO対策】
- E-E-A-T（経験・専門性・権威性・信頼性）を意識した内容
- AI検索（ChatGPT・Gemini・Perplexity）で引用されやすい構造
- 各セクションの冒頭に結論を置く（PREP法）
${MEDICAL_NG_NOTE}
${crossLinkRule}
${htmlLinks ? `\n【記事末尾の関連リンク】\nまとめセクションの後に、以下のリンクを掲載する関連リンクセクションを追加：\n<div class="related-links"><h3>関連リンク</h3><p>${htmlLinks}</p></div>` : ""}

【画像挿入ガイド（重要）】
各セクションの適切な箇所に、以下の形式で画像挿入ガイドを含めてください：
<!-- 📷 画像挿入: ○○の写真（例：施術風景、院内の様子など） -->
具体的に挿入すべき箇所：
1. 「はじめに」の直後 → <!-- 📷 画像挿入: ${keyword}で悩む方のイメージ写真、または院内の施術風景 -->
2. 「施術アプローチ」セクション内 → <!-- 📷 画像挿入: 施術の様子・カウンセリング風景の写真 -->
3. 「セルフケア」セクション内 → <!-- 📷 画像挿入: セルフケア・ストレッチの実践写真 -->
4. 「まとめ」の前 → <!-- 📷 画像挿入: 院の外観写真またはスタッフ集合写真 -->
- HTMLコメント形式で挿入し、実際の表示には影響しないようにする
- WordPressで後から画像を差し替えられるようにする

【改行・読みやすさの指示（非常に重要）】
- 1つの段落（<p>タグ）は2〜3文以内にしてください。長い段落は分割すること
- 各<p>タグの間には十分な余白が出るように、段落を細かく分けること
- セクション見出し（<h2>）の前には十分な間隔を持たせること
- 箇条書き（<ul><li>）の各項目は1〜2文で簡潔に
- スマートフォンで読みやすいよう、1画面に文字が詰まりすぎないこと

【出力形式】
HTML形式で出力してください（WordPressに直接投稿できる形式）。
- h2, h3タグで見出しを構造化
- pタグで段落を分ける（1段落2〜3文以内）
- ul/liタグでリスト化
- strongタグで重要ワードを強調
- タイトル（h1）は含めないでください（WordPressのタイトル欄で別途入力するため）
- 画像挿入ガイドはHTMLコメント <!-- 📷 画像挿入: ... --> 形式で含める`;
}

// ─── ブログSEO情報（タイトル・メタ・OGP）─────────
export function blogSeoPrompt(profile: BusinessProfile, keyword: string, topic: string): string {
  return `以下の治療院ブログ記事のSEO情報を一括生成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}

【記事のテーマ】
- 症状キーワード: ${keyword}
- テーマ: ${topic}

【生成してほしい項目】
以下の項目を正確に生成してください：

1. SEOタイトル（32文字以内）
   - 形式: 「【${keyword}の原因と改善法】テーマ｜${profile.area}${profile.name}」

2. メタディスクリプション（120文字以内）
   - ${profile.area}の${profile.name}が${keyword}の原因・改善方法を解説する内容

3. メタキーワード（カンマ区切り10〜15個）
   - ${keyword}, ${keyword}原因, ${keyword}改善方法, ${profile.area}${profile.category} 等

4. OGPタイトル（40文字以内）
   - SNSシェア時に表示されるタイトル

5. OGP説明文（90文字以内）
   - SNSシェア時に表示される説明文

6. WordPress投稿スラッグ（英語・ハイフン区切り）
   - 例: lower-back-pain-improvement-guide

【出力形式】
以下のJSON形式で出力してください：
{
  "seoTitle": "...",
  "metaDescription": "...",
  "metaKeywords": "...",
  "ogpTitle": "...",
  "ogpDescription": "...",
  "slug": "..."
}
JSON以外の文字は一切出力しないでください。`;
}

// ─── 一括生成：FAQ（ブログURL埋め込み）──────────
export function faqWithBlogUrlPrompt(profile: BusinessProfile, keyword: string, blogUrl?: string): string {
  const crossLinkRule = buildCrossLinkRule("faq", profile, blogUrl || "");
  const htmlLinks = buildUrlLinksForHtml(profile, blogUrl || "");

  return `あなたは治療院のMEO対策とLLMO（AI検索最適化）の専門家です。
以下の治療院の「よくある質問」ページをWordPress投稿用HTML形式で作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}

【FAQ条件】
- 症状キーワード: ${keyword}
- FAQ数: 8〜10個
- 以下の観点を必ず含める：
  1. 症状の原因（「${keyword}の原因は？」）
  2. 施術内容（「どんな施術？」「何回で変化？」）
  3. 来院関連（「初めてでも大丈夫？」「予約方法は？」）
  4. 料金・保険
  5. 院の特徴（子連れOK・駐車場等）
  6. 再発予防
- 各回答は100〜200文字
- AI検索で引用されやすい明確で簡潔な回答
${MEDICAL_NG_NOTE}
${crossLinkRule}
${htmlLinks ? `\n【FAQ末尾の関連リンク】\n全FAQの後に関連リンクセクションを追加：\n<div class="related-links"><h3>関連ページ</h3><p>${htmlLinks}</p></div>` : ""}

【出力形式】
WordPress投稿用HTML形式で出力してください。
- 各Q&Aを<div class="faq-item">で囲む
- 質問は<h3>タグ
- 回答は<p>タグ
- リンクは<a href="URL">テキスト</a>形式`;
}

// ─── 一括生成：個別FAQ生成（1質問1投稿用）──────────
export function faqIndividualListPrompt(profile: BusinessProfile, keyword: string, faqCount: number = 5): string {
  const htmlLinks = buildUrlLinksForHtml(profile);

  return `あなたは治療院のMEO対策とLLMO（AI検索最適化）の専門家です。
以下の治療院の「よくある質問」を個別投稿用に生成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}

【FAQ条件】
- 症状キーワード: ${keyword}
- FAQ数: ちょうど${faqCount}個（多くても少なくてもダメ）
- 以下の観点からバランスよく選んで含める：
  1. 症状の原因（「${keyword}の原因は？」）
  2. 施術内容（「どんな施術？」「何回で変化？」）
  3. 来院関連（「初めてでも大丈夫？」「予約方法は？」）
  4. 料金・保険
  5. 院の特徴（子連れOK・駐車場等）
  6. 再発予防
- 各回答はWordPress投稿用HTML形式（150〜300文字）
- AI検索（ChatGPT・Gemini・Perplexity）で引用されやすい明確で簡潔な回答
- 地域名「${profile.area}」・症状キーワード「${keyword}」を自然に含める
${MEDICAL_NG_NOTE}

【各FAQの回答HTML構成】
- 回答本文は<p>タグで記述
- 重要ポイントは<strong>で強調
- 必要に応じて<ul><li>でリスト化
${htmlLinks ? `- 回答の最後に関連リンクを1〜2個自然に埋め込む（例: <a href="URL">テキスト</a>）\n利用可能なリンク: ${htmlLinks}` : ""}

【出力形式】
以下のJSON配列形式のみ出力してください。JSON以外の文字は一切不要。
配列の要素数は必ず${faqCount}個にしてください。
[
  {
    "question": "質問文（自然な日本語で）",
    "answer": "<p>回答HTML</p>",
    "seoTitle": "SEOタイトル（32文字以内、質問のキーワードを含む）",
    "seoDescription": "メタディスクリプション（120文字以内）",
    "slug": "英語ハイフン区切りのスラッグ",
    "blogTitle": "この質問を深掘りするブログ記事のタイトル（40文字以内、SEO最適化）",
    "blogSlug": "ブログ用英語ハイフン区切りスラッグ"
  }
]`;
}

// ─── 一括生成：GBP投稿（ブログURL埋め込み）─────
export function gbpWithBlogUrlPrompt(profile: BusinessProfile, keyword: string, blogUrl: string): string {
  const urlFooter = buildUrlFooter(profile, blogUrl);

  return `あなたは治療院のGBP（Googleビジネスプロフィール）投稿の専門家です。
以下の条件でGBP投稿文を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}${buildOwnerInfo(profile)}

【投稿条件】
- キーワード: ${keyword}
- 文字数: 300〜500文字（本文部分）
- 症状キーワード「${keyword}」を2〜3回
- 地域名「${profile.area}」を1〜2回
- 絵文字は控えめに使用（1〜3個）

【投稿の構成（この順番で）】
1. 院長の自己紹介（1〜2行）${profile.ownerName ? `「${profile.area}の${profile.name} 院長の${profile.ownerName}です。」` : ""}
2. ${keyword}についての本文（悩みへの共感 → 原因の簡潔な解説 → 当院のアプローチ → 変化の期待）
3. 行動喚起（CTA）「お気軽にご相談ください」等

${MEDICAL_NG_NOTE}

【重要：フッターリンク】
本文の後に、以下のリンクを改行区切りでそのまま記載してください（テキストのまま。省略しないこと）：

${urlFooter}

【出力形式】
GBP投稿にそのままコピペできる形式。投稿文のみ出力。
- 各段落・セクションの間には必ず空行（改行）を入れてください
- 読みやすさのため、1文ごとに改行を入れてください
- フッターリンク部分も各リンクの間に空行を入れてください`;
}

// ─── 一括生成：note記事（ブログURL埋め込み・装飾付き）
export function noteWithBlogUrlPrompt(profile: BusinessProfile, keyword: string, blogUrl: string): string {
  const crossLinkRule = buildCrossLinkRule("note", profile, blogUrl);
  const urlLinks = buildUrlLinksForMarkdown(profile, blogUrl);

  return `あなたは治療院のコンテンツマーケティングの専門家です。
以下の治療院の情報をもとに、noteに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}${buildNoteProfileInfo(profile)}

【記事の条件】
- キーワード: 「${profile.area} ${keyword}」
- 文字数: 2000〜3000文字
- SEO・MEO・LLMO最適化
- 以下の要素を含める：
  1. 患者の悩みに寄り添う導入文
  2. 症状の原因解説（専門性）
  3. 自院の施術アプローチ
  4. セルフケアのアドバイス
  5. 来院を促すCTA
- 地域名「${profile.area}」を3〜5回
- 症状キーワード「${keyword}」を5〜8回
- E-E-A-T意識
- Q&A形式セクション1つ
${MEDICAL_NG_NOTE}
${crossLinkRule}
${urlLinks ? `\n【記事末尾の関連リンク】\n記事の最後に「## 🔗 関連リンク」セクションを作り、以下を掲載：\n${urlLinks}` : ""}

【装飾・読みやすさの指示（重要）】
1. **太字**: 重要ポイント・結論・キーワードは必ず**太字**
2. **大きい見出し**: ## で大きく表示
3. **赤文字・強調**: 🔴 や ⚠️ で重要注意点を強調
4. **箇条書き**: 情報の羅列は箇条書き
5. **区切り線**: セクション区切りに ---
6. **引用ブロック**: 患者の声や概念は > で引用形式
7. **画像・図解の挿入ガイド**: 以下の箇所に画像挿入ガイドを明記する
   - 記事冒頭（タイトル直後）: 📷【アイキャッチ画像】${keyword}に関連する写真（施術風景・院内の様子など）
   - 症状解説セクション: 📊【図解】${keyword}が起こるメカニズム（原因→影響→症状の流れ）
   - 施術アプローチセクション: 📷【写真】施術の様子・カウンセリング風景
   - セルフケアセクション: 📷【写真】セルフケア・ストレッチの実践写真 / 📊【図解】セルフケア3ステップ
   - まとめ直前: 📷【写真】院の外観またはスタッフの写真
   - 画像ガイドは「📷【写真】○○」「📊【図解】○○」の形式で本文中に明記する
8. **目次**: 記事冒頭に目次
9. **短い段落**: 1段落3行以内（スマホ対応）
10. **絵文字**: 各見出しに適切な絵文字1つ

${buildNoteArticleFooter(profile)}${buildNoteHashtags(profile)}

【出力形式】
マークダウン形式。タイトルはh1で。noteにコピペしてそのまま公開できる品質。`;
}

// ─── 一括生成：ブログSEO情報 ────────────────────
export function bulkBlogSeoPrompt(profile: BusinessProfile, keyword: string): string {
  return `以下の治療院ブログ記事のSEO・OGP情報を生成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}

【記事のキーワード】${keyword}

【生成する項目】
1. blogTitle: ブログ記事タイトル（40文字以内、SEO最適化）
2. blogSummary: 要約文（100文字以内、記事の概要）
3. seoTitle: SEOタイトル（32文字以内）
4. seoDescription: メタディスクリプション（120文字以内）
5. seoKeywords: メタキーワード（カンマ区切り10〜15個）
6. ogpTitle: OGPタイトル（40文字以内）
7. ogpDescription: OGPディスクリプション（90文字以内）
8. slug: WordPress投稿スラッグ（英語ハイフン区切り）
9. faqSeoTitle: FAQページSEOタイトル（32文字以内）
10. faqSeoDescription: FAQページメタディスクリプション（120文字以内）
11. faqOgpTitle: FAQページOGPタイトル（40文字以内）
12. faqOgpDescription: FAQページOGPディスクリプション（90文字以内）
13. faqSlug: FAQ投稿スラッグ（英語ハイフン区切り）

【出力形式】
以下のJSON形式のみ出力。JSON以外の文字は一切不要。
{
  "blogTitle": "...",
  "blogSummary": "...",
  "seoTitle": "...",
  "seoDescription": "...",
  "seoKeywords": "...",
  "ogpTitle": "...",
  "ogpDescription": "...",
  "slug": "...",
  "faqSeoTitle": "...",
  "faqSeoDescription": "...",
  "faqOgpTitle": "...",
  "faqOgpDescription": "...",
  "faqSlug": "..."
}`;
}

// ─── 口コミ返信生成 ─────────────────────────────
export function reviewReplyPrompt(profile: BusinessProfile, reviewText: string, starRating: number): string {
  const toneGuide = starRating >= 4
    ? "感謝の気持ちを込めた温かいトーンで返信してください。来院いただいたことへのお礼と、今後も寄り添う姿勢を伝えてください。"
    : starRating === 3
    ? "感謝しつつも、改善への真摯な姿勢を示してください。ご指摘を前向きに受け止め、今後の対応について具体的に触れてください。"
    : "誠実で丁寧なトーンで返信してください。ご不満に対するお詫びと、改善に向けた具体的な姿勢を示してください。感情的にならず、プロフェッショナルな対応を心がけてください。";

  return `あなたは治療院のGoogleビジネスプロフィール（GBP）口コミ返信の専門家です。
以下の口コミに対する返信文を3パターン作成してください。

【治療院情報】
- 院名: ${profile.name}
- エリア: ${profile.area}
- 業種: ${profile.category}${profile.ownerName ? `\n- 院長名: ${profile.ownerName}` : ""}

【口コミ内容】
- 星評価: ${"★".repeat(starRating)}${"☆".repeat(5 - starRating)}（${starRating}/5）
- 口コミ本文:
${reviewText}

【返信のルール】
- ${toneGuide}
- 文字数: 100〜200文字程度（長すぎず短すぎず）
- ${profile.ownerName ? `院長名「${profile.ownerName}」を名乗って返信` : "院名を冒頭に添えて返信"}
- 口コミの内容に具体的に触れること（テンプレ感を出さない）
- 「またのご来院をお待ちしております」等の来院促進を含める
- 絵文字は使わない（GBP返信では不自然）
${MEDICAL_NG_NOTE}

【出力形式】
以下の形式で3パターン出力してください。各パターンの間に空行を入れてください。

---パターン1---
（返信文）

---パターン2---
（返信文）

---パターン3---
（返信文）

返信文のみ出力し、説明や注釈は不要です。`;
}

// ─── 構造化データ ─────────────────────────────
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
