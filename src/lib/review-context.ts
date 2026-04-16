import { createClient } from "@/lib/supabase/client";

interface ReviewSummary {
  summary_overall: string | null;
  symptom_tags: Record<string, string[]> | null;
  representative_reviews: { text: string; rating: number; pattern: string }[] | null;
  total_count: number;
  avg_rating: number | null;
}

/**
 * キーワード（症状名）に応じて関連口コミだけを抽出してテキスト化
 * 記事生成プロンプトに渡すための軽量化されたコンテキストを作る
 */
export async function buildReviewContext(clinicId: string, keyword: string): Promise<string> {
  if (!clinicId || !keyword) return "";

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meo_review_summaries")
      .select("summary_overall, symptom_tags, representative_reviews, total_count, avg_rating")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (error || !data) return "";
    const summary = data as ReviewSummary;

    const parts: string[] = [];

    // 全体傾向
    if (summary.summary_overall) {
      parts.push(`【口コミ全体の傾向（${summary.total_count}件・平均★${summary.avg_rating?.toFixed(1) || "?"}）】\n${summary.summary_overall}`);
    }

    // キーワードに関連する症状タグの口コミを抽出
    if (summary.symptom_tags) {
      const matchedTags: string[] = [];
      for (const [tag, episodes] of Object.entries(summary.symptom_tags)) {
        // 部分一致でキーワードと関連する症状を抽出
        if (keyword.includes(tag) || tag.includes(keyword) || isRelatedSymptom(keyword, tag)) {
          matchedTags.push(`■ ${tag}\n${episodes.map((e) => `・${e}`).join("\n")}`);
        }
      }
      if (matchedTags.length > 0) {
        parts.push(`【「${keyword}」に関連する患者の声】\n${matchedTags.join("\n\n")}`);
      }
    }

    // 代表的な口コミから関連するものを抽出（最大5件）
    if (summary.representative_reviews) {
      const matched = summary.representative_reviews
        .filter((r) => r.pattern && (keyword.includes(r.pattern) || r.pattern.includes(keyword) || isRelatedSymptom(keyword, r.pattern)))
        .slice(0, 5);
      if (matched.length > 0) {
        parts.push(`【象徴的な患者の声】\n${matched.map((r) => `「${r.text}」（★${r.rating}）`).join("\n")}`);
      }
    }

    return parts.length > 0 ? parts.join("\n\n") : "";
  } catch {
    return "";
  }
}

/**
 * 症状の関連性を判定（簡易版）
 * 例：「腰痛」と「ぎっくり腰」、「肩こり」と「首こり」など
 */
function isRelatedSymptom(keyword: string, tag: string): boolean {
  const groups: string[][] = [
    ["腰痛", "ぎっくり腰", "椎間板ヘルニア", "坐骨神経痛", "脊柱管狭窄症", "腰"],
    ["肩こり", "首こり", "肩", "首", "頸"],
    ["頭痛", "片頭痛", "緊張性頭痛", "頭"],
    ["自律神経", "めまい", "不眠", "動悸", "パニック", "うつ"],
    ["膝痛", "膝", "変形性膝関節症"],
    ["猫背", "姿勢", "巻き肩", "ストレートネック"],
    ["骨盤", "産後", "歪み"],
    ["スポーツ", "ケガ", "捻挫", "肉離れ"],
  ];
  for (const group of groups) {
    const inKeyword = group.some((g) => keyword.includes(g));
    const inTag = group.some((g) => tag.includes(g));
    if (inKeyword && inTag) return true;
  }
  return false;
}
