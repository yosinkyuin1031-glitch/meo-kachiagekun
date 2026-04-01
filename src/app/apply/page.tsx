"use client";

import { useState } from "react";

export default function ApplyPage() {
  const [form, setForm] = useState({
    clinicName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    homepage: "",
    wordpress: "",
    note: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.clinicName || !form.email || !form.address) {
      setError("院名・メールアドレス・住所は必須です");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "送信に失敗しました");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("送信に失敗しました。インターネット接続を確認してください。");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">お申込みありがとうございます</h2>
          <p className="text-sm text-gray-600 mb-4">
            内容を確認のうえ、1営業日以内にログイン情報をメールでお送りします。
          </p>
          <p className="text-xs text-gray-400">
            ご不明な点がございましたら、LINEまたはメールにてお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-orange-600 to-amber-500 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <h1 className="text-2xl font-bold text-white">MEO勝ち上げくん</h1>
          <p className="text-orange-100 text-sm mt-1">お申込みフォーム</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-2">基本情報</h2>
            <p className="text-xs text-gray-500">
              お申込み後、こちらでアカウント設定を行い、すぐにご利用いただける状態でログイン情報をお送りします。
            </p>
          </div>

          <div className="space-y-4">
            {/* 必須項目 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                院名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.clinicName}
                onChange={(e) => handleChange("clinicName", e.target.value)}
                placeholder="例：○○整体院"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-xs text-gray-400 mt-1">Googleマップに登録されている名前をそのままご入力ください</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                住所 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="例：大阪府大阪市北区○○1-2-3"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="example@gmail.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-xs text-gray-400 mt-1">ログイン用のアカウントとして使用します</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">院長名</label>
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={(e) => handleChange("ownerName", e.target.value)}
                  placeholder="例：山田太郎"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="090-1234-5678"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <hr className="my-2" />

            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-800 mb-1">連携情報（任意）</h2>
              <p className="text-xs text-gray-500">あとから設定画面で入力することも可能です</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ホームページURL</label>
              <input
                type="url"
                value={form.homepage}
                onChange={(e) => handleChange("homepage", e.target.value)}
                placeholder="https://www.example.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WordPress管理画面URL</label>
              <input
                type="url"
                value={form.wordpress}
                onChange={(e) => handleChange("wordpress", e.target.value)}
                placeholder="https://www.example.com/wp-admin"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">noteアカウントURL</label>
              <input
                type="url"
                value={form.note}
                onChange={(e) => handleChange("note", e.target.value)}
                placeholder="https://note.com/your_account"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">その他ご要望</label>
              <textarea
                value={form.message}
                onChange={(e) => handleChange("message", e.target.value)}
                placeholder="何かご要望があればお書きください"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-bold hover:from-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-300 transition-all shadow-lg"
            >
              {submitting ? "送信中..." : "申込みを送信する"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
