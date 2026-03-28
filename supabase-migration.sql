-- MEO勝ち上げくん: Supabaseテーブル作成
-- 既存プロジェクト（検査シートSaaS等）と同じSupabaseプロジェクトを共有
-- テーブルプレフィックス: meo_

-- 1. ユーザー設定（APIキー・アクティブ院ID）
CREATE TABLE IF NOT EXISTS meo_user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anthropic_key TEXT DEFAULT '',
  active_clinic_id TEXT DEFAULT '',
  serp_api_key TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. 院プロフィール
CREATE TABLE IF NOT EXISTS meo_clinics (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  area TEXT DEFAULT '',
  keywords JSONB DEFAULT '[]'::jsonb,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '整体院',
  categories JSONB DEFAULT '[]'::jsonb,
  owner_name TEXT DEFAULT '',
  specialty TEXT DEFAULT '',
  note_profile JSONB DEFAULT '{}'::jsonb,
  urls JSONB DEFAULT '{}'::jsonb,
  wordpress JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 3. 生成コンテンツ
CREATE TABLE IF NOT EXISTS meo_contents (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  keyword TEXT DEFAULT '',
  clinic_id TEXT DEFAULT '',
  wp_post_id INTEGER,
  wp_post_url TEXT,
  note_post_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 4. フィードバック
CREATE TABLE IF NOT EXISTS meo_feedbacks (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT DEFAULT '',
  type TEXT NOT NULL,
  original_content TEXT DEFAULT '',
  edited_content TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 5. 順位履歴
CREATE TABLE IF NOT EXISTS meo_ranking_history (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  rank INTEGER,
  business_name TEXT DEFAULT '',
  top_three JSONB DEFAULT '[]'::jsonb,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 6. Google Search Console設定
CREATE TABLE IF NOT EXISTS meo_search_console_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT DEFAULT '',
  client_secret TEXT DEFAULT '',
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TEXT,
  site_url TEXT,
  site_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 7. GBP画像メタデータ（本体はStorage）
CREATE TABLE IF NOT EXISTS meo_gbp_images (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  storage_path TEXT DEFAULT '',
  name TEXT DEFAULT '',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 8. チェックリスト
CREATE TABLE IF NOT EXISTS meo_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, clinic_id)
);

-- 9. サブスクリプション（Stripe連携）
CREATE TABLE IF NOT EXISTS meo_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(stripe_customer_id)
);

-- ── RLS（行レベルセキュリティ）────────────────────

ALTER TABLE meo_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_ranking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_search_console_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_gbp_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_subscriptions ENABLE ROW LEVEL SECURITY;

-- meo_subscriptions: ユーザーは自分のレコードのみ参照可能
DROP POLICY IF EXISTS "meo_subscriptions_service_all" ON meo_subscriptions;
CREATE POLICY "meo_subscriptions_user_select" ON meo_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- meo_subscriptions: サービスロール（Webhook用）は全行操作可能
CREATE POLICY "meo_subscriptions_service_all" ON meo_subscriptions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- meo_user_settings: サービスロール（init-user API等）は全行操作可能
DROP POLICY IF EXISTS "meo_user_settings_service_all" ON meo_user_settings;
CREATE POLICY "meo_user_settings_service_all" ON meo_user_settings
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 各テーブルに SELECT/INSERT/UPDATE/DELETE ポリシー
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'meo_user_settings',
    'meo_clinics',
    'meo_contents',
    'meo_feedbacks',
    'meo_ranking_history',
    'meo_search_console_settings',
    'meo_gbp_images',
    'meo_checklists'
  ]) LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (auth.uid() = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE USING (auth.uid() = user_id)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE USING (auth.uid() = user_id)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ── インデックス ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_meo_clinics_user ON meo_clinics(user_id);
CREATE INDEX IF NOT EXISTS idx_meo_contents_user ON meo_contents(user_id);
CREATE INDEX IF NOT EXISTS idx_meo_contents_clinic ON meo_contents(user_id, clinic_id);
CREATE INDEX IF NOT EXISTS idx_meo_ranking_user ON meo_ranking_history(user_id);
CREATE INDEX IF NOT EXISTS idx_meo_ranking_keyword ON meo_ranking_history(user_id, keyword);
CREATE INDEX IF NOT EXISTS idx_meo_gbp_images_user ON meo_gbp_images(user_id);
CREATE INDEX IF NOT EXISTS idx_meo_checklists_user ON meo_checklists(user_id, clinic_id);
CREATE INDEX IF NOT EXISTS idx_meo_subscriptions_user ON meo_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_meo_subscriptions_stripe ON meo_subscriptions(stripe_customer_id);

-- ── Storage バケット ───────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('meo-gbp-images', 'meo-gbp-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "meo_gbp_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'meo-gbp-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "meo_gbp_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'meo-gbp-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "meo_gbp_images_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'meo-gbp-images' AND (storage.foldername(name))[1] = auth.uid()::text);
