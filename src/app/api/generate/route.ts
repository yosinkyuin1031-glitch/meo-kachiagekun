import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, prompt, type } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic APIキーが設定されていません。設定画面で入力してください。" },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "プロンプトが空です" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    const maxTokens = type === "gbp" ? 1000 : type === "faq" ? 3000 : 4000;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = message.content[0];
    const text = content.type === "text" ? content.text : "";

    return NextResponse.json({ content: text, type });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    if (errorMsg.includes("authentication") || errorMsg.includes("invalid")) {
      return NextResponse.json(
        { error: "APIキーが無効です。正しいAnthropic APIキーを設定してください。" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: `コンテンツ生成に失敗しました: ${errorMsg}` },
      { status: 500 }
    );
  }
}
