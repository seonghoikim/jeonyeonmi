# 해야 할 일

사이트 관리자(호이)가 직접 해야 하거나, 나중으로 미뤄 둔 일입니다. 끝낸 항목은 체크하고, 새로 생기면 여기에 추가하세요.

## 호이가 할 일 (편집 모드에서)
- [ ] **작가노트에 "작업을 시작한 계기" 슬라이드 추가** — 작가가 직접 쓴 글("남편의 한마디…")은 `supabase/functions/server/curator-notes.ts`에 들어 있습니다. 작가노트에 넣은 뒤, 같은 글이 도슨트 자료에 두 번 들어가지 않도록 그 항목을 `curator-notes.ts`에서 지우세요.
- [ ] **〈결연〉(2026) 작품 설명 작성** — 작품 팝업의 "작품 설명" 칸. 가장 최근 작품인데 설명이 비어 있습니다.
- [ ] (선택) 작품 하나에 걸리는 기간·한지 종류·태우는 방식 같은 작업 과정 사실을 "작업방식" 슬라이드에 2~3줄.

## 다음 데이터 정리 때 (Claude에게 요청)
- [ ] **작가 소개(약력) 넣기** — 2026-10-11에 제안한 3~4문장 초안(국문·영문)을 보류해 둠. 다듬어서 About/작가노트에 반영.
  > 전연미는 한지를 태우고 찢고 물들인 뒤 나무 패널 위에 겹겹이 쌓아, 시간과 감정이 남긴 '결'을 화면에 새기는 작가다. 2025년부터 수도권을 중심으로 활동하며 안산에서 작업하고 있다. 2026년 안목갤러리에서 첫 개인전 〈거친 결로 다져온 시간 뒤, 가볍게 만개한 순간〉을 열었고, 같은 해 중앙회화대전 특선, 아시아프100에 선정되었다.
  >
  > Jeon Yeonmi burns, tears and dyes hanji, layering it on wood panels to inscribe the "grain" left by time and emotion. Active since 2025 in the Seoul metropolitan area, she works in Ansan. In 2026 she held her first solo exhibition at Anmok Gallery, received a Special Selection at the JoongAng Fine Arts Competition, and was selected for ASYAAF100.
- [ ] **활동 사진 캡션의 전시명 통일** — 전시 이력과 같은 공식 표기로 (예: 다층시선 → 와이케이갤러리, 리수갤러리 → Leesoo Gallery).

## 예정된 점검
- 매주 월요일: 도슨트 주간 리포트 (질문 빈도와 "충분히 답하지 못한 질문"을 같이 보고, 이번에 넣은 자료로 줄었는지 확인)
- 2026-10-26(월): Supabase Pro 유지/다운그레이드 판단 (예약됨, Billing 화면 캡처 필요)
- 2026-10-28경: 구글 서치 콘솔의 "발견됨 - 현재 색인이 생성되지 않음" 107건이 줄었는지 확인
- 2027-09-16: GitHub 배포 토큰 교체 (토큰 만료 2027-09-30)

## 미뤄 둔 것
- 보안 후속: 편집 로그인 시도 횟수 제한을 DB로, 세션 토큰 강화·폐기, CORS 제한, 오류 메시지 노출 줄이기, 도슨트 프롬프트 주입 방어, 저장 동시성
- 이미지 정리: 5~10MB 원본은 정리 완료. 새 이미지가 쌓여 무거워지면 Actions의 "Optimize images"(dry → apply)
