import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEO勝ち上げくん",
  description: "治療院のMEO対策を完全サポート。施策管理・note記事生成・GBP投稿・LLMO対策を統合",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
