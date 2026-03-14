import { NextRequest, NextResponse } from "next/server";

interface WordPressPostRequest {
  siteUrl: string;
  username: string;
  appPassword: string;
  title: string;
  content: string;
  status: "publish" | "draft";
  categories?: number[];
  tags?: number[];
  slug?: string;
  categorySlug?: string;
  meta?: {
    description?: string;
    keywords?: string;
  };
}

// カテゴリ名のマッピング
const CATEGORY_NAMES: Record<string, string> = {
  blog: "院内ブログ",
  faq: "よくある質問",
};

async function getOrCreateCategory(
  siteUrl: string,
  authToken: string,
  categorySlug: string
): Promise<number | null> {
  const categoryName = CATEGORY_NAMES[categorySlug] || categorySlug;
  const baseUrl = siteUrl.replace(/\/$/, "");

  // まず既存カテゴリを検索
  try {
    const searchRes = await fetch(
      `${baseUrl}/wp-json/wp/v2/categories?slug=${encodeURIComponent(categorySlug)}`,
      { headers: { Authorization: `Basic ${authToken}` } }
    );
    if (searchRes.ok) {
      const cats = await searchRes.json();
      if (Array.isArray(cats) && cats.length > 0) {
        return cats[0].id as number;
      }
    }
  } catch { /* continue to create */ }

  // なければ作成
  try {
    const createRes = await fetch(`${baseUrl}/wp-json/wp/v2/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify({ name: categoryName, slug: categorySlug }),
    });
    if (createRes.ok) {
      const newCat = await createRes.json();
      return newCat.id as number;
    }
  } catch { /* ignore */ }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body: WordPressPostRequest = await request.json();
    const { siteUrl, username, appPassword, title, content, status, slug, categorySlug, meta } = body;

    if (!siteUrl || !username || !appPassword) {
      return NextResponse.json(
        { error: "WordPress接続情報が不足しています。設定画面で入力してください。" },
        { status: 400 }
      );
    }

    if (!title || !content) {
      return NextResponse.json(
        { error: "タイトルまたは本文が空です。" },
        { status: 400 }
      );
    }

    // WordPress REST API endpoint
    const apiUrl = `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`;

    // Basic Auth (Application Password)
    const authToken = Buffer.from(`${username}:${appPassword}`).toString("base64");

    // カテゴリを取得/作成
    let categoryId: number | null = null;
    if (categorySlug) {
      categoryId = await getOrCreateCategory(siteUrl, authToken, categorySlug);
    }

    // WordPress投稿データ
    const postData: Record<string, unknown> = {
      title,
      content,
      status,
    };

    if (slug) {
      postData.slug = slug;
    }

    if (categoryId) {
      postData.categories = [categoryId];
    }

    // Yoast SEO等のメタデータ
    if (meta) {
      postData.meta = {};
      if (meta.description) {
        (postData.meta as Record<string, string>)._yoast_wpseo_metadesc = meta.description;
      }
      if (meta.keywords) {
        (postData.meta as Record<string, string>)._yoast_wpseo_focuskw = meta.keywords.split(",")[0]?.trim() || "";
      }
    }

    const wpResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(postData),
    });

    if (!wpResponse.ok) {
      const errorData = await wpResponse.json().catch(() => ({}));
      const errorMessage = errorData.message || `WordPress APIエラー (${wpResponse.status})`;

      if (wpResponse.status === 401 || wpResponse.status === 403) {
        return NextResponse.json(
          { error: `WordPress認証エラー: ユーザー名またはアプリケーションパスワードが正しくありません。` },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `WordPress投稿エラー: ${errorMessage}` },
        { status: wpResponse.status }
      );
    }

    const wpPost = await wpResponse.json();

    return NextResponse.json({
      success: true,
      postId: wpPost.id,
      postUrl: wpPost.link,
      editUrl: `${siteUrl.replace(/\/$/, "")}/wp-admin/post.php?post=${wpPost.id}&action=edit`,
      status: wpPost.status,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `WordPress投稿に失敗しました: ${errorMsg}` },
      { status: 500 }
    );
  }
}

// WordPress接続テスト
export async function PUT(request: NextRequest) {
  try {
    const { siteUrl, username, appPassword } = await request.json();

    if (!siteUrl || !username || !appPassword) {
      return NextResponse.json(
        { error: "接続情報が不足しています。" },
        { status: 400 }
      );
    }

    const apiUrl = `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/users/me`;
    const authToken = Buffer.from(`${username}:${appPassword}`).toString("base64");

    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: "認証失敗: ユーザー名またはアプリケーションパスワードが正しくありません。" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `接続エラー (${res.status}): WordPressサイトURLを確認してください。` },
        { status: res.status }
      );
    }

    const user = await res.json();

    return NextResponse.json({
      success: true,
      userName: user.name,
      userSlug: user.slug,
      roles: user.roles,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `接続テストに失敗しました: ${errorMsg}` },
      { status: 500 }
    );
  }
}
