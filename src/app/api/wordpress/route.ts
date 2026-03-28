import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

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
  seo?: {
    seoTitle?: string;
    seoDescription?: string;
    metaKeywords?: string;
    ogpTitle?: string;
    ogpDescription?: string;
    ogpImage?: string;
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

  // よくあるFAQカスタム投稿タイプのスラッグ候補（幅広くカバー）
  const faqSlugs = [
    "faq", "faqs", "qa", "qas", "question", "questions",
    "yokuaru-shitsumon", "yokuaru", "faq_item", "faq-item",
    "faq_post", "faq-post", "yokusitu",
  ];

  // まずWP REST APIの投稿タイプ一覧を取得
  try {
    const typesRes = await fetch(`${baseUrl}/wp-json/wp/v2/types`, {
      headers: { Authorization: `Basic ${authToken}` },
    });
    if (typesRes.ok) {
      const types = await typesRes.json();
      // FAQ系のカスタム投稿タイプを探す（post, page, attachment以外）
      for (const [key, value] of Object.entries(types)) {
        if (key === "post" || key === "page" || key === "attachment") continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typeInfo = value as any;
        const name = (typeInfo.name || "").toLowerCase();
        const slug = key.toLowerCase();
        const label = (typeInfo.labels?.singular_name || typeInfo.labels?.name || "").toLowerCase();
        const description = (typeInfo.description || "").toLowerCase();

        if (
          faqSlugs.includes(slug) ||
          name.includes("faq") || name.includes("よくある") || name.includes("質問") ||
          label.includes("faq") || label.includes("よくある") || label.includes("質問") ||
          description.includes("faq") || description.includes("よくある") || description.includes("質問")
        ) {
          // REST APIエンドポイントを確認
          const restBase = typeInfo.rest_base || key;
          const endpoint = `${baseUrl}/wp-json/wp/v2/${restBase}`;
          // エンドポイントが存在するか確認
          try {
            const checkRes = await fetch(endpoint, {
              method: "GET",
              headers: { Authorization: `Basic ${authToken}` },
            });
            if (checkRes.ok) {
              return endpoint;
            }
          } catch { /* continue searching */ }
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

/**
 * WordPressのSEOプラグインを検出し、適切なメタフィールド名を返す
 */
type SeoPlugin = "selfull" | "ssp" | "yoast" | "aioseo" | "unknown";

interface SeoFieldMap {
  seoTitle: string;
  seoDescription: string;
  metaKeywords: string;
  ogpTitle: string;
  ogpDescription: string;
  ogpImage: string;
}

const SEO_FIELD_MAPS: Record<SeoPlugin, SeoFieldMap> = {
  // selfullテーマ（治療院向けWordPressテーマ）
  selfull: {
    seoTitle: "seo_title",
    seoDescription: "seo_description",
    metaKeywords: "seo_keyword",
    ogpTitle: "ogp_title",
    ogpDescription: "ogp_description",
    ogpImage: "ogp_image",
  },
  // SEO SIMPLE PACK（日本で最も一般的）
  ssp: {
    seoTitle: "ssp_meta_title",
    seoDescription: "ssp_meta_description",
    metaKeywords: "ssp_meta_keyword",
    ogpTitle: "ssp_ogp_title",
    ogpDescription: "ssp_ogp_description",
    ogpImage: "ssp_ogp_image",
  },
  // Yoast SEO
  yoast: {
    seoTitle: "_yoast_wpseo_title",
    seoDescription: "_yoast_wpseo_metadesc",
    metaKeywords: "_yoast_wpseo_focuskw",
    ogpTitle: "_yoast_wpseo_opengraph-title",
    ogpDescription: "_yoast_wpseo_opengraph-description",
    ogpImage: "_yoast_wpseo_opengraph-image",
  },
  // All in One SEO
  aioseo: {
    seoTitle: "_aioseo_title",
    seoDescription: "_aioseo_description",
    metaKeywords: "_aioseo_keywords",
    ogpTitle: "_aioseo_og_title",
    ogpDescription: "_aioseo_og_description",
    ogpImage: "_aioseo_og_image",
  },
  unknown: {
    seoTitle: "seo_title",
    seoDescription: "seo_description",
    metaKeywords: "seo_keyword",
    ogpTitle: "ogp_title",
    ogpDescription: "ogp_description",
    ogpImage: "ogp_image",
  },
};

async function detectSeoPlugin(
  siteUrl: string,
  authToken: string
): Promise<SeoPlugin> {
  const baseUrl = siteUrl.replace(/\/$/, "");

  // まずMEO勝ち上げくんプラグインの情報エンドポイントを確認
  try {
    const infoRes = await fetch(`${baseUrl}/wp-json/meo-kachiage/v1/info`, {
      headers: { Authorization: `Basic ${authToken}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json();
      if (info.seo_plugin && info.seo_plugin !== "unknown") {
        return info.seo_plugin as SeoPlugin;
      }
    }
  } catch { /* ignore */ }

  try {
    // 既存投稿からメタフィールドを確認
    const postsRes = await fetch(
      `${baseUrl}/wp-json/wp/v2/posts?per_page=1&_fields=id,meta`,
      { headers: { Authorization: `Basic ${authToken}` } }
    );
    if (postsRes.ok) {
      const posts = await postsRes.json();
      if (posts.length > 0 && posts[0].meta) {
        const meta = posts[0].meta;
        // selfullテーマのフィールドチェック
        if ("seo_title" in meta || "seo_description" in meta) return "selfull";
        // SSP（SEO SIMPLE PACK）のフィールドチェック
        if ("ssp_meta_title" in meta || "ssp_meta_description" in meta) return "ssp";
        // Yoastのフィールドチェック
        if ("_yoast_wpseo_metadesc" in meta || "_yoast_wpseo_title" in meta) return "yoast";
        // AIOSEOのフィールドチェック
        if ("_aioseo_title" in meta || "_aioseo_description" in meta) return "aioseo";
      }
    }
  } catch { /* ignore */ }

  try {
    // テーマ情報からselfullを検出
    const themeRes = await fetch(`${baseUrl}/wp-json/wp/v2/themes`, {
      headers: { Authorization: `Basic ${authToken}` },
    });
    if (themeRes.ok) {
      const themes = await themeRes.json();
      const themeStr = JSON.stringify(themes).toLowerCase();
      if (themeStr.includes("selfull")) return "selfull";
    }
  } catch { /* ignore */ }

  try {
    // プラグイン一覧からチェック
    const pluginsRes = await fetch(`${baseUrl}/wp-json/wp/v2/plugins`, {
      headers: { Authorization: `Basic ${authToken}` },
    });
    if (pluginsRes.ok) {
      const plugins = await pluginsRes.json();
      const pluginNames = JSON.stringify(plugins).toLowerCase();
      if (pluginNames.includes("seo-simple-pack") || pluginNames.includes("ssp")) return "ssp";
      if (pluginNames.includes("wordpress-seo") || pluginNames.includes("yoast")) return "yoast";
      if (pluginNames.includes("all-in-one-seo") || pluginNames.includes("aioseo")) return "aioseo";
    }
  } catch { /* ignore - may not have permission */ }

  // デフォルト: selfull（治療院向けテーマのフィールド名を使用）
  return "selfull";
}

function buildSeoMeta(
  seo: WordPressPostRequest["seo"],
  fieldMap: SeoFieldMap
): Record<string, string> {
  const meta: Record<string, string> = {};
  if (!seo) return meta;
  if (seo.seoTitle) meta[fieldMap.seoTitle] = seo.seoTitle;
  if (seo.seoDescription) meta[fieldMap.seoDescription] = seo.seoDescription;
  if (seo.metaKeywords) meta[fieldMap.metaKeywords] = seo.metaKeywords;
  if (seo.ogpTitle) meta[fieldMap.ogpTitle] = seo.ogpTitle;
  if (seo.ogpDescription) meta[fieldMap.ogpDescription] = seo.ogpDescription;
  if (seo.ogpImage) meta[fieldMap.ogpImage] = seo.ogpImage;
  return meta;
}

/**
 * XML-RPC経由でWordPressに投稿する（REST APIが使えないカスタム投稿タイプ用）
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function postViaXmlRpc(
  baseUrl: string,
  username: string,
  password: string,
  opts: {
    title: string;
    content: string;
    status: string;
    postType: string;
    slug?: string;
    seo?: WordPressPostRequest["seo"];
    seoFieldMap?: SeoFieldMap;
  }
): Promise<{
  success: boolean;
  postId: number;
  postUrl: string;
  editUrl: string;
  status: string;
  postType: string;
} | null> {
  const xmlrpcUrl = `${baseUrl}/xmlrpc.php`;

  // SEOカスタムフィールドを構築
  const customFields: { key: string; value: string }[] = [];
  if (opts.seo && opts.seoFieldMap) {
    const seoMeta = buildSeoMeta(opts.seo, opts.seoFieldMap);
    for (const [key, value] of Object.entries(seoMeta)) {
      if (value) customFields.push({ key, value });
    }
  }

  const customFieldsXml = customFields
    .map(
      (f) => `
      <value><struct>
        <member><name>key</name><value><string>${escapeXml(f.key)}</string></value></member>
        <member><name>value</name><value><string>${escapeXml(f.value)}</string></value></member>
      </struct></value>`
    )
    .join("");

  const contentStruct = `<value><struct>
    <member><name>post_type</name><value><string>${escapeXml(opts.postType)}</string></value></member>
    <member><name>post_status</name><value><string>${escapeXml(opts.status)}</string></value></member>
    <member><name>post_title</name><value><string>${escapeXml(opts.title)}</string></value></member>
    <member><name>post_content</name><value><string>${escapeXml(opts.content)}</string></value></member>
    ${opts.slug ? `<member><name>post_name</name><value><string>${escapeXml(opts.slug)}</string></value></member>` : ""}
    ${customFields.length > 0 ? `<member><name>custom_fields</name><value><array><data>${customFieldsXml}</data></array></value></member>` : ""}
  </struct></value>`;

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>wp.newPost</methodName>
  <params>
    <param><value><int>0</int></value></param>
    <param><value><string>${escapeXml(username)}</string></value></param>
    <param><value><string>${escapeXml(password)}</string></value></param>
    <param>${contentStruct}</param>
  </params>
</methodCall>`;

  const response = await fetch(xmlrpcUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: xmlBody,
  });

  if (!response.ok) return null;

  const responseXml = await response.text();

  // faultチェック
  if (responseXml.includes("<fault>")) return null;

  // 投稿IDを取得
  const idMatch = responseXml.match(/<value>[\s\S]*?<(?:string|int|i4)>([\s\S]*?)<\/(?:string|int|i4)>/);
  if (!idMatch) return null;

  const postId = Number(idMatch[1]);
  return {
    success: true,
    postId,
    postUrl: `${baseUrl}/?p=${postId}`,
    editUrl: `${baseUrl}/wp-admin/post.php?post=${postId}&action=edit`,
    status: opts.status,
    postType: `${opts.postType}-xmlrpc`,
  };
}

/**
 * XML-RPC経由で既存投稿のSEOカスタムフィールドを更新する
 */
async function updateSeoViaXmlRpc(
  baseUrl: string,
  username: string,
  password: string,
  postId: number,
  seo: WordPressPostRequest["seo"],
  seoFieldMap: SeoFieldMap
): Promise<void> {
  if (!seo) return;

  const xmlrpcUrl = `${baseUrl}/xmlrpc.php`;
  const seoMeta = buildSeoMeta(seo, seoFieldMap);
  const customFields = Object.entries(seoMeta)
    .filter(([, v]) => v)
    .map(([key, value]) => ({ key, value }));

  if (customFields.length === 0) return;

  const customFieldsXml = customFields
    .map(
      (f) => `
      <value><struct>
        <member><name>key</name><value><string>${escapeXml(f.key)}</string></value></member>
        <member><name>value</name><value><string>${escapeXml(f.value)}</string></value></member>
      </struct></value>`
    )
    .join("");

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>wp.editPost</methodName>
  <params>
    <param><value><int>0</int></value></param>
    <param><value><string>${escapeXml(username)}</string></value></param>
    <param><value><string>${escapeXml(password)}</string></value></param>
    <param><value><int>${postId}</int></value></param>
    <param><value><struct>
      <member><name>custom_fields</name><value><array><data>${customFieldsXml}</data></array></value></member>
    </struct></value></param>
  </params>
</methodCall>`;

  await fetch(xmlrpcUrl, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: xmlBody,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body: WordPressPostRequest = await request.json();
    const { siteUrl, username, appPassword, title, content, status, slug, categorySlug, postType, meta, seo } = body;

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

    // SEOプラグインを検出
    const seoPlugin = await detectSeoPlugin(siteUrl, authToken);
    const seoFieldMap = SEO_FIELD_MAPS[seoPlugin];

    // FAQ投稿の場合: カスタム投稿タイプを検出して使用
    if (postType === "faq" || categorySlug === "faq") {
      // まずREST APIで試行
      const faqEndpoint = await detectFaqEndpoint(siteUrl, authToken);
      if (faqEndpoint) {
        const faqPostData: Record<string, unknown> = {
          title,
          content,
          status,
        };
        if (slug) faqPostData.slug = slug;

        if (seo) {
          faqPostData.meta = buildSeoMeta(seo, seoFieldMap);
        } else if (meta) {
          const metaObj: Record<string, string> = {};
          if (meta.description) metaObj[seoFieldMap.seoDescription] = meta.description;
          if (meta.keywords) metaObj[seoFieldMap.metaKeywords] = meta.keywords;
          faqPostData.meta = metaObj;
        }

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
      }

      // REST APIが使えない場合: XML-RPCでFAQカスタム投稿タイプに直接投稿
      try {
        const xmlrpcResult = await postViaXmlRpc(baseUrl, username, appPassword, {
          title,
          content,
          status,
          postType: "faq",
          slug,
          seo,
          seoFieldMap,
        });
        if (xmlrpcResult) {
          return NextResponse.json(xmlrpcResult);
        }
      } catch {
        // XML-RPCも失敗
      }

      // XML-RPCも使えない場合: WordPress管理画面フォーム送信で投稿
      try {
        const adminApiUrl = new URL("/api/wordpress-admin", request.url);
        const adminRes = await fetch(adminApiUrl.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteUrl,
            username,
            appPassword,
            title,
            content,
            status,
            postType: "faq",
            slug,
            seoFields: seo ? {
              seoTitle: seo.seoTitle,
              seoDescription: seo.seoDescription,
              metaKeywords: seo.metaKeywords,
              ogpTitle: seo.ogpTitle,
              ogpDescription: seo.ogpDescription,
            } : undefined,
          }),
        });
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          return NextResponse.json(adminData);
        }
      } catch {
        // 管理画面フォーム送信も失敗した場合、通常投稿にフォールバック
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

    // SEOメタデータ（新しいseo形式を優先、旧meta形式もサポート）
    if (seo) {
      postData.meta = buildSeoMeta(seo, seoFieldMap);
    } else if (meta) {
      const metaObj: Record<string, string> = {};
      if (meta.description) metaObj[seoFieldMap.seoDescription] = meta.description;
      if (meta.keywords) metaObj[seoFieldMap.metaKeywords] = meta.keywords;
      postData.meta = metaObj;
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

    // REST APIでmeta書き込みが効かない場合に備え、XML-RPCでSEOフィールドを追加書き込み
    if (seo && wpPost.id) {
      try {
        await updateSeoViaXmlRpc(baseUrl, username, appPassword, wpPost.id, seo, seoFieldMap);
      } catch {
        // SEO書き込み失敗は無視（投稿自体は成功している）
      }
    }

    return NextResponse.json({
      success: true,
      postId: wpPost.id,
      postUrl: wpPost.link,
      editUrl: `${baseUrl}/wp-admin/post.php?post=${wpPost.id}&action=edit`,
      status: wpPost.status,
      postType: "post",
    });
  } catch (e) {
    console.error("WordPress post error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "WordPress投稿に失敗しました" },
      { status: 500 }
    );
  }
}

// WordPress接続テスト
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { siteUrl, username, appPassword } = await request.json();

    if (!siteUrl || !username || !appPassword) {
      return NextResponse.json(
        { error: "接続情報が不足しています。" },
        { status: 400 }
      );
    }

    const baseUrl = siteUrl.replace(/\/$/, "");
    const authToken = Buffer.from(`${username}:${appPassword}`).toString("base64");

    // まずREST APIが存在するか確認
    let restApiAvailable = false;
    try {
      const discoverRes = await fetch(`${baseUrl}/wp-json/`, {
        method: "GET",
        headers: { "User-Agent": "MEO-Kachiage/1.0" },
      });
      restApiAvailable = discoverRes.ok;
      if (!restApiAvailable) {
        // wp-json が無い場合、?rest_route= も試す
        const altRes = await fetch(`${baseUrl}/?rest_route=/`, {
          method: "GET",
          headers: { "User-Agent": "MEO-Kachiage/1.0" },
        });
        restApiAvailable = altRes.ok;
      }
    } catch {
      return NextResponse.json(
        { error: `WordPressサイトに接続できません。URLを確認してください: ${baseUrl}` },
        { status: 502 }
      );
    }

    if (!restApiAvailable) {
      return NextResponse.json(
        { error: `WordPress REST APIが無効です。サイトURLを確認してください: ${baseUrl}` },
        { status: 404 }
      );
    }

    const apiUrl = `${baseUrl}/wp-json/wp/v2/users/me`;

    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${authToken}`,
        },
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "";
      return NextResponse.json(
        { error: `WordPress APIへの接続に失敗しました: ${msg}` },
        { status: 502 }
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // レスポンスボディも確認
        let detail = "";
        try {
          const errBody = await res.json();
          detail = errBody.message || "";
        } catch { /* ignore */ }
        return NextResponse.json(
          { error: `認証失敗: ユーザー名またはアプリケーションパスワードが正しくありません。${detail ? ` (${detail})` : ""}` },
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
    let faqEndpointUrl: string | null = null;
    try {
      faqEndpointUrl = await detectFaqEndpoint(siteUrl, authToken);
      hasFaqPostType = !!faqEndpointUrl;
    } catch { /* ignore */ }

    // SEOプラグインを検出
    let seoPluginName: SeoPlugin = "unknown";
    try {
      seoPluginName = await detectSeoPlugin(siteUrl, authToken);
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      userName: user.name,
      userSlug: user.slug,
      roles: user.roles,
      hasFaqPostType,
      faqEndpoint: faqEndpointUrl,
      seoPlugin: seoPluginName,
    });
  } catch (e) {
    console.error("WordPress connection test error:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "接続テストに失敗しました" },
      { status: 500 }
    );
  }
}
