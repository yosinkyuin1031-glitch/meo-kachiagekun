"use client";

import { useEffect, useState } from "react";
import { getGoogleSettings, saveGoogleSettings } from "@/lib/storage";
import { GoogleSettings } from "@/lib/types";

export default function GoogleCallbackPage() {
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Google認証を処理中...");

  useEffect(() => {
    const processCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const errorParam = urlParams.get("error");

      if (errorParam) {
        setStatus("error");
        setMessage(`認証がキャンセルされました: ${errorParam}`);
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("認証コードが見つかりません");
        return;
      }

      const saved = getGoogleSettings();
      if (!saved?.clientId || !saved?.clientSecret) {
        setStatus("error");
        setMessage("Google設定が見つかりません。設定画面からやり直してください。");
        return;
      }

      try {
        // トークン交換
        const redirectUri = `${window.location.origin}/google-callback`;
        const tokenRes = await fetch("/api/google/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            clientId: saved.clientId,
            clientSecret: saved.clientSecret,
            redirectUri,
          }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error);

        const settings: GoogleSettings = {
          ...saved,
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || saved.refreshToken,
          tokenExpiry: new Date(Date.now() + (tokenData.expiresIn || 3600) * 1000).toISOString(),
        };

        // ロケーション取得
        const locRes = await fetch("/api/google/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: tokenData.accessToken }),
        });
        const locData = await locRes.json();

        if (locRes.ok && locData.locations?.length > 0) {
          // 最初のロケーションを自動選択
          const loc = locData.locations[0];
          settings.accountId = loc.accountId;
          settings.locationId = loc.locationId;
          settings.locationName = loc.locationName;
        }

        saveGoogleSettings(settings);
        setStatus("success");
        setMessage(
          settings.locationName
            ? `連携完了: ${settings.locationName}`
            : "認証完了。設定画面でビジネスを選択してください。"
        );

        // 3秒後にメインページへ
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "認証処理に失敗しました");
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {status === "processing" && (
          <>
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-800">認証処理中...</h1>
            <p className="text-sm text-gray-500 mt-2">{message}</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-green-800">{message}</h1>
            <p className="text-sm text-gray-500 mt-2">メインページに戻ります...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">!</span>
            </div>
            <h1 className="text-lg font-bold text-red-800">エラー</h1>
            <p className="text-sm text-red-600 mt-2">{message}</p>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              設定画面に戻る
            </a>
          </>
        )}
      </div>
    </div>
  );
}
