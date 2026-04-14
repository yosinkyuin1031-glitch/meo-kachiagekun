#!/usr/bin/env node
/**
 * MEO勝ち上げくん v2 - 新規顧客セットアップスクリプト
 *
 * Usage: node scripts/meo-setup.mjs "院名" "email@example.com"
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local 読み込み
function loadEnv() {
  const envPath = resolve(__dirname, "../.env.local");
  const content = readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    if (line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Vercel CLIが付与するエスケープ文字を除去
    val = val.replace(/\\n$/, "").replace(/\\n/g, "\n");
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const SERPAPI_KEY = env.SERPAPI_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SERPAPI_KEY) {
  console.error("❌ 環境変数が不足しています。.env.local を確認してください。");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// 業種別デフォルトキーワード
const DEFAULT_KEYWORDS = {
  整体院: ["腰痛", "肩こり", "頭痛", "自律神経", "坐骨神経痛", "ぎっくり腰", "骨盤矯正", "整体", "猫背矯正", "膝痛"],
  鍼灸院: ["腰痛", "肩こり", "頭痛", "自律神経", "鍼灸", "美容鍼", "不妊", "冷え性", "更年期", "眼精疲労"],
  接骨院: ["腰痛", "肩こり", "交通事故", "むちうち", "スポーツ障害", "骨盤矯正", "膝痛", "接骨院", "捻挫", "肉離れ"],
  治療院: ["腰痛", "肩こり", "頭痛", "自律神経", "坐骨神経痛", "整体", "鍼灸", "骨盤矯正", "冷え性", "不眠"],
};

function generatePassword() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function detectCategory(name) {
  if (name.includes("鍼灸")) return "鍼灸院";
  if (name.includes("接骨")) return "接骨院";
  if (name.includes("治療")) return "治療院";
  return "整体院";
}

function extractArea(address) {
  const match = address.match(/(東京都|北海道|(?:大阪|京都)府|.+?県)?\s*(.+?[市区町村])/);
  return match ? (match[2] || match[0]) : "";
}

async function searchBusiness(query) {
  const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&hl=ja&gl=jp&api_key=${SERPAPI_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.place_results) {
    const p = data.place_results;
    return [{
      title: p.title,
      address: p.address,
      rating: p.rating,
      reviews: p.reviews,
      website: p.website,
      phone: p.phone,
    }];
  }

  if (data.local_results) {
    return data.local_results.slice(0, 5).map(r => ({
      title: r.title,
      address: r.address,
      rating: r.rating,
      reviews: r.reviews,
      website: r.website,
      phone: r.phone,
    }));
  }

  return [];
}

async function setupCustomer(business, email) {
  const password = generatePassword();
  const category = detectCategory(business.title);
  const area = extractArea(business.address || "");
  const keywords = DEFAULT_KEYWORDS[category] || DEFAULT_KEYWORDS["整体院"];

  // 1. アカウント作成
  const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signUpError) {
    if (signUpError.message.includes("already") || signUpError.message.includes("duplicate")) {
      throw new Error("このメールアドレスは既に登録されています");
    }
    throw new Error(`アカウント作成失敗: ${signUpError.message}`);
  }

  const userId = newUser.user.id;

  // 2. ユーザー設定
  await supabase.from("meo_user_settings").upsert({
    user_id: userId,
    anthropic_key: "",
    active_clinic_id: "",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // 3. 院情報
  const clinicId = crypto.randomUUID();
  await supabase.from("meo_clinics").insert({
    id: clinicId,
    user_id: userId,
    name: business.title,
    area,
    keywords,
    description: "",
    category,
    categories: [],
    owner_name: "",
    specialty: "",
    note_profile: {},
    urls: { homepage: business.website || "", googleMap: "", booking: "" },
    wordpress: {},
    strengths: "",
    experience: "",
    reviews: "",
    nearest_station: "",
    coverage_areas: [],
  });

  // 4. アクティブ院セット
  await supabase.from("meo_user_settings").update({
    active_clinic_id: clinicId,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return { userId, clinicId, password, category, area, keywords, business };
}

// ===== メイン =====
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node scripts/meo-setup.mjs \"院名\" \"email@example.com\"");
  process.exit(1);
}

const clinicName = args[0];
const email = args[1];

console.log(`\n🔍 Googleマップで「${clinicName}」を検索中...\n`);

try {
  const results = await searchBusiness(clinicName);

  if (results.length === 0) {
    console.error("❌ 院名が見つかりませんでした。正確な院名で再検索してください。");
    process.exit(1);
  }

  const biz = results[0];
  console.log(`📍 見つかりました: ${biz.title}`);
  console.log(`   住所: ${biz.address || "不明"}`);
  console.log(`   評価: ${biz.rating ? `★${biz.rating}` : "-"} (口コミ ${biz.reviews || 0}件)`);
  console.log(`   HP: ${biz.website || "なし"}`);
  console.log("");

  console.log(`⚙️  アカウントをセットアップ中...\n`);
  const result = await setupCustomer(biz, email);

  // 結果出力（JSON形式でも出力してスキルから解析可能に）
  console.log("===RESULT_START===");
  console.log(JSON.stringify({
    success: true,
    businessName: biz.title,
    email,
    password: result.password,
    area: result.area,
    category: result.category,
    keywords: result.keywords,
    rating: biz.rating,
    reviews: biz.reviews,
    website: biz.website,
  }));
  console.log("===RESULT_END===");

  console.log(`\n✅ セットアップ完了\n`);
  console.log(`院名: ${biz.title}`);
  console.log(`エリア: ${result.area}`);
  console.log(`業種: ${result.category}`);
  console.log(`キーワード: ${result.keywords.join(", ")}`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 顧客に送るログイン情報`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`【MEO勝ち上げくん ログイン情報】\n`);
  console.log(`ログインURL: https://meo-kachiagekun-v2.vercel.app/login`);
  console.log(`メールアドレス: ${email}`);
  console.log(`パスワード: ${result.password}\n`);
  console.log(`ログイン後「設定」タブから、院の強み・得意施術・経歴を入力してください。`);
  console.log(`入力いただいた情報をもとに、AIがMEO対策コンテンツを生成します。`);
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

} catch (e) {
  console.error(`\n❌ エラー: ${e.message}\n`);
  process.exit(1);
}
