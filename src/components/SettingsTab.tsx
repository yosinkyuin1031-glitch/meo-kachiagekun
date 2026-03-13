"use client";

import { useState } from "react";
import { BusinessProfile } from "@/lib/types";

interface Props {
  profile: BusinessProfile;
  onSave: (profile: BusinessProfile) => void;
}

export default function SettingsTab({ profile, onSave }: Props) {
  const [name, setName] = useState(profile.name);
  const [area, setArea] = useState(profile.area);
  const [category, setCategory] = useState(profile.category);
  const [description, setDescription] = useState(profile.description);
  const [keywordsText, setKeywordsText] = useState(profile.keywords.join("\n"));
  const [anthropicKey, setAnthropicKey] = useState(profile.anthropicKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const keywords = keywordsText
      .split("\n")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    onSave({ name, area, category, description, keywords, anthropicKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-lg mx-auto">
      <h3 className="font-bold text-gray-800 text-lg mb-6">設定</h3>

      <div className="space-y-5">
        {/* APIキー */}
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <label className="block text-sm font-medium text-purple-800 mb-1">
            Anthropic APIキー（AI生成機能に必要）
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 px-4 py-2.5 border border-purple-200 rounded-lg text-sm font-mono bg-white outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-xs hover:bg-purple-200"
            >
              {showKey ? "隠す" : "表示"}
            </button>
          </div>
          <p className="text-xs text-purple-600 mt-2">
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline">
              Anthropic Console
            </a>
            でAPIキーを取得してください。note記事・GBP投稿・FAQ等の自動生成に使用します。
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">院名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: ○○整体院"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">エリア</label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="例: 大阪"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">業種</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="整体院">整体院</option>
            <option value="鍼灸院">鍼灸院</option>
            <option value="整骨院">整骨院</option>
            <option value="接骨院">接骨院</option>
            <option value="カイロプラクティック">カイロプラクティック</option>
            <option value="マッサージ">マッサージ</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">院の説明（コンテンツ生成に使用）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="例: 大阪で開業10年。腰痛・肩こりを根本改善する整体院です。"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">対象キーワード（1行に1つ）</label>
          <textarea
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            rows={8}
            placeholder={"腰痛\n肩こり\n頭痛\n整体\n骨盤矯正"}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            {keywordsText.split("\n").filter((k) => k.trim()).length}個のキーワード
          </p>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
            saved ? "bg-green-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
          }`}
        >
          {saved ? "保存しました" : "設定を保存"}
        </button>
      </div>
    </div>
  );
}
