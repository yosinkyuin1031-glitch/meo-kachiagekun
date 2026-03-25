"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BusinessProfile, GbpMaterialImage, ImageCategory } from "@/lib/types";
import { getGbpImages, saveGbpImage, deleteGbpImage } from "@/lib/supabase-storage";
import { ConfirmDialog, useConfirmDialog } from "./ConfirmDialog";

interface Props {
  profile: BusinessProfile;
}

const CATEGORIES: ImageCategory[] = ["施術風景", "院内風景", "スタッフ", "外観", "その他"];

const CATEGORY_ICONS: Record<ImageCategory, string> = {
  "施術風景": "💆",
  "院内風景": "🏥",
  "スタッフ": "👨‍⚕️",
  "外観": "🏢",
  "その他": "📷",
};

// GBP投稿タイプとマッチするカテゴリ
const TYPE_CATEGORY_MAP: Record<string, ImageCategory[]> = {
  "症状解説": ["施術風景", "院内風景"],
  "施術紹介": ["施術風景", "スタッフ"],
  "院内紹介": ["院内風景", "外観"],
  "スタッフ紹介": ["スタッフ"],
  "お知らせ": ["院内風景", "外観", "その他"],
  "セルフケア": ["施術風景", "その他"],
};

const POST_TYPES = Object.keys(TYPE_CATEGORY_MAP);

// デザインテンプレート
type DesignTemplate = "classic" | "modern" | "minimal" | "bold" | "elegant";

const TEMPLATE_OPTIONS: { key: DesignTemplate; label: string; desc: string }[] = [
  { key: "classic", label: "クラシック", desc: "中央配置・暗めオーバーレイ" },
  { key: "modern", label: "モダン", desc: "左寄せ・グラデーションバー" },
  { key: "minimal", label: "ミニマル", desc: "白帯・シンプルテキスト" },
  { key: "bold", label: "インパクト", desc: "大文字・斜めストライプ" },
  { key: "elegant", label: "エレガント", desc: "上下枠・セリフ風" },
];

// ---------- 画像リサイズ ----------
function resizeImage(file: File, maxWidth: number = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = (h * maxWidth) / w;
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- メインコンポーネント ----------
export default function GbpImageGenerator({ profile }: Props) {
  const [images, setImages] = useState<GbpMaterialImage[]>([]);
  const [activeTab, setActiveTab] = useState<"library" | "generate">("library");

  // ライブラリ系
  const [uploadCategory, setUploadCategory] = useState<ImageCategory>("施術風景");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 生成系
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [postType, setPostType] = useState(POST_TYPES[0]);
  const [keyword, setKeyword] = useState("");
  const [overlayText, setOverlayText] = useState("");
  const [ctaText, setCtaText] = useState("ご予約はお気軽に");
  const [template, setTemplate] = useState<DesignTemplate>("classic");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    getGbpImages().then(setImages);
  }, []);

  // カテゴリ別にフィルタされた画像
  const matchingImages = images.filter((img) => {
    const cats = TYPE_CATEGORY_MAP[postType] || CATEGORIES;
    return cats.includes(img.category);
  });

  // ---------- 画像アップロード ----------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        const dataUrl = await resizeImage(file);
        const newImage: GbpMaterialImage = {
          id: `img-${Date.now()}-${i}`,
          category: uploadCategory,
          dataUrl,
          name: file.name,
          addedAt: new Date().toISOString(),
        };
        await saveGbpImage(newImage);
      }
      setImages(await getGbpImages());
    } catch {
      setUploadError("画像のアップロードに失敗しました。ファイル形式やサイズを確認してください。");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const { confirmingId: deletingImageId, requestConfirm: requestDeleteImage, cancelConfirm: cancelDeleteImage, isConfirming: isConfirmingDeleteImage } = useConfirmDialog();

  const handleDeleteImage = async (id: string) => {
    await deleteGbpImage(id);
    setImages(await getGbpImages());
    if (selectedImageId === id) setSelectedImageId(null);
    cancelDeleteImage();
  };

  // ---------- テキスト折り返し ----------
  const wrapText = useCallback(
    (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
      const lines: string[] = [];
      let currentLine = "";
      for (const char of text) {
        const testLine = currentLine + char;
        if (ctx.measureText(testLine).width > maxWidth) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines.slice(0, 3);
    },
    []
  );

  // ---------- テキストオーバーレイ描画（テンプレート別）----------
  const drawTextOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      const font = "'Hiragino Kaku Gothic ProN', sans-serif";
      ctx.shadowBlur = 0;

      if (template === "classic") {
        // ── クラシック（中央配置・暗めオーバーレイ）──
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.font = `bold 36px ${font}`;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 8;
        ctx.fillText(profile.name || "院名", W / 2, 80);
        ctx.font = `bold 24px ${font}`;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText(postType, W / 2, 130);
        ctx.font = `bold 72px ${font}`;
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 12;
        ctx.fillText(keyword || "キーワード", W / 2, H / 2 - 20);
        ctx.shadowBlur = 0;
        if (overlayText) {
          ctx.font = `bold 40px ${font}`;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 6;
          wrapText(ctx, overlayText, W - 120).forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + 60 + i * 50));
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, H - 120, W, 120);
        if (ctaText) {
          ctx.font = `bold 32px ${font}`; ctx.fillStyle = "#fbbf24"; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 4;
          ctx.fillText(ctaText, W / 2, H - 70); ctx.shadowBlur = 0;
        }
        ctx.font = `24px ${font}`; ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText(profile.area || "", W / 2, H - 30);

      } else if (template === "modern") {
        // ── モダン（左寄せ・カラーバー）──
        ctx.textAlign = "left";
        // 左サイドバー
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(37, 99, 235, 0.9)");
        grad.addColorStop(1, "rgba(59, 130, 246, 0.7)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 60, H);
        // コンテンツエリア背景
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(60, H * 0.25, W - 120, H * 0.55);
        // アクセントライン
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(100, H * 0.3, 6, 120);
        // テキスト
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = `bold 22px ${font}`;
        ctx.fillText(postType, 130, H * 0.35);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold 64px ${font}`;
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 8;
        ctx.fillText(keyword || "キーワード", 130, H * 0.48);
        ctx.shadowBlur = 0;
        if (overlayText) {
          ctx.font = `36px ${font}`; ctx.fillStyle = "rgba(255,255,255,0.85)";
          wrapText(ctx, overlayText, W - 200).forEach((line, i) => ctx.fillText(line, 130, H * 0.56 + i * 44));
        }
        ctx.font = `bold 28px ${font}`; ctx.fillStyle = "#ffffff";
        ctx.fillText(profile.name || "", 130, H * 0.75);
        ctx.font = `20px ${font}`; ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillText(profile.area || "", 130, H * 0.8);
        // 下部CTA
        if (ctaText) {
          ctx.fillStyle = "#fbbf24";
          ctx.fillRect(60, H - 80, W - 60, 80);
          ctx.textAlign = "center";
          ctx.font = `bold 30px ${font}`; ctx.fillStyle = "#1e293b";
          ctx.fillText(ctaText, W / 2 + 30, H - 32);
        }

      } else if (template === "minimal") {
        // ── ミニマル（白帯・シンプル）──
        ctx.textAlign = "center";
        // 中央の白帯
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.fillRect(0, H * 0.3, W, H * 0.4);
        // 上下のライン
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, H * 0.3, W, 3);
        ctx.fillRect(0, H * 0.7 - 3, W, 3);
        // テキスト
        ctx.fillStyle = "#374151";
        ctx.font = `20px ${font}`;
        ctx.fillText(`${profile.area} ${postType}`, W / 2, H * 0.38);
        ctx.fillStyle = "#111827";
        ctx.font = `bold 60px ${font}`;
        ctx.fillText(keyword || "キーワード", W / 2, H / 2);
        if (overlayText) {
          ctx.font = `32px ${font}`; ctx.fillStyle = "#4b5563";
          wrapText(ctx, overlayText, W - 160).forEach((line, i) => ctx.fillText(line, W / 2, H * 0.56 + i * 40));
        }
        ctx.fillStyle = "#6b7280"; ctx.font = `bold 24px ${font}`;
        ctx.fillText(profile.name || "", W / 2, H * 0.66);
        // 下部CTA
        if (ctaText) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, H - 70, W, 70);
          ctx.fillStyle = "#fbbf24"; ctx.font = `bold 28px ${font}`;
          ctx.fillText(ctaText, W / 2, H - 28);
        }

      } else if (template === "bold") {
        // ── インパクト（大文字・斜めストライプ）──
        ctx.textAlign = "center";
        // 斜めストライプ
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-0.05);
        ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
        ctx.fillRect(-W, -60, W * 2, 180);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(-W, -200, W * 2, 130);
        ctx.restore();
        // タイプバッジ
        ctx.fillStyle = "#fbbf24"; ctx.font = `bold 28px ${font}`;
        ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 6;
        ctx.fillText(postType, W / 2, H * 0.28);
        // メインキーワード（大きく）
        ctx.font = `bold 88px ${font}`; ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 16;
        ctx.fillText(keyword || "キーワード", W / 2, H / 2 + 15);
        ctx.shadowBlur = 0;
        if (overlayText) {
          ctx.font = `bold 38px ${font}`; ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 4;
          wrapText(ctx, overlayText, W - 100).forEach((line, i) => ctx.fillText(line, W / 2, H * 0.6 + i * 46));
          ctx.shadowBlur = 0;
        }
        // 院名
        ctx.fillStyle = "#ffffff"; ctx.font = `bold 32px ${font}`;
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
        ctx.fillText(profile.name || "", W / 2, H * 0.82);
        ctx.font = `22px ${font}`; ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText(profile.area || "", W / 2, H * 0.87);
        ctx.shadowBlur = 0;
        // CTA
        if (ctaText) {
          ctx.fillStyle = "#fbbf24"; ctx.fillRect(W * 0.2, H - 80, W * 0.6, 55);
          ctx.beginPath();
          ctx.roundRect(W * 0.2, H - 80, W * 0.6, 55, 8);
          ctx.fillStyle = "#fbbf24"; ctx.fill();
          ctx.font = `bold 26px ${font}`; ctx.fillStyle = "#1e293b";
          ctx.fillText(ctaText, W / 2, H - 46);
        }

      } else if (template === "elegant") {
        // ── エレガント（上下枠・落ち着いたトーン）──
        ctx.textAlign = "center";
        // 上部枠
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(40, 40, W - 80, H - 80);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        ctx.strokeRect(60, 60, W - 120, H - 120);
        // 装飾ライン
        ctx.fillStyle = "#d4af37";
        ctx.fillRect(W * 0.3, 100, W * 0.4, 2);
        ctx.fillRect(W * 0.3, H - 100, W * 0.4, 2);
        // テキスト
        ctx.fillStyle = "#d4af37"; ctx.font = `18px ${font}`;
        ctx.fillText(profile.area || "", W / 2, 140);
        ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = `22px ${font}`;
        ctx.fillText(postType, W / 2, 180);
        ctx.fillStyle = "#ffffff"; ctx.font = `bold 64px ${font}`;
        ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 8;
        ctx.fillText(keyword || "キーワード", W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        if (overlayText) {
          ctx.font = `34px ${font}`; ctx.fillStyle = "rgba(255,255,255,0.85)";
          wrapText(ctx, overlayText, W - 200).forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + 50 + i * 42));
        }
        ctx.fillStyle = "#d4af37"; ctx.font = `bold 28px ${font}`;
        ctx.fillText(profile.name || "", W / 2, H * 0.78);
        // CTA
        if (ctaText) {
          ctx.fillStyle = "rgba(212, 175, 55, 0.9)"; ctx.font = `bold 26px ${font}`;
          ctx.fillText(ctaText, W / 2, H - 130);
        }
      }
    },
    [profile, postType, keyword, overlayText, ctaText, wrapText, template]
  );

  // ---------- Canvas描画 ----------
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = 1200;
    const H = 900;
    canvas.width = W;
    canvas.height = H;

    const selectedImg = images.find((img) => img.id === selectedImageId);

    // テンプレート別の背景グラデーション色
    const gradientColors: Record<DesignTemplate, [string, string]> = {
      classic: ["#ea580c", "#f59e0b"],
      modern: ["#1e3a5f", "#2563eb"],
      minimal: ["#f8fafc", "#e2e8f0"],
      bold: ["#991b1b", "#dc2626"],
      elegant: ["#1a1a2e", "#16213e"],
    };

    // テンプレート別のオーバーレイ強度
    const overlayOpacity: Record<DesignTemplate, number> = {
      classic: 0.35,
      modern: 0.45,
      minimal: 0.15,
      bold: 0.5,
      elegant: 0.55,
    };

    if (selectedImg) {
      const img = new Image();
      img.onload = () => {
        const scale = Math.max(W / img.width, H / img.height);
        const sw = W / scale;
        const sh = H / scale;
        const sx = (img.width - sw) / 2;
        const sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

        ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity[template]})`;
        ctx.fillRect(0, 0, W, H);

        drawTextOverlay(ctx, W, H);
      };
      img.src = selectedImg.dataUrl;
    } else {
      const colors = gradientColors[template];
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, colors[0]);
      grad.addColorStop(1, colors[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.arc(W * 0.8, H * 0.2, 200, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(W * 0.15, H * 0.75, 150, 0, Math.PI * 2);
      ctx.fill();

      drawTextOverlay(ctx, W, H);
    }
  }, [selectedImageId, images, drawTextOverlay, template]);

  const handleGenerate = () => {
    setGenerated(true);
    setTimeout(() => drawCanvas(), 50);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `gbp-${keyword || "post"}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const categoryCount = (cat: ImageCategory) =>
    images.filter((img) => img.category === cat).length;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-pink-600 to-orange-500 rounded-xl shadow-lg p-6 text-white">
        <h2 className="text-xl font-bold mb-1">GBP画像生成</h2>
        <p className="text-sm opacity-90">
          素材写真をアップロードして、投稿内容に合った画像を作成します
        </p>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("library")}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "library"
              ? "bg-orange-600 text-white shadow"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          📷 素材ライブラリ ({images.length})
        </button>
        <button
          onClick={() => setActiveTab("generate")}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "generate"
              ? "bg-orange-600 text-white shadow"
              : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          🖼️ 画像を作成
        </button>
      </div>

      {/* ========== 素材ライブラリ ========== */}
      {activeTab === "library" && (
        <div className="space-y-6">
          {/* アップロードセクション */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-base font-bold text-gray-800 mb-4">素材をアップロード</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setUploadCategory(cat)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      uploadCategory === cat
                        ? "bg-orange-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {CATEGORY_ICONS[cat]} {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-orange-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📸</div>
                <p className="text-sm font-medium text-gray-700">
                  {uploading ? "アップロード中..." : "クリックして写真を選択"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  複数選択OK / JPEG, PNG対応 / 自動リサイズ
                </p>
              </label>
            </div>

            {uploadError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                <p className="text-xs text-red-600">{uploadError}</p>
                <button onClick={() => setUploadError("")} className="text-red-400 hover:text-red-600 text-xs ml-2 flex-shrink-0">✕</button>
              </div>
            )}

            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>おすすめ素材:</strong> 施術風景、院内の雰囲気、スタッフの笑顔、外観写真など。
                Googleマイビジネスでは実際の写真が評価されます。各カテゴリ3〜5枚あると使い分けできます。
              </p>
            </div>
          </div>

          {/* カテゴリ別サマリー */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="bg-white rounded-xl shadow-sm p-4 text-center border border-gray-100"
              >
                <span className="text-2xl">{CATEGORY_ICONS[cat]}</span>
                <p className="text-2xl font-bold text-gray-800 mt-1">{categoryCount(cat)}</p>
                <p className="text-xs text-gray-500">{cat}</p>
              </div>
            ))}
          </div>

          {/* 画像一覧 */}
          {CATEGORIES.map((cat) => {
            const catImages = images.filter((img) => img.category === cat);
            if (catImages.length === 0) return null;
            return (
              <div key={cat} className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-800 mb-3">
                  {CATEGORY_ICONS[cat]} {cat}（{catImages.length}枚）
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {catImages.map((img) => (
                    <div key={img.id} className="relative group">
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                      />
                      {isConfirmingDeleteImage(img.id) ? (
                        <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center gap-2 p-2">
                          <p className="text-white text-[10px] text-center">削除しますか？</p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDeleteImage(img.id)}
                              className="px-2 py-1 bg-red-500 text-white rounded text-[10px] font-medium hover:bg-red-600"
                            >
                              削除
                            </button>
                            <button
                              onClick={cancelDeleteImage}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[10px] font-medium hover:bg-gray-300"
                            >
                              戻る
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => requestDeleteImage(img.id)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="削除"
                        >
                          ×
                        </button>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1 truncate">{img.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {images.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-10 text-center">
              <p className="text-4xl mb-3">📷</p>
              <p className="text-gray-500 text-sm">
                まだ素材がアップロードされていません。
                <br />
                上のエリアから写真を追加してください。
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========== 画像作成 ========== */}
      {activeTab === "generate" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-base font-bold text-gray-800 mb-4">投稿画像を作成</h3>

            <div className="space-y-4">
              {/* 投稿タイプ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">投稿タイプ</label>
                <div className="flex flex-wrap gap-2">
                  {POST_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setPostType(type);
                        setSelectedImageId(null);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        postType === type
                          ? "bg-orange-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* デザインテンプレート */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">デザインテンプレート</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {TEMPLATE_OPTIONS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTemplate(t.key)}
                      className={`px-3 py-2.5 rounded-lg text-left transition-all border ${
                        template === t.key
                          ? "bg-orange-600 text-white border-orange-600 shadow-md"
                          : "bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:bg-orange-50"
                      }`}
                    >
                      <span className="text-xs font-bold block">{t.label}</span>
                      <span className={`text-[10px] ${template === t.key ? "text-orange-100" : "text-gray-400"}`}>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* キーワード選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">キーワード</label>
                {profile.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {profile.keywords.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => setKeyword(kw)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          keyword === kw
                            ? "bg-orange-600 text-white"
                            : "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                        }`}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: 腰痛、肩こり"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              {/* サブテキスト */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サブテキスト（任意）
                </label>
                <input
                  type="text"
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                  placeholder="例: つらい痛みにお悩みの方へ"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              {/* CTAテキスト */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CTA（下部テキスト）
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="例: ご予約はお気軽に"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              {/* 素材選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ベース画像を選択
                  <span className="text-xs text-gray-400 ml-2">
                    （{postType}に合う素材: {matchingImages.length}枚）
                  </span>
                </label>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {/* グラデーション背景 */}
                  <button
                    onClick={() => setSelectedImageId(null)}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center text-2xl transition-all ${
                      selectedImageId === null
                        ? "border-orange-500 bg-gradient-to-br from-orange-500 to-amber-400 shadow-md"
                        : "border-gray-200 bg-gradient-to-br from-orange-200 to-amber-100 hover:border-orange-300"
                    }`}
                    title="グラデーション背景"
                  >
                    🎨
                  </button>

                  {matchingImages.map((img) => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImageId(img.id)}
                      className={`aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                        selectedImageId === img.id
                          ? "border-orange-500 shadow-md ring-2 ring-orange-300"
                          : "border-gray-200 hover:border-orange-300"
                      }`}
                    >
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>

                {matchingImages.length === 0 && images.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    「素材ライブラリ」タブで写真をアップロードすると、ここに表示されます
                  </p>
                )}

                {/* 全画像表示 */}
                {images.length > matchingImages.length && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      その他の素材も表示（全{images.length}枚）
                    </summary>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2">
                      {images
                        .filter((img) => !matchingImages.some((m) => m.id === img.id))
                        .map((img) => (
                          <button
                            key={img.id}
                            onClick={() => setSelectedImageId(img.id)}
                            className={`aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                              selectedImageId === img.id
                                ? "border-orange-500 shadow-md ring-2 ring-orange-300"
                                : "border-gray-200 hover:border-orange-300"
                            }`}
                          >
                            <img
                              src={img.dataUrl}
                              alt={img.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                    </div>
                  </details>
                )}
              </div>

              {/* 生成ボタン */}
              <button
                onClick={handleGenerate}
                disabled={!keyword}
                className={`w-full py-3.5 rounded-lg font-bold text-sm transition-all ${
                  !keyword
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-pink-600 to-orange-500 text-white hover:from-pink-700 hover:to-orange-600 shadow-lg"
                }`}
              >
                画像を生成
              </button>
            </div>
          </div>

          {/* 生成結果 */}
          {generated && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-base font-bold text-gray-800 mb-4">生成結果</h3>

              <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                <canvas
                  ref={canvasRef}
                  className="w-full"
                  style={{ maxHeight: "500px", objectFit: "contain" }}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDownload}
                  className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                >
                  画像をダウンロード（PNG）
                </button>
                <button
                  onClick={handleGenerate}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  再生成
                </button>
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>使い方:</strong> 画像をダウンロードして、Googleビジネスプロフィールの投稿画面でアップロードしてください。
                  投稿文は「コンテンツ生成 → GBP投稿」タブで生成できます。
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
