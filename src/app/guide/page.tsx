'use client'

import { useState } from 'react'

interface Slide {
  title: string
  subtitle?: string
  content: React.ReactNode
  bg: string
}

/* ─── 画面モック用コンポーネント ─── */

function PhoneMock({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-gray-800 max-w-[300px] mx-auto">
      {/* ステータスバー */}
      <div className="bg-gray-800 px-4 py-1.5 flex justify-between items-center">
        <span className="text-white text-[10px]">9:41</span>
        {title && <span className="text-white text-[10px] font-bold">{title}</span>}
        <div className="flex gap-1">
          <div className="w-3 h-2 bg-white/60 rounded-sm" />
          <div className="w-1.5 h-2 bg-white/60 rounded-sm" />
        </div>
      </div>
      {children}
    </div>
  )
}

function BrowserMock({ children, url }: { children: React.ReactNode; url: string }) {
  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-300 max-w-[320px] mx-auto">
      {/* ブラウザバー */}
      <div className="bg-gray-100 px-3 py-2 flex items-center gap-2 border-b border-gray-200">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded px-2 py-0.5 text-[9px] text-gray-500 truncate border border-gray-200">
          {url}
        </div>
      </div>
      {children}
    </div>
  )
}

function Arrow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="text-orange-400 text-xl animate-bounce">👆</div>
      <span className="text-xs font-bold text-orange-300 bg-orange-500/20 px-2 py-1 rounded-lg">{text}</span>
    </div>
  )
}

function HighlightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute -inset-1 bg-orange-400/30 rounded-lg animate-pulse" />
      <div className="relative">{children}</div>
    </div>
  )
}

/* ─── スライド定義 ─── */

const slides: Slide[] = [
  // 0: タイトル
  {
    title: 'MEO勝ち上げくん',
    subtitle: '導入ガイド',
    bg: 'from-orange-500 to-amber-500',
    content: (
      <div className="text-center space-y-6">
        <div className="text-6xl">🏆</div>
        <p className="text-xl font-bold text-white/90">
          10分で設定完了！
        </p>
        <div className="bg-white/10 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-white/80 font-bold">このガイドでできること</p>
          <div className="text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">✓</span>
              <span className="text-sm text-white/80">アカウント作成</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">✓</span>
              <span className="text-sm text-white/80">APIキーの取得と設定</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">✓</span>
              <span className="text-sm text-white/80">院の情報を入力して即使える状態に</span>
            </div>
          </div>
        </div>
        <p className="text-white/50 text-xs">
          スワイプまたは「次へ」ボタンで進んでください
        </p>
      </div>
    ),
  },

  // 1: 全体の流れ
  {
    title: '全体の流れ',
    subtitle: '3ステップで完了です',
    bg: 'from-gray-800 to-gray-900',
    content: (
      <div className="space-y-4">
        <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-violet-400">1</span>
            <div>
              <p className="font-bold text-white">アカウントを作成する</p>
              <p className="text-xs text-white/50">メールアドレスとパスワードだけ（1分）</p>
            </div>
          </div>
        </div>
        <div className="text-center text-xl text-white/30">↓</div>
        <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-blue-400">2</span>
            <div>
              <p className="font-bold text-white">APIキーを取得する</p>
              <p className="text-xs text-white/50">AIを動かすための鍵を手に入れる（5分）</p>
            </div>
          </div>
        </div>
        <div className="text-center text-xl text-white/30">↓</div>
        <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-emerald-400">3</span>
            <div>
              <p className="font-bold text-white">院の情報を入力する</p>
              <p className="text-xs text-white/50">設定画面で入力すれば完了（4分）</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // 2: STEP 1 アカウント作成
  {
    title: 'STEP 1',
    subtitle: 'アカウントを作成する',
    bg: 'from-violet-600 to-violet-800',
    content: (
      <div className="space-y-4">
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-xs text-white/60 mb-2">まず下のボタンを押してください：</p>
          <a
            href="https://app-three-pi-32.vercel.app/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-lg p-3 text-center text-violet-700 font-bold text-sm hover:bg-white/90 transition"
          >
            アカウント作成ページを開く →
          </a>
        </div>

        <p className="text-xs text-white/50 text-center">↓ このような画面が表示されます</p>

        {/* サインアップ画面モック */}
        <PhoneMock>
          <div className="bg-gradient-to-b from-slate-50 to-white p-4">
            <div className="text-center mb-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                <span className="text-white text-lg font-black">M</span>
              </div>
              <p className="text-sm font-bold text-gray-800">新規登録</p>
              <p className="text-[9px] text-gray-400">MEO勝ち上げくんのアカウントを作成</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2.5">
              <div>
                <p className="text-[9px] font-medium text-gray-600 mb-0.5">メールアドレス</p>
                <HighlightBox>
                  <div className="border border-orange-400 rounded-lg px-2 py-1.5 text-[10px] text-gray-800 bg-orange-50">
                    your-email@gmail.com
                  </div>
                </HighlightBox>
                <Arrow text="普段のメールアドレスを入力" />
              </div>
              <div>
                <p className="text-[9px] font-medium text-gray-600 mb-0.5">パスワード（6文字以上）</p>
                <HighlightBox>
                  <div className="border border-orange-400 rounded-lg px-2 py-1.5 text-[10px] text-gray-800 bg-orange-50">
                    ●●●●●●●●
                  </div>
                </HighlightBox>
                <Arrow text="自分で決めたパスワードを入力" />
              </div>
              <div>
                <p className="text-[9px] font-medium text-gray-600 mb-0.5">パスワード確認</p>
                <div className="border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] text-gray-400">
                  同じパスワードをもう一度
                </div>
              </div>
              <HighlightBox>
                <div className="bg-blue-600 text-white text-center py-2 rounded-lg text-[10px] font-bold">
                  アカウントを作成
                </div>
              </HighlightBox>
              <Arrow text="入力したら、ここを押す！" />
            </div>
          </div>
        </PhoneMock>

        <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-3 text-center">
          <p className="text-xs text-emerald-300 font-bold">→ 自動でログインされてトップ画面に移動します</p>
        </div>
      </div>
    ),
  },

  // 3: STEP 2 APIキーとは
  {
    title: 'STEP 2',
    subtitle: 'APIキーを取得する',
    bg: 'from-blue-600 to-blue-800',
    content: (
      <div className="space-y-4">
        <div className="bg-white/10 rounded-xl p-5">
          <p className="text-sm text-blue-200 font-bold mb-2">APIキーとは？</p>
          <div className="flex items-start gap-3">
            <span className="text-3xl">🔑</span>
            <p className="text-sm text-white/80">
              AIを動かすための<strong className="text-white">「鍵」</strong>のようなものです。<br/>
              この鍵がないとAIが文章を作れません。
            </p>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl p-5">
          <p className="text-sm text-blue-200 font-bold mb-2">料金について</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xl">💰</span>
              <div>
                <p className="text-sm text-white font-bold">月500円くらい</p>
                <p className="text-xs text-white/60">通常の利用量の場合</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">💳</span>
              <div>
                <p className="text-sm text-white font-bold">最初は$5（約750円）でOK</p>
                <p className="text-xs text-white/60">クレジットカードで購入できます</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-4">
          <p className="text-xs text-yellow-200">
            💡 次のページから、APIキーの取得手順を<strong>画面付き</strong>で説明します。<br/>
            見ながら同じ操作をするだけでOKです。
          </p>
        </div>
      </div>
    ),
  },

  // 4: STEP 2-1 Anthropicにアクセス
  {
    title: 'STEP 2-1',
    subtitle: 'Anthropicのサイトを開く',
    bg: 'from-blue-600 to-blue-800',
    content: (
      <div className="space-y-4">
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-xs text-white/60 mb-2">下のボタンを押してください：</p>
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-lg p-3 text-center text-blue-700 font-bold text-sm hover:bg-white/90 transition"
          >
            Anthropic Console を開く →
          </a>
        </div>

        <p className="text-xs text-white/50 text-center">↓ このような画面が表示されます</p>

        <BrowserMock url="console.anthropic.com">
          <div className="bg-[#1a1a2e] p-5 text-center space-y-3">
            <div className="text-2xl font-bold text-white tracking-wider">anthropic</div>
            <p className="text-xs text-gray-400">Welcome to Claude</p>
            <div className="space-y-2 max-w-[200px] mx-auto">
              <div className="bg-white rounded-lg py-2 text-center text-sm text-gray-700 font-medium">
                Continue with Google
              </div>
              <HighlightBox>
                <div className="bg-orange-500 rounded-lg py-2 text-center text-sm text-white font-bold">
                  Sign up
                </div>
              </HighlightBox>
              <Arrow text="ここを押してアカウント作成" />
            </div>
            <p className="text-[10px] text-gray-500">Already have an account? <span className="text-blue-400">Log in</span></p>
          </div>
        </BrowserMock>

        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-xs text-white/80">
            <strong className="text-blue-200">おすすめ：</strong>「Continue with Google」を押せば、<br/>
            Googleアカウントでそのまま登録できます。<br/>
            <span className="text-white/50">新しくパスワードを作る必要はありません。</span>
          </p>
        </div>
      </div>
    ),
  },

  // 5: STEP 2-2 クレジット購入
  {
    title: 'STEP 2-2',
    subtitle: 'クレジットを購入する',
    bg: 'from-blue-600 to-blue-800',
    content: (
      <div className="space-y-4">
        <p className="text-xs text-white/60">ログインしたら、左のメニューから操作します：</p>

        <BrowserMock url="console.anthropic.com/settings/billing">
          <div className="flex min-h-[220px]">
            {/* サイドバー */}
            <div className="w-[80px] bg-gray-50 border-r border-gray-200 p-2 space-y-1.5">
              <div className="text-[8px] text-gray-400 px-1">Menu</div>
              <div className="text-[8px] text-gray-600 px-1 py-0.5 rounded">Dashboard</div>
              <div className="text-[8px] text-gray-600 px-1 py-0.5 rounded">API Keys</div>
              <HighlightBox>
                <div className="text-[8px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-bold">Settings</div>
              </HighlightBox>
              <Arrow text="①" />
            </div>
            {/* メイン */}
            <div className="flex-1 p-3 bg-white">
              <div className="flex gap-2 mb-3">
                <span className="text-[8px] text-gray-400 px-1 py-0.5">General</span>
                <HighlightBox>
                  <span className="text-[8px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-bold">Billing</span>
                </HighlightBox>
              </div>
              <Arrow text="② Billingタブを押す" />
              <div className="space-y-2">
                <div className="text-[9px] text-gray-600">Credit Balance</div>
                <div className="text-lg font-bold text-gray-800">$0.00</div>
                <HighlightBox>
                  <div className="bg-blue-600 text-white text-[9px] font-bold py-1.5 px-3 rounded-lg inline-block">
                    Add credits
                  </div>
                </HighlightBox>
                <Arrow text="③ ここで$5以上を購入！" />
              </div>
            </div>
          </div>
        </BrowserMock>

        <div className="bg-white/10 rounded-xl p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-sm">💳</span>
            <p className="text-xs text-white/80">
              <strong className="text-white">$5（約750円）</strong>から購入できます。<br/>
              クレジットカードで決済します。
            </p>
          </div>
        </div>

        <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-xl p-3">
          <p className="text-[11px] text-yellow-200">
            💡 $5で約1〜2ヶ月分の通常利用ができます。足りなくなったら追加で購入するだけです。
          </p>
        </div>
      </div>
    ),
  },

  // 6: STEP 2-3 APIキー作成
  {
    title: 'STEP 2-3',
    subtitle: 'APIキーを作成する',
    bg: 'from-blue-600 to-blue-800',
    content: (
      <div className="space-y-4">
        <BrowserMock url="console.anthropic.com/settings/keys">
          <div className="flex min-h-[200px]">
            {/* サイドバー */}
            <div className="w-[80px] bg-gray-50 border-r border-gray-200 p-2 space-y-1.5">
              <div className="text-[8px] text-gray-400 px-1">Menu</div>
              <div className="text-[8px] text-gray-600 px-1 py-0.5 rounded">Dashboard</div>
              <HighlightBox>
                <div className="text-[8px] text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-bold">API Keys</div>
              </HighlightBox>
              <Arrow text="①" />
              <div className="text-[8px] text-gray-600 px-1 py-0.5 rounded">Settings</div>
            </div>
            {/* メイン */}
            <div className="flex-1 p-3 bg-white">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold text-gray-700">API Keys</span>
                <HighlightBox>
                  <div className="bg-blue-600 text-white text-[8px] font-bold py-1 px-2 rounded">
                    + Create Key
                  </div>
                </HighlightBox>
              </div>
              <Arrow text="② ここを押す" />
              <div className="bg-green-50 border border-green-200 rounded p-2 mt-2">
                <p className="text-[8px] text-green-700 font-bold">新しいキーが作成されました：</p>
                <div className="bg-white border border-green-300 rounded p-1.5 mt-1">
                  <code className="text-[7px] text-green-800 break-all">sk-ant-api03-xxxxx...xxxxx</code>
                </div>
                <Arrow text="③ この文字列をコピー！" />
              </div>
            </div>
          </div>
        </BrowserMock>

        <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-sm text-red-200 font-bold">超重要！</p>
              <p className="text-xs text-white/80 mt-1">
                このキーは<strong className="text-red-200">一度しか表示されません</strong>。<br/>
                必ず今すぐコピーして、メモ帳やLINEの自分宛てに<br/>
                貼り付けて保存してください。
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-white/60">
            もしコピーし忘れても大丈夫です。<br/>
            もう一度「Create Key」を押せば新しいキーが作れます。
          </p>
        </div>
      </div>
    ),
  },

  // 7: STEP 3 設定タブを開く
  {
    title: 'STEP 3',
    subtitle: '院の情報を入力する',
    bg: 'from-emerald-600 to-emerald-800',
    content: (
      <div className="space-y-4">
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-xs text-white/80">
            STEP 1でアカウント作成後、自動でログインされています。<br/>
            ログアウトしている場合は：
          </p>
          <a
            href="https://app-three-pi-32.vercel.app/login"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white rounded-lg p-2.5 text-center text-emerald-700 font-bold text-sm mt-2 hover:bg-white/90 transition"
          >
            ログインページを開く →
          </a>
        </div>

        <p className="text-xs text-white/50 text-center">↓ ログイン後、この画面が表示されます</p>

        <PhoneMock title="MEO勝ち上げくん">
          <div className="bg-gray-50 p-2">
            {/* ヘッダー */}
            <div className="bg-white rounded-lg p-2 mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-[8px] font-black">M</span>
                </div>
                <span className="text-[9px] font-bold text-gray-700">MEO勝ち上げくん</span>
              </div>
              <span className="text-[8px] text-gray-400">ログアウト</span>
            </div>
            {/* タブ */}
            <div className="flex gap-0.5 mb-2 overflow-x-auto">
              <div className="text-[7px] px-2 py-1 rounded bg-white text-gray-500 whitespace-nowrap">📊 ダッシュボード</div>
              <div className="text-[7px] px-2 py-1 rounded bg-white text-gray-500 whitespace-nowrap">⚡ コンテンツ生成</div>
              <div className="text-[7px] px-2 py-1 rounded bg-white text-gray-500 whitespace-nowrap">✅ 施策</div>
              <HighlightBox>
                <div className="text-[7px] px-2 py-1 rounded bg-blue-600 text-white font-bold whitespace-nowrap">⚙️ 設定</div>
              </HighlightBox>
            </div>
            <Arrow text="「設定」タブを押す" />
            <div className="bg-white rounded-lg p-2 text-center text-[9px] text-gray-400 h-16 flex items-center justify-center">
              設定画面が開きます →
            </div>
          </div>
        </PhoneMock>
      </div>
    ),
  },

  // 8: STEP 3-1 APIキーを貼り付ける
  {
    title: 'STEP 3-1',
    subtitle: 'APIキーを設定画面に貼り付ける',
    bg: 'from-emerald-600 to-emerald-800',
    content: (
      <div className="space-y-4">
        <p className="text-xs text-white/60">設定画面の一番上に「AI設定」があります：</p>

        <PhoneMock title="設定">
          <div className="bg-gray-50 p-3 space-y-2">
            {/* AI設定セクション */}
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <p className="text-[9px] font-bold text-gray-700 mb-2">🤖 AI設定（全院共通）</p>
              <div className="bg-blue-50 rounded p-2 mb-2">
                <p className="text-[8px] text-blue-700">接続テスト：</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-[8px] text-gray-500">未テスト</span>
                </div>
              </div>
              <p className="text-[8px] text-gray-500 mb-1">詳細設定（個別APIキーを使用する場合）</p>
              <div className="space-y-1.5">
                <p className="text-[8px] font-medium text-gray-600">Anthropic APIキー</p>
                <HighlightBox>
                  <div className="border-2 border-orange-400 rounded-lg px-2 py-1.5 text-[8px] text-gray-700 bg-orange-50">
                    sk-ant-api03-xxxxx...xxxxx
                  </div>
                </HighlightBox>
                <Arrow text="STEP 2で取得したキーを貼り付け" />
                <HighlightBox>
                  <div className="bg-blue-600 text-white text-[8px] font-bold py-1.5 px-3 rounded-lg text-center">
                    保存＆テスト
                  </div>
                </HighlightBox>
                <Arrow text="ここを押して接続テスト！" />
              </div>
            </div>
          </div>
        </PhoneMock>

        <div className="bg-emerald-400/20 border border-emerald-400/30 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-xs text-emerald-300 font-bold">「接続成功」が出ればOK！</p>
              <p className="text-[10px] text-white/60">緑色の「接続成功」が表示されれば完了です</p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-white/60">
            <strong className="text-white/80">エラーが出た場合：</strong><br/>
            ・キーの前後に余計なスペースがないか確認<br/>
            ・「sk-ant-」で始まっているか確認<br/>
            ・コピーし直してもう一度貼り付けてみてください
          </p>
        </div>
      </div>
    ),
  },

  // 9: STEP 3-2 院を追加する
  {
    title: 'STEP 3-2',
    subtitle: '院の基本情報を入力する',
    bg: 'from-emerald-600 to-emerald-800',
    content: (
      <div className="space-y-4">
        <p className="text-xs text-white/60">画面を下にスクロールすると「登録院」セクションがあります：</p>

        <PhoneMock title="設定 - 登録院">
          <div className="bg-gray-50 p-3 space-y-2">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[9px] font-bold text-gray-700">🏥 登録院</p>
                <HighlightBox>
                  <div className="bg-blue-600 text-white text-[7px] font-bold py-1 px-2 rounded">
                    + 院を追加
                  </div>
                </HighlightBox>
              </div>
              <Arrow text="ここを押して院を登録" />

              <div className="border border-gray-200 rounded-lg p-2 space-y-1.5 mt-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <p className="text-[7px] text-gray-500">院名 <span className="text-red-400">*</span></p>
                    <HighlightBox>
                      <div className="border border-orange-400 rounded px-1.5 py-1 text-[8px] bg-orange-50 text-gray-700">
                        〇〇整体院
                      </div>
                    </HighlightBox>
                  </div>
                  <div>
                    <p className="text-[7px] text-gray-500">エリア</p>
                    <HighlightBox>
                      <div className="border border-orange-400 rounded px-1.5 py-1 text-[8px] bg-orange-50 text-gray-700">
                        渋谷区
                      </div>
                    </HighlightBox>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <p className="text-[7px] text-gray-500">最寄り駅</p>
                    <div className="border border-gray-200 rounded px-1.5 py-1 text-[8px] text-gray-400">
                      渋谷駅
                    </div>
                  </div>
                  <div>
                    <p className="text-[7px] text-gray-500">院長名</p>
                    <div className="border border-gray-200 rounded px-1.5 py-1 text-[8px] text-gray-400">
                      山田 太郎
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PhoneMock>

        <div className="bg-white/10 rounded-xl p-4 space-y-2">
          <p className="text-xs text-white font-bold">入力する項目：</p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-orange-400 text-xs font-bold mt-0.5">必須</span>
              <p className="text-xs text-white/80"><strong>院名</strong> ─ 正式な院名</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-400 text-xs font-bold mt-0.5">必須</span>
              <p className="text-xs text-white/80"><strong>エリア</strong> ─ 集客したい地域名</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-white/30 text-xs mt-0.5">任意</span>
              <p className="text-xs text-white/60">最寄り駅・院長名・専門分野</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },

  // 10: STEP 3-3 強み・口コミ・キーワード
  {
    title: 'STEP 3-3',
    subtitle: '強み・口コミ・キーワードを入力',
    bg: 'from-emerald-600 to-emerald-800',
    content: (
      <div className="space-y-4">
        <p className="text-xs text-white/60">さらに下にスクロールすると、AIの文章品質を上げる項目があります：</p>

        <PhoneMock title="設定 - 院の詳細">
          <div className="bg-gray-50 p-3 space-y-2">
            <div className="bg-white rounded-lg p-2.5 border border-gray-200 space-y-2">
              <div>
                <p className="text-[7px] font-medium text-gray-600">院の説明</p>
                <div className="border border-gray-200 rounded px-1.5 py-1 text-[7px] text-gray-500 h-8">
                  開業15年の実績。延べ3万人以上...
                </div>
              </div>
              <div>
                <p className="text-[7px] font-medium text-gray-600">院の強み・差別化ポイント</p>
                <HighlightBox>
                  <div className="border border-orange-400 rounded px-1.5 py-1 text-[7px] text-gray-700 bg-orange-50 h-8">
                    独自の神経整体で根本改善...
                  </div>
                </HighlightBox>
                <Arrow text="AIの文章が格段に良くなる！" />
              </div>
              <div>
                <p className="text-[7px] font-medium text-gray-600">代表的な口コミ・患者の声</p>
                <div className="border border-gray-200 rounded px-1.5 py-1 text-[7px] text-gray-500 h-8">
                  「3回で腰痛が改善しました」...
                </div>
              </div>
              <div>
                <p className="text-[7px] font-medium text-gray-600">症状キーワード（1行1つ）</p>
                <HighlightBox>
                  <div className="border border-orange-400 rounded px-1.5 py-1 text-[7px] text-gray-700 bg-orange-50 h-12 leading-relaxed">
                    腰痛<br/>肩こり<br/>頭痛<br/>自律神経
                  </div>
                </HighlightBox>
                <Arrow text="上位を狙いたい症状を入力" />
              </div>
            </div>
          </div>
        </PhoneMock>

        <div className="bg-white/10 rounded-xl p-4 space-y-2">
          <p className="text-xs text-white font-bold">💡 入力のコツ</p>
          <div className="space-y-1">
            <p className="text-[11px] text-white/70">・<strong className="text-white/90">強み</strong>は「他の院にない特徴」を書く</p>
            <p className="text-[11px] text-white/70">・<strong className="text-white/90">口コミ</strong>はGoogleの口コミからコピペでOK</p>
            <p className="text-[11px] text-white/70">・<strong className="text-white/90">キーワード</strong>は1行に1つずつ（地域名は不要）</p>
          </div>
        </div>

        <div className="bg-emerald-400/20 border border-emerald-400/30 rounded-xl p-3">
          <p className="text-[11px] text-emerald-200">
            ✨ おすすめキーワードが画面に表示されるので、<br/>タップするだけで追加もできます！
          </p>
        </div>
      </div>
    ),
  },

  // 11: STEP 3-4 保存して完了
  {
    title: 'STEP 3-4',
    subtitle: '保存して設定完了！',
    bg: 'from-emerald-600 to-emerald-800',
    content: (
      <div className="space-y-4">
        <PhoneMock title="設定 - 保存">
          <div className="bg-gray-50 p-3">
            <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
              <p className="text-[8px] text-gray-500 text-center">（入力が終わったら一番下へ）</p>
              <div className="flex gap-2">
                <HighlightBox>
                  <div className="flex-1 bg-blue-600 text-white text-[9px] font-bold py-2 rounded-lg text-center">
                    追加
                  </div>
                </HighlightBox>
                <div className="flex-1 bg-gray-200 text-gray-600 text-[9px] py-2 rounded-lg text-center">
                  キャンセル
                </div>
              </div>
              <Arrow text="「追加」ボタンを押して保存！" />

              <div className="bg-green-50 border border-green-200 rounded-lg p-2 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✅</span>
                  <div>
                    <p className="text-[9px] text-green-700 font-bold">院の登録が完了しました！</p>
                    <p className="text-[7px] text-green-600">さっそくコンテンツを作ってみましょう</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PhoneMock>

        <div className="bg-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs text-white font-bold">🎊 おめでとうございます！</p>
          <p className="text-xs text-white/80">
            これで設定は全て完了です。<br/>
            画面上部の「コンテンツ生成」タブを押すと、<br/>
            すぐにAIが文章を作ってくれます。
          </p>
        </div>
      </div>
    ),
  },

  // 12: 使い方ガイド
  {
    title: 'さっそく使ってみよう！',
    subtitle: 'おすすめの機能',
    bg: 'from-orange-500 to-amber-500',
    content: (
      <div className="space-y-5">
        <PhoneMock title="MEO勝ち上げくん">
          <div className="bg-gray-50 p-2">
            <div className="flex gap-0.5 mb-2">
              <div className="text-[7px] px-1.5 py-0.5 rounded bg-white text-gray-500">📊</div>
              <HighlightBox>
                <div className="text-[7px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-bold">⚡ コンテンツ生成</div>
              </HighlightBox>
              <div className="text-[7px] px-1.5 py-0.5 rounded bg-white text-gray-500">✅</div>
              <div className="text-[7px] px-1.5 py-0.5 rounded bg-white text-gray-500">🔍</div>
            </div>
            <div className="bg-white rounded-lg p-2 space-y-1">
              <div className="flex items-center gap-2 p-1.5 bg-blue-50 rounded">
                <span className="text-sm">📝</span>
                <div>
                  <p className="text-[8px] font-bold text-gray-700">GBP投稿</p>
                  <p className="text-[7px] text-gray-400">Googleマップに投稿する文章</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded">
                <span className="text-sm">❓</span>
                <div>
                  <p className="text-[8px] font-bold text-gray-700">FAQ生成</p>
                  <p className="text-[7px] text-gray-400">よくある質問の回答を自動生成</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded">
                <span className="text-sm">📰</span>
                <div>
                  <p className="text-[8px] font-bold text-gray-700">ブログ記事</p>
                  <p className="text-[7px] text-gray-400">SEO対策されたブログ記事</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded">
                <span className="text-sm">💬</span>
                <div>
                  <p className="text-[8px] font-bold text-gray-700">口コミ返信</p>
                  <p className="text-[7px] text-gray-400">Google口コミへの返信文</p>
                </div>
              </div>
            </div>
          </div>
        </PhoneMock>

        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-xs text-white/70">
            ご不明な点があれば、いつでもLINEでご連絡ください。<br/>
            「ここで止まった」などスクショを送っていただければ<br/>
            すぐにサポートします。
          </p>
        </div>

        <a
          href="https://app-three-pi-32.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-xl p-3 text-center text-orange-600 font-bold text-sm hover:bg-white/90 transition shadow-lg"
        >
          🏆 MEO勝ち上げくんを開く →
        </a>
      </div>
    ),
  },
]

export default function GuidePage() {
  const [current, setCurrent] = useState(0)
  const slide = slides[current]

  const goNext = () => setCurrent(prev => Math.min(prev + 1, slides.length - 1))
  const goPrev = () => setCurrent(prev => Math.max(prev - 1, 0))

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${slide.bg} transition-all duration-500 flex flex-col`}
      onTouchStart={(e) => {
        const startX = e.touches[0].clientX
        const handleEnd = (e2: TouchEvent) => {
          const diff = startX - e2.changedTouches[0].clientX
          if (diff > 50) goNext()
          if (diff < -50) goPrev()
          document.removeEventListener('touchend', handleEnd)
        }
        document.addEventListener('touchend', handleEnd)
      }}
    >
      {/* Progress bar */}
      <div className="flex gap-0.5 px-4 pt-4">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i <= current ? 'bg-white/80' : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Slide number */}
      <div className="px-4 pt-3">
        <span className="text-xs text-white/50">{current + 1} / {slides.length}</span>
      </div>

      {/* Title */}
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-black text-white">{slide.title}</h1>
        {slide.subtitle && (
          <p className="text-sm text-white/70 mt-1">{slide.subtitle}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4 overflow-y-auto">
        {slide.content}
      </div>

      {/* Navigation */}
      <div className="px-6 pb-8 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={current === 0}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
            current === 0
              ? 'text-white/20'
              : 'bg-white/20 text-white hover:bg-white/30 active:scale-95'
          }`}
        >
          ← 戻る
        </button>
        <button
          onClick={goNext}
          disabled={current === slides.length - 1}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
            current === slides.length - 1
              ? 'text-white/20'
              : 'bg-white text-gray-800 hover:bg-white/90 active:scale-95'
          }`}
        >
          次へ →
        </button>
      </div>
    </div>
  )
}
