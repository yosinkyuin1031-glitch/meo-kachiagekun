'use client'

import { useState } from 'react'

interface Slide {
  title: string
  subtitle?: string
  content: React.ReactNode
  bg: string
}

const slides: Slide[] = [
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
        <p className="text-white/70 text-sm">
          スワイプまたは矢印ボタンで進んでください
        </p>
      </div>
    ),
  },
  {
    title: '全体の流れ',
    subtitle: 'たった2ステップです',
    bg: 'from-gray-800 to-gray-900',
    content: (
      <div className="space-y-6">
        <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-orange-400">1</span>
            <div>
              <p className="font-bold text-white">APIキーを取得する</p>
              <p className="text-sm text-white/60">AIを動かすための鍵を手に入れる</p>
            </div>
          </div>
        </div>
        <div className="text-center text-2xl text-white/30">↓</div>
        <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-orange-400">2</span>
            <div>
              <p className="font-bold text-white">アプリにログインして設定</p>
              <p className="text-sm text-white/60">院の情報を入力すれば完了</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'STEP 1',
    subtitle: 'APIキーを取得する',
    bg: 'from-blue-600 to-blue-800',
    content: (
      <div className="space-y-4">
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-sm text-blue-200 font-bold mb-1">APIキーとは？</p>
          <p className="text-sm text-white/80">
            AIを動かすための「鍵」のようなものです。<br/>
            1人1つ必要で、使った分だけ料金がかかります。
          </p>
        </div>
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-sm text-blue-200 font-bold mb-1">料金の目安</p>
          <p className="text-sm text-white/80">
            月500円程度（通常利用の場合）<br/>
            最初に$5（約750円）購入すればしばらく使えます
          </p>
        </div>
      </div>
    ),
  },
  {
    title: 'STEP 1-1',
    subtitle: 'Anthropicにアクセス',
    bg: 'from-blue-600 to-blue-800',
    content: (
      <div className="space-y-5">
        <div className="bg-white/10 rounded-xl p-5">
          <p className="text-sm text-white/80 mb-3">下記のサイトにアクセスしてください：</p>
          <a
            href="https://console.anthropic.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white/20 rounded-lg p-3 text-center text-white font-bold hover:bg-white/30 transition"
          >
            console.anthropic.com
          </a>
        </div>
        <div className="bg-white/10 rounded-xl p-5">
          <p className="text-sm text-blue-200 font-bold mb-2">アカウント作成</p>
          <p className="text-sm text-white/80">
            「Sign up」を押して、<br/>
            <strong>Googleアカウント</strong>でそのまま登録できます。<br/>
            新しくパスワードを作る必要はありません。
          </p>
        </div>
      </div>
    ),
  },
  {
    title: 'STEP 1-2',
    subtitle: 'クレジットを購入',
    bg: 'from-blue-600 to-blue-800',
    content: (
      <div className="space-y-4">
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">1️⃣</span>
          <p className="text-sm text-white/90">左メニューの「<strong>Settings</strong>」を押す</p>
        </div>
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">2️⃣</span>
          <p className="text-sm text-white/90">「<strong>Billing</strong>」を押す</p>
        </div>
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">3️⃣</span>
          <p className="text-sm text-white/90">
            「<strong>Add credits</strong>」ボタンから<br/>
            最低 <strong>$5（約750円）</strong> を購入<br/>
            <span className="text-white/60">クレジットカードで決済できます</span>
          </p>
        </div>
      </div>
    ),
  },
  {
    title: 'STEP 1-3',
    subtitle: 'APIキーを作成',
    bg: 'from-blue-600 to-blue-800',
    content: (
      <div className="space-y-4">
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">1️⃣</span>
          <p className="text-sm text-white/90">左メニューの「<strong>API Keys</strong>」を押す</p>
        </div>
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">2️⃣</span>
          <p className="text-sm text-white/90">「<strong>Create Key</strong>」ボタンを押す</p>
        </div>
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">3️⃣</span>
          <p className="text-sm text-white/90">
            表示されたキーを<strong>コピー</strong>して保存<br/>
            <span className="text-white/60">「sk-ant-」で始まる長い文字列です</span>
          </p>
        </div>
        <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-4">
          <p className="text-sm text-red-200 font-bold">注意</p>
          <p className="text-xs text-white/80 mt-1">
            このキーは一度しか表示されません。<br/>
            必ずこのタイミングでコピーしてください。<br/>
            忘れた場合はもう一度「Create Key」で作れます。
          </p>
        </div>
      </div>
    ),
  },
  {
    title: 'STEP 2',
    subtitle: 'アプリにログイン',
    bg: 'from-emerald-600 to-emerald-800',
    content: (
      <div className="space-y-4">
        <div className="bg-white/10 rounded-xl p-5">
          <p className="text-sm text-white/80 mb-3">アプリにアクセス：</p>
          <a
            href="https://meo-kachiagekun.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-white/20 rounded-lg p-3 text-center text-white font-bold hover:bg-white/30 transition"
          >
            meo-kachiagekun.vercel.app
          </a>
        </div>
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">1️⃣</span>
          <p className="text-sm text-white/90">
            メールアドレスとパスワードでログイン<br/>
            <span className="text-white/60">個別にお送りしたものを使ってください</span>
          </p>
        </div>
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">2️⃣</span>
          <p className="text-sm text-white/90">画面上部の「<strong>設定</strong>」タブを押す</p>
        </div>
      </div>
    ),
  },
  {
    title: 'STEP 2-2',
    subtitle: '設定画面で入力する項目',
    bg: 'from-emerald-600 to-emerald-800',
    content: (
      <div className="space-y-3">
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-emerald-300 font-bold">APIキー（必須）</p>
          <p className="text-xs text-white/70">STEP 1で取得した「sk-ant-」で始まる文字列</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-emerald-300 font-bold">院名</p>
          <p className="text-xs text-white/70">正式な院名を入力</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-emerald-300 font-bold">エリア</p>
          <p className="text-xs text-white/70">「渋谷区」「横浜市青葉区」など集客したい地域名</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-emerald-300 font-bold">キーワード</p>
          <p className="text-xs text-white/70">「腰痛」「肩こり」「整体」など上位を狙いたい言葉</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3">
          <p className="text-xs text-emerald-300 font-bold">院の説明・強み・実績・口コミ</p>
          <p className="text-xs text-white/70">AIの文章品質がぐっと上がります</p>
        </div>
      </div>
    ),
  },
  {
    title: 'STEP 2-3',
    subtitle: '接続テスト',
    bg: 'from-emerald-600 to-emerald-800',
    content: (
      <div className="space-y-5">
        <div className="flex items-start gap-3 bg-white/10 rounded-xl p-4">
          <span className="text-xl mt-0.5">1️⃣</span>
          <p className="text-sm text-white/90">
            設定画面の「<strong>接続テスト</strong>」ボタンを押す
          </p>
        </div>
        <div className="bg-emerald-400/20 border border-emerald-400/30 rounded-xl p-4 text-center">
          <p className="text-lg font-bold text-emerald-300">接続成功</p>
          <p className="text-xs text-white/60 mt-1">この表示が出ればOKです</p>
        </div>
        <div className="bg-white/10 rounded-xl p-4">
          <p className="text-xs text-white/60">
            エラーが出た場合は、キーのコピーミスがないか確認してください。<br/>
            前後にスペースが入っていないかもチェックしてください。
          </p>
        </div>
      </div>
    ),
  },
  {
    title: '設定完了！',
    subtitle: 'さっそく使ってみましょう',
    bg: 'from-orange-500 to-amber-500',
    content: (
      <div className="space-y-5 text-center">
        <div className="text-5xl">🎉</div>
        <p className="text-white/90 text-sm">
          設定が完了しました！<br/>
          さっそく以下の機能を試してみてください。
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-2xl mb-1">📝</p>
            <p className="text-xs font-bold text-white">GBP投稿</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-2xl mb-1">❓</p>
            <p className="text-xs font-bold text-white">FAQ生成</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-2xl mb-1">📰</p>
            <p className="text-xs font-bold text-white">ブログ記事</p>
          </div>
          <div className="bg-white/20 rounded-xl p-3">
            <p className="text-2xl mb-1">💬</p>
            <p className="text-xs font-bold text-white">口コミ返信</p>
          </div>
        </div>
        <div className="bg-white/10 rounded-xl p-4 mt-4">
          <p className="text-xs text-white/70">
            ご不明な点があれば、いつでもLINEでご連絡ください。<br/>
            「ここで止まった」などスクショを送っていただければ<br/>
            すぐにサポートします。
          </p>
        </div>
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
      <div className="flex gap-1 px-4 pt-4">
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
