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
