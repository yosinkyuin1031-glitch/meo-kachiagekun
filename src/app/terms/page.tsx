export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white text-2xl font-black">M</span>
            </div>
          </a>
          <h1 className="text-2xl font-bold text-gray-800">利用規約</h1>
          <p className="text-sm text-gray-500 mt-1">MEO勝ち上げくん</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8 text-sm text-gray-700 leading-relaxed">
          <p className="text-xs text-gray-400">最終更新日: 2026年3月26日</p>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">1. サービスについて</h2>
            <p>
              「MEO勝ち上げくん」（以下「本サービス」）は、大口陽平（個人事業主）が提供する、治療院・サロン向けのMEO対策支援ツールです。
            </p>
            <p className="mt-2">本サービスでは、以下の機能を提供しています。</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>AIによるGBP投稿文・ブログ記事・FAQ等のコンテンツ生成</li>
              <li>Googleマップでの検索順位チェック</li>
              <li>MEO施策の管理（チェックリスト）</li>
              <li>WordPress・noteへの記事投稿連携</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">2. 料金とお支払い</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>月額料金: 1,980円（税込）</li>
              <li>モニター期間中は無料でご利用いただけます</li>
              <li>お支払い方法: Stripeを通じたクレジットカード決済</li>
              <li>毎月自動更新となります</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">3. 解約について</h2>
            <p>
              解約はいつでも可能です。解約後も、次回の請求日まではサービスをご利用いただけます。
              解約のお手続きは、設定画面またはLINEからお申し出ください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">4. 禁止事項</h2>
            <p>以下の行為は禁止とさせていただきます。</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>不正アクセスや、サービスの正常な運営を妨げる行為</li>
              <li>本サービスのプログラムを解析・改変する行為（リバースエンジニアリング）</li>
              <li>アカウントを第三者に譲渡・貸与する行為</li>
              <li>本サービスを利用して第三者にサービスを再販する行為</li>
              <li>法令や公序良俗に反する行為</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">5. AIコンテンツに関する注意事項</h2>
            <p>
              本サービスで生成されるコンテンツはAI（人工知能）によるものです。
              生成内容の正確性や適切性について、すべてを保証するものではありません。
            </p>
            <p className="mt-2">
              特に医療広告ガイドラインの遵守については、ご利用者様の責任で確認・修正をお願いいたします。
              生成されたコンテンツをそのまま公開する前に、内容をご確認ください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">6. 免責事項</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>本サービスの利用によって生じた損害について、故意または重大な過失がある場合を除き、責任を負いかねます</li>
              <li>検索順位の改善を保証するものではありません</li>
              <li>サーバーメンテナンスや障害によるサービスの一時的な停止が発生する場合があります</li>
              <li>外部サービス（Google、Stripe等）の仕様変更により、一部機能が利用できなくなる場合があります</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">7. データの取り扱い</h2>
            <p>
              解約後30日が経過したデータは、サーバーから完全に削除いたします。
              必要なデータは、解約前に設定画面の「データエクスポート」機能でダウンロードしてください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">8. 規約の変更</h2>
            <p>
              本規約は、サービスの改善や法令の変更に応じて変更する場合があります。
              変更がある場合は、メールまたはサービス内でお知らせいたします。
              変更後にサービスを継続してご利用いただいた場合、変更後の規約に同意いただいたものとみなします。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">9. お問い合わせ</h2>
            <p>本規約やサービスに関するご質問は、以下までお気軽にご連絡ください。</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>LINE: <a href="https://lin.ee/yFbMNJM" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">公式LINEはこちら</a></li>
              <li>提供者: 大口陽平（個人事業主）</li>
            </ul>
          </section>
        </div>

        <div className="text-center mt-6 space-x-4">
          <a href="/privacy" className="text-sm text-blue-600 hover:underline">プライバシーポリシー</a>
          <a href="/login" className="text-sm text-blue-600 hover:underline">ログイン</a>
          <a href="/signup" className="text-sm text-blue-600 hover:underline">新規登録</a>
        </div>
      </div>
    </div>
  );
}
