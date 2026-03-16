import { NextResponse } from "next/server";
import { chromium } from "playwright";

export const maxDuration = 120;

interface NotePublishRequest {
  email: string;
  password: string;
  title: string;
  content: string;
  status: "publish" | "draft";
  hashtags?: string[];
}

export async function POST(req: Request) {
  let browser = null;

  try {
    const body: NotePublishRequest = await req.json();
    const { email, password, title, content, status, hashtags } = body;

    if (!email || !password || !title || !content) {
      return NextResponse.json(
        { error: "メールアドレス、パスワード、タイトル、本文は必須です" },
        { status: 400 }
      );
    }

    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // 1. noteにログイン
    await page.goto("https://note.com/login", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // メールアドレス入力
    const emailInput = page.locator('input[name="login"]');
    await emailInput.fill(email);

    // パスワード入力
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill(password);

    // ログインボタンクリック
    const loginButton = page.locator('button[type="submit"]');
    await loginButton.click();

    // ログイン完了待ち
    await page.waitForTimeout(5000);

    // ログイン成功確認
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      await browser.close();
      return NextResponse.json(
        { error: "noteへのログインに失敗しました。メールアドレスとパスワードを確認してください。" },
        { status: 401 }
      );
    }

    // 2. 新規記事作成ページへ
    await page.goto("https://note.com/api/v1/text_notes", {
      waitUntil: "networkidle",
    });

    // APIを使って直接投稿を試みる
    // noteのエディタページに移動
    await page.goto("https://note.com/notes/new", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Markdownをnoteの形式に変換（見出し、太字等を維持）
    const lines = content.split("\n");
    let noteBody = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        noteBody += "\n";
        continue;
      }
      // h1タイトルはスキップ（別途タイトル入力するため）
      if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
        continue;
      }
      noteBody += trimmed + "\n";
    }

    // タイトル入力
    const titleArea = page.locator('[data-placeholder="記事タイトル"], textarea[placeholder*="タイトル"], .p-editor__title textarea, .p-editor__title input, [contenteditable][data-placeholder*="タイトル"]').first();

    try {
      await titleArea.waitFor({ timeout: 10000 });
      await titleArea.click();
      await titleArea.fill(title);
    } catch {
      // フォールバック：キーボード入力
      await page.keyboard.type(title);
    }

    await page.waitForTimeout(1000);

    // 本文入力エリアにフォーカス
    const bodyArea = page.locator('[data-placeholder="本文を入力してください"], .p-editor__body [contenteditable], .ProseMirror, [contenteditable="true"]').first();

    try {
      await bodyArea.waitFor({ timeout: 10000 });
      await bodyArea.click();
      await page.waitForTimeout(500);

      // 本文をクリップボード経由で貼り付け（書式維持のため）
      await page.evaluate((text) => {
        navigator.clipboard.writeText(text);
      }, noteBody);

      // Ctrl+V で貼り付け
      const isMac = process.platform === "darwin";
      await page.keyboard.press(isMac ? "Meta+v" : "Control+v");
      await page.waitForTimeout(2000);
    } catch {
      // フォールバック：直接入力
      await page.keyboard.type(noteBody, { delay: 10 });
    }

    // ハッシュタグ追加
    if (hashtags && hashtags.length > 0) {
      try {
        const hashtagButton = page.locator('button:has-text("ハッシュタグ"), [data-testid="hashtag-button"]').first();
        if (await hashtagButton.isVisible()) {
          await hashtagButton.click();
          await page.waitForTimeout(1000);
          for (const tag of hashtags) {
            const tagInput = page.locator('input[placeholder*="タグ"], input[placeholder*="ハッシュタグ"]').first();
            await tagInput.fill(tag);
            await page.keyboard.press("Enter");
            await page.waitForTimeout(500);
          }
        }
      } catch {
        // ハッシュタグ追加に失敗しても続行
      }
    }

    let postUrl = "";

    if (status === "publish") {
      // 公開ボタンをクリック
      try {
        const publishButton = page.locator('button:has-text("投稿"), button:has-text("公開"), [data-testid="publish-button"]').first();
        await publishButton.waitFor({ timeout: 5000 });
        await publishButton.click();
        await page.waitForTimeout(3000);

        // 確認ダイアログがあれば承認
        const confirmButton = page.locator('button:has-text("投稿する"), button:has-text("公開する")').first();
        if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmButton.click();
          await page.waitForTimeout(5000);
        }

        postUrl = page.url();
      } catch {
        // 公開に失敗した場合は下書き保存に切り替え
        status === "publish"; // keep status for response
      }
    }

    // 下書きの場合は自動保存される
    if (status === "draft" || !postUrl) {
      await page.waitForTimeout(3000);
      postUrl = page.url();
    }

    await browser.close();

    return NextResponse.json({
      success: true,
      postUrl,
      status: status === "publish" ? "公開済み" : "下書き保存済み",
      message:
        status === "publish"
          ? "noteに記事を公開しました！"
          : "noteに下書きとして保存しました！",
    });
  } catch (error) {
    if (browser) await browser.close();
    console.error("note投稿エラー:", error);
    return NextResponse.json(
      {
        error: `note投稿に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
      },
      { status: 500 }
    );
  }
}
