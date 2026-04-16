-- ── Google口コミ自動取得・要約テーブル ─────────
-- 実行: Supabase SQL Editor で1回だけ実行

-- 1. 取得した口コミ本文（生データ）
CREATE TABLE IF NOT EXISTS meo_clinic_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id TEXT NOT NULL,
  author_name TEXT,
  rating INTEGER,
  review_text TEXT NOT NULL,
  review_date TEXT,
  source TEXT DEFAULT 'google',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AI要約・タグ付けデータ
CREATE TABLE IF NOT EXISTS meo_review_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id TEXT NOT NULL,
  summary_overall TEXT,
  symptom_tags JSONB,
  representative_reviews JSONB,
  total_count INTEGER DEFAULT 0,
  avg_rating NUMERIC(3, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, clinic_id)
);

-- RLS有効化
ALTER TABLE meo_clinic_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE meo_review_summaries ENABLE ROW LEVEL SECURITY;

-- ポリシー
CREATE POLICY "meo_clinic_reviews_select" ON meo_clinic_reviews
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meo_clinic_reviews_insert" ON meo_clinic_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meo_clinic_reviews_update" ON meo_clinic_reviews
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "meo_clinic_reviews_delete" ON meo_clinic_reviews
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "meo_review_summaries_select" ON meo_review_summaries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meo_review_summaries_insert" ON meo_review_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meo_review_summaries_update" ON meo_review_summaries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "meo_review_summaries_delete" ON meo_review_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_meo_reviews_user_clinic ON meo_clinic_reviews(user_id, clinic_id);
CREATE INDEX IF NOT EXISTS idx_meo_summaries_user_clinic ON meo_review_summaries(user_id, clinic_id);

-- 取得履歴（月の取得回数制限用）
CREATE TABLE IF NOT EXISTS meo_review_fetch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id TEXT NOT NULL,
  fetch_count INTEGER NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE meo_review_fetch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meo_review_fetch_log_select" ON meo_review_fetch_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meo_review_fetch_log_insert" ON meo_review_fetch_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_meo_fetch_log_user ON meo_review_fetch_log(user_id, fetched_at);
