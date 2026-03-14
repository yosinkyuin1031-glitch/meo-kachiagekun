import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// モデルフォールバック（順番に試す）
const MODEL_CANDIDATES = [
  "claude-sonnet-4-6",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022",
];

// タイプ別のmax_tokens設定
const MAX_TOKENS_MAP: Record<string, number> = {
  gbp: 1500,
  faq: 3000,
  "faq-short": 2000,
  note: 5000,
  blog: 5000,
  "blog-seo": 1500,
  "structured-data": 4000,
};

// APIキーを取得：環境変数を最優先、なければリクエストのキーを使用
function resolveApiKey(requestKey?: string): string {
  // 環境変数を最優先
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey && envKey.trim().length > 50) {
    return envKey.trim();
  }
  // 環境変数がなければリクエストのキーを使う
  if (requestKey && requestKey.trim().length > 50) {
    return requestKey.trim();
  }
  return "";
}

async function tryGenerate(
  client: Anthropic,
  model: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  return content.type === "text" ? content.text : "";
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey, prompt, type } = await request.json();

    const resolvedKey = resolveApiKey(apiKey);
    if (!resolvedKey) {
      return NextResponse.json(
        { error: "APIキーが設定されていません。設定画面で入力するか、管理者に連絡してください。" },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json({ error: "プロンプトが空です" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: resolvedKey });
    const maxTokens = MAX_TOKENS_MAP[type] || 4000;

    // モデルフォールバック
    let lastError: Error | null = null;
    for (const model of MODEL_CANDIDATES) {
      try {
        const text = await tryGenerate(client, model, prompt, maxTokens);
        return NextResponse.json({ content: text, type, model });
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        const msg = err.message.toLowerCase();

        if (msg.includes("authentication") || msg.includes("api_key") || msg.includes("invalid x-api-key") || msg.includes("invalid api key")) {
          return NextResponse.json(
            { error: "APIキーが無効です。Anthropic Consoleで正しいキーを確認してください。" },
            { status: 401 }
          );
        }
        if (msg.includes("credit") || msg.includes("billing") || msg.includes("insufficient")) {
          return NextResponse.json(
            { error: "APIクレジットが不足しています。Anthropic Consoleで残高を確認してください。" },
            { status: 402 }
          );
        }
        if (msg.includes("permission") || msg.includes("forbidden")) {
          return NextResponse.json(
            { error: "このAPIキーにはアクセス権がありません。" },
            { status: 403 }
          );
        }

        // モデル関連エラーは次のモデルを試す
        if (msg.includes("not_found") || msg.includes("model") || msg.includes("404")) {
          lastError = err;
          continue;
        }

        // レート制限はリトライ
        if (msg.includes("rate_limit") || msg.includes("overloaded") || msg.includes("529")) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const text = await tryGenerate(client, model, prompt, maxTokens);
            return NextResponse.json({ content: text, type, model });
          } catch {
            lastError = err;
            continue;
          }
        }

        lastError = err;
        continue;
      }
    }

    return NextResponse.json(
      { error: `生成に失敗しました: ${lastError?.message || "不明なエラー"}` },
      { status: 500 }
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    console.error("Generate API error:", errorMsg);
    return NextResponse.json(
      { error: `エラー: ${errorMsg}` },
      { status: 500 }
    );
  }
}

// APIキー接続テスト用
export async function PUT(request: NextRequest) {
  try {
    const { apiKey } = await request.json();
    const resolvedKey = resolveApiKey(apiKey);

    if (!resolvedKey) {
      return NextResponse.json({ valid: false, error: "APIキーが見つかりません" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: resolvedKey });

    for (const model of MODEL_CANDIDATES) {
      try {
        await client.messages.create({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "テスト" }],
        });
        return NextResponse.json({ valid: true, model, source: resolvedKey === apiKey?.trim() ? "user" : "server" });
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : "";
        if (msg.includes("authentication") || msg.includes("api_key") || msg.includes("invalid")) {
          return NextResponse.json({ valid: false, error: "APIキーが無効です" }, { status: 401 });
        }
        if (msg.includes("credit") || msg.includes("billing")) {
          return NextResponse.json({ valid: false, error: "クレジット不足です" }, { status: 402 });
        }
        continue;
      }
    }

    return NextResponse.json({ valid: false, error: "利用可能なモデルがありません" }, { status: 500 });
  } catch (e) {
    return NextResponse.json(
      { valid: false, error: e instanceof Error ? e.message : "不明なエラー" },
      { status: 500 }
    );
  }
}
