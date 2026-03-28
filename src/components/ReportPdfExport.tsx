"use client";

import { useState } from "react";
import { RankingHistory } from "@/lib/ranking-types";
import { GeneratedContent, BusinessProfile } from "@/lib/types";
import { useToast } from "./Toast";

interface Props {
  profile: BusinessProfile;
  history: RankingHistory[];
  contents: GeneratedContent[];
}

export default function ReportPdfExport({ profile, history, contents }: Props) {
  const { showToast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState<"month" | "quarter">("month");

  const generatePdf = async () => {
    setGenerating(true);
    try {
      // 動的インポート（クライアントサイドのみ）
      const { default: jsPDF } = await import("jspdf");

      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;

      // 期間の算出
      const now = new Date();
      const periodStart = new Date(now);
      if (period === "month") {
        periodStart.setMonth(periodStart.getMonth() - 1);
      } else {
        periodStart.setMonth(periodStart.getMonth() - 3);
      }
      const periodLabel =
        period === "month"
          ? `${now.getFullYear()}年${now.getMonth() + 1}月`
          : `${periodStart.getFullYear()}年${periodStart.getMonth() + 1}月〜${now.getFullYear()}年${now.getMonth() + 1}月`;

      // 期間内のデータをフィルタ
      const periodHistory = history.filter(
        (h) => new Date(h.checkedAt) >= periodStart
      );
      const periodContents = contents.filter(
        (c) => new Date(c.createdAt) >= periodStart
      );

      // ─── NotoSansJPフォントは使えないので、テキストは英数字中心で日本語はUnicode描画 ───
      // jsPDFの標準フォントでは日本語が化けるため、描画関数でBase64フォントを使わず
      // シンプルにASCIIベースのレポートを生成する

      // ヘッダー背景
      doc.setFillColor(30, 58, 138); // blue-900
      doc.rect(0, 0, pageWidth, 40, "F");

      // タイトル
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("MEO Report", margin, 20);
      doc.setFontSize(10);
      doc.text(`${profile.name || "Clinic"} - ${periodLabel}`, margin, 30);
      doc.text(
        `Generated: ${now.toLocaleDateString("ja-JP")}`,
        pageWidth - margin - 50,
        30
      );

      yPos = 50;

      // ─── セクション1: サマリー ───
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.text("1. Summary", margin, yPos);
      yPos += 8;

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);

      // キーワード別最新順位を集計
      const keywordLatestRanks = new Map<string, number | null>();
      periodHistory.forEach((h) => {
        const existing = keywordLatestRanks.get(h.keyword);
        if (existing === undefined) {
          keywordLatestRanks.set(h.keyword, h.rank);
        }
      });

      const rankEntries = Array.from(keywordLatestRanks.entries());
      const avgRank =
        rankEntries.length > 0
          ? rankEntries
              .filter(([, r]) => r !== null)
              .reduce((sum, [, r]) => sum + (r as number), 0) /
            Math.max(
              1,
              rankEntries.filter(([, r]) => r !== null).length
            )
          : 0;

      const top3Count = rankEntries.filter(
        ([, r]) => r !== null && r <= 3
      ).length;
      const top10Count = rankEntries.filter(
        ([, r]) => r !== null && r <= 10
      ).length;

      // サマリーカード
      const cardData = [
        { label: "Ranking Checks", value: `${periodHistory.length}` },
        { label: "Avg. Rank", value: avgRank > 0 ? `${avgRank.toFixed(1)}` : "N/A" },
        { label: "TOP 3", value: `${top3Count} keywords` },
        { label: "TOP 10", value: `${top10Count} keywords` },
        { label: "Contents Generated", value: `${periodContents.length}` },
      ];

      const cardWidth = contentWidth / 3;
      cardData.forEach((card, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = margin + col * cardWidth;
        const y = yPos + row * 22;

        doc.setFillColor(240, 245, 255);
        doc.roundedRect(x, y, cardWidth - 4, 18, 3, 3, "F");

        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(card.label, x + 4, y + 6);

        doc.setFontSize(14);
        doc.setTextColor(30, 58, 138);
        doc.text(card.value, x + 4, y + 14);
      });

      yPos += Math.ceil(cardData.length / 3) * 22 + 10;

      // ─── セクション2: キーワード順位 ───
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.text("2. Keyword Rankings", margin, yPos);
      yPos += 8;

      // テーブルヘッダー
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, contentWidth, 7, "F");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text("Keyword", margin + 3, yPos + 5);
      doc.text("Rank", margin + 100, yPos + 5);
      doc.text("Change", margin + 130, yPos + 5);
      yPos += 7;

      // 各キーワード行を出力
      const keywordData = Array.from(keywordLatestRanks.entries());
      doc.setFontSize(9);
      keywordData.forEach(([keyword, rank]) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = margin;
        }

        // 前回の順位を取得
        const kwHistory = periodHistory
          .filter((h) => h.keyword === keyword)
          .sort(
            (a, b) =>
              new Date(b.checkedAt).getTime() -
              new Date(a.checkedAt).getTime()
          );
        const previousRank =
          kwHistory.length > 1 ? kwHistory[1].rank : null;
        const change =
          rank !== null && previousRank !== null
            ? previousRank - rank
            : null;

        doc.setTextColor(60, 60, 60);
        doc.text(keyword, margin + 3, yPos + 5);

        if (rank !== null) {
          if (rank <= 3) {
            doc.setTextColor(16, 185, 129); // green
          } else if (rank <= 10) {
            doc.setTextColor(59, 130, 246); // blue
          } else {
            doc.setTextColor(100, 100, 100);
          }
          doc.text(`#${rank}`, margin + 100, yPos + 5);
        } else {
          doc.setTextColor(180, 180, 180);
          doc.text("N/A", margin + 100, yPos + 5);
        }

        if (change !== null) {
          if (change > 0) {
            doc.setTextColor(16, 185, 129);
            doc.text(`+${change}`, margin + 130, yPos + 5);
          } else if (change < 0) {
            doc.setTextColor(239, 68, 68);
            doc.text(`${change}`, margin + 130, yPos + 5);
          } else {
            doc.setTextColor(160, 160, 160);
            doc.text("0", margin + 130, yPos + 5);
          }
        }

        yPos += 7;
      });

      yPos += 8;

      // ─── セクション3: コンテンツ生成サマリー ───
      if (yPos > 240) {
        doc.addPage();
        yPos = margin;
      }

      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.text("3. Content Generation", margin, yPos);
      yPos += 8;

      const typeCount: Record<string, number> = {};
      periodContents.forEach((c) => {
        typeCount[c.type] = (typeCount[c.type] || 0) + 1;
      });

      const typeLabels: Record<string, string> = {
        blog: "Blog",
        faq: "FAQ",
        gbp: "GBP Post",
        note: "Note",
        "blog-seo": "SEO Blog",
        "faq-short": "FAQ (Short)",
        "structured-data": "Structured Data",
        "review-reply": "Review Reply",
      };

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      Object.entries(typeCount).forEach(([type, count]) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = margin;
        }

        const label = typeLabels[type] || type;
        // バー表示
        doc.setFillColor(200, 215, 255);
        doc.roundedRect(margin, yPos, contentWidth, 6, 1, 1, "F");
        const barWidth = Math.min(
          contentWidth,
          (count / Math.max(1, periodContents.length)) * contentWidth
        );
        doc.setFillColor(59, 130, 246);
        doc.roundedRect(margin, yPos, barWidth, 6, 1, 1, "F");

        doc.setTextColor(60, 60, 60);
        doc.text(`${label}: ${count}`, margin + 3, yPos + 5);
        yPos += 10;
      });

      yPos += 5;

      // ─── セクション4: 競合情報 ───
      if (yPos > 230) {
        doc.addPage();
        yPos = margin;
      }

      doc.setTextColor(30, 58, 138);
      doc.setFontSize(14);
      doc.text("4. Top Competitors", margin, yPos);
      yPos += 8;

      // 競合を集計
      const competitorMap = new Map<
        string,
        { count: number; bestRank: number }
      >();
      periodHistory.forEach((entry) => {
        entry.topThree?.forEach(
          (place: { name: string; rank: number }) => {
            if (!place.name) return;
            const normalizedBiz = (profile.name || "")
              .replace(/[\s\u3000]/g, "")
              .toLowerCase();
            const normalizedPlace = place.name
              .replace(/[\s\u3000]/g, "")
              .toLowerCase();
            if (
              normalizedPlace.includes(normalizedBiz) ||
              normalizedBiz.includes(normalizedPlace)
            )
              return;

            const existing = competitorMap.get(place.name);
            if (existing) {
              existing.count += 1;
              if (place.rank < existing.bestRank)
                existing.bestRank = place.rank;
            } else {
              competitorMap.set(place.name, {
                count: 1,
                bestRank: place.rank,
              });
            }
          }
        );
      });

      const topCompetitors = Array.from(competitorMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

      doc.setFontSize(9);
      if (topCompetitors.length === 0) {
        doc.setTextColor(160, 160, 160);
        doc.text("No competitor data available.", margin + 3, yPos + 5);
        yPos += 7;
      } else {
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos, contentWidth, 7, "F");
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(8);
        doc.text("Competitor", margin + 3, yPos + 5);
        doc.text("TOP3 Count", margin + 110, yPos + 5);
        doc.text("Best Rank", margin + 145, yPos + 5);
        yPos += 7;

        doc.setFontSize(9);
        topCompetitors.forEach(([name, data]) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = margin;
          }
          doc.setTextColor(60, 60, 60);
          const displayName =
            name.length > 30 ? name.substring(0, 30) + "..." : name;
          doc.text(displayName, margin + 3, yPos + 5);
          doc.text(`${data.count}`, margin + 115, yPos + 5);
          doc.text(`#${data.bestRank}`, margin + 150, yPos + 5);
          yPos += 7;
        });
      }

      // ─── フッター ───
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalPages = (doc as any).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `MEO Report - ${profile.name || "Clinic"} - Page ${i}/${totalPages}`,
          margin,
          doc.internal.pageSize.getHeight() - 8
        );
        doc.text(
          "Powered by MEO Kachiagehkun",
          pageWidth - margin - 55,
          doc.internal.pageSize.getHeight() - 8
        );
      }

      // ファイル名
      const fileName = `MEO_Report_${profile.name || "clinic"}_${format(now)}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("PDF generation error:", error);
      showToast("PDF生成に失敗しました。もう一度お試しください。", "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="font-bold text-gray-800 mb-1">月次レポートPDF出力</h3>
      <p className="text-xs text-gray-400 mb-4">
        クライアントに渡せるMEOレポートをPDFで生成します
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* 期間選択 */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setPeriod("month")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              period === "month"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            月次
          </button>
          <button
            onClick={() => setPeriod("quarter")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              period === "quarter"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            四半期
          </button>
        </div>

        {/* PDF生成ボタン */}
        <button
          onClick={generatePdf}
          disabled={generating}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all shadow-sm"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              PDFレポートをダウンロード
            </>
          )}
        </button>
      </div>

      {/* レポート内容プレビュー */}
      <div className="mt-4 bg-gray-50 rounded-lg p-4">
        <p className="text-xs font-medium text-gray-600 mb-2">
          レポートに含まれる内容:
        </p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            順位チェック結果のサマリー（平均順位・TOP3/TOP10キーワード数）
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            キーワード別順位一覧と変動
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            コンテンツ生成実績（タイプ別の生成数）
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            競合院の分析結果（TOP5）
          </li>
        </ul>
      </div>
    </div>
  );
}

function format(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}
