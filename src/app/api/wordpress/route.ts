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
  postType?: string; // "post" | "faq" 等のカスタム投稿タイプ
  meta?: {
    description?: string;
    keywords?: string;
  };
}

// カテゴリ名のマッピング
const CATEGORY_NAMES: Record<string, string> = {
  blog: "院内ブログ",
  symptom: "症状ブログ",
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

  // 日本語名でも検索（WordPressがスラッグを自動変換している場合）
  try {
    const searchRes = await fetch(
      `${baseUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(categoryName)}`,
      { headers: { Authorization: `Basic ${authToken}` } }
    );
    if (searchRes.ok) {
      const cats = await searchRes.json();
      if (Array.isArray(cats) && cats.length > 0) {
        // 名前が一致するものを返す
        const exact = cats.find((c: { name: string }) => c.name === categoryName);
        if (exact) return exact.id as number;
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

/**
 * WordPressのカスタム投稿タイプ（FAQ等）のエンドポイントを検出する
 * 例: /wp-json/wp/v2/faq, /wp-json/wp/v2/qa, etc.
 */
async function detectFaqEndpoint(
  siteUrl: string,
  authToken: string
): Promise<string | null> {
  const baseUrl = siteUrl.replace(/\/$/, "");

  // よくあるFAQカスタム投稿タイプのスラッグ候補
  const faqSlugs = ["faq", "faqs", "qa", "question", "yokuaru-shitsumon"];

  // まずWP REST APIの投稿タイプ一覧を取得
  try {
    const typesRes = await fetch(`${baseUrl}/wp-json/wp/v2/types`, {
      headers: { Authorization: `Basic ${authToken}` },
    });
    if (typesRes.ok) {
      const types = await typesRes.json();
      // FAQ系のカスタム投稿タイプを探す
      for (const [key, value] of Object.entries(types)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typeInfo = value as any;
        const name = (typeInfo.name || "").toLowerCase();
        const slug = key.toLowerCase();
        const label = (typeInfo.labels?.singular_name || typeInfo.labels?.name || "").toLowerCase();

        if (
          faqSlugs.includes(slug) ||
          name.includes("faq") || name.includes("よくある") || name.includes("質問") ||
          label.includes("faq") || label.includes("よくある") || label.includes("質問")
        ) {
          // REST APIエンドポイントを確認
          const restBase = typeInfo.rest_base || key;
          const endpoint = `${baseUrl}/wp-json/wp/v2/${restBase}`;
          // エンドポイントが存在するか確認
          const checkRes = await fetch(endpoint, {
            method: "GET",
            headers: { Authorization: `Basic ${authToken}` },
          });
          if (checkRes.ok) {
            return endpoint;
          }
        }
      }
    }
  } catch { /* ignore */ }

  // フォールバック: 直接エンドポイントを試す
  for (const slug of faqSlugs) {
    try {
      const checkRes = await fetch(`${baseUrl}/wp-json/wp/v2/${slug}`, {
        method: "GET",
        headers: { Authorization: `Basic ${authToken}` },
      });
      if (checkRes.ok) {
        return `${baseUrl}/wp-json/wp/v2/${slug}`;
      }
    } catch { /* continue */ }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body: WordPressPostRequest = await request.json();
    const { siteUrl, username, appPassword, title, content, status, slug, categorySlug, postType, meta } = body;

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

    const baseUrl = siteUrl.replace(/\/$/, "");
    const authToken = Buffer.from(`${username}:${appPassword}`).toString("base64");

    // FAQ投稿の場合: カスタム投稿タイプを検出して使用
    if (postType === "faq" || categorySlug === "faq") {
      const faqEndpoint = await detectFaqEndpoint(siteUrl, authToken);
      if (faqEndpoint) {
        // カスタム投稿タイプとして投稿
        const faqPostData: Record<string, unknown> = {
          title,
          content,
          status,
        };
        if (slug) faqPostData.slug = slug;

        const faqRes = await fetch(faqEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${authToken}`,
          },
          body: JSON.stringify(faqPostData),
        });

        if (faqRes.ok) {
          const faqPost = await faqRes.json();
          return NextResponse.json({
            success: true,
            postId: faqPost.id,
            postUrl: faqPost.link,
            editUrl: `${baseUrl}/wp-admin/post.php?post=${faqPost.id}&action=edit`,
            status: faqPost.status,
            postType: "faq-custom",
          });
        }
        // カスタム投稿タイプへの投稿が失敗した場合、通常投稿にフォールバック
      }
    }

    // 通常投稿（ブログ記事）
    const apiUrl = `${baseUrl}/wp-json/wp/v2/posts`;

    // カテゴリを取得/作成
    let categoryId: number | null = null;
    if (categorySlug && categorySlug !== "faq") {
      // FAQはカスタム投稿タイプで処理済み。ここに来る場合はフォールバック
      categoryId = await getOrCreateCategory(siteUrl, authToken, categorySlug);
    } else if (categorySlug === "faq") {
      // カスタム投稿タイプが見つからなかった場合のフォールバック
      categoryId = await getOrCreateCategory(siteUrl, authToken, "faq");
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
      editUrl: `${baseUrl}/wp-admin/post.php?post=${wpPost.id}&action=edit`,
      status: wpPost.status,
      postType: "post",
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

    // FAQ カスタム投稿タイプの存在も確認
    let hasFaqPostType = false;
    try {
      const faqEndpoint = await detectFaqEndpoint(siteUrl, authToken);
      hasFaqPostType = !!faqEndpoint;
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      userName: user.name,
      userSlug: user.slug,
      roles: user.roles,
      hasFaqPostType,
    });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `接続テストに失敗しました: ${errorMsg}` },
      { status: 500 }
    );
  }
}
