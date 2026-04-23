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
          <p className="text-xs text-gray-400">制定日: 2026年3月26日 / 最終改定日: 2026年4月22日</p>

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
            <h2 className="text-lg font-bold text-gray-800 mb-3">5. 安全管理措置</h2>
            <p>運営者は、個人情報の漏洩、滅失、毀損を防止するため、以下の安全管理措置を講じています。</p>
            <div className="space-y-2 mt-3 text-xs text-gray-600">
              <p><strong className="text-gray-700">技術的安全管理措置：</strong>SSL/TLS通信暗号化、Supabase RLSによる利用者ごとのデータ分離、パスワードのbcryptハッシュ化、Google OAuthトークンの暗号化保存、RBAC、ログイン失敗回数制限、アクセスログの記録</p>
              <p><strong className="text-gray-700">物理的・組織的安全管理措置：</strong>データは<strong>東京リージョン（日本国内）</strong>のデータセンターに保管、Supabaseによる自動バックアップ、アクセス権限の必要最小限化、定期的なセキュリティレビュー</p>
              <p><strong className="text-gray-700">人的安全管理措置：</strong>従業者教育、守秘義務の徹底</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">5-2. 漏洩等発生時の対応</h2>
            <p>
              個人情報の漏洩等が発生した場合、運営者は個人情報保護委員会への報告および影響を受ける利用者への通知を、<strong>事故認知後速やかに（原則72時間以内を目安に）</strong>行います。
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
