"use client";

import { createClient } from "@/lib/supabase/client";

export default function ExpiredPage() {
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-black">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">MEO勝ち上げくん</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">無料モニター期間が終了しました</h2>
          <p className="text-sm text-gray-500 mb-6">
            引き続きMEO勝ち上げくんをご利用いただくには、月額プラン（2,980円/月）へのお申し込みが必要です。
          </p>

          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
            <h3 className="text-sm font-bold text-blue-800 mb-2">月額プラン（2,980円/月）</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>- AI記事・投稿の自動生成</li>
              <li>- MEO順位チェック（月4回）</li>
              <li>- GBP投稿・FAQ・ブログ生成</li>
              <li>- チェックリスト・施策管理</li>
            </ul>
          </div>

          <p className="text-xs text-gray-400 mb-4">
            お申し込みはLINEまたはメールにてお問い合わせください。
          </p>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm"
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  );
}
