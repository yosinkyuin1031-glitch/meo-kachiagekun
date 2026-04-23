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
          <p className="text-xs text-gray-400">制定日: 2026年3月26日 / 最終改定日: 2026年4月22日</p>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第1条（本サービスの概要）</h2>
            <p>
              「MEO勝ち上げくん」（以下「本サービス」といいます）は、大口陽平（個人事業主。以下「当社」といいます）が提供する、治療院・サロン向けのMEO対策支援SaaSです。本規約は本サービスの利用条件を定めます。
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
            <h2 className="text-lg font-bold text-gray-800 mb-3">第2条（アカウントと管理責任）</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>利用者は、正確な情報を登録し、自己の責任においてアカウントを管理するものとします。</li>
              <li>ログイン情報の第三者への譲渡・貸与・共有は禁止します。</li>
              <li>不正アクセスまたはその兆候を認知した場合、速やかに当社に通知するものとします。</li>
              <li>Google アカウント等の外部サービス連携により得られるトークン・認可情報は、利用者が当社に安全管理を委託するものとします。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第3条（料金・支払・最低契約期間）</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>月額料金: 1,980円（税込）</li>
              <li>モニター期間中は当社が定める料金（無料または割引価格）でご利用いただけます。</li>
              <li>お支払い方法: Stripeを通じたクレジットカード決済。毎月自動更新されます。</li>
              <li>月額プランの最低契約期間は<strong>6ヶ月</strong>とし、期間内に利用者都合で解約する場合、<strong>残存期間分の月額料金を早期解約金として一括請求</strong>します。</li>
              <li>一度解約したメールアドレス・事業者での再登録は、当社が認めた場合を除き原則として受け付けません。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第4条（禁止事項・反社排除）</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>不正アクセス、サービスの正常な運営を妨げる行為、過度な負荷</li>
              <li>リバースエンジニアリング、逆コンパイル、スクレイピング、クローリング</li>
              <li>アカウントの第三者への譲渡・貸与・共有</li>
              <li>本サービスを利用して第三者にサービスを再販する行為</li>
              <li>反社会的勢力に該当する行為、またはこれを利用する行為</li>
              <li>法令や公序良俗に反する行為</li>
            </ul>
            <p className="mt-2">利用者は、自己および自己の役員・従業員等が暴力団等の反社会的勢力に該当しないこと、関係を有しないことを表明・保証します。違反時、当社は何らの催告なく直ちに契約を解除できます。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第5条（AI生成コンテンツ・医療広告ガイドライン）</h2>
            <p>
              本サービスで生成されるコンテンツはAI（人工知能）によるものです。生成内容の正確性・適切性・法令適合性について、当社は保証しません。
            </p>
            <p className="mt-2">
              特に医療広告ガイドライン、景品表示法、薬機法、その他の関連法令の遵守については、利用者の責任で確認・修正をお願いいたします。生成されたコンテンツをそのまま公開する前に、内容をご確認ください。公開により生じた法的責任・損害について当社は責任を負いません。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第6条（安全管理措置）</h2>
            <p>当社は、利用者情報の漏洩、滅失、改ざんを防止するため、以下の安全管理措置を講じています。</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>SSL/TLSによる通信経路の暗号化</li>
              <li>Supabase Row Level Security による利用者ごとのデータ分離</li>
              <li>パスワードのbcryptハッシュ化保存</li>
              <li>データベースの国内リージョン（東京）での保管</li>
              <li>Supabaseによる自動バックアップ</li>
              <li>Google OAuthトークンの暗号化保存</li>
              <li>決済カード情報はStripeに直接送信（PCI DSS Level 1準拠）、当社は保持しません</li>
              <li>ログイン失敗回数制限（ブルートフォース対策）</li>
              <li>業務委託先の選定および定期的なセキュリティレビュー</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第7条（漏洩等発生時の対応）</h2>
            <p>
              個人情報の漏洩等が発生した場合、当社は個人情報保護委員会への報告および影響を受ける利用者への通知を、<strong>事故認知後速やかに（原則72時間以内を目安に）</strong>行います。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第8条（免責・損害賠償の上限）</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>当社の責に帰すべき事由により利用者に損害が発生した場合、当社の損害賠償責任は、故意または重大な過失がある場合を除き、<strong>損害発生時点から遡って直近3ヶ月間に利用者が当社に現実に支払った利用料金の総額を上限</strong>とし、逸失利益・間接損害等については責任を負いません。</li>
              <li>検索順位の改善、コンテンツの集客効果を保証するものではありません。</li>
              <li>サーバーメンテナンスや障害によるサービスの一時的な停止が発生する場合があります。</li>
              <li>外部サービス（Google、Stripe、WordPress、note等）の仕様変更により、一部機能が利用できなくなる場合があります。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第9条（データの取り扱い）</h2>
            <p>
              解約後30日が経過したデータは、サーバーから完全に削除いたします。Google OAuthトークンは解約と同時に失効処理を行います。必要なデータは、解約前に設定画面の「データエクスポート」機能でダウンロードしてください。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第10条（規約の変更・準拠法）</h2>
            <p>
              当社は、民法第548条の4の規定に基づき必要に応じて本規約を変更することがあります。変更がある場合は、メールまたはサービス内でお知らせいたします。本規約は日本法に準拠し、本サービスに関する紛争は当社所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">第11条（お問い合わせ）</h2>
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
