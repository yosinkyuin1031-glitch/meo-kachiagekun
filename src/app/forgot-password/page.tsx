"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError("リセットメールの送信に失敗しました。メールアドレスを確認してください。");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
            <div className="text-4xl">&#9993;</div>
            <h2 className="text-lg font-bold text-gray-800">リセットメールを送信しました</h2>
            <p className="text-sm text-gray-600">
              {email} にパスワードリセット用のリンクを送信しました。メール内のリンクからパスワードを再設定してください。
            </p>
            <a
              href="/login"
              className="inline-block mt-4 px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
            >
              ログインページへ戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-black">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">パスワードリセット</h1>
          <p className="text-xs text-gray-400 mt-1">by ClinicApps</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
          <p className="text-sm text-gray-600">
            登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
              autoComplete="email"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all shadow-lg text-sm"
          >
            {loading ? "送信中..." : "リセットメールを送信"}
          </button>

          <p className="text-center text-sm text-gray-500">
            <a href="/login" className="text-blue-600 font-medium hover:underline">
              ログインページへ戻る
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
