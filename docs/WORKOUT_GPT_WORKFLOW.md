# Motion Log — 운동 기록 처리 규칙

Motion Log의 운동 입력은 웹사이트에서 이미지를 직접 업로드하는 방식으로 처리하지 않는다.

## 사용 흐름

1. Galaxy Watch에서 운동을 완료한다.
2. Samsung Health에서 운동 상세 화면을 캡처한다.
3. 필요하면 지도/그래프 화면과 랩 화면을 추가로 캡처한다.
4. 이 Motion Log 대화방에 캡처를 올린다.
5. 운동 기록을 추출하고, 확인 가능한 값만 데이터로 사용한다.
6. 기존 Motion Log 기록과 비교해 당일 운동을 분석한다.
7. 사용자가 `운동저장`이라고 확인하면 GitHub의 운동 데이터 브랜치에 추가한다.
8. Motion Log는 GitHub의 최신 데이터 브랜치를 읽어 누적 기록과 분석을 표시한다.

## 기본 입력 화면

- 운동 상세: 날짜, 운동 종류, 거리, 시간, 칼로리, 걸음, 페이스, 속도, 고도, 심박, 케이던스, VO₂ Max 등
- 지도/그래프: 경로, 페이스 변화, 심박 변화, 고도 등
- 랩: 구간별 기록이 화면에 표시된 경우에만 저장

지도 자체의 경로 좌표나 그래프 픽셀 정보는 캡처만으로 재현 가능한 원본 데이터가 아니므로 JSON에 임의 생성하지 않는다.

## GitHub 데이터셋

현재 운동 데이터의 기준 파일은 `public/motion-log-data-test.json`이다.

운동 기록은 `workout-data` 브랜치에서 누적한다. 앱 코드의 `main` 브랜치와 운동 데이터 업데이트를 분리해 운동을 기록할 때마다 Vercel 배포가 발생하지 않도록 한다.

### 저장 형식

기록은 **한 운동 = 한 객체**인 평면(flat) JSON 레코드로 저장한다. 현재 웹앱의 `Activity` 구조와 호환성을 유지하기 위해 데이터를 중첩 객체로 바꾸지 않는다.

```json
{
  "id": "sh-unique-id",
  "date": "2026-09-17",
  "type": "러닝",
  "distanceKm": 2.12,
  "durationSec": 900,
  "calories": 215,
  "steps": 2248,
  "avgPaceSecPerKm": 423,
  "bestPaceSecPerKm": 351,
  "avgSpeedKmh": 8.5,
  "bestSpeedKmh": 10.2,
  "elevationGainM": 28,
  "minAltitudeM": 45,
  "maxAltitudeM": 74,
  "uphillDistanceKm": 0.23,
  "downhillDistanceKm": 0.16,
  "avgHeartRate": 148,
  "maxHeartRate": 163,
  "avgCadence": 149,
  "maxCadence": 167,
  "vo2max": 37.6,
  "note": "",
  "source": "Samsung Health"
}
```

### 필수 필드

- `id`: 각 운동의 고유 ID
- `date`: `YYYY-MM-DD`
- `type`: `러닝`, `걷기`, `자전거`, `등산`, `수영`, `기타`
- `distanceKm`: km 단위 거리
- `durationSec`: 초 단위 운동 시간

### 선택 필드

Samsung Health 캡처에서 실제 수치가 확인된 경우에만 추가한다.

- `calories`
- `steps`
- `avgPaceSecPerKm`, `bestPaceSecPerKm`
- `avgSpeedKmh`, `bestSpeedKmh`
- `elevationGainM`, `elevationLossM`
- `minAltitudeM`, `maxAltitudeM`
- `uphillDistanceKm`, `downhillDistanceKm`
- `avgHeartRate`, `maxHeartRate`
- `avgCadence`, `maxCadence`
- `vo2max`
- `note`
- `source`

랩, 심박 구간, 러닝 다이나믹스 등 추가 세부 데이터는 화면에 실제 세부 수치가 확인되고 앱에서 사용할 필요가 있을 때 별도 필드로 추가한다. 원본이 없는 상태에서 추정하거나 그래프를 수치 배열로 재구성하지 않는다.

### 저장 규칙

- 기존 `id`는 변경하지 않는다.
- 새 기록은 기존 배열 끝에 추가한다.
- 동일 운동을 중복 추가하지 않는다.
- 숫자는 숫자 타입으로 저장한다. 단위 문자열을 함께 저장하지 않는다.
- 페이스는 초/km로 저장한다. 예: `7'03"/km` → `423`.
- 시간은 초로 저장한다. 예: `15:00` → `900`.
- 표시되지 않은 값은 생략한다. `0`이나 임의의 기본값으로 채우지 않는다.
- `source`는 기본적으로 `Samsung Health`로 기록한다.
- 지도/그래프의 시각 정보만으로 좌표·구간 수치 등을 임의 생성하지 않는다.
- 사용자가 `운동저장`으로 확인한 뒤에만 GitHub 데이터 브랜치를 수정한다.

## 중복 검사

새 기록은 다음 정보를 조합해 기존 운동과 비교한다.

- 날짜
- 운동 종류
- 거리
- 운동 시간
- 평균 페이스/속도 등 주요 수치

동일 캡처를 다시 올린 경우 기존 레코드를 재사용하고 새 레코드를 만들지 않는다.

## 분석 원칙

운동 분석은 숫자 나열보다 기존 기록과의 변화에 초점을 둔다.

가능한 범위에서 다음을 비교한다.

- 거리와 운동 시간
- 평균/최고 페이스 및 속도
- 평균/최대 심박
- 평균/최대 케이던스
- 고도 상승/하강
- VO₂ Max
- 같은 기간의 이전 운동과의 변화

의미 있는 비교가 어려운 항목은 억지로 결론을 만들지 않는다.

## GPT 응답 권장 형식

사진을 받은 뒤 다음 순서로 정리한다.

### 1. 추출 데이터

확인된 값만 항목별로 정리한다. 보이지 않는 값은 저장 데이터에서는 생략한다.

### 2. 운동 분석

이번 운동의 핵심 특징과 이전 기록 대비 변화를 설명한다. 단순한 최고/최저 기록보다 페이스·심박·케이던스·고도와 거리의 관계를 우선 본다.

### 3. 저장 전 확인

- 날짜
- 운동 종류
- 거리
- 운동 시간
- 동일 기록 여부
- 새 `id`
- 저장될 선택 필드

을 확인한다.

### 4. 저장

사용자가 `운동저장`이라고 확인하면 `workout-data` 브랜치의 `public/motion-log-data-test.json`에 새 기록을 추가한다. 기존 기록은 그대로 유지한다.

## 웹사이트 역할

Motion Log 웹앱은 운동 캡처를 분석하는 입력창이 아니라, GitHub의 운동 데이터 브랜치를 읽어 조회·분석·백업하는 개인 운동 아카이브로 사용한다.