"use client";

import { useState, useEffect, useMemo } from "react";
import { GeneratedContent, ContentType } from "@/lib/types";
import { getContents, getActiveClinic } from "@/lib/supabase-storage";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import {
  format, subDays, startOfDay, startOfWeek, endOfWeek, isWithinInterval,
} from "date-fns";
import { ja } from "date-fns/locale";

// ─── 定数 ──────────────────────────────────────

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  note: "Note記事",
  gbp: "GBP投稿",
  faq: "FAQ",
  "faq-short": "FAQ(短)",
  blog: "ブログ",
  "blog-seo": "SEOブログ",
  "structured-data": "構造化データ",
  "review-reply": "口コミ返信",
};

const CHART_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

const KEYWORD_SUGGESTIONS: Record<string, string[]> = {
  "整体院": ["腰痛", "肩こり", "骨盤矯正", "猫背矯正", "頭痛", "姿勢改善", "産後骨盤", "ぎっくり腰", "坐骨神経痛", "自律神経"],
  "鍼灸院": ["鍼灸", "肩こり", "腰痛", "自律神経", "不妊治療", "美容鍼", "頭痛", "冷え性", "更年期", "眼精疲労"],
  "接骨院": ["骨折", "捻挫", "打撲", "交通事故", "スポーツ外傷", "腰痛", "肩こり", "むちうち", "リハビリ", "膝痛"],
  "カイロプラクティック": ["骨盤矯正", "背骨矯正", "姿勢改善", "頭痛", "肩こり", "腰痛", "猫背", "ストレートネック", "自律神経", "産後ケア"],
};

// ─── TagCloud コンポーネント ────────────────────

function TagCloud({ keywords }: { keywords: { word: string; count: number }[] }) {
  if (keywords.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">キーワードデータがありません</p>;
  }
  const maxCount = Math.max(...keywords.map((k) => k.count));
  const minCount = Math.min(...keywords.map((k) => k.count));
  const range = maxCount - minCount || 1;

  return (
    <div className="flex flex-wrap gap-2 justify-center py-4">
      {keywords.map((kw) => {
        const ratio = (kw.count - minCount) / range;
        const fontSize = 0.75 + ratio * 1.25; // 0.75rem ~ 2rem
        const opacity = 0.5 + ratio * 0.5;
        return (
          <span key={kw.word}
            className="inline-block px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium cursor-default hover:bg-indigo-100 transition-colors"
            style={{ fontSize: `${fontSize}rem`, opacity }}
            title={`${kw.count}回使用`}>
            {kw.word}
          </span>
        );
      })}
    </div>
  );
}

// ─── メインコンポーネント ───────────────────────

export default function AnalyticsDashboard() {
  const [contents, setContents] = useState<GeneratedContent[]>([]);
  const [clinicCategory, setClinicCategory] = useState("整体院");
  const [clinicName, setClinicName] = useState("院");

  useEffect(() => {
    getContents().then(setContents);
    getActiveClinic().then((clinic) => {
      if (clinic?.category) setClinicCategory(clinic.category);
      if (clinic?.name) setClinicName(clinic.name);
    });
  }, []);

  // ─── 生成コンテンツ統計 ─────────────────────

  const contentByType = useMemo(() => {
    const counts: Record<string, number> = {};
    contents.forEach((c) => {
      const label = CONTENT_TYPE_LABELS[c.type] || c.type;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [contents]);

  const trendData = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(today, 29 - i);
      return { date, label: format(date, "M/d"), count: 0 };
    });
    contents.forEach((c) => {
      const created = startOfDay(new Date(c.createdAt));
      const idx = days.findIndex(
        (d) => format(d.date, "yyyy-MM-dd") === format(created, "yyyy-MM-dd")
      );
      if (idx >= 0) days[idx].count++;
    });
    return days;
  }, [contents]);

  const wpPieData = useMemo(() => {
    const published = contents.filter((c) => c.wpPostId).length;
    const draft = contents.length - published;
    return [
      { name: "WordPress公開済み", value: published },
      { name: "未公開/下書き", value: draft },
    ];
  }, [contents]);

  // ─── キーワード分析 ─────────────────────────

  const keywordFrequency = useMemo(() => {
    const counts: Record<string, number> = {};
    contents.forEach((c) => {
      if (c.keyword) {
        const kw = c.keyword.trim();
        if (kw) counts[kw] = (counts[kw] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  }, [contents]);

  const suggestedKeywords = useMemo(() => {
    const suggestions = KEYWORD_SUGGESTIONS[clinicCategory] || KEYWORD_SUGGESTIONS["整体院"];
    const usedSet = new Set(contents.map((c) => c.keyword?.trim()).filter(Boolean));
    return suggestions.filter((kw) => !usedSet.has(kw));
  }, [contents, clinicCategory]);

  // ─── 週間サマリー ──────────────────────────

  const weeklySummary = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { locale: ja });
    const weekEnd = endOfWeek(now, { locale: ja });
    const thisWeek = contents.filter((c) => {
      const d = new Date(c.createdAt);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });

    const typesGenerated = new Set(thisWeek.map((c) => c.type));
    const allTypes: ContentType[] = ["gbp", "blog", "blog-seo", "faq", "faq-short", "note", "structured-data"];
    const missingTypes = allTypes.filter((t) => !typesGenerated.has(t));

    return {
      count: thisWeek.length,
      weekStart: format(weekStart, "M/d(E)", { locale: ja }),
      weekEnd: format(weekEnd, "M/d(E)", { locale: ja }),
      typesGenerated: [...typesGenerated],
      missingTypes,
    };
  }, [contents]);

  // ─── レンダリング ──────────────────────────

  const isEmpty = contents.length === 0;

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">MEO パフォーマンス分析</h2>
        <p className="text-sm text-gray-500 mt-1">
          {clinicName} の MEO 施策状況を一覧で確認
        </p>
      </div>

      {/* ═══ 1. 生成コンテンツ統計 ═══ */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-sm">📊</span>
          生成コンテンツ統計
        </h3>

        {/* 総数 */}
        <div className="text-center mb-8">
          <div className="text-6xl font-extrabold text-indigo-600">{contents.length}</div>
          <div className="text-sm text-gray-500 mt-1">コンテンツ生成総数</div>
        </div>

        {isEmpty ? (
          <p className="text-center text-gray-400 py-8">
            まだコンテンツが生成されていません。「コンテンツ生成」タブから作成しましょう。
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* タイプ別棒グラフ */}
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-3">タイプ別生成数</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={contentByType} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="生成数" radius={[6, 6, 0, 0]}>
                    {contentByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 30日間トレンド */}
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-3">過去30日間の生成トレンド</h4>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="生成数"
                    stroke="#6366f1" fill="url(#colorTrend)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* WordPress投稿比率 */}
            <div className="lg:col-span-2">
              <h4 className="text-sm font-semibold text-gray-600 mb-3">WordPress投稿比率</h4>
              <div className="flex justify-center">
                <ResponsiveContainer width={300} height={220}>
                  <PieChart>
                    <Pie data={wpPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" labelLine={false}
                      label={({ name, percent }: { name?: string; percent?: number }) => `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`}>
                      <Cell fill="#6366f1" />
                      <Cell fill="#e5e7eb" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══ 2. キーワード分析 ═══ */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-sm">🔍</span>
          キーワード分析
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* キーワード頻度 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-3">使用キーワード頻度</h4>
            {keywordFrequency.length > 0 ? (
              <div className="space-y-2">
                {keywordFrequency.slice(0, 10).map((kw, i) => (
                  <div key={kw.word} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 truncate">{kw.word}</span>
                        <span className="text-gray-500 flex-shrink-0">{kw.count}回</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-purple-500 transition-all"
                          style={{ width: `${(kw.count / keywordFrequency[0].count) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">キーワードデータがありません</p>
            )}
          </div>

          {/* ワードクラウド */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-3">キーワードクラウド</h4>
            <TagCloud keywords={keywordFrequency} />
          </div>
        </div>

        {/* おすすめキーワード */}
        {suggestedKeywords.length > 0 && (
          <div className="mt-6 bg-purple-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-purple-800 mb-2">
              「{clinicCategory}」向けおすすめキーワード（未使用）
            </h4>
            <div className="flex flex-wrap gap-2">
              {suggestedKeywords.map((kw) => (
                <span key={kw}
                  className="px-3 py-1 bg-white border border-purple-200 rounded-full text-sm text-purple-700 hover:bg-purple-100 transition-colors cursor-default">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ═══ 3. 週間サマリー ═══ */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center text-sm">📅</span>
          週間サマリー
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* 今週の活動 */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-indigo-600">{weeklySummary.count}</div>
            <div className="text-xs text-indigo-500 mt-1">
              今週の生成数 ({weeklySummary.weekStart} ~ {weeklySummary.weekEnd})
            </div>
          </div>

          {/* 生成済みタイプ */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{weeklySummary.typesGenerated.length}</div>
            <div className="text-xs text-green-500 mt-1">今週生成したタイプ数</div>
          </div>

          {/* 未生成タイプ */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{weeklySummary.missingTypes.length}</div>
            <div className="text-xs text-amber-500 mt-1">まだ生成していないタイプ</div>
          </div>
        </div>

        {/* 未生成コンテンツへの提案 */}
        {weeklySummary.missingTypes.length > 0 && (
          <div className="bg-sky-50 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-sky-800 mb-3">今週まだ生成していないコンテンツ</h4>
            <div className="flex flex-wrap gap-2">
              {weeklySummary.missingTypes.map((type) => (
                <span key={type}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-sky-200 rounded-lg text-sm text-sky-700 hover:bg-sky-100 transition-colors cursor-default shadow-sm">
                  <span className="w-2 h-2 bg-sky-400 rounded-full" />
                  {CONTENT_TYPE_LABELS[type] || type}
                </span>
              ))}
            </div>
            <p className="text-xs text-sky-600 mt-3">
              「コンテンツ生成」タブからこれらのタイプを生成して、MEO施策を網羅的に進めましょう。
            </p>
          </div>
        )}

        {weeklySummary.missingTypes.length === 0 && weeklySummary.count > 0 && (
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-green-700 font-medium">
              今週は全タイプのコンテンツを生成済みです！素晴らしい！
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
