-- ============================================================
-- 포트폴리오 DB 스키마 — Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. 포트폴리오 상태 테이블 (단일 행 JSONB)
CREATE TABLE IF NOT EXISTS portfolio_state (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  content       JSONB DEFAULT '{}'::jsonb,
  current_exhibitions JSONB DEFAULT '[]'::jsonb,
  artworks      JSONB DEFAULT '[]'::jsonb,
  series_list   JSONB DEFAULT '[]'::jsonb,
  slides        JSONB DEFAULT '[]'::jsonb,
  exhibitions   JSONB DEFAULT '[]'::jsonb,
  activity_photos JSONB DEFAULT '[]'::jsonb,
  videos        JSONB DEFAULT '[]'::jsonb,
  contacts      JSONB DEFAULT '[]'::jsonb,
  settings      JSONB DEFAULT '{}'::jsonb,
  image_urls    JSONB DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 행 삽입 (없을 때만)
INSERT INTO portfolio_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS 설정 (포트폴리오는 공개 읽기, 편집은 앱 내 비밀번호로 제어)
ALTER TABLE portfolio_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read"  ON portfolio_state;
DROP POLICY IF EXISTS "public_write" ON portfolio_state;
CREATE POLICY "public_read"  ON portfolio_state FOR SELECT USING (true);
CREATE POLICY "public_write" ON portfolio_state FOR ALL    USING (true);

-- 2. Storage 버킷 생성 (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portfolio', 'portfolio', true, 10485760, '{image/webp,image/jpeg,image/png,image/gif}')
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage 정책
DROP POLICY IF EXISTS "portfolio_select" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_insert" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_update" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_delete" ON storage.objects;
CREATE POLICY "portfolio_select" ON storage.objects FOR SELECT USING (bucket_id = 'portfolio');
CREATE POLICY "portfolio_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'portfolio');
CREATE POLICY "portfolio_update" ON storage.objects FOR UPDATE USING (bucket_id = 'portfolio');
CREATE POLICY "portfolio_delete" ON storage.objects FOR DELETE USING (bucket_id = 'portfolio');
