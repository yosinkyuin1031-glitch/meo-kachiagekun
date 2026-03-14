"use client";

import { useState, useEffect, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  getMonth,
} from "date-fns";
import { ja } from "date-fns/locale";
import { GeneratedContent } from "@/lib/types";
import { getContents } from "@/lib/storage";

// ─── 定数 ────────────────────────────────────

const CONTENT_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  note: {
    label: "note記事",
    color: "text-blue-700",
    bg: "bg-blue-100",
    border: "border-blue-300",
  },
  gbp: {
    label: "GBP投稿",
    color: "text-green-700",
    bg: "bg-green-100",
    border: "border-green-300",
  },
  faq: {
    label: "FAQ",
    color: "text-purple-700",
    bg: "bg-purple-100",
    border: "border-purple-300",
  },
  "faq-short": {
    label: "FAQ",
    color: "text-purple-700",
    bg: "bg-purple-100",
    border: "border-purple-300",
  },
  blog: {
    label: "ブログ",
    color: "text-orange-700",
    bg: "bg-orange-100",
    border: "border-orange-300",
  },
  "blog-seo": {
    label: "ブログ",
    color: "text-orange-700",
    bg: "bg-orange-100",
    border: "border-orange-300",
  },
  "structured-data": {
    label: "構造化データ",
    color: "text-gray-700",
    bg: "bg-gray-100",
    border: "border-gray-300",
  },
};

const SEASONAL_KEYWORDS: Record<number, string[]> = {
  0: ["正月太り", "冷え性"],
  1: ["花粉症対策", "肩こり"],
  2: ["花粉症", "春の不調", "自律神経"],
  3: ["新生活ストレス", "五月病予防"],
  4: ["五月病", "ぎっくり腰"],
  5: ["梅雨だるさ", "湿気と関節痛"],
  6: ["夏バテ", "冷房病"],
  7: ["熱中症", "夏の疲れ"],
  8: ["秋バテ", "自律神経"],
  9: ["寒暖差疲労", "姿勢改善"],
  10: ["冬の準備", "冷え性対策"],
  11: ["年末疲労", "大掃除腰痛"],
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const MONTHLY_TARGET = 20;

// ─── コンポーネント ────────────────────────────

export default function ContentCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [contents, setContents] = useState<GeneratedContent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    setContents(getContents());
  }, []);

  // 当月のコンテンツ
  const monthContents = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return contents.filter((c) => {
      const d = parseISO(c.createdAt);
      return d >= monthStart && d <= monthEnd;
    });
  }, [contents, currentMonth]);

  // 日ごとにコンテンツをグループ化
  const contentsByDate = useMemo(() => {
    const map = new Map<string, GeneratedContent[]>();
    monthContents.forEach((c) => {
      const key = format(parseISO(c.createdAt), "yyyy-MM-dd");
      const existing = map.get(key) || [];
      existing.push(c);
      map.set(key, existing);
    });
    return map;
  }, [monthContents]);

  // カレンダーグリッド用の日付配列
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // 選択日のコンテンツ
  const selectedDayContents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return contentsByDate.get(key) || [];
  }, [selectedDate, contentsByDate]);

  // 季節キーワード
  const seasonalKeywords =
    SEASONAL_KEYWORDS[getMonth(currentMonth)] || [];

  // 月切替
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  // 投稿数 / 目標
  const postedCount = monthContents.length;
  const progressPct = Math.min((postedCount / MONTHLY_TARGET) * 100, 100);

  return (
    <div className="space-y-6">
      {/* ── ヘッダー：月ナビ ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="前月"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">
            {format(currentMonth, "yyyy年 M月", { locale: ja })}
          </h2>
          <button
            onClick={goToToday}
            className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            今日
          </button>
        </div>

        <button
          onClick={goToNextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="次月"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── 今月の投稿目標 ── */}
      <div className="bg-white rounded-xl border p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">今月の投稿目標</span>
          <span className="tabular-nums">
            <span className="text-lg font-bold text-blue-600">{postedCount}</span>
            <span className="text-gray-400"> / {MONTHLY_TARGET} 件</span>
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressPct >= 100
                ? "bg-green-500"
                : progressPct >= 50
                ? "bg-blue-500"
                : "bg-orange-400"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {progressPct >= 100 && (
          <p className="text-xs text-green-600 font-medium">目標達成！</p>
        )}
      </div>

      {/* ── 季節キーワード ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-medium text-amber-800 mb-2">
          {format(currentMonth, "M月", { locale: ja })}のおすすめキーワード
        </p>
        <div className="flex flex-wrap gap-2">
          {seasonalKeywords.map((kw) => (
            <span
              key={kw}
              className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium border border-amber-200"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* ── カレンダーグリッド ── */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-2 ${
                i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 日付セル */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayContents = contentsByDate.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const selected = selectedDate && isSameDay(day, selectedDate);
            const dayOfWeek = day.getDay();

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(day)}
                className={`
                  relative min-h-[72px] sm:min-h-[90px] p-1 border-b border-r text-left
                  transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-inset
                  ${!inMonth ? "bg-gray-50" : ""}
                  ${selected ? "ring-2 ring-blue-500 ring-inset bg-blue-50" : ""}
                `}
              >
                {/* 日付番号 */}
                <span
                  className={`
                    inline-flex items-center justify-center text-xs sm:text-sm w-6 h-6 rounded-full
                    ${!inMonth ? "text-gray-300" : ""}
                    ${today ? "bg-blue-600 text-white font-bold" : ""}
                    ${!today && inMonth && dayOfWeek === 0 ? "text-red-500" : ""}
                    ${!today && inMonth && dayOfWeek === 6 ? "text-blue-500" : ""}
                  `}
                >
                  {format(day, "d")}
                </span>

                {/* コンテンツピル */}
                <div className="mt-0.5 space-y-0.5 overflow-hidden">
                  {dayContents.slice(0, 3).map((c) => {
                    const cfg = CONTENT_TYPE_CONFIG[c.type] || CONTENT_TYPE_CONFIG["note"];
                    return (
                      <div
                        key={c.id}
                        className={`truncate text-[10px] sm:text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} leading-tight`}
                        title={`${cfg.label}: ${c.title}`}
                      >
                        <span className="hidden sm:inline">{cfg.label}: </span>
                        {c.title}
                      </div>
                    );
                  })}
                  {dayContents.length > 3 && (
                    <div className="text-[10px] text-gray-400 px-1">
                      +{dayContents.length - 3}件
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── コンテンツタイプ凡例 ── */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(CONTENT_TYPE_CONFIG)
          .filter(([key]) => !["faq-short", "blog-seo"].includes(key))
          .map(([key, cfg]) => (
            <span key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded ${cfg.bg} ${cfg.color}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.bg} border ${cfg.border}`} />
              {cfg.label}
            </span>
          ))}
      </div>

      {/* ── 選択日の詳細パネル ── */}
      {selectedDate && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">
              {format(selectedDate, "M月d日（E）", { locale: ja })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="閉じる"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {selectedDayContents.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              この日のコンテンツはありません
            </p>
          ) : (
            <div className="divide-y">
              {selectedDayContents.map((c) => {
                const cfg = CONTENT_TYPE_CONFIG[c.type] || CONTENT_TYPE_CONFIG["note"];
                return (
                  <div key={c.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <span
                        className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${cfg.bg} ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{c.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          キーワード: {c.keyword}
                        </p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-3 whitespace-pre-wrap">
                          {c.content.slice(0, 200)}
                          {c.content.length > 200 ? "..." : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
