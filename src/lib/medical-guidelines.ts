// ─── 医療広告ガイドラインチェック ─────────────────

interface NgWord {
  word: string;
  suggestion: string;
}

const NG_WORDS: NgWord[] = [
  { word: "完治", suggestion: "改善を目指す" },
  { word: "治ります", suggestion: "緩和が期待できます" },
  { word: "必ず治る", suggestion: "多くの方が改善を実感" },
  { word: "100%改善", suggestion: "高い改善実感率" },
  { word: "絶対に効く", suggestion: "効果が期待できる" },
  { word: "即効性", suggestion: "早い段階で変化を実感される方も" },
  { word: "治癒", suggestion: "症状の緩和・改善" },
  { word: "根治", suggestion: "根本からのアプローチ" },
  { word: "確実に", suggestion: "多くの場合" },
  { word: "間違いなく", suggestion: "高い確率で" },
  { word: "驚きの効果", suggestion: "多くの方が変化を実感" },
  { word: "奇跡", suggestion: "着実な改善" },
  { word: "最高の", suggestion: "質の高い" },
  { word: "日本一", suggestion: "専門性の高い" },
  { word: "世界初", suggestion: "独自の" },
  { word: "他にはない", suggestion: "当院ならではの" },
  { word: "唯一の治療法", suggestion: "有効なアプローチの一つ" },
  { word: "副作用なし", suggestion: "身体への負担が少ない" },
  { word: "安全性100%", suggestion: "安全性に配慮した" },
  { word: "全員が", suggestion: "多くの方が" },
  { word: "誰でも治る", suggestion: "幅広い方に対応" },
  { word: "完全に治る", suggestion: "改善を目指せる" },
  { word: "確実に効果", suggestion: "効果が期待できる" },
  { word: "必ず効果", suggestion: "多くの方が効果を実感" },
  { word: "治療効果保証", suggestion: "施術へのこだわり" },
];

export interface GuidelineCheckResult {
  hasViolation: boolean;
  violations: string[];
  suggestions: string[];
}

export function checkMedicalGuidelines(text: string): GuidelineCheckResult {
  const violations: string[] = [];
  const suggestions: string[] = [];

  for (const ng of NG_WORDS) {
    if (text.includes(ng.word)) {
      violations.push(ng.word);
      suggestions.push(`「${ng.word}」 → 「${ng.suggestion}」に変更を推奨`);
    }
  }

  return {
    hasViolation: violations.length > 0,
    violations,
    suggestions,
  };
}

// プロンプト用のNGワードリスト文字列を生成
export function getMedicalNgNote(): string {
  const wordList = NG_WORDS.map((ng) => `「${ng.word}」`).join("、");
  const suggestionList = NG_WORDS.slice(0, 5)
    .map((ng) => `「${ng.word}」→「${ng.suggestion}」`)
    .join("、");

  return `
【厳守事項：医療広告ガイドライン】
以下の表現は絶対に使用しないでください：
${wordList}
代わりに以下のような表現を使用してください：
${suggestionList} 等。
「改善を目指す」「緩和を期待できる」「多くの方が変化を実感」等の表現を推奨します。`;
}
