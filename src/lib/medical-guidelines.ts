// ─── 医療広告ガイドラインチェック ─────────────────

interface NgWord {
  word: string;
  suggestion: string;
  category: NgCategory;
}

type NgCategory =
  | "guarantee"      // 効果保証
  | "superlative"    // 最上級・比較優良
  | "absoluteness"   // 断定的表現
  | "safety"         // 安全性の保証
  | "universality";  // 全員に効く表現

const CATEGORY_LABELS: Record<NgCategory, string> = {
  guarantee: "効果の保証表現",
  superlative: "最上級・比較優良の表現",
  absoluteness: "断定的な表現",
  safety: "安全性の保証表現",
  universality: "全員に効くような表現",
};

const CATEGORY_DESCRIPTIONS: Record<NgCategory, string> = {
  guarantee: "「必ず治る」「完治する」など、治療結果を保証するような表現は医療広告ガイドラインで禁止されています。代わりに「改善を目指す」「緩和が期待できる」といった表現を使いましょう。",
  superlative: "「日本一」「最高の」など、他と比べて優れていると主張する表現は使えません。「専門性の高い」「質の高い」など事実に基づいた表現に変えましょう。",
  absoluteness: "「確実に」「間違いなく」など、断定的な表現は避ける必要があります。「多くの場合」「高い確率で」といった柔らかい表現がおすすめです。",
  safety: "「副作用なし」「安全性100%」など、安全性を完全に保証する表現は使えません。「身体への負担が少ない」「安全性に配慮した」に言い換えましょう。",
  universality: "「全員が」「誰でも治る」など、すべての人に効果があるかのような表現は禁止です。「多くの方が」「幅広い方に対応」など、範囲を限定した表現を使いましょう。",
};

const NG_WORDS: NgWord[] = [
  { word: "完治", suggestion: "改善を目指す", category: "guarantee" },
  { word: "治ります", suggestion: "緩和が期待できます", category: "guarantee" },
  { word: "必ず治る", suggestion: "多くの方が改善を実感", category: "guarantee" },
  { word: "100%改善", suggestion: "高い改善実感率", category: "guarantee" },
  { word: "絶対に効く", suggestion: "効果が期待できる", category: "guarantee" },
  { word: "即効性", suggestion: "早い段階で変化を実感される方も", category: "guarantee" },
  { word: "治癒", suggestion: "症状の緩和・改善", category: "guarantee" },
  { word: "根治", suggestion: "根本からのアプローチ", category: "guarantee" },
  { word: "確実に", suggestion: "多くの場合", category: "absoluteness" },
  { word: "間違いなく", suggestion: "高い確率で", category: "absoluteness" },
  { word: "驚きの効果", suggestion: "多くの方が変化を実感", category: "absoluteness" },
  { word: "奇跡", suggestion: "着実な改善", category: "absoluteness" },
  { word: "最高の", suggestion: "質の高い", category: "superlative" },
  { word: "日本一", suggestion: "専門性の高い", category: "superlative" },
  { word: "世界初", suggestion: "独自の", category: "superlative" },
  { word: "他にはない", suggestion: "当院ならではの", category: "superlative" },
  { word: "唯一の治療法", suggestion: "有効なアプローチの一つ", category: "superlative" },
  { word: "副作用なし", suggestion: "身体への負担が少ない", category: "safety" },
  { word: "安全性100%", suggestion: "安全性に配慮した", category: "safety" },
  { word: "全員が", suggestion: "多くの方が", category: "universality" },
  { word: "誰でも治る", suggestion: "幅広い方に対応", category: "universality" },
  { word: "完全に治る", suggestion: "改善を目指せる", category: "guarantee" },
  { word: "確実に効果", suggestion: "効果が期待できる", category: "absoluteness" },
  { word: "必ず効果", suggestion: "多くの方が効果を実感", category: "guarantee" },
  { word: "治療効果保証", suggestion: "施術へのこだわり", category: "guarantee" },
];

export interface GuidelineViolation {
  word: string;
  suggestion: string;
  category: NgCategory;
  categoryLabel: string;
}

export interface GuidelineCheckResult {
  hasViolation: boolean;
  violations: string[];
  suggestions: string[];
  groupedViolations: Record<string, { label: string; description: string; items: GuidelineViolation[] }>;
}

export function checkMedicalGuidelines(text: string): GuidelineCheckResult {
  const violations: string[] = [];
  const suggestions: string[] = [];
  const groupedViolations: Record<string, { label: string; description: string; items: GuidelineViolation[] }> = {};

  for (const ng of NG_WORDS) {
    if (text.includes(ng.word)) {
      violations.push(ng.word);
      suggestions.push(`「${ng.word}」 → 「${ng.suggestion}」に変更を推奨`);

      if (!groupedViolations[ng.category]) {
        groupedViolations[ng.category] = {
          label: CATEGORY_LABELS[ng.category],
          description: CATEGORY_DESCRIPTIONS[ng.category],
          items: [],
        };
      }
      groupedViolations[ng.category].items.push({
        word: ng.word,
        suggestion: ng.suggestion,
        category: ng.category,
        categoryLabel: CATEGORY_LABELS[ng.category],
      });
    }
  }

  return {
    hasViolation: violations.length > 0,
    violations,
    suggestions,
    groupedViolations,
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
