/**
 * ブログHTML自動整形：長い段落を分割し、改行を確保する
 * AIが生成したHTMLの段落が長すぎる場合に、読みやすく分割する
 */
export function formatBlogHtml(html: string): string {
  // 1. <p>タグ内が長すぎる場合（句点「。」で3文以上）を分割
  let formatted = html.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_match, inner: string) => {
    const text = inner.trim();
    // 句点で文を分割
    const sentences = text.split(/(?<=。)/).filter((s: string) => s.trim());
    if (sentences.length <= 2) {
      return `<p>${text}</p>`;
    }
    // 2文ずつのグループに分けて別々の<p>タグにする
    const groups: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      const group = sentences.slice(i, i + 2).join("").trim();
      if (group) groups.push(`<p>${group}</p>`);
    }
    return groups.join("\n\n");
  });

  // 2. <h2>の前に余白を確保
  formatted = formatted.replace(/(?<!\n\n)(<h2)/gi, "\n\n$1");

  // 3. </h2>の後に余白を確保
  formatted = formatted.replace(/(<\/h2>)(?!\n\n)/gi, "$1\n\n");

  // 4. <h3>の前後にも余白
  formatted = formatted.replace(/(?<!\n)(<h3)/gi, "\n$1");
  formatted = formatted.replace(/(<\/h3>)(?!\n)/gi, "$1\n");

  // 5. 連続する改行を整理（3つ以上は2つに）
  formatted = formatted.replace(/\n{3,}/g, "\n\n");

  return formatted.trim();
}
