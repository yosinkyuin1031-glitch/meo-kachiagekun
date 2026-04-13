"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error.message?.includes("rate limit") || error.message?.includes("too many")) {
        setError("ログインの試行回数が上限に達しました。しばらく時間をおいてから、もう一度お試しください。");
      } else {
        setError("メールアドレスまたはパスワードが正しくありません。入力内容をご確認のうえ、もう一度お試しください。");
      }
      setLoading(false);
      return;
    }

    window.location.href = "/";
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-black">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">MEO勝ち上げくん</h1>
          <p className="text-xs text-gray-400 mt-1">by ClinicApps</p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
              aria-label="メールアドレス"
              autoComplete="email"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="パスワード"
              aria-label="パスワード"
              autoComplete="current-password"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="text-right mt-1">
              <a href="/forgot-password" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">
                パスワードを忘れた方
              </a>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-label={loading ? "ログイン処理中" : "ログイン"}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all shadow-lg text-sm"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>

          <p className="text-center text-xs text-gray-400">
            ※ アカウント作成・パスワード再発行は管理者にお問い合わせください
          </p>
        </form>

        <div className="text-center mt-4 space-x-4">
          <a href="/terms" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">利用規約</a>
          <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">プライバシーポリシー</a>
        </div>

        <p className="text-center text-gray-400 text-[10px] mt-4">&copy; ClinicApps</p>
      </div>
    </div>
  );
}
