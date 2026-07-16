-- Press 섹션 추가 시 신설된 컬럼 — 실서비스 테이블에 반영 안 돼 있으면
-- 저장 시마다 "Could not find the 'press' column" 에러로 모든 저장이 실패한다.
ALTER TABLE portfolio_state ADD COLUMN IF NOT EXISTS press jsonb DEFAULT '[]'::jsonb;

-- portfolio_state: 공개 읽기만 허용, INSERT/UPDATE/DELETE 정책 없음 → anon 전부 차단
ALTER TABLE portfolio_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read"  ON portfolio_state;
DROP POLICY IF EXISTS "public_write" ON portfolio_state;
CREATE POLICY "public_read" ON portfolio_state FOR SELECT USING (true);

-- Realtime 브로드캐스트 활성화
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'portfolio_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE portfolio_state;
  END IF;
END $$;

-- storage.objects (portfolio 버킷): 공개 읽기만 허용, INSERT/UPDATE/DELETE 정책 없음 → anon 전부 차단
DROP POLICY IF EXISTS "portfolio_select" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_insert" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_update" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_delete" ON storage.objects;
CREATE POLICY "portfolio_select" ON storage.objects FOR SELECT USING (bucket_id = 'portfolio');
