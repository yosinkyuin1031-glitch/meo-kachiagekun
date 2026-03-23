"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(`認証がキャンセルされました: ${error}`);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("認証コードが見つかりませんでした");
      return;
    }

    // Send the code back to the opener window
    if (window.opener) {
      window.opener.postMessage({ type: "gsc_auth_code", code }, window.location.origin);
      setStatus("success");
      setMessage("認証が完了しました。このウィンドウは自動的に閉じます。");
      setTimeout(() => window.close(), 2000);
    } else {
      // If no opener (direct navigation), store code in localStorage for the main page to pick up
      localStorage.setItem("gsc_auth_code", code);
      setStatus("success");
      setMessage("認証が完了しました。MEO勝ち上げくんのページに戻ってください。");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-3xl" style={{
          backgroundColor: status === "processing" ? "#fef3c7" : status === "success" ? "#d1fae5" : "#fee2e2",
        }}>
          {status === "processing" ? "⏳" : status === "success" ? "✅" : "❌"}
        </div>
        <h1 className="text-lg font-bold text-gray-800 mb-2">
          {status === "processing" ? "認証処理中..." : status === "success" ? "認証完了" : "認証エラー"}
        </h1>
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default function GscCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
