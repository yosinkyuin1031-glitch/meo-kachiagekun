import { BusinessProfile } from "./types";
import { ContentInsight, RankingInsight } from "./supabase-storage";

// ─── 蓄積データ活用コンテキスト ──────────────────
export interface AccumulatedContext {
  contentInsight?: ContentInsight;
  rankingInsight?: RankingInsight;
  reviewContext?: string; // キーワードに応じて抽出された口コミコンテキスト
}

function buildAccumulatedContext(ctx?: AccumulatedContext): string {
  if (!ctx) return "";
  const sections: string[] = [];

  // Google口コミから抽出したコンテキスト（キーワード関連の患者の声）
  if (ctx.reviewContext) {
    sections.push(`\n${ctx.reviewContext}\n\n※ 上記の口コミは実際にGoogle Mapsに投稿された患者様の声です。記事内に「患者様からは○○という声をいただいています」「ある50代女性は○回の施術で○○を実感されました」のような形で自然に引用し、数字や具体的な変化を交えてリアリティを持たせてください。引用する際は、口コミの文言をそのまま使うのではなく、本文の流れに自然に溶け込ませてください。`);
  }

  // 過去記事の重複回避
  const ci = ctx.contentInsight;
  if (ci && ci.pastTitles.length > 0) {
    sections.push(`
【重複回避（重要）】
以下は同じキーワードで過去に生成済みの記事タイトルです。これらと異なる切り口・視点で記事を作成してください：
${ci.pastTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join("\n")}
※ 同じ構成・同じ結論にならないよう、新しい角度からアプローチしてください。`);
  }

  // フィードバック学習
  if (ci && (ci.totalGoodCount > 0 || ci.totalBadCount > 0)) {
    let feedbackSection = `\n【過去のフィードバックから学習】`;
    feedbackSection += `\nこれまでの評価: 良い ${ci.totalGoodCount}件 / 改善が必要 ${ci.totalBadCount}件`;

    if (ci.goodContentPatterns.length > 0) {
      feedbackSection += `\n\n好評だった記事の傾向（この方向性を踏襲すること）：`;
      ci.goodContentPatterns.forEach((p, i) => {
        feedbackSection += `\n--- 好評パターン${i + 1} ---\n${p}...`;
      });
    }

    if (ci.badContentPatterns.length > 0) {
      feedbackSection += `\n\n改善指摘があった点（これらを避けること）：`;
      ci.badContentPatterns.forEach((p, i) => {
        feedbackSection += `\n- ${p}`;
      });
    }

    sections.push(feedbackSection);
  }

  // 順位変動の反映
  const ri = ctx.rankingInsight;
  if (ri && ri.latestRank !== null) {
    let rankSection = `\n【MEO順位データの反映】`;
    rankSection += `\n現在の順位: ${ri.latestRank}位`;

    if (ri.previousRank !== null) {
      rankSection += ` (前回: ${ri.previousRank}位)`;
    }

    if (ri.trend === "down") {
      rankSection += `\n⚠️ 順位が${Math.abs(ri.changeAmount)}位下降しています。以下を意識してください：`;
      rankSection += `\n- より専門性の高い、独自の知見を盛り込んだ内容にする`;
      rankSection += `\n- キーワードの網羅性を高め、関連語句も積極的に含める`;
      rankSection += `\n- E-E-A-T（経験・専門性・権威性・信頼性）を強く意識した構成にする`;
      rankSection += `\n- 患者の具体的な声や症例を交えて説得力を高める`;
    } else if (ri.trend === "up") {
      rankSection += `\n✅ 順位が${ri.changeAmount}位上昇しています。現在の方向性を維持してください。`;
    } else if (ri.trend === "stable") {
      rankSection += `\n順位は安定しています。さらなる上位を目指して、コンテンツの質と独自性を高めてください。`;
    }

    if (ri.topCompetitors.length > 0) {
      rankSection += `\n\n上位の競合: ${ri.topCompetitors.join("、")}`;
      rankSection += `\nこれらの競合と差別化できる独自の視点・情報を盛り込んでください。`;
    }

    sections.push(rankSection);
  }

  return sections.join("\n");
}

// ─── 医療広告NGワード ─────────────────────────
const MEDICAL_NG_NOTE = `
【厳守事項：医療広告ガイドライン】
以下の表現は絶対に使用しないでください：
- 「完治」「治ります」「必ず治る」「100%改善」「絶対に効く」
- 「即効性」「治癒」「根治」「確実に」「間違いなく」
- 「驚きの効果」「奇跡」「最高の」「日本一」「世界初」
- 「他にはない」「唯一の治療法」「副作用なし」「安全性100%」
- 「全員が」「誰でも治る」「完全に治る」「確実に効果」「必ず効果」「治療効果保証」
- 「劇的に」「魔法のような」「画期的」「革命的」「究極の」
- 「痛みが消える」「一発で治る」「たった1回で」
- 「before/after」の誇大表現、施術前後の比較で効果を断定する表現
代わりに以下のような表現を使用してください：
- 「完治」→「改善を目指す」、「治ります」→「緩和が期待できます」
- 「必ず治る」→「多くの方が改善を実感」、「即効性」→「早い段階で変化を実感される方も」
- 「確実に」→「多くの場合」、「最高の」→「質の高い」
- 「日本一」→「専門性の高い」、「副作用なし」→「身体への負担が少ない」
- 「全員が」→「多くの方が」、「誰でも治る」→「幅広い方に対応」
- 「劇的に」→「段階的に」、「痛みが消える」→「痛みの軽減を目指す」
※ 生成した文章に上記NG表現が含まれていないか、出力前に必ずセルフチェックすること`;

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

function buildOwnerVoiceContext(profile: BusinessProfile): string {
  const ov = profile.ownerVoice;
  if (!ov) return "";
  const parts: string[] = [];
  if (ov.philosophy) parts.push(`【治療哲学】\n${ov.philosophy}`);
  if (ov.passion) parts.push(`【患者への想い】\n${ov.passion}`);
  if (ov.approach) parts.push(`【施術のこだわり】\n${ov.approach}`);
  if (ov.difference) parts.push(`【他院との違い】\n${ov.difference}`);
  if (ov.origin) parts.push(`【この道を選んだきっかけ】\n${ov.origin}`);
  if (parts.length === 0) return "";
  return `
【院長の声（最重要：このセクションが記事のトーンと内容の核です）】
以下は院長本人が語った言葉です。記事を書く際はこの想い・考え方を軸にしてください。
院長の言葉づかいや表現をそのまま活かし、「院長が自分で書いた記事」になるようにしてください。

${parts.join("\n\n")}`;
}

function buildWritingSampleContext(profile: BusinessProfile): string {
  const ov = profile.ownerVoice;
  if (!ov?.writingSamples) return "";
  return `
【文体サンプル（院長が実際に書いた文章）】
以下の文章は院長本人が書いたものです。この文体・口調・言い回しを真似て記事を書いてください。
- 「です・ます」の使い方、語尾のクセを踏襲する
- 患者への語りかけ方を真似る
- 専門用語の使い方・砕け具合を合わせる

${ov.writingSamples}`;
}

function buildClinicContext(profile: BusinessProfile): string {
  const sections = [];
  // 院長の声（最優先コンテキスト）
  const ownerVoice = buildOwnerVoiceContext(profile);
  if (ownerVoice) sections.push(ownerVoice);
  const writingSample = buildWritingSampleContext(profile);
  if (writingSample) sections.push(writingSample);
  if (profile.strengths) {
    sections.push(`\n【院の強み・差別化ポイント】\n${profile.strengths}`);
  }
  if (profile.experience) {
    sections.push(`\n【経験・実績・資格】\n${profile.experience}`);
  }
  if (profile.reviews) {
    sections.push(`\n【患者の口コミ・声（実際の口コミを参考に自然に盛り込むこと）】\n${profile.reviews}`);
  }
  if (sections.length > 0) {
    return "\n" + sections.join("\n") + `

※ 上記の活用ルール：
- 院長の声がある場合、それが記事全体のトーン・方向性の最上位指針となる
- 強みは箇条書きの引用ではなく、具体的なエピソードやストーリーとして展開すること
- 例：「当院では○○という技術を用いており〜」ではなく「ある患者様は○○の症状で来院され、○○のアプローチにより○回の施術で○○を実感されました」のように患者の体験談のような形で文中に織り込む
- 口コミは「患者様からは〜という声をいただいています」等の形で自然に引用する
- 数字や具体的な変化を交えてリアリティを持たせる
- 文体サンプルがある場合、その口調・言い回しを最優先で踏襲する`;
  }
  return "";
}

function buildLSIKeywords(keyword: string, profile: BusinessProfile): string {
  return `
【キーワード戦略（3層構造で網羅すること）】
1. メインキーワード: 「${keyword}」→ タイトル・見出し・冒頭・まとめに必須
2. 関連症状キーワード: 「${keyword}」に関連する症状名・原因名・治療法名を5〜8個、記事全体に散りばめる
   例: 腰痛なら「ぎっくり腰」「椎間板ヘルニア」「坐骨神経痛」「脊柱管狭窄症」「反り腰」「骨盤の歪み」等
3. 地域キーワード: 「${profile.area}」に加え、最寄り駅名・近隣エリア名も1〜2回含める
   ${profile.nearestStation ? `最寄り駅: ${profile.nearestStation}` : ''}
   ${profile.coverageAreas?.length ? `近隣エリア: ${profile.coverageAreas.join('、')}` : ''}
- ロングテールキーワード（「${profile.area} ${keyword} 改善」「${keyword} 原因 治し方」等）を見出しに含める
- 共起語を意識：施術・改善・原因・対策・予防・再発・根本・専門・実績 等を自然に使用`;
}

function buildAreaContext(profile: BusinessProfile): string {
  const parts = [`- メインエリア: ${profile.area}`];
  if (profile.nearestStation) parts.push(`- 最寄り駅: ${profile.nearestStation}`);
  if (profile.coverageAreas?.length) parts.push(`- 対応エリア: ${profile.coverageAreas.join("、")}`);
  return parts.join("\n");
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
export function noteArticlePrompt(profile: BusinessProfile, keyword: string, topic: string, accCtx?: AccumulatedContext): string {
  const urlLinks = buildUrlLinksForMarkdown(profile);
  const crossLinkRule = buildCrossLinkRule("note", profile);

  return `あなたは治療院のMEO対策とコンテンツマーケティングの専門家です。
以下の治療院の情報をもとに、noteに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}${buildNoteProfileInfo(profile)}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

【記事の条件】
- メイン症状キーワード: 「${keyword}」
- テーマ: ${topic}
- 文字数: 3000〜5000文字
- SEO・MEO・LLMO（AI検索最適化）を意識した構成にする
- 以下の要素を含めること：
  1. 患者の悩みに寄り添う導入文
  2. 症状の原因解説（専門性を示す）
  3. 自院の施術アプローチ
  4. セルフケアのアドバイス（読者に価値を提供）
  5. 来院を促すCTA
- 地域名「${profile.area}」をタイトル・冒頭・まとめに自然に2〜3回含める
- 症状キーワード「${keyword}」を自然に8〜12回含める
- 【重要】記事の本文は症状の専門的な解説を中心に構成し（80%）、地域情報はタイトル・導入・まとめに配置（15%）、院の強みは自然に織り込む（5%）
- タイトル形式: 「【${keyword}でお悩みの方へ】原因と改善法を専門家が解説｜${profile.area}」のように地域はタイトル末尾に
- E-E-A-T（経験・専門性・権威性・信頼性）を意識した内容
- AI検索（ChatGPT・Gemini等）で引用されやすい、明確なQ&A形式のセクションを1つ含める
${buildLSIKeywords(keyword, profile)}

【文章の質を高める指示】
- 一般的な健康サイトのコピーではなく、実際の臨床経験に基づいた具体的な記述にする
- 「〜と言われています」ではなく「当院では〜というケースを多く見てきました」のように経験ベースで書く
- 数字・データを積極的に使う
- 患者が検索しそうな悩みのフレーズをそのまま使う
${MEDICAL_NG_NOTE}
${crossLinkRule}
${urlLinks ? `\n【記事末尾の関連リンク】\n記事の最後に「## 🔗 関連リンク」セクションを作り、以下を掲載：\n${urlLinks}` : ""}

【装飾・読みやすさの指示（最重要）】
noteの記事は「スマホで読みやすいか」が最も大切です。以下のルールを必ず守ってください：

1. 見出しは ## で大きく表示し、各見出しに適切な絵文字を1つ付ける
2. 重要なポイント・結論・キーワードは **太字** にする
3. 特に重要な注意点は 🔴 や ⚠️ で強調
4. 患者の声や重要な概念は > で引用形式にする
5. セクションの区切りには --- を使う
6. 記事冒頭に目次を入れる

【改行・余白のルール（絶対厳守）】
- 1つの段落は1〜2文までにする。句点（。）が2回来たら原則そこで段落を切る
- 段落と段落の間には必ず空行を1行入れる（空行がない状態はNG）
- 接続詞や逆接（しかし・ところが・だから・つまり等）の直前でも段落を切る
- 読者が話題転換を感じるたびに段落を切る
- 見出し（##）の前後には空行を2行入れる
- 内容を詰め込みすぎない。1つのセクションで伝えることは1つに絞る
- スマホで読んだとき、画面いっぱいに文字が詰まっている状態は絶対NG
- 「読みやすさ > 情報量」を徹底する

【改行の書き方（具体例）】
NG例（詰まりすぎ）:
腰痛の原因は骨盤の歪みから来ることが多く、日常生活の姿勢が深く関わっています。長時間のデスクワークや猫背の習慣が積み重なると、筋肉の緊張バランスが崩れ、神経を圧迫してしまいます。

OK例（1〜2文ごとに改行）:
腰痛の原因は、骨盤の歪みから来ることが多いです。

日常生活の姿勢が深く関わっています。

長時間のデスクワークや猫背の習慣が積み重なると、筋肉の緊張バランスが崩れます。

その結果、神経を圧迫してしまうのです。

【装飾記号の使用制限（重要）】
アスタリスク（*）やハイフン（-）を箇条書き目的で多用しないでください。
AIが書いた文章に見えてしまいます。
箇条書きが必要な場合は1セクションに3〜4項目まで。それ以上は文章で展開してください。


${buildNoteArticleFooter(profile)}${buildNoteHashtags(profile)}
${buildAccumulatedContext(accCtx)}
【出力形式】
マークダウン形式で出力してください。タイトルはh1で始めてください。
noteにコピペしてそのまま公開できる品質にしてください。`;
}

// ─── GBP投稿 ──────────────────────────────────
export function gbpPostPrompt(profile: BusinessProfile, keyword: string, postType: string, accCtx?: AccumulatedContext): string {
  const urlFooter = buildUrlFooter(profile);

  return `あなたは治療院のGoogleビジネスプロフィール（GBP）投稿の専門家です。
MEO順位を上げるための最適化された投稿文を作成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}${buildOwnerInfo(profile)}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

【投稿条件】
- キーワード: ${keyword}
- 投稿タイプ: ${postType}
- 文字数: 500〜800文字（本文部分）
- 以下を含めること：
  1. 症状キーワード「${keyword}」を3〜5回自然に含める
  2. 地域名「${profile.area}」を2〜3回含める
  3. 親しみやすく専門性も感じられるトーン
- 絵文字は控えめに使用（1〜3個程度）
${buildLSIKeywords(keyword, profile)}

【投稿の構成（この順番で）】
1. 院長の自己紹介（1〜2行）${profile.ownerName ? `「${profile.area}の${profile.name} 院長の${profile.ownerName}です。」` : ""}
2. ${keyword}の悩みへの共感（具体的なシーン描写）
3. なぜその症状が起こるのか（原因の簡潔な専門解説）
4. 当院の施術アプローチ（強みを具体的に1つ展開）
5. 実際の患者の変化（口コミや実績から具体例）
6. セルフケアのワンポイントアドバイス
7. 行動喚起（CTA）
${MEDICAL_NG_NOTE}
${urlFooter ? `\n【重要：フッターリンク】\n本文の後に、以下のリンクを改行区切りでそのまま記載してください（省略しないこと）：\n\n${urlFooter}` : ""}
${buildAccumulatedContext(accCtx)}
【重要：装飾記号の禁止】
アスタリスク（*）やハイフン（-）を箇条書き・装飾目的で絶対に使わないでください。
GBP投稿はプレーンテキストです。記号で装飾するとAIが書いた文章に見えます。
情報を伝える場合は、自然な文章の流れで書いてください。

【出力形式】
GBP投稿にそのままコピーペーストできる形式で出力してください。
投稿文のみを出力し、説明は不要です。
- 各段落・セクションの間には必ず空行（改行）を入れてください
- 読みやすさのため、1文ごとに改行を入れてください
- フッターリンク部分も各リンクの間に空行を入れてください`;
}

// ─── FAQ（よくある質問）─ クリニックマーク準拠 ─────
export function faqPrompt(profile: BusinessProfile, keyword: string, accCtx?: AccumulatedContext): string {
  return `あなたは治療院のMEO対策とLLMO（AI検索最適化）の専門家です。
以下の治療院の情報をもとに、FAQ（よくある質問）を作成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

【FAQ条件】
- 症状キーワード: ${keyword}
- FAQ数: 10〜15個
- 以下の観点を必ず含めること：
  1. 症状の一般的な質問（「${keyword}の原因は？」）
  2. 施術に関する質問（「どんな施術をしますか？」「何回で変化を感じますか？」）
  3. 来院に関する質問（「初めてでも大丈夫？」「予約は必要？」）
  4. 料金・保険に関する質問（「保険は使えますか？」）
  5. 院の特徴に関する質問（「子ども連れOK？」「駐車場は？」）
  6. 再発予防に関する質問（「${keyword}の再発を防ぐには？」）
- 各回答は200〜400文字で、具体的かつ分かりやすく
- 各回答に院の強み・専門性を1つ以上自然に盛り込む
- 回答は「結論→理由→具体例→当院での対応」の構成で書く
- 患者の実際の声や具体的な改善例を引用して説得力を持たせる
- AI検索（ChatGPT・Gemini・Perplexity等）で引用されやすい、明確で簡潔な回答
- 【重要】FAQ回答は症状の専門知識を中心に作成し、「${profile.area}の${profile.name}では〜」のように地域・院名は回答の導入や締めに自然に配置
- 症状キーワード「${keyword}」を各回答に含め、地域名は3〜4個の回答に自然に配置
${buildLSIKeywords(keyword, profile)}
${MEDICAL_NG_NOTE}
${buildAccumulatedContext(accCtx)}
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
- 業種: ${profile.category}

【地域情報】
${buildAreaContext(profile)}

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
export function blogPostPrompt(profile: BusinessProfile, keyword: string, topic: string, accCtx?: AccumulatedContext): string {
  const crossLinkRule = buildCrossLinkRule("blog", profile);
  const htmlLinks = buildUrlLinksForHtml(profile);

  return `あなたは日本の治療院マーケティングとSEO・LLMO対策の専門家です。
以下の治療院のWordPressブログに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

【記事の条件】
- テーマ: ${topic}
- メイン症状キーワード: ${keyword}
- 文字数: 2500〜4000文字
- 【重要な構成比率】
  - 症状の専門的解説（原因・メカニズム・改善法）: 記事の80%
  - 院の強み・施術アプローチ: 記事の15%
  - 地域情報: タイトル・冒頭・まとめに集約（5%）
- 症状キーワード「${keyword}」を自然に8〜12回含める
- 地域名「${profile.area}」はタイトル・冒頭の挨拶・まとめのCTAに配置（2〜3回）
${buildLSIKeywords(keyword, profile)}

【文章の質を高める指示】
- 一般的な健康サイトのコピーではなく、実際の臨床経験に基づいた具体的な記述にする
- 「〜と言われています」ではなく「当院では〜というケースを多く見てきました」のように経験ベースで書く
- 数字・データを積極的に使う（「約80%の方が3回以内に変化を実感」等）
- 患者が検索しそうな悩みのフレーズをそのまま使う（「朝起きると腰が痛い」「長時間座ると辛い」等）

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

## こんな方は要注意
- ${keyword}が悪化しやすい生活習慣やタイプを具体的に列挙
- ターゲット層が「自分のことだ」と感じる描写

## よくある誤った対処法
- 痛み止めだけでは根本解決にならない理由
- 自己流ケアのリスク

## ${profile.name}の施術アプローチ
- 独自の施術方法を紹介
- カウンセリングから施術までの流れ

## 患者様の声
- 口コミデータから具体的な改善例を展開
- 「○○代の方が○回の施術で○○を実感」等の具体例

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


【改行・読みやすさの指示（絶対厳守）】
- 1つの段落（<p>タグ）は1〜2文までにする。句点（。）が2回来たら原則そこで<p>タグを閉じる
- 1つの<p>タグに3文以上詰め込むのは絶対NG
- 接続詞や逆接（しかし・ところが・だから・つまり等）の直前でも段落を切る
- 読者が話題転換を感じるたびに段落を切る
- セクション見出し（<h2>）の前後には十分な間隔を持たせる
- 箇条書き（<ul><li>）の各項目は1〜2文で簡潔に
- スマートフォンで読んだとき、画面いっぱいに文字が詰まっている状態は絶対NG
- 「読みやすさ > 情報量」を徹底する。詰め込みすぎない
- 1つのセクションで伝えることは1つに絞り、余白を大切にする

【HTML出力の具体例】
NG例（詰まりすぎ）:
<p>腰痛の原因は骨盤の歪みから来ることが多く、日常生活の姿勢が深く関わっています。長時間のデスクワークや猫背の習慣が積み重なると、筋肉の緊張バランスが崩れ、神経を圧迫してしまいます。</p>

OK例（1〜2文ごとに<p>を分ける）:
<p>腰痛の原因は、骨盤の歪みから来ることが多いです。</p>
<p>日常生活の姿勢が深く関わっています。</p>
<p>長時間のデスクワークや猫背の習慣が積み重なると、筋肉の緊張バランスが崩れます。</p>
<p>その結果、神経を圧迫してしまうのです。</p>

【装飾記号の使用制限】
アスタリスク（*）やハイフン（-）をそのまま表示する形で使わないでください。
HTMLの<ul><li>タグを使い、1セクションの箇条書きは3〜4項目まで。それ以上は文章で展開してください。

【出力形式】
HTML形式で出力してください（WordPressに直接投稿できる形式）。
- h2, h3タグで見出しを構造化
- pタグで段落を分ける（1段落1〜2文まで）
- ul/liタグでリスト化（ただし多用しない）
- strongタグで重要ワードを強調
- タイトル（h1）は含めないでください（WordPressのタイトル欄で別途入力するため）
${buildAccumulatedContext(accCtx)}`;
}

// ─── ブログ記事（FAQ参照付き）─ 一括生成用 ──────────
export function blogPostWithFaqPrompt(profile: BusinessProfile, keyword: string, topic: string, faqContent: string, accCtx?: AccumulatedContext): string {
  const crossLinkRule = buildCrossLinkRule("blog", profile);
  const htmlLinks = buildUrlLinksForHtml(profile);

  return `あなたは日本の治療院マーケティングとSEO・LLMO対策の専門家です。
以下の治療院のWordPressブログに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

【記事の条件】
- テーマ: ${topic}
- メイン症状キーワード: ${keyword}
- 文字数: 2500〜4000文字
- 【重要な構成比率】
  - 症状の専門的解説（原因・メカニズム・改善法）: 記事の80%
  - 院の強み・施術アプローチ: 記事の15%
  - 地域情報: タイトル・冒頭・まとめに集約（5%）
- 症状キーワード「${keyword}」を自然に8〜12回含める
- 地域名「${profile.area}」はタイトル・冒頭の挨拶・まとめのCTAに配置（2〜3回）
${buildLSIKeywords(keyword, profile)}

【文章の質を高める指示】
- 一般的な健康サイトのコピーではなく、実際の臨床経験に基づいた具体的な記述にする
- 「〜と言われています」ではなく「当院では〜というケースを多く見てきました」のように経験ベースで書く
- 数字・データを積極的に使う（「約80%の方が3回以内に変化を実感」等）
- 患者が検索しそうな悩みのフレーズをそのまま使う（「朝起きると腰が痛い」「長時間座ると辛い」等）

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

## こんな方は要注意
- ${keyword}が悪化しやすい生活習慣やタイプを具体的に列挙
- ターゲット層が「自分のことだ」と感じる描写

## よくある誤った対処法
- 痛み止めだけでは根本解決にならない理由
- 自己流ケアのリスク

## ${profile.name}の施術アプローチ
- 独自の施術方法を紹介
- カウンセリングから施術までの流れ

## 患者様の声
- 口コミデータから具体的な改善例を展開
- 「○○代の方が○回の施術で○○を実感」等の具体例

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


【改行・読みやすさの指示（絶対厳守）】
- 1つの段落（<p>タグ）は1〜2文までにする。句点（。）が2回来たら原則そこで<p>タグを閉じる
- 1つの<p>タグに3文以上詰め込むのは絶対NG
- 接続詞や逆接（しかし・ところが・だから・つまり等）の直前でも段落を切る
- 読者が話題転換を感じるたびに段落を切る
- セクション見出し（<h2>）の前後には十分な間隔を持たせる
- 箇条書き（<ul><li>）の各項目は1〜2文で簡潔に
- スマートフォンで読んだとき、画面いっぱいに文字が詰まっている状態は絶対NG
- 「読みやすさ > 情報量」を徹底する。詰め込みすぎない
- 1つのセクションで伝えることは1つに絞り、余白を大切にする

【HTML出力の具体例】
NG例（詰まりすぎ）:
<p>腰痛の原因は骨盤の歪みから来ることが多く、日常生活の姿勢が深く関わっています。長時間のデスクワークや猫背の習慣が積み重なると、筋肉の緊張バランスが崩れ、神経を圧迫してしまいます。</p>

OK例（1〜2文ごとに<p>を分ける）:
<p>腰痛の原因は、骨盤の歪みから来ることが多いです。</p>
<p>日常生活の姿勢が深く関わっています。</p>
<p>長時間のデスクワークや猫背の習慣が積み重なると、筋肉の緊張バランスが崩れます。</p>
<p>その結果、神経を圧迫してしまうのです。</p>

【装飾記号の使用制限】
アスタリスク（*）やハイフン（-）をそのまま表示する形で使わないでください。
HTMLの<ul><li>タグを使い、1セクションの箇条書きは3〜4項目まで。それ以上は文章で展開してください。

【出力形式】
HTML形式で出力してください（WordPressに直接投稿できる形式）。
- h2, h3タグで見出しを構造化
- pタグで段落を分ける（1段落1〜2文まで）
- ul/liタグでリスト化（ただし多用しない）
- strongタグで重要ワードを強調
- タイトル（h1）は含めないでください（WordPressのタイトル欄で別途入力するため）
${buildAccumulatedContext(accCtx)}`;
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
export function faqWithBlogUrlPrompt(profile: BusinessProfile, keyword: string, blogUrl?: string, accCtx?: AccumulatedContext): string {
  const crossLinkRule = buildCrossLinkRule("faq", profile, blogUrl || "");
  const htmlLinks = buildUrlLinksForHtml(profile, blogUrl || "");

  return `あなたは治療院のMEO対策とLLMO（AI検索最適化）の専門家です。
以下の治療院の「よくある質問」ページをWordPress投稿用HTML形式で作成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

【FAQ条件】
- 症状キーワード: ${keyword}
- FAQ数: 10〜15個
- 以下の観点を必ず含める：
  1. 症状の原因（「${keyword}の原因は？」）
  2. 施術内容（「どんな施術？」「何回で変化？」）
  3. 来院関連（「初めてでも大丈夫？」「予約方法は？」）
  4. 料金・保険
  5. 院の特徴（子連れOK・駐車場等）
  6. 再発予防
- 各回答は200〜400文字
- 各回答に院の強み・専門性を1つ以上自然に盛り込む
- 回答は「結論→理由→具体例→当院での対応」の構成で書く
- 患者の実際の声や具体的な改善例を引用して説得力を持たせる
- AI検索で引用されやすい明確で簡潔な回答
- 【重要】FAQ回答は症状の専門知識を中心に作成し、「${profile.area}の${profile.name}では〜」のように地域・院名は回答の導入や締めに自然に配置
- 症状キーワード「${keyword}」を各回答に含め、地域名は3〜4個の回答に自然に配置
${buildLSIKeywords(keyword, profile)}
${MEDICAL_NG_NOTE}
${crossLinkRule}
${htmlLinks ? `\n【FAQ末尾の関連リンク】\n全FAQの後に関連リンクセクションを追加：\n<div class="related-links"><h3>関連ページ</h3><p>${htmlLinks}</p></div>` : ""}

【出力形式】
WordPress投稿用HTML形式で出力してください。
- 各Q&Aを<div class="faq-item">で囲む
- 質問は<h3>タグ
- 回答は<p>タグ
- リンクは<a href="URL">テキスト</a>形式
${buildAccumulatedContext(accCtx)}`;
}

// ─── 一括生成：個別FAQ生成（1質問1投稿用）──────────
export function faqIndividualListPrompt(profile: BusinessProfile, keyword: string, faqCount: number = 5, accCtx?: AccumulatedContext): string {
  const htmlLinks = buildUrlLinksForHtml(profile);

  return `あなたは治療院のMEO対策とLLMO（AI検索最適化）の専門家です。
以下の治療院の「よくある質問」を個別投稿用に生成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

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
- 各回答はWordPress投稿用HTML形式（200〜400文字）
- 各回答に院の強み・専門性を1つ以上自然に盛り込む
- 回答は「結論→理由→具体例→当院での対応」の構成で書く
- 患者の実際の声や具体的な改善例を引用して説得力を持たせる
- AI検索（ChatGPT・Gemini・Perplexity）で引用されやすい明確で簡潔な回答
- 【重要】FAQ回答は症状の専門知識を中心に作成し、「${profile.area}の${profile.name}では〜」のように地域・院名は回答の導入や締めに自然に配置
- 症状キーワード「${keyword}」を各回答に含め、地域名は3〜4個の回答に自然に配置
${buildLSIKeywords(keyword, profile)}
${MEDICAL_NG_NOTE}

【各FAQの回答HTML構成】
- 回答本文は<p>タグで記述
- 重要ポイントは<strong>で強調
- 必要に応じて<ul><li>でリスト化
${htmlLinks ? `- 回答の最後に関連リンクを1〜2個自然に埋め込む（例: <a href="URL">テキスト</a>）\n利用可能なリンク: ${htmlLinks}` : ""}

【出力形式】
以下のJSON配列形式のみ出力してください。JSON以外の文字は一切不要。
配列の要素数は必ず${faqCount}個にしてください。
${buildAccumulatedContext(accCtx)}
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
export function gbpWithBlogUrlPrompt(profile: BusinessProfile, keyword: string, blogUrl: string, accCtx?: AccumulatedContext): string {
  const urlFooter = buildUrlFooter(profile, blogUrl);

  return `あなたは治療院のGBP（Googleビジネスプロフィール）投稿の専門家です。
以下の条件でGBP投稿文を作成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}${buildOwnerInfo(profile)}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

【投稿条件】
- キーワード: ${keyword}
- 文字数: 500〜800文字（本文部分）
- 症状キーワード「${keyword}」を3〜5回
- 地域名「${profile.area}」を2〜3回
- 絵文字は控えめに使用（1〜3個）
${buildLSIKeywords(keyword, profile)}

【投稿の構成（この順番で）】
1. 院長の自己紹介（1〜2行）${profile.ownerName ? `「${profile.area}の${profile.name} 院長の${profile.ownerName}です。」` : ""}
2. ${keyword}の悩みへの共感（具体的なシーン描写）
3. なぜその症状が起こるのか（原因の簡潔な専門解説）
4. 当院の施術アプローチ（強みを具体的に1つ展開）
5. 実際の患者の変化（口コミや実績から具体例）
6. セルフケアのワンポイントアドバイス
7. 行動喚起（CTA）

${MEDICAL_NG_NOTE}

【重要：フッターリンク】
本文の後に、以下のリンクを改行区切りでそのまま記載してください（テキストのまま。省略しないこと）：

${urlFooter}

【出力形式】
【重要：装飾記号の禁止】
アスタリスク（*）やハイフン（-）を箇条書き・装飾目的で絶対に使わないでください。
GBP投稿はプレーンテキストです。記号で装飾するとAIが書いた文章に見えます。
情報を伝える場合は、自然な文章の流れで書いてください。

GBP投稿にそのままコピペできる形式。投稿文のみ出力。
- 各段落・セクションの間には必ず空行（改行）を入れてください
- 読みやすさのため、1文ごとに改行を入れてください
- フッターリンク部分も各リンクの間に空行を入れてください
${buildAccumulatedContext(accCtx)}`;
}

// ─── 一括生成：note記事（ブログURL埋め込み・装飾付き）
export function noteWithBlogUrlPrompt(profile: BusinessProfile, keyword: string, blogUrl: string, accCtx?: AccumulatedContext): string {
  const crossLinkRule = buildCrossLinkRule("note", profile, blogUrl);
  const urlLinks = buildUrlLinksForMarkdown(profile, blogUrl);

  return `あなたは治療院のコンテンツマーケティングの専門家です。
以下の治療院の情報をもとに、noteに投稿する記事を作成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}
- 説明: ${profile.description}${buildOwnerInfo(profile)}${buildNoteProfileInfo(profile)}${buildClinicContext(profile)}

【地域情報】
${buildAreaContext(profile)}

【記事の条件】
- メイン症状キーワード: 「${keyword}」
- 文字数: 3000〜5000文字
- SEO・MEO・LLMO最適化
- 以下の要素を含める：
  1. 患者の悩みに寄り添う導入文
  2. 症状の原因解説（専門性）
  3. 自院の施術アプローチ
  4. セルフケアのアドバイス
  5. 来院を促すCTA
- 地域名「${profile.area}」をタイトル・冒頭・まとめに自然に2〜3回含める
- 症状キーワード「${keyword}」を自然に8〜12回含める
- 【重要】記事の本文は症状の専門的な解説を中心に構成し（80%）、地域情報はタイトル・導入・まとめに配置（15%）、院の強みは自然に織り込む（5%）
- タイトル形式: 「【${keyword}でお悩みの方へ】原因と改善法を専門家が解説｜${profile.area}」のように地域はタイトル末尾に
- E-E-A-T意識
- Q&A形式セクション1つ
${buildLSIKeywords(keyword, profile)}

【文章の質を高める指示】
- 一般的な健康サイトのコピーではなく、実際の臨床経験に基づいた具体的な記述にする
- 「〜と言われています」ではなく「当院では〜というケースを多く見てきました」のように経験ベースで書く
- 数字・データを積極的に使う
- 患者が検索しそうな悩みのフレーズをそのまま使う
${MEDICAL_NG_NOTE}
${crossLinkRule}
${urlLinks ? `\n【記事末尾の関連リンク】\n記事の最後に「## 🔗 関連リンク」セクションを作り、以下を掲載：\n${urlLinks}` : ""}

【装飾・読みやすさの指示（最重要）】
noteの記事は「スマホで読みやすいか」が最も大切です。以下のルールを必ず守ってください：

1. 見出しは ## で大きく表示し、各見出しに適切な絵文字を1つ付ける
2. 重要なポイント・結論・キーワードは **太字** にする
3. 特に重要な注意点は 🔴 や ⚠️ で強調
4. 患者の声や重要な概念は > で引用形式にする
5. セクションの区切りには --- を使う
6. 記事冒頭に目次を入れる

【改行・余白のルール（絶対厳守）】
- 1つの段落は1〜2文までにする。句点（。）が2回来たら原則そこで段落を切る
- 段落と段落の間には必ず空行を1行入れる（空行がない状態はNG）
- 接続詞や逆接（しかし・ところが・だから・つまり等）の直前でも段落を切る
- 読者が話題転換を感じるたびに段落を切る
- 見出し（##）の前後には空行を2行入れる
- 内容を詰め込みすぎない。1つのセクションで伝えることは1つに絞る
- スマホで読んだとき、画面いっぱいに文字が詰まっている状態は絶対NG
- 「読みやすさ > 情報量」を徹底する

【改行の書き方（具体例）】
NG例（詰まりすぎ）:
腰痛の原因は骨盤の歪みから来ることが多く、日常生活の姿勢が深く関わっています。長時間のデスクワークや猫背の習慣が積み重なると、筋肉の緊張バランスが崩れ、神経を圧迫してしまいます。

OK例（1〜2文ごとに改行）:
腰痛の原因は、骨盤の歪みから来ることが多いです。

日常生活の姿勢が深く関わっています。

長時間のデスクワークや猫背の習慣が積み重なると、筋肉の緊張バランスが崩れます。

その結果、神経を圧迫してしまうのです。

【装飾記号の使用制限（重要）】
アスタリスク（*）やハイフン（-）を箇条書き目的で多用しないでください。
AIが書いた文章に見えてしまいます。
箇条書きが必要な場合は1セクションに3〜4項目まで。それ以上は文章で展開してください。


${buildNoteArticleFooter(profile)}${buildNoteHashtags(profile)}
${buildAccumulatedContext(accCtx)}
【出力形式】
マークダウン形式。タイトルはh1で。noteにコピペしてそのまま公開できる品質。`;
}

// ─── 一括生成：ブログSEO情報 ────────────────────
export function bulkBlogSeoPrompt(profile: BusinessProfile, keyword: string): string {
  return `以下の治療院ブログ記事のSEO・OGP情報を生成してください。

【治療院情報】
- 院名: ${profile.name}
- 業種: ${profile.category}

【地域情報】
${buildAreaContext(profile)}

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
