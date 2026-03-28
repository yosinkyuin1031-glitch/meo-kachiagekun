"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">
          予期しないエラーが発生しました
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          ページの読み込み中にエラーが発生しました。もう一度お試しください。
          問題が続く場合は、しばらく時間をおいてからアクセスしてください。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            aria-label="ページを再読み込みする"
          >
            もう一度試す
          </button>
          <a
            href="/"
            className="px-6 py-2.5 bg-white text-gray-700 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="ダッシュボードに戻る"
          >
            ダッシュボードに戻る
          </a>
        </div>
      </div>
    </div>
  );
}
