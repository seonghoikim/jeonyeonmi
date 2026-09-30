# 전연미 작가 포트폴리오 (jeonyeonmi.com)

React 18 + TypeScript + Vite + Tailwind v4 프런트엔드, Supabase(Postgres · Storage · Edge Function) 백엔드, Vercel 호스팅.
콘텐츠는 전부 `portfolio_state` 테이블의 한 행(id=1)에 JSON으로 저장되고, 작가가 사이트 안의 **편집 모드**에서 직접 수정합니다.

## 구조

| 경로 | 역할 |
|---|---|
| `src/app/` | 프런트엔드. `App.tsx`가 상태·저장·인증을 담당하고 `components/sections/*`가 각 섹션 |
| `src/lib/supabase.ts` | 서버 호출 클라이언트 (읽기는 `fetch`, `supabase-js`는 편집 모드 실시간 동기화 때만 지연 로드) |
| `supabase/functions/server/` | 유일한 백엔드 (Hono on Deno): 로그인, 저장, 업로드, 번역, 링크 미리보기, AI 도슨트 |
| `supabase/functions/server/curator-prompt.ts` | 도슨트 페르소나·지식 조립 (순수 함수, 테스트 있음) |
| `supabase/functions/server/safety.ts` | 링크 검증, SSRF 차단, 클라이언트 IP 판별 |
| `api/seo.js`, `api/_seoLib.js` | Vercel 함수: `/works/:slug` 작품별 공유 미리보기 메타, 동적 `/sitemap.xml` |
| `scripts/` | 빌드 후처리: `/en` 정적 메타 생성, 히어로 og:image·JSON-LD 삽입 |
| `supabase/curator_security.sql`, `src/lib/migration.sql` | DB에 **수동으로** 한 번 실행하는 SQL |
| `tests/` | vitest 단위 테스트 |

## 개발

```
npm ci
npm run dev          # 로컬 개발 서버
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run build        # 프로덕션 빌드 (dist/)
```

## 배포 — 두 갈래이고, 서버 쪽은 자동이 아닙니다

1. **프런트엔드 + `api/` (Vercel)**: `main`에 머지되면 자동 배포됩니다.
2. **Edge Function (Supabase)**: 자동 배포되지 **않습니다.** `supabase/functions/` 아래를 바꿨다면 머지 후 직접:

   ```
   git pull
   supabase functions deploy make-server-9c6a1cce
   ```

   슬러그가 폴더 이름(`server`)과 다른 `make-server-9c6a1cce`인 이유: 이 함수는 Figma Make 시절에 그 이름으로 만들어졌고,
   프런트엔드(`FUNCTIONS_URL`)와 `index.tsx`의 `PREFIX`가 그 이름을 그대로 씁니다. `supabase/config.toml`이 폴더와 슬러그를 연결하니
   어느 쪽도 이름을 바꾸지 마세요.
3. **DB 스크립트**: SQL 파일은 Supabase 대시보드 → SQL Editor에서 한 번 실행합니다 (여러 번 실행해도 안전).

### Edge Function 시크릿 (`supabase secrets set NAME=값`)

| 이름 | 용도 |
|---|---|
| `EDIT_PASSWORD` | 편집 모드 비밀번호 |
| `SESSION_SECRET` | 편집 세션 토큰 서명, IP 해시 솔트 |
| `GEMINI_API_KEY` | 번역·도슨트 (결제 등급 프로젝트의 키) |
| `CURATOR_REPORT_KEY` | 주간 리포트가 `GET /curator/report`·`/curator/usage`를 읽는 전용 키 |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동 주입합니다. `utils/supabase/info.tsx`의 anon key는 공개 키라 저장소에 있어도 됩니다.

## 도슨트 운영 메모

- 질문·답변은 `curator_logs`에 쌓이고 90일 지나면 정리됩니다. 공개 키로는 읽을 수 없습니다.
- 요청 제한(방문자별 10분 12회·하루 40회, 전체 하루 500회)은 Postgres(`curator_usage`, `curator_hit()`)에 저장됩니다. 현재 사용량은 `GET /curator/usage` (리포트 키 필요).
- 모델 목록은 `index.tsx`의 `CURATOR_MODELS`. Google이 모델 이름을 종종 폐기하므로 404가 나면 가장 먼저 여기를 확인하세요.
- 답변 길이 상한(`CURATOR_MAX_OUTPUT_TOKENS`)은 모델의 "생각" 토큰까지 포함합니다. 너무 낮으면 답변이 중간에 잘리니(1024일 때 실제로 발생) 낮추지 마세요. 잘린 응답은 서버가 걸러서 재시도합니다.
- `POST /curator/lab` (리포트 키 필요): 실제 프롬프트로 모델·`generationConfig`를 바꿔 한 번 호출해 토큰·캐시·finishReason을 확인하는 실험용 경로.
