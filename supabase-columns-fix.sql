-- meo_clinics に不足カラムを追加（院情報の保存失敗の原因）
-- Supabase SQL Editor で1回だけ実行してください

ALTER TABLE meo_clinics ADD COLUMN IF NOT EXISTS strengths TEXT DEFAULT '';
ALTER TABLE meo_clinics ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT '';
ALTER TABLE meo_clinics ADD COLUMN IF NOT EXISTS reviews TEXT DEFAULT '';
ALTER TABLE meo_clinics ADD COLUMN IF NOT EXISTS nearest_station TEXT DEFAULT '';
ALTER TABLE meo_clinics ADD COLUMN IF NOT EXISTS coverage_areas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE meo_clinics ADD COLUMN IF NOT EXISTS owner_voice JSONB DEFAULT '{}'::jsonb;
