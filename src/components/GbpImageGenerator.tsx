"use client";

import { useState, useRef, useEffect, useCallback, ChangeEvent } from "react";
import { BusinessProfile } from "@/lib/types";

interface Props {
  profile: BusinessProfile;
}

type TemplateType = "clinic-info" | "symptom-promo" | "campaign" | "before-after" | "hours-access";

interface TemplateConfig {
  key: TemplateType;
  label: string;
  icon: string;
  description: string;
}

const TEMPLATES: TemplateConfig[] = [
  { key: "clinic-info", label: "院情報カード", icon: "🏥", description: "院名・住所・電話番号を表示" },
  { key: "symptom-promo", label: "症状別プロモ", icon: "💪", description: "腰痛・肩こり等の訴求画像" },
  { key: "campaign", label: "キャンペーン", icon: "🎉", description: "初回割引・季節キャンペーン" },
  { key: "before-after", label: "ビフォーアフター", icon: "✨", description: "改善イメージのフレーム" },
  { key: "hours-access", label: "営業時間・アクセス", icon: "🕐", description: "営業情報とアクセス案内" },
];

const SYMPTOM_OPTIONS = ["腰痛", "肩こり", "頭痛", "膝痛", "首の痛み", "坐骨神経痛", "ぎっくり腰", "五十肩", "自律神経の乱れ", "産後骨盤矯正"];

const COLOR_PRESETS = [
  { name: "オレンジ", primary: "#EA580C", secondary: "#FED7AA", text: "#FFFFFF", bg: "#FFF7ED" },
  { name: "ブルー", primary: "#2563EB", secondary: "#BFDBFE", text: "#FFFFFF", bg: "#EFF6FF" },
  { name: "グリーン", primary: "#16A34A", secondary: "#BBF7D0", text: "#FFFFFF", bg: "#F0FDF4" },
  { name: "パープル", primary: "#9333EA", secondary: "#E9D5FF", text: "#FFFFFF", bg: "#FAF5FF" },
  { name: "レッド", primary: "#DC2626", secondary: "#FECACA", text: "#FFFFFF", bg: "#FEF2F2" },
  { name: "ティール", primary: "#0D9488", secondary: "#99F6E4", text: "#FFFFFF", bg: "#F0FDFA" },
];

// ─── 記事タイプ自動判定 ─────────────────────────
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

// ─── 症状別自動配色 ─────────────────────────────
function getAutoColorIndex(symptom: string): number {
  // 神経系 → ティール(5), 慢性痛 → オレンジ(0), 狭窄症 → レッド(4), 自律神経 → ブルー(1)
  if (symptom.includes("神経") && !symptom.includes("自律")) return 5; // ティール
  if (symptom.includes("自律")) return 1; // ブルー (blue+purple accent built into the preset)
  if (symptom.includes("狭窄")) return 4; // レッド
  // 慢性痛系
  if (["腰痛", "肩こり", "膝痛", "首の痛み", "五十肩"].some((s) => symptom.includes(s))) return 0; // オレンジ(amber accent)
  if (symptom.includes("頭痛")) return 3; // パープル
  if (symptom.includes("産後") || symptom.includes("骨盤")) return 2; // グリーン
  if (symptom.includes("ぎっくり")) return 4; // レッド
  return 0;
}

// ─── 写真ストレージ ─────────────────────────────
const PHOTOS_KEY = "meo_gbp_photos";

interface StoredPhoto {
  id: string;
  label: string;
  data: string; // base64
}

const PHOTO_LABELS = ["先生写真", "院内", "施術", "外観", "スタッフ", "その他"];

function getStoredPhotos(): StoredPhoto[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(PHOTOS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveStoredPhotos(photos: StoredPhoto[]) {
  localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos));
}

const W = 1200;
const H = 900;

export default function GbpImageGenerator({ profile }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<TemplateType>("clinic-info");
  const [colorIdx, setColorIdx] = useState(0);
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [selectedSymptom, setSelectedSymptom] = useState(SYMPTOM_OPTIONS[0]);

  // Photo management
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [newPhotoLabel, setNewPhotoLabel] = useState(PHOTO_LABELS[0]);
  const [teacherPhotoImg, setTeacherPhotoImg] = useState<HTMLImageElement | null>(null);
  const [useTeacherPhoto, setUseTeacherPhoto] = useState(false);

  // Article type detection
  const [detectedType, setDetectedType] = useState<ArticleType>("explanation");

  const colors = COLOR_PRESETS[colorIdx];

  // Load photos from localStorage
  useEffect(() => {
    setPhotos(getStoredPhotos());
  }, []);

  // Load teacher photo image when photos change
  useEffect(() => {
    const teacherPhoto = photos.find((p) => p.label === "先生写真");
    if (teacherPhoto) {
      const img = new Image();
      img.onload = () => setTeacherPhotoImg(img);
      img.src = teacherPhoto.data;
    } else {
      setTeacherPhotoImg(null);
      setUseTeacherPhoto(false);
    }
  }, [photos]);

  // Detect article type when symptom changes
  useEffect(() => {
    setDetectedType(detectArticleType(selectedSymptom));
  }, [selectedSymptom]);

  // Initialize default texts from profile
  useEffect(() => {
    setCustomText((prev) => ({
      clinicName: profile.name || "○○整体院",
      area: profile.area || "東京都○○区",
      phone: "000-0000-0000",
      description: profile.description || "あなたの痛みに寄り添う施術",
      category: profile.category || "整体院",
      campaignTitle: "初回限定キャンペーン",
      campaignDiscount: "初回 50%OFF",
      campaignNote: "ご予約はお電話またはLINEから",
      beforeLabel: "施術前",
      afterLabel: "施術後",
      beforeDesc: "長年の肩こり・腰痛に\nお悩みの方",
      afterDesc: "痛みが改善し\n快適な毎日へ",
      hours: "平日 9:00〜20:00\n土曜 9:00〜17:00\n日祝 休診",
      access: "○○駅 徒歩3分\n駐車場2台完備",
      ...prev,
    }));
  }, [profile]);

  const setText = (key: string, value: string) => {
    setCustomText((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Photo upload handler ──────────────────────
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newPhoto: StoredPhoto = {
        id: `photo-${Date.now()}`,
        label: newPhotoLabel,
        data: reader.result as string,
      };
      const updated = [...photos, newPhoto];
      setPhotos(updated);
      saveStoredPhotos(updated);
    };
    reader.readAsDataURL(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deletePhoto = (id: string) => {
    const updated = photos.filter((p) => p.id !== id);
    setPhotos(updated);
    saveStoredPhotos(updated);
  };

  // ─── Auto color selection ─────────────────────
  const handleAutoColor = () => {
    const idx = getAutoColorIndex(selectedSymptom);
    setColorIdx(idx);
  };

  // Helper: draw rounded rect
  const roundRect = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
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
  }, []);

  // Helper: draw multiline text
  const drawMultiline = useCallback((ctx: CanvasRenderingContext2D, text: string, x: number, y: number, lineHeight: number, maxWidth?: number) => {
    const lines = text.split("\n");
    let lineIdx = 0;
    lines.forEach((line) => {
      if (maxWidth) {
        let currentLine = "";
        for (const char of line) {
          const testLine = currentLine + char;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            ctx.fillText(currentLine, x, y + lineIdx * lineHeight);
            currentLine = char;
            lineIdx++;
          } else {
            currentLine = testLine;
          }
        }
        ctx.fillText(currentLine, x, y + lineIdx * lineHeight);
        lineIdx++;
      } else {
        ctx.fillText(line, x, y + lineIdx * lineHeight);
        lineIdx++;
      }
    });
  }, []);

  // Helper: draw decorative accent line
  const drawAccent = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) => {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, 4, 2);
    ctx.fill();
  }, [roundRect]);

  // Helper: draw teacher photo with rounded rect clip
  const drawTeacherPhoto = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!useTeacherPhoto || !teacherPhotoImg) return;
    const size = 200;
    const x = W - size - 60;
    const y = H / 2 - size / 2;
    const r = 24;

    ctx.save();
    // Clip to rounded rectangle
    roundRect(ctx, x, y, size, size, r);
    ctx.clip();
    // Draw image to fill the rounded rect area
    const imgAspect = teacherPhotoImg.width / teacherPhotoImg.height;
    let sx = 0, sy = 0, sw = teacherPhotoImg.width, sh = teacherPhotoImg.height;
    if (imgAspect > 1) {
      sw = sh;
      sx = (teacherPhotoImg.width - sw) / 2;
    } else {
      sh = sw;
      sy = (teacherPhotoImg.height - sh) / 2;
    }
    ctx.drawImage(teacherPhotoImg, sx, sy, sw, sh, x, y, size, size);
    ctx.restore();

    // Border
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 4;
    roundRect(ctx, x, y, size, size, r);
    ctx.stroke();
  }, [useTeacherPhoto, teacherPhotoImg, roundRect, colors]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = customText;
    const c = colors;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, W, H);

    // Decorative border
    ctx.strokeStyle = c.primary;
    ctx.lineWidth = 6;
    roundRect(ctx, 20, 20, W - 40, H - 40, 24);
    ctx.stroke();

    // Inner subtle border
    ctx.strokeStyle = c.secondary;
    ctx.lineWidth = 2;
    roundRect(ctx, 30, 30, W - 60, H - 60, 20);
    ctx.stroke();

    switch (template) {
      case "clinic-info":
        drawClinicInfo(ctx, t, c);
        break;
      case "symptom-promo":
        drawSymptomPromo(ctx, t, c);
        break;
      case "campaign":
        drawCampaign(ctx, t, c);
        break;
      case "before-after":
        drawBeforeAfter(ctx, t, c);
        break;
      case "hours-access":
        drawHoursAccess(ctx, t, c);
        break;
    }

    // Teacher photo overlay
    drawTeacherPhoto(ctx);

    // Footer branding
    ctx.fillStyle = c.primary;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, H - 50, W, 50);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.primary;
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${t.clinicName || ""} | ${t.area || ""}`, W / 2, H - 18);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customText, colors, template, selectedSymptom, roundRect, drawMultiline, drawAccent, drawTeacherPhoto]);

  function drawClinicInfo(ctx: CanvasRenderingContext2D, t: Record<string, string>, c: typeof COLOR_PRESETS[0]) {
    // Header bar
    ctx.fillStyle = c.primary;
    roundRect(ctx, 40, 40, W - 80, 140, 20);
    ctx.fill();

    // Category badge
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    roundRect(ctx, 60, 55, 120, 36, 18);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t.category || "整体院", 120, 80);

    // Clinic name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t.clinicName || "", W / 2, 135);

    // Description
    ctx.fillStyle = c.primary;
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t.description || "", W / 2, 250);

    drawAccent(ctx, W / 2 - 60, 275, 120, c.primary);

    // Info cards
    const cardY = 320;
    const cardH = 180;
    const gap = 30;
    const cardW = (W - 80 - gap * 2) / 3;

    // Address card
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, 40, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.fillStyle = c.primary;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("📍 所在地", 40 + cardW / 2, cardY + 50);
    ctx.fillStyle = "#374151";
    ctx.font = "24px sans-serif";
    ctx.fillText(t.area || "", 40 + cardW / 2, cardY + 100);

    // Phone card
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, 40 + cardW + gap, cardY, cardW, cardH, 16);
    ctx.fill();

    ctx.fillStyle = c.primary;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("📞 お電話", 40 + cardW + gap + cardW / 2, cardY + 50);
    ctx.fillStyle = "#374151";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(t.phone || "", 40 + cardW + gap + cardW / 2, cardY + 100);

    // Category card
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, 40 + (cardW + gap) * 2, cardY, cardW, cardH, 16);
    ctx.fill();

    ctx.fillStyle = c.primary;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("🏥 診療科目", 40 + (cardW + gap) * 2 + cardW / 2, cardY + 50);
    ctx.fillStyle = "#374151";
    ctx.font = "24px sans-serif";
    ctx.fillText(t.category || "", 40 + (cardW + gap) * 2 + cardW / 2, cardY + 100);

    // CTA
    ctx.fillStyle = c.primary;
    roundRect(ctx, W / 2 - 200, 560, 400, 70, 35);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("お気軽にご相談ください", W / 2, 605);

    // Decorative circles
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = c.primary;
    ctx.beginPath();
    ctx.arc(100, 700, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W - 100, 700, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawSymptomPromo(ctx: CanvasRenderingContext2D, t: Record<string, string>, c: typeof COLOR_PRESETS[0]) {
    // Large symptom text
    ctx.fillStyle = c.primary;
    ctx.globalAlpha = 0.07;
    ctx.font = "bold 300px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(selectedSymptom.charAt(0), W / 2, 350);
    ctx.globalAlpha = 1;

    // Top badge
    ctx.fillStyle = c.secondary;
    roundRect(ctx, W / 2 - 140, 60, 280, 44, 22);
    ctx.fill();
    ctx.fillStyle = c.primary;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${t.category || "整体院"}の専門施術`, W / 2, 90);

    // Article type badge
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    roundRect(ctx, W / 2 - 60, 115, 120, 28, 14);
    ctx.fill();
    ctx.fillStyle = c.primary;
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(ARTICLE_TYPE_LABELS[detectedType], W / 2, 134);

    // Main symptom
    ctx.fillStyle = c.primary;
    ctx.font = "bold 100px sans-serif";
    ctx.fillText(selectedSymptom, W / 2, 260);

    // Subtitle
    ctx.fillStyle = "#374151";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("でお悩みの方へ", W / 2, 320);

    drawAccent(ctx, W / 2 - 60, 350, 120, c.primary);

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

    // CTA
    ctx.fillStyle = c.primary;
    roundRect(ctx, W / 2 - 220, 660, 440, 70, 35);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("まずはお気軽にご相談ください", W / 2, 705);

    // Clinic name
    ctx.fillStyle = c.primary;
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(t.clinicName || "", W / 2, 780);
  }

  function drawCampaign(ctx: CanvasRenderingContext2D, t: Record<string, string>, c: typeof COLOR_PRESETS[0]) {
    // Festive top bar
    ctx.fillStyle = c.primary;
    ctx.fillRect(40, 40, W - 80, 8);

    // Decorative dots
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = c.primary;
      ctx.beginPath();
      ctx.arc(80 + i * 55, 80, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Campaign badge
    ctx.fillStyle = c.primary;
    roundRect(ctx, W / 2 - 180, 100, 360, 50, 25);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🎉 " + (t.campaignTitle || "初回限定キャンペーン"), W / 2, 133);

    // Big discount text
    ctx.fillStyle = c.primary;
    ctx.font = "bold 120px sans-serif";
    ctx.fillText(t.campaignDiscount || "初回 50%OFF", W / 2, 330);

    // Underline
    drawAccent(ctx, W / 2 - 100, 360, 200, c.primary);

    // Description
    ctx.fillStyle = "#374151";
    ctx.font = "28px sans-serif";
    ctx.fillText(t.description || "あなたの痛みに寄り添う施術", W / 2, 430);

    // Clinic info box
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, W / 2 - 280, 480, 560, 160, 16);
    ctx.fill();
    ctx.strokeStyle = c.secondary;
    ctx.lineWidth = 2;
    roundRect(ctx, W / 2 - 280, 480, 560, 160, 16);
    ctx.stroke();

    ctx.fillStyle = c.primary;
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(t.clinicName || "", W / 2, 530);

    ctx.fillStyle = "#6B7280";
    ctx.font = "22px sans-serif";
    ctx.fillText(`📍 ${t.area || ""}  📞 ${t.phone || ""}`, W / 2, 575);

    ctx.fillStyle = "#374151";
    ctx.font = "20px sans-serif";
    ctx.fillText(t.campaignNote || "ご予約はお電話またはLINEから", W / 2, 620);

    // CTA button
    ctx.fillStyle = c.primary;
    roundRect(ctx, W / 2 - 180, 680, 360, 65, 32);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("今すぐ予約する →", W / 2, 722);
  }

  function drawBeforeAfter(ctx: CanvasRenderingContext2D, t: Record<string, string>, c: typeof COLOR_PRESETS[0]) {
    // Title
    ctx.fillStyle = c.primary;
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("施術による変化イメージ", W / 2, 100);

    drawAccent(ctx, W / 2 - 80, 120, 160, c.primary);

    // Two panels
    const panelW = 480;
    const panelH = 420;
    const panelY = 170;
    const leftX = 70;
    const rightX = W - 70 - panelW;

    // Before panel
    ctx.fillStyle = "#F3F4F6";
    roundRect(ctx, leftX, panelY, panelW, panelH, 20);
    ctx.fill();
    ctx.strokeStyle = "#D1D5DB";
    ctx.lineWidth = 2;
    roundRect(ctx, leftX, panelY, panelW, panelH, 20);
    ctx.stroke();

    // Before label
    ctx.fillStyle = "#6B7280";
    roundRect(ctx, leftX + panelW / 2 - 60, panelY + 20, 120, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(t.beforeLabel || "施術前", leftX + panelW / 2, panelY + 47);

    // Before icon/text
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "80px sans-serif";
    ctx.fillText("😰", leftX + panelW / 2, panelY + 180);

    ctx.fillStyle = "#6B7280";
    ctx.font = "24px sans-serif";
    const beforeLines = (t.beforeDesc || "").split("\n");
    beforeLines.forEach((line, i) => {
      ctx.fillText(line, leftX + panelW / 2, panelY + 260 + i * 36);
    });

    // Arrow
    ctx.fillStyle = c.primary;
    ctx.font = "bold 60px sans-serif";
    ctx.fillText("→", W / 2, panelY + panelH / 2 + 10);

    // After panel
    ctx.fillStyle = c.bg;
    roundRect(ctx, rightX, panelY, panelW, panelH, 20);
    ctx.fill();
    ctx.strokeStyle = c.primary;
    ctx.lineWidth = 3;
    roundRect(ctx, rightX, panelY, panelW, panelH, 20);
    ctx.stroke();

    // After label
    ctx.fillStyle = c.primary;
    roundRect(ctx, rightX + panelW / 2 - 60, panelY + 20, 120, 40, 20);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(t.afterLabel || "施術後", rightX + panelW / 2, panelY + 47);

    // After icon/text
    ctx.font = "80px sans-serif";
    ctx.fillText("😊", rightX + panelW / 2, panelY + 180);

    ctx.fillStyle = c.primary;
    ctx.font = "bold 24px sans-serif";
    const afterLines = (t.afterDesc || "").split("\n");
    afterLines.forEach((line, i) => {
      ctx.fillText(line, rightX + panelW / 2, panelY + 260 + i * 36);
    });

    // Bottom text
    ctx.fillStyle = "#374151";
    ctx.font = "24px sans-serif";
    ctx.fillText("※ 効果には個人差があります", W / 2, 640);

    // CTA
    ctx.fillStyle = c.primary;
    roundRect(ctx, W / 2 - 200, 680, 400, 60, 30);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`${t.clinicName || ""} にご相談ください`, W / 2, 718);
  }

  function drawHoursAccess(ctx: CanvasRenderingContext2D, t: Record<string, string>, c: typeof COLOR_PRESETS[0]) {
    // Header
    ctx.fillStyle = c.primary;
    roundRect(ctx, 40, 40, W - 80, 100, 20);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${t.clinicName || ""} のご案内`, W / 2, 105);

    // Two columns
    const colW = 500;
    const colH = 460;
    const colY = 180;
    const leftX = 70;
    const rightX = W - 70 - colW;

    // Hours column
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, leftX, colY, colW, colH, 16);
    ctx.fill();

    ctx.fillStyle = c.primary;
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("🕐 営業時間", leftX + colW / 2, colY + 50);

    drawAccent(ctx, leftX + colW / 2 - 50, colY + 65, 100, c.primary);

    ctx.fillStyle = "#374151";
    ctx.font = "26px sans-serif";
    const hoursLines = (t.hours || "").split("\n");
    hoursLines.forEach((line, i) => {
      ctx.fillText(line, leftX + colW / 2, colY + 130 + i * 50);
    });

    // Reservation note
    ctx.fillStyle = c.secondary;
    roundRect(ctx, leftX + 30, colY + colH - 110, colW - 60, 80, 12);
    ctx.fill();
    ctx.fillStyle = c.primary;
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("完全予約制", leftX + colW / 2, colY + colH - 60);

    // Access column
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, rightX, colY, colW, colH, 16);
    ctx.fill();

    ctx.fillStyle = c.primary;
    ctx.font = "bold 28px sans-serif";
    ctx.fillText("📍 アクセス", rightX + colW / 2, colY + 50);

    drawAccent(ctx, rightX + colW / 2 - 50, colY + 65, 100, c.primary);

    ctx.fillStyle = "#374151";
    ctx.font = "26px sans-serif";
    ctx.fillText(t.area || "", rightX + colW / 2, colY + 130);

    const accessLines = (t.access || "").split("\n");
    accessLines.forEach((line, i) => {
      ctx.fillText(line, rightX + colW / 2, colY + 200 + i * 50);
    });

    // Phone
    ctx.fillStyle = c.primary;
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`📞 ${t.phone || ""}`, rightX + colW / 2, colY + colH - 60);

    // Bottom CTA
    ctx.fillStyle = c.primary;
    roundRect(ctx, W / 2 - 220, 680, 440, 65, 32);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("ご予約・お問い合わせはこちら", W / 2, 722);
  }

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `gbp-image-${template}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const renderEditPanel = () => {
    switch (template) {
      case "clinic-info":
        return (
          <div className="space-y-3">
            <Field label="院名" value={customText.clinicName} onChange={(v) => setText("clinicName", v)} />
            <Field label="エリア" value={customText.area} onChange={(v) => setText("area", v)} />
            <Field label="電話番号" value={customText.phone} onChange={(v) => setText("phone", v)} />
            <Field label="キャッチコピー" value={customText.description} onChange={(v) => setText("description", v)} />
            <Field label="業種" value={customText.category} onChange={(v) => setText("category", v)} />
          </div>
        );
      case "symptom-promo":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">症状を選択</label>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSymptom(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      selectedSymptom === s
                        ? "bg-orange-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {/* Article type detection display */}
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">
                記事タイプ自動判定: <span className="font-bold text-gray-700">{ARTICLE_TYPE_LABELS[detectedType]}</span>
              </p>
            </div>
            <Field label="院名" value={customText.clinicName} onChange={(v) => setText("clinicName", v)} />
            <Field label="業種" value={customText.category} onChange={(v) => setText("category", v)} />
          </div>
        );
      case "campaign":
        return (
          <div className="space-y-3">
            <Field label="キャンペーンタイトル" value={customText.campaignTitle} onChange={(v) => setText("campaignTitle", v)} />
            <Field label="割引内容（大きく表示）" value={customText.campaignDiscount} onChange={(v) => setText("campaignDiscount", v)} />
            <Field label="説明文" value={customText.description} onChange={(v) => setText("description", v)} />
            <Field label="注意書き" value={customText.campaignNote} onChange={(v) => setText("campaignNote", v)} />
            <Field label="院名" value={customText.clinicName} onChange={(v) => setText("clinicName", v)} />
            <Field label="エリア" value={customText.area} onChange={(v) => setText("area", v)} />
            <Field label="電話番号" value={customText.phone} onChange={(v) => setText("phone", v)} />
          </div>
        );
      case "before-after":
        return (
          <div className="space-y-3">
            <Field label="施術前ラベル" value={customText.beforeLabel} onChange={(v) => setText("beforeLabel", v)} />
            <Field label="施術前の説明" value={customText.beforeDesc} onChange={(v) => setText("beforeDesc", v)} multiline />
            <Field label="施術後ラベル" value={customText.afterLabel} onChange={(v) => setText("afterLabel", v)} />
            <Field label="施術後の説明" value={customText.afterDesc} onChange={(v) => setText("afterDesc", v)} multiline />
            <Field label="院名" value={customText.clinicName} onChange={(v) => setText("clinicName", v)} />
          </div>
        );
      case "hours-access":
        return (
          <div className="space-y-3">
            <Field label="営業時間（改行で区切り）" value={customText.hours} onChange={(v) => setText("hours", v)} multiline />
            <Field label="アクセス情報（改行で区切り）" value={customText.access} onChange={(v) => setText("access", v)} multiline />
            <Field label="院名" value={customText.clinicName} onChange={(v) => setText("clinicName", v)} />
            <Field label="エリア" value={customText.area} onChange={(v) => setText("area", v)} />
            <Field label="電話番号" value={customText.phone} onChange={(v) => setText("phone", v)} />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-2">🖼️ GBP画像ジェネレーター</h2>
        <p className="text-sm text-gray-600">
          Googleビジネスプロフィール投稿用の画像を作成・ダウンロードできます（1200x900px）
        </p>
      </div>

      {/* Photo Upload & Storage Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">参考写真のアップロード</h3>
        <p className="text-xs text-gray-500 mb-3">
          院長写真・施術風景などをアップロードしておくと、画像生成時にオーバーレイできます。
        </p>

        {/* Upload form */}
        <div className="flex items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ラベル</label>
            <select
              value={newPhotoLabel}
              onChange={(e) => setNewPhotoLabel(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {PHOTO_LABELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
            >
              + 写真を追加
            </button>
          </div>
        </div>

        {/* Photo grid */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.data}
                    alt={photo.label}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="block text-center text-[10px] text-gray-600 mt-1 font-medium">
                  {photo.label}
                </span>
                <button
                  onClick={() => deletePhoto(photo.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
        {photos.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">写真がまだアップロードされていません</p>
        )}
      </div>

      {/* Template selector */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">テンプレートを選択</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {TEMPLATES.map((tp) => (
            <button
              key={tp.key}
              onClick={() => setTemplate(tp.key)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                template === tp.key
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="text-2xl mb-1">{tp.icon}</div>
              <div className="text-xs font-bold text-gray-800">{tp.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{tp.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit panel */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">テキストを編集</h3>
          {renderEditPanel()}

          {/* Teacher photo overlay toggle */}
          {teacherPhotoImg && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTeacherPhoto}
                  onChange={(e) => setUseTeacherPhoto(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700">先生写真を右下に表示</span>
              </label>
            </div>
          )}

          {/* Color selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-600">カラーテーマ</label>
              <button
                onClick={handleAutoColor}
                className="px-3 py-1 bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-full text-xs font-medium hover:from-teal-600 hover:to-blue-600 transition-all"
              >
                自動配色
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map((cp, i) => (
                <button
                  key={cp.name}
                  onClick={() => setColorIdx(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    colorIdx === i
                      ? "ring-2 ring-offset-1 ring-gray-400 bg-gray-100"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: cp.primary }} />
                  {cp.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview & download */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700">プレビュー</h3>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
            >
              📥 PNGダウンロード
            </button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="w-full h-auto"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">1200 x 900px（GBP推奨サイズ）</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      ) : (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      )}
    </div>
  );
}
