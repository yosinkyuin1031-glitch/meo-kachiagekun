import Stripe from "stripe";

/**
 * Stripe インスタンス（サーバーサイド専用・遅延初期化）
 * 環境変数 STRIPE_SECRET_KEY を Vercel に設定してください。
 * テストモードの秘密鍵（sk_test_...）を使用します。
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

// 後方互換のためのgetter export（ビルド時にStripeを初期化しない）
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    try {
      return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
    } catch {
      return undefined;
    }
  },
});

/**
 * Stripe Price ID（月額1,980円）
 * Stripeダッシュボードで商品・価格を作成後、ここにPrice IDを設定してください。
 * テスト環境: price_test_xxxxxx
 * 本番環境: price_live_xxxxxx
 */
export const PRICE_ID = process.env.STRIPE_PRICE_ID || "price_PLACEHOLDER";

/**
 * アプリURL
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://meo-kachiagekun.vercel.app";
