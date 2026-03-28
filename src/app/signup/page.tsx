"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState<{ password: boolean; confirmPassword: boolean }>({ password: false, confirmPassword: false });
  const supabase = createClient();

  const passwordTooShort = touched.password && password.length > 0 && password.length < 6;
  const passwordMismatch = touched.confirmPassword && confirmPassword.length > 0 && password !== confirmPassword;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください");
      return;
    }
    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    setLoading(true);

    try {
      // サーバー側でアカウント作成（メール確認を自動スキップ）
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const result = await res.json();

      if (!res.ok) {
        // 重複メールアドレスの場合、分かりやすいメッセージを表示
        if (result.error?.includes("既に登録")) {
          setError("このメールアドレスは既に登録されています");
        } else {
          setError(result.error || "登録に失敗しました。しばらく時間をおいてから、もう一度お試しください。");
        }
        setLoading(false);
        return;
      }

      // そのままログインしてリダイレクト
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!loginError) {
        window.location.href = "/";
        return;
      }

      setError("アカウントは作成できましたが、自動ログインに失敗しました。お手数ですが、ログインページからメールアドレスとパスワードを入力してログインしてください。");
      setLoading(false);
    } catch {
      setError("インターネット接続を確認して、もう一度お試しください。");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-3xl font-black">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">新規登録</h1>
          <p className="text-sm text-gray-500 mt-1">MEO勝ち上げくんのアカウントを作成</p>
        </div>

        <form onSubmit={handleSignup} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              id="signup-email"
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
            <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">パスワード（6文字以上）</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, password: true }))}
              required
              placeholder="パスワード"
              aria-label="パスワード"
              aria-invalid={passwordTooShort}
              autoComplete="new-password"
              className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                passwordTooShort ? "border-red-300 bg-red-50/50" : "border-gray-200"
              }`}
            />
            {passwordTooShort && (
              <p className="text-xs text-red-600 mt-1" role="alert">パスワードは6文字以上で入力してください</p>
            )}
          </div>

          <div>
            <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">パスワード確認</label>
            <input
              id="signup-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, confirmPassword: true }))}
              required
              placeholder="パスワード（再入力）"
              aria-label="パスワード確認"
              aria-invalid={passwordMismatch}
              autoComplete="new-password"
              className={`w-full px-4 py-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                passwordMismatch ? "border-red-300 bg-red-50/50" : "border-gray-200"
              }`}
            />
            {passwordMismatch && (
              <p className="text-xs text-red-600 mt-1" role="alert">パスワードが一致しません</p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="agree-terms" className="text-xs text-gray-600 leading-relaxed">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">利用規約</a>
              と
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">プライバシーポリシー</a>
              に同意する
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !agreed}
            aria-label={loading ? "登録処理中" : "アカウントを作成"}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition-all shadow-lg text-sm"
          >
            {loading ? "登録中..." : "アカウントを作成"}
          </button>

          <p className="text-center text-sm text-gray-500">
            既にアカウントをお持ちの方は{" "}
            <a href="/login" className="text-blue-600 font-medium hover:underline">
              ログイン
            </a>
          </p>
        </form>

        <div className="text-center mt-4 space-x-4">
          <a href="/terms" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">利用規約</a>
          <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 hover:underline">プライバシーポリシー</a>
        </div>
      </div>
    </div>
  );
}
