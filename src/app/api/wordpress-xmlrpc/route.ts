import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "hnd1";

/**
 * WordPress XML-RPC APIを使ってカスタム投稿タイプ（FAQ等）に投稿する
 * REST APIでshow_in_rest=falseの投稿タイプにも対応可能
 */

interface XmlRpcPostRequest {
  siteUrl: string;
  username: string;
  appPassword: string;
  title: string;
  content: string;
  status: "publish" | "draft";
  postType: string; // "faq", "post" etc.
  slug?: string;
  customFields?: { key: string; value: string }[];
}

function buildXmlRpcRequest(
  method: string,
  params: string[]
): string {
  const paramXml = params.map((p) => `<param>${p}</param>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>${paramXml}</params>
</methodCall>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseXmlRpcResponse(xml: string): { success: boolean; value?: string; fault?: string } {
  // faultチェック
  const faultMatch = xml.match(/<fault>[\s\S]*?<string>([\s\S]*?)<\/string>/);
  if (faultMatch) {
    return { success: false, fault: faultMatch[1] };
  }

  // 成功時のレスポンス（投稿IDなど）
  const valueMatch = xml.match(/<value>[\s\S]*?<(?:string|int|i4)>([\s\S]*?)<\/(?:string|int|i4)>/);
  if (valueMatch) {
    return { success: true, value: valueMatch[1] };
  }

  // booleanレスポンス
  const boolMatch = xml.match(/<boolean>(\d)<\/boolean>/);
  if (boolMatch) {
    return { success: boolMatch[1] === "1", value: boolMatch[1] };
  }

  return { success: false, fault: "レスポンスを解析できませんでした" };
}

export async function POST(request: NextRequest) {
  try {
    const body: XmlRpcPostRequest = await request.json();
    const { siteUrl, username, appPassword, title, content, status, postType, slug, customFields } = body;

    if (!siteUrl || !username || !appPassword) {
      return NextResponse.json(
        { error: "WordPress接続情報が不足しています。" },
        { status: 400 }
      );
    }

    const baseUrl = siteUrl.replace(/\/$/, "");
    const xmlrpcUrl = `${baseUrl}/xmlrpc.php`;

    // wp.newPost メソッドでカスタム投稿タイプに投稿
    // パラメータ: blog_id, username, password, content_struct
    const customFieldsXml = (customFields || [])
      .map(
        (f) => `
        <value><struct>
          <member><name>key</name><value><string>${escapeXml(f.key)}</string></value></member>
          <member><name>value</name><value><string>${escapeXml(f.value)}</string></value></member>
        </struct></value>`
      )
      .join("");

    const contentStruct = `<value><struct>
      <member><name>post_type</name><value><string>${escapeXml(postType)}</string></value></member>
      <member><name>post_status</name><value><string>${escapeXml(status)}</string></value></member>
      <member><name>post_title</name><value><string>${escapeXml(title)}</string></value></member>
      <member><name>post_content</name><value><string>${escapeXml(content)}</string></value></member>
      ${slug ? `<member><name>post_name</name><value><string>${escapeXml(slug)}</string></value></member>` : ""}
      ${
        customFields && customFields.length > 0
          ? `<member><name>custom_fields</name><value><array><data>${customFieldsXml}</data></array></value></member>`
          : ""
      }
    </struct></value>`;

    const xmlBody = buildXmlRpcRequest("wp.newPost", [
      "<value><int>0</int></value>",
      `<value><string>${escapeXml(username)}</string></value>`,
      `<value><string>${escapeXml(appPassword)}</string></value>`,
      contentStruct,
    ]);

    const response = await fetch(xmlrpcUrl, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: xmlBody,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `WordPress XML-RPCエラー (${response.status})` },
        { status: response.status }
      );
    }

    const responseXml = await response.text();
    const result = parseXmlRpcResponse(responseXml);

    if (!result.success) {
      // 認証エラーチェック
      if (result.fault?.includes("Incorrect username") || result.fault?.includes("403")) {
        return NextResponse.json(
          { error: "WordPress認証エラー: ユーザー名またはパスワードが正しくありません。" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `WordPress投稿エラー: ${result.fault}` },
        { status: 400 }
      );
    }

    const postId = result.value;
    const postUrl = `${baseUrl}/?p=${postId}`;
    const editUrl = `${baseUrl}/wp-admin/post.php?post=${postId}&action=edit`;

    return NextResponse.json({
      success: true,
      postId: Number(postId),
      postUrl,
      editUrl,
      status,
      postType,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `WordPress投稿に失敗しました: ${errorMsg}` },
      { status: 500 }
    );
  }
}

/**
 * XML-RPCが有効か確認 + カスタム投稿タイプ一覧を取得
 */
export async function PUT(request: NextRequest) {
  try {
    const { siteUrl, username, appPassword } = await request.json();
    const baseUrl = siteUrl.replace(/\/$/, "");
    const xmlrpcUrl = `${baseUrl}/xmlrpc.php`;

    // wp.getPostTypes でカスタム投稿タイプ一覧を取得
    const xmlBody = buildXmlRpcRequest("wp.getPostTypes", [
      "<value><int>0</int></value>",
      `<value><string>${escapeXml(username)}</string></value>`,
      `<value><string>${escapeXml(appPassword)}</string></value>`,
    ]);

    const response = await fetch(xmlrpcUrl, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: xmlBody,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `XML-RPC接続エラー (${response.status})` },
        { status: response.status }
      );
    }

    const responseXml = await response.text();

    // カスタム投稿タイプの名前を抽出
    const typeMatches = responseXml.matchAll(/<name>name<\/name>[\s\S]*?<string>([\s\S]*?)<\/string>/g);
    const postTypes: string[] = [];
    for (const match of typeMatches) {
      postTypes.push(match[1]);
    }

    // FAQ系の投稿タイプがあるかチェック
    const hasFaq = postTypes.some(
      (t) => t === "faq" || t === "faqs" || t === "qa" || t.includes("faq")
    );

    return NextResponse.json({
      success: true,
      xmlrpcEnabled: true,
      postTypes,
      hasFaqPostType: hasFaq,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `XML-RPC確認に失敗しました: ${errorMsg}` },
      { status: 500 }
    );
  }
}
