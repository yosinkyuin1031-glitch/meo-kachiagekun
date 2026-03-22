/**
 * MEO勝ち上げくん - モニターアカウント一括作成スクリプト
 *
 * 使い方:
 *   1. 下の EMAILS 配列にメールアドレスを記入
 *   2. node scripts/create-monitor-accounts.js
 *
 * 処理内容:
 *   - Supabase GoTrue API でサインアップ
 *   - DBで email_confirmed_at を即時設定（メール確認不要）
 *   - meo_user_settings に初期レコードをINSERT
 *   - 全員分のログイン情報をLINE送信用フォーマットで出力
 */

const https = require('https');
const { Client } = require('pg');

// ============================================================
// 設定
// ============================================================

const EMAILS = [
  'staygold07265123@gmail.com',   // 乾 光一 - 西登美施術所
  'popura.seikotuin@gmail.com',   // きょーへー - ぽぷら整骨院
  'yasuhito.53.9.7.1@gmail.com',  // 西田 康人 - 整体院康
  'you2911198@gmail.com',         // Yu Okazaki - YOUはり灸施術院
  'tomihisasukoyaka@yahoo.co.jp', // 中越俊兵 - Only One整骨院
  'oguri.junpei316@gmail.com',    // 小栗 純平 - 栄整治療院
  'ryoichi@raxis-ichi.jp',        // Ryoichi.Ichikawa - ichi整体院
];

const APP_URL = 'https://meo-kachiagekun.vercel.app';

const SUPABASE_URL = 'https://vzkfkazjylrkspqrnhnx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_H1Ch2D2XIuSQMzNL-ns8zg_gAqrx7wL';

const DB_CONNECTION = 'postgresql://postgres.vzkfkazjylrkspqrnhnx:fJZj8SDawfJze7H9@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

// ============================================================
// パスワード生成（12文字、読みやすい英数字）
// ============================================================

function generatePassword(length = 12) {
  // 紛らわしい文字を除外（0/O, 1/l/I）
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;

  let password = '';
  // 最低1文字ずつ含める
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];

  for (let i = 3; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // シャッフル
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// ============================================================
// Supabase GoTrue API でサインアップ
// ============================================================

function signUp(email, password) {
  return new Promise((resolve, reject) => {
    const url = new URL('/auth/v1/signup', SUPABASE_URL);
    const body = JSON.stringify({ email, password });

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(json.msg || json.error_description || json.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`レスポンス解析エラー: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  // バリデーション
  if (EMAILS.length === 0) {
    console.error('エラー: EMAILS配列にメールアドレスを追加してください。');
    process.exit(1);
  }

  const uniqueEmails = [...new Set(EMAILS.map(e => e.trim().toLowerCase()))];
  if (uniqueEmails.length !== EMAILS.length) {
    console.warn('警告: 重複するメールアドレスがあったため、重複を除外しました。');
  }

  console.log(`\n=== MEO勝ち上げくん モニターアカウント作成 ===`);
  console.log(`対象: ${uniqueEmails.length}件\n`);

  // DB接続
  const db = new Client({ connectionString: DB_CONNECTION });
  try {
    await db.connect();
    console.log('DB接続: OK\n');
  } catch (err) {
    console.error('DB接続エラー:', err.message);
    process.exit(1);
  }

  const results = [];
  const errors = [];

  for (const email of uniqueEmails) {
    const password = generatePassword();
    console.log(`--- ${email} ---`);

    try {
      // 1. サインアップ
      console.log('  サインアップ中...');
      const signUpResult = await signUp(email, password);

      const userId = signUpResult.user?.id || signUpResult.id;
      if (!userId) {
        throw new Error('ユーザーIDが取得できませんでした。レスポンス: ' + JSON.stringify(signUpResult));
      }
      console.log(`  ユーザーID: ${userId}`);

      // 2. メール確認をスキップ（email_confirmed_at を設定）
      console.log('  メール確認設定中...');
      await db.query(
        `UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1 AND email_confirmed_at IS NULL`,
        [userId]
      );
      console.log('  メール確認: 済');

      // 3. meo_user_settings に初期レコード
      console.log('  初期設定レコード作成中...');
      await db.query(
        `INSERT INTO meo_user_settings (user_id, anthropic_key, serp_api_key, active_clinic_id)
         VALUES ($1, '', '', '')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      console.log('  初期設定: 完了');

      results.push({ email, password, userId });
      console.log(`  => 成功\n`);

    } catch (err) {
      const msg = err.message || String(err);

      // 既存アカウントの場合
      if (msg.includes('already been registered') || msg.includes('already exists') || msg.includes('User already registered')) {
        console.log(`  => スキップ（既にアカウントが存在します）\n`);
        errors.push({ email, reason: '既にアカウントが存在' });
      } else {
        console.error(`  => エラー: ${msg}\n`);
        errors.push({ email, reason: msg });
      }
    }

    // API レートリミット対策（200ms待機）
    await new Promise(r => setTimeout(r, 200));
  }

  // DB切断
  await db.end();

  // ============================================================
  // 結果サマリー
  // ============================================================

  console.log('\n====================================');
  console.log('  結果サマリー');
  console.log('====================================');
  console.log(`成功: ${results.length}件`);
  console.log(`エラー/スキップ: ${errors.length}件`);

  if (errors.length > 0) {
    console.log('\n--- エラー/スキップ一覧 ---');
    for (const e of errors) {
      console.log(`  ${e.email}: ${e.reason}`);
    }
  }

  if (results.length > 0) {
    // 個別情報
    console.log('\n--- 作成済みアカウント ---');
    console.log('メールアドレス | パスワード | ユーザーID');
    console.log('-'.repeat(80));
    for (const r of results) {
      console.log(`${r.email} | ${r.password} | ${r.userId}`);
    }

    // LINE送信用フォーマット
    console.log('\n\n====================================');
    console.log('  LINE送信用テキスト（個別送信用）');
    console.log('====================================\n');

    for (const r of results) {
      console.log(`【MEO勝ち上げくん ログイン情報】`);
      console.log(`URL: ${APP_URL}`);
      console.log(`メールアドレス: ${r.email}`);
      console.log(`パスワード: ${r.password}`);
      console.log('');
    }
  }
}

main().catch((err) => {
  console.error('予期しないエラー:', err);
  process.exit(1);
});
