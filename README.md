# Motion Log

개인 운동 기록용 Next.js 웹앱입니다.

## 현재 기능
- 모바일 우선 반응형 운동 대시보드
- Samsung Health에서 정리된 운동 기록 조회
- 러닝/등산 중심 대시보드 스냅샷
- 최근 기록 및 전체 기록 검색·정렬·종목 필터
- 기간별 운동 분석, 종목 필터, 사용자 지정 날짜 범위
- 거리/페이스/심박/케이던스/속도/칼로리 등 운동 추세 그래프
- 현재 기간과 직전 동일 기간의 수치 비교
- 월별 거리와 운동 캘린더, 날짜 클릭 필터
- 기록 상세 보기
- 휴지통, 복원, 영구 삭제
- JSON/CSV 백업 및 JSON 병합 복원
- GitHub 데이터 수동 동기화
- 브라우저 LocalStorage 캐시
- 다크/라이트 모드
- Vercel 배포

## 데이터 입력 흐름

운동 사진은 웹사이트에서 직접 업로드하지 않는다.

Galaxy Watch → Samsung Health → 화면 캡처 → ChatGPT `프로젝트 → 운동` 대화 → 운동 데이터 추출 및 분석 → 사용자 확인 → GitHub 데이터셋 반영 → Motion Log에서 조회

세부 규칙은 `docs/WORKOUT_GPT_WORKFLOW.md`를 참고한다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 데이터 원칙

Samsung Health 화면에서 확인되지 않은 값을 임의로 생성하지 않는다. 기존 기록의 `id`는 유지하고 새 운동에는 고유한 `id`를 사용한다.

## 배포

개발은 `motion-log-next`에서 검증한 뒤 이상이 없을 때만 `main`으로 병합하고 Vercel Production에 배포한다.
