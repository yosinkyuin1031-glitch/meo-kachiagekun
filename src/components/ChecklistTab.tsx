"use client";

import { useState, useEffect } from "react";
import { ChecklistItem } from "@/lib/types";
import { getChecklist, saveChecklist } from "@/lib/supabase-storage";

const CATEGORY_ICONS: Record<string, string> = {
  "GBP最適化": "📍",
  "写真・動画": "📷",
  "口コミ戦略": "⭐",
  "GBP投稿": "📝",
  "サイテーション": "🔗",
  "ウェブサイト": "🌐",
  "外部施策": "📣",
  "LLMO対策": "🤖",
  "WordPress投稿": "📄",
};

const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-500",
};

const PRIORITY_LABELS = {
  high: "優先度：高",
  medium: "優先度：中",
  low: "優先度：低",
};

export default function ChecklistTab() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    getChecklist().then(setItems);
  }, []);

  const toggleItem = async (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(updated);
    await saveChecklist(updated);
  };

  const categories = [...new Set(items.map((i) => i.category))];
  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);
  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const categoryProgress = categories.map((cat) => {
    const catItems = items.filter((i) => i.category === cat);
    const done = catItems.filter((i) => i.completed).length;
    return { category: cat, done, total: catItems.length, pct: Math.round((done / catItems.length) * 100) };
  });

  return (
    <div className="space-y-6">
      {/* 全体の進捗 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">MEO対策 進捗状況</h2>
          <span className="text-2xl font-bold text-blue-600">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">{completedCount} / {totalCount} 完了</p>
      </div>

      {/* カテゴリ別進捗 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categoryProgress.map((cp) => (
          <button
            key={cp.category}
            onClick={() => setFilter(filter === cp.category ? "all" : cp.category)}
            className={`p-3 rounded-lg text-left transition-all ${
              filter === cp.category ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white shadow-sm hover:shadow"
            }`}
          >
            <div className="flex items-center gap-1 mb-1">
              <span>{CATEGORY_ICONS[cp.category] || "📋"}</span>
              <span className="text-xs font-medium text-gray-700 truncate">{cp.category}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
              <div
                className={`h-1.5 rounded-full ${cp.pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${cp.pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{cp.done}/{cp.total}</span>
          </button>
        ))}
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            filter === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
          }`}
        >
          すべて ({totalCount})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              filter === cat ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
            }`}
          >
            {CATEGORY_ICONS[cat]} {cat}
          </button>
        ))}
      </div>

      {/* チェックリスト */}
      <div className="space-y-2">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`bg-white rounded-lg p-4 shadow-sm cursor-pointer transition-all hover:shadow ${
              item.completed ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                item.completed ? "bg-green-500 border-green-500" : "border-gray-300"
              }`}>
                {item.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-sm font-medium ${item.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                    {item.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${PRIORITY_STYLES[item.priority]}`}>
                    {PRIORITY_LABELS[item.priority]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
