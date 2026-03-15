/**
 * GBP画像のオフスクリーン生成ユーティリティ
 * BulkGenerator から呼び出して、症状プロモ画像を自動生成する
 */

const W = 1200;
const H = 900;

const COLOR_PRESETS = [
  { name: "オレンジ", primary: "#EA580C", secondary: "#FED7AA", text: "#FFFFFF", bg: "#FFF7ED" },
  { name: "ブルー", primary: "#2563EB", secondary: "#BFDBFE", text: "#FFFFFF", bg: "#EFF6FF" },
  { name: "グリーン", primary: "#16A34A", secondary: "#BBF7D0", text: "#FFFFFF", bg: "#F0FDF4" },
  { name: "パープル", primary: "#9333EA", secondary: "#E9D5FF", text: "#FFFFFF", bg: "#FAF5FF" },
  { name: "レッド", primary: "#DC2626", secondary: "#FECACA", text: "#FFFFFF", bg: "#FEF2F2" },
  { name: "ティール", primary: "#0D9488", secondary: "#99F6E4", text: "#FFFFFF", bg: "#F0FDFA" },
];

function getAutoColorIndex(symptom: string): number {
  if (symptom.includes("神経") && !symptom.includes("自律")) return 5;
  if (symptom.includes("自律")) return 1;
  if (symptom.includes("狭窄")) return 4;
  if (["腰痛", "肩こり", "膝痛", "首の痛み", "五十肩"].some((s) => symptom.includes(s))) return 0;
  if (symptom.includes("頭痛")) return 3;
  if (symptom.includes("産後") || symptom.includes("骨盤")) return 2;
  if (symptom.includes("ぎっくり")) return 4;
  return 0;
}

type ArticleType = "comparison" | "explanation" | "decision" | "reassurance" | "improvement";

const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  comparison: "比較型",
  explanation: "解説型",
  decision: "判断型",
  reassurance: "安心訴求型",
  improvement: "改善訴求型",
};

function detectArticleType(keyword: string): ArticleType {
  const kw = keyword.toLowerCase();
  if (kw.includes("違い") || kw.includes("比較") || kw.includes("どっち") || kw.includes("vs")) return "comparison";
  if (kw.includes("判断") || kw.includes("いつ") || kw.includes("受診") || kw.includes("病院")) return "decision";
  if (kw.includes("不安") || kw.includes("怖い") || kw.includes("大丈夫") || kw.includes("安心")) return "reassurance";
  if (kw.includes("改善") || kw.includes("治") || kw.includes("ストレッチ") || kw.includes("セルフケア")) return "improvement";
  return "explanation";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface GbpImageOptions {
  keyword: string;
  clinicName: string;
  area: string;
  category: string;
}

/**
 * オフスクリーンCanvasでGBP画像を生成し、base64 PNGを返す
 */
export function generateGbpImageBase64(options: GbpImageOptions): string {
  const { keyword, clinicName, area, category } = options;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const colorIdx = getAutoColorIndex(keyword);
  const c = COLOR_PRESETS[colorIdx];
  const articleType = detectArticleType(keyword);

  // Background
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative border
  ctx.strokeStyle = c.primary;
  ctx.lineWidth = 6;
  roundRect(ctx, 20, 20, W - 40, H - 40, 24);
  ctx.stroke();
  ctx.strokeStyle = c.secondary;
  ctx.lineWidth = 2;
  roundRect(ctx, 30, 30, W - 60, H - 60, 20);
  ctx.stroke();

  // Large background char
  ctx.fillStyle = c.primary;
  ctx.globalAlpha = 0.07;
  ctx.font = "bold 300px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(keyword.charAt(0), W / 2, 350);
  ctx.globalAlpha = 1;

  // Top badge
  ctx.fillStyle = c.secondary;
  roundRect(ctx, W / 2 - 140, 60, 280, 44, 22);
  ctx.fill();
  ctx.fillStyle = c.primary;
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${category || "整体院"}の専門施術`, W / 2, 90);

  // Article type badge
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  roundRect(ctx, W / 2 - 60, 115, 120, 28, 14);
  ctx.fill();
  ctx.fillStyle = c.primary;
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(ARTICLE_TYPE_LABELS[articleType], W / 2, 134);

  // Main symptom keyword
  ctx.fillStyle = c.primary;
  ctx.font = "bold 100px sans-serif";
  ctx.fillText(keyword, W / 2, 260);

  // Subtitle
  ctx.fillStyle = "#374151";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("でお悩みの方へ", W / 2, 320);

  // Accent line
  ctx.fillStyle = c.primary;
  roundRect(ctx, W / 2 - 60, 350, 120, 4, 2);
  ctx.fill();

  // Benefit boxes
  const benefits = [
    "根本原因にアプローチ",
    "痛みの少ないソフト施術",
    "一人ひとりに合わせた施術",
  ];
  const boxW = 320;
  const boxH = 70;
  const startX = W / 2 - boxW / 2;
  benefits.forEach((b, i) => {
    const y = 390 + i * 85;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, startX, y, boxW, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = c.secondary;
    ctx.lineWidth = 2;
    roundRect(ctx, startX, y, boxW, boxH, 12);
    ctx.stroke();

    ctx.fillStyle = c.primary;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("✓", startX + 20, y + 42);
    ctx.fillStyle = "#374151";
    ctx.font = "24px sans-serif";
    ctx.fillText(b, startX + 50, y + 42);
  });

  // CTA button
  ctx.textAlign = "center";
  ctx.fillStyle = c.primary;
  roundRect(ctx, W / 2 - 220, 660, 440, 70, 35);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("まずはお気軽にご相談ください", W / 2, 705);

  // Clinic name
  ctx.fillStyle = c.primary;
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(clinicName || "", W / 2, 780);

  // Footer branding
  ctx.fillStyle = c.primary;
  ctx.globalAlpha = 0.15;
  ctx.fillRect(0, H - 50, W, 50);
  ctx.globalAlpha = 1;
  ctx.fillStyle = c.primary;
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`${clinicName} | ${area}`, W / 2, H - 18);

  return canvas.toDataURL("image/png");
}

/**
 * base64をBlobに変換
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(parts[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}
