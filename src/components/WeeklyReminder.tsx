"use client";

import { useState, useEffect } from "react";
import { getContents } from "@/lib/supabase-storage";

const WEEKLY_GOAL = 3;

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function getDismissKey(): string {
  const today = new Date().toISOString().split("T")[0];
  return `meo_weekly_reminder_dismissed_${today}`;
}

export default function WeeklyReminder() {
  const [weeklyCount, setWeeklyCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if already dismissed today
    const key = getDismissKey();
    if (localStorage.getItem(key) === "true") {
      setDismissed(true);
      return;
    }
    setDismissed(false);

    // Fetch this week's content count
    getContents().then((contents) => {
      const { start, end } = getWeekRange();
      const thisWeek = contents.filter((c) => {
        const d = new Date(c.createdAt);
        return d >= start && d <= end;
      });
      setWeeklyCount(thisWeek.length);
    });
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(getDismissKey(), "true");
    setDismissed(true);
  };

  if (dismissed || weeklyCount === null) return null;

  // Determine banner style and message
  let bgClass: string;
  let borderClass: string;
  let iconBgClass: string;
  let textClass: string;
  let icon: string;
  let message: string;

  if (weeklyCount === 0) {
    bgClass = "bg-amber-50";
    borderClass = "border-amber-200";
    iconBgClass = "bg-amber-100";
    textClass = "text-amber-800";
    icon = "⚠️";
    message = "今週の投稿はまだ0本です。GBP投稿やFAQを作成しましょう！";
  } else if (weeklyCount < WEEKLY_GOAL) {
    const remaining = WEEKLY_GOAL - weeklyCount;
    bgClass = "bg-emerald-50";
    borderClass = "border-emerald-200";
    iconBgClass = "bg-emerald-100";
    textClass = "text-emerald-800";
    icon = "📝";
    message = `今週${weeklyCount}本投稿しました！あと${remaining}本でペース達成です`;
  } else {
    bgClass = "bg-emerald-50";
    borderClass = "border-emerald-200";
    iconBgClass = "bg-emerald-100";
    textClass = "text-emerald-800";
    icon = "🎉";
    message = `今週${weeklyCount}本投稿達成！素晴らしいペースです`;
  }

  return (
    <div className={`${bgClass} border ${borderClass} rounded-xl px-4 py-3 flex items-center gap-3`}>
      <div className={`w-8 h-8 ${iconBgClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-sm font-medium ${textClass} flex-1`}>
        {message}
      </p>
      <button
        onClick={handleDismiss}
        className={`${textClass} opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 p-1`}
        aria-label="閉じる"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
