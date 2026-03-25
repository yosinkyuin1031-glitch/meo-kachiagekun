export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white text-2xl font-black">M</span>
            </div>
          </a>
          <h1 className="text-2xl font-bold text-gray-800">プライバシーポリシー</h1>
          <p className="text-sm text-gray-500 mt-1">MEO勝ち上げくん</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8 text-sm text-gray-700 leading-relaxed">
          <p className="text-xs text-gray-400">最終更新日: 2026年3月26日</p>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">1. はじめに</h2>
            <p>
              「MEO勝ち上げくん」（以下「本サービス」）を提供する大口陽平（以下「運営者」）は、
              ご利用者様の個人情報を適切に取り扱うことが重要であると考えています。
              このプライバシーポリシーでは、どのような情報を収集し、どのように利用・管理しているかをご説明します。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">2. 収集する情報</h2>
            <p>本サービスでは、以下の情報を収集します。</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>メールアドレス（ログイン・アカウント管理に使用）</li>
              <li>院情報（院名、エリア、キーワード、業種など）</li>
              <li>AIで生成したコンテンツ（GBP投稿文、ブログ記事、FAQ等）</li>
              <li>MEO順位チェックの履歴データ</li>
              <li>チェックリストの進捗状況</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">3. 情報の利用目的</h2>
            <p>収集した情報は、以下の目的で利用します。</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>本サービスの提供・運営</li>
              <li>サービスの品質向上・機能改善</li>
              <li>お問い合わせへの対応・サポート</li>
              <li>サービスに関する重要なお知らせの送信</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">4. 外部サービスとの連携</h2>
            <p>
              本サービスでは、機能を提供するために以下の外部サービスを利用しています。
              それぞれのサービスのプライバシーポリシーもご確認ください。
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>
                <span className="font-medium">Stripe</span>（決済処理）
                <br />
                <span className="text-gray-500">クレジットカード情報はStripeが直接管理しており、運営者のサーバーには保存されません</span>
              </li>
              <li>
                <span className="font-medium">Supabase</span>（データベース・認証）
                <br />
                <span className="text-gray-500">ユーザーデータの保存と認証処理に使用しています</span>
              </li>
              <li>
                <span className="font-medium">Anthropic（Claude AI）</span>（AI生成）
                <br />
                <span className="text-gray-500">コンテンツ生成のためにAI処理を行っています</span>
              </li>
              <li>
                <span className="font-medium">SerpAPI</span>（検索順位取得）
                <br />
                <span className="text-gray-500">Googleマップでの検索順位を取得するために使用しています</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">5. データの保管</h2>
            <p>
              お客様のデータは、Supabase（AWS上のインフラ）に暗号化して保存されています。
              データの保管にあたっては、不正アクセスや情報漏洩を防ぐために適切なセキュリティ対策を講じています。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">6. データの削除</h2>
            <p>
              ご利用者様からのご請求により、保存しているデータを削除いたします。
              削除をご希望の場合は、LINEまたはメールでご連絡ください。
            </p>
            <p className="mt-2">
              また、サービス解約後30日が経過したデータは自動的に削除されます。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">7. Cookieについて</h2>
            <p>
              本サービスでは、ログイン状態を維持するためにCookie（クッキー）を使用しています。
              広告やトラッキングの目的でCookieを使用することはありません。
              認証セッションの管理のみに利用しています。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">8. 第三者への提供</h2>
            <p>
              法令に基づく場合を除き、ご利用者様の同意なく個人情報を第三者に提供することはありません。
              ただし、上記「4. 外部サービスとの連携」に記載のサービスには、サービス提供に必要な範囲で情報を共有しています。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">9. ポリシーの変更</h2>
            <p>
              本ポリシーは、法令の改正やサービス内容の変更に伴い、更新する場合があります。
              重要な変更がある場合は、メールまたはサービス内でお知らせいたします。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">10. お問い合わせ</h2>
            <p>個人情報の取り扱いに関するご質問やご要望は、以下までご連絡ください。</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>LINE: <a href="https://lin.ee/yFbMNJM" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">公式LINEはこちら</a></li>
              <li>運営者: 大口陽平（個人事業主）</li>
            </ul>
          </section>
        </div>

        <div className="text-center mt-6 space-x-4">
          <a href="/terms" className="text-sm text-blue-600 hover:underline">利用規約</a>
          <a href="/login" className="text-sm text-blue-600 hover:underline">ログイン</a>
          <a href="/signup" className="text-sm text-blue-600 hover:underline">新規登録</a>
        </div>
      </div>
    </div>
  );
}
