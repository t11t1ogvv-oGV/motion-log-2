# Motion Log

개인 운동 기록용 Next.js 웹앱 1차 버전입니다.

## 현재 기능
- 모바일 우선 반응형 대시보드
- 운동 기록 추가
- 러닝/걷기 등 운동 종류 선택
- 운동 캡처 이미지 첨부 및 미리보기
- 거리/시간/평균심박/케이던스/칼로리/체중/메모 기록
- 최근 기록 및 전체 기록 확인
- 체중·운동거리 추이 그래프
- 브라우저 LocalStorage 저장
- 다크/라이트 모드
- Vercel 배포용 설정

## 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 배포
GitHub에 업로드한 뒤 Vercel에서 해당 저장소를 Import하면 됩니다.

## 2차 버전 계획
사진 업로드 → 서버에서 이미지 분석 → 운동 값 자동 추출 → 확인 후 저장하는 AI 기능을 추가할 수 있습니다. 이때 `OPENAI_API_KEY`는 Vercel Environment Variables에만 저장해야 합니다.
