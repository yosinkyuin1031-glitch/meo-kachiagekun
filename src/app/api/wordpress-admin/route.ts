import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * WordPress管理画面のフォーム送信をシミュレートして
 * カスタム投稿タイプ（FAQ等）に投稿する
 * REST APIやXML-RPCが使えない環境用
 */

interface AdminPostRequest {
  siteUrl: string;
  username: string;
  appPassword: string; // WordPress login password or app password
  title: string;
  content: string;
  status: "publish" | "draft";
  postType: string; // "faq", "post", etc.
  slug?: string;
  seoFields?: {
    seoTitle?: string;
    seoDescription?: string;
    metaKeywords?: string;
    ogpTitle?: string;
    ogpDescription?: string;
  };
}

/**
 * WordPressにログインしてセッションcookieを取得
 */
async function wpLogin(
  baseUrl: string,
  username: string,
  password: string
): Promise<string | null> {
  const loginUrl = `${baseUrl}/wp-login.php`;

  const loginBody = new URLSearchParams({
    log: username,
    pwd: password,
    "wp-submit": "ログイン",
    redirect_to: `${baseUrl}/wp-admin/`,
    testcookie: "1",
  });

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: "wordpress_test_cookie=WP+Cookie+check",
    },
    body: loginBody.toString(),
    redirect: "manual",
  });

  // ログイン成功時は302リダイレクトされる
  if (response.status === 302 || response.status === 200) {
    const setCookies = response.headers.getSetCookie?.() || [];
    // すべてのSet-Cookieヘッダーを取得
    const cookies: string[] = [];
    for (const sc of setCookies) {
      const cookiePart = sc.split(";")[0];
      if (cookiePart) cookies.push(cookiePart);
    }

    // wordpress_logged_in cookie があるかチェック
    const hasAuth = cookies.some(
      (c) => c.includes("wordpress_logged_in") || c.includes("wordpress_sec")
    );
    if (hasAuth || cookies.length > 0) {
      return cookies.join("; ");
    }
  }

  return null;
}

/**
 * 新規投稿画面からnonceを取得
 */
async function getPostNonce(
  baseUrl: string,
  cookies: string,
  postType: string
): Promise<{ nonce: string; postId?: string } | null> {
  const newPostUrl = `${baseUrl}/wp-admin/post-new.php?post_type=${postType}`;

  const response = await fetch(newPostUrl, {
    headers: { Cookie: cookies },
    redirect: "follow",
  });

  if (!response.ok) return null;

  const html = await response.text();

  // _wpnonce を取得
  const nonceMatch = html.match(/name="_wpnonce"\s+value="([^"]+)"/);
  if (!nonceMatch) return null;

  // 自動下書きの投稿IDを取得
  const postIdMatch = html.match(/name="post_ID"\s+value="(\d+)"/);

  return {
    nonce: nonceMatch[1],
    postId: postIdMatch?.[1],
  };
}

/**
 * WordPress管理画面経由で投稿を作成
 */
async function createPostViaAdmin(
  baseUrl: string,
  cookies: string,
  nonce: string,
  postId: string,
  opts: AdminPostRequest
): Promise<{ success: boolean; postId: number; error?: string }> {
  const postUrl = `${baseUrl}/wp-admin/post.php`;

  const formData = new URLSearchParams({
    _wpnonce: nonce,
    _wp_http_referer: `${baseUrl}/wp-admin/post-new.php?post_type=${opts.postType}`,
    post_ID: postId,
    post_type: opts.postType,
    post_status: opts.status,
    post_title: opts.title,
    post_content: opts.content,
    post_name: opts.slug || "",
    action: "editpost",
    originalaction: "editpost",
    original_post_status: "auto-draft",
    // selfullテーマのSEOフィールド
    ...(opts.seoFields?.seoTitle ? { seo_title: opts.seoFields.seoTitle } : {}),
    ...(opts.seoFields?.seoDescription ? { seo_description: opts.seoFields.seoDescription } : {}),
    ...(opts.seoFields?.metaKeywords ? { seo_keyword: opts.seoFields.metaKeywords } : {}),
    ...(opts.seoFields?.ogpTitle ? { ogp_title: opts.seoFields.ogpTitle } : {}),
    ...(opts.seoFields?.ogpDescription ? { ogp_description: opts.seoFields.ogpDescription } : {}),
  });

  const response = await fetch(postUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: formData.toString(),
    redirect: "manual",
  });

  // 成功時は302リダイレクトされる
  if (response.status === 302) {
    const location = response.headers.get("location") || "";
    const idMatch = location.match(/post=(\d+)/);
    if (idMatch) {
      return { success: true, postId: Number(idMatch[1]) };
    }
    return { success: true, postId: Number(postId) };
  }

  return { success: false, postId: 0, error: `予期しないレスポンス (${response.status})` };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body: AdminPostRequest = await request.json();
    const { siteUrl, username, appPassword, title, content, postType } = body;

    if (!siteUrl || !username || !appPassword || !title || !content) {
      return NextResponse.json(
        { error: "必要な情報が不足しています。" },
        { status: 400 }
      );
    }

    const baseUrl = siteUrl.replace(/\/$/, "");

    // Step 1: ログイン
    const cookies = await wpLogin(baseUrl, username, appPassword);
    if (!cookies) {
      return NextResponse.json(
        { error: "WordPressへのログインに失敗しました。ユーザー名とパスワードを確認してください。" },
        { status: 401 }
      );
    }

    // Step 2: 新規投稿画面からnonceと自動下書きIDを取得
    const nonceData = await getPostNonce(baseUrl, cookies, postType);
    if (!nonceData) {
      return NextResponse.json(
        { error: `${postType}の投稿画面にアクセスできませんでした。投稿権限を確認してください。` },
        { status: 403 }
      );
    }

    // Step 3: 投稿を作成
    const result = await createPostViaAdmin(
      baseUrl,
      cookies,
      nonceData.nonce,
      nonceData.postId || "0",
      body
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "投稿の作成に失敗しました。" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      postId: result.postId,
      postUrl: `${baseUrl}/?p=${result.postId}`,
      editUrl: `${baseUrl}/wp-admin/post.php?post=${result.postId}&action=edit`,
      status: body.status,
      postType: `${postType}-admin`,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `WordPress投稿に失敗しました: ${errorMsg}` },
      { status: 500 }
    );
  }
}
