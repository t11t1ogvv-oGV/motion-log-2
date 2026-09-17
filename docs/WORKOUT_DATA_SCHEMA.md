# Motion Log 운동 데이터 스키마

## 목적

`workout-data` 브랜치의 `public/motion-log-data-test.json`에 저장되는 운동 기록의 표준 형식을 정의한다.

## 기본 구조

전체 파일은 운동 객체들의 JSON 배열이다.

```json
[
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
]
```

실제 저장 시 선택 필드는 값이 확인된 경우에만 포함한다. 위 예시는 가능한 필드를 보여주기 위한 예시다.

## 필수 필드

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `id` | string | 고유 운동 ID |
| `date` | string | 운동 날짜 `YYYY-MM-DD` |
| `type` | string | `러닝`, `걷기`, `자전거`, `등산`, `수영`, `기타` |
| `distanceKm` | number | 거리 km |
| `durationSec` | number | 운동 시간 초 |

## 선택 필드

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `calories` | number | kcal |
| `steps` | number | 걸음 수 |
| `avgPaceSecPerKm` | number | 평균 페이스, 초/km |
| `bestPaceSecPerKm` | number | 최고 페이스, 초/km |
| `avgSpeedKmh` | number | 평균 속도 km/h |
| `bestSpeedKmh` | number | 최고 속도 km/h |
| `elevationGainM` | number | 상승 고도 m |
| `elevationLossM` | number | 하강 고도 m |
| `minAltitudeM` | number | 최저 고도 m |
| `maxAltitudeM` | number | 최고 고도 m |
| `uphillDistanceKm` | number | 총 오르막 거리 km |
| `downhillDistanceKm` | number | 총 내리막 거리 km |
| `avgHeartRate` | number | 평균 심박 bpm |
| `maxHeartRate` | number | 최대 심박 bpm |
| `avgCadence` | number | 평균 케이던스 spm |
| `maxCadence` | number | 최대 케이던스 spm |
| `vo2max` | number | VO₂ Max |
| `note` | string | 사용자 메모 |
| `source` | string | 데이터 출처. 기본 `Samsung Health` |

## 단위 저장 규칙

표시용 문자열을 저장하지 않고 숫자와 단위를 분리한다.

- `15:00` → `durationSec: 900`
- `7'03"/km` → `avgPaceSecPerKm: 423`
- `8.5 km/h` → `avgSpeedKmh: 8.5`
- `148 bpm` → `avgHeartRate: 148`

## 데이터 생성 규칙

- Samsung Health 캡처에서 실제 확인 가능한 값만 저장한다.
- 캡처에 표시되지 않은 값은 생략한다.
- 그래프의 모양만 보고 세부 시계열 값을 추정하지 않는다.
- 지도 이미지만 보고 GPS 좌표를 만들어내지 않는다.
- 기존 레코드의 `id`와 수치를 수정하지 않는다. 수정이 필요한 경우 별도 명시적 데이터 보정 작업으로 처리한다.
- 새 운동은 새 고유 `id`로 기존 배열에 추가한다.
- 동일 운동을 다시 업로드한 경우 중복 레코드를 만들지 않는다.

## 계산값과 원본값 구분

다음 항목은 운동 객체에 저장하지 않고 Motion Log에서 전체 기록을 바탕으로 계산한다.

- 총 누적 거리
- 주간/월간 거리
- 총 운동 횟수
- 평균 페이스 등 기간별 집계값
- 개인 최고 기록 요약
- 추세 그래프용 집계값

이렇게 하면 새로운 운동을 하나 추가해도 별도의 집계 데이터를 다시 수정할 필요가 없다.

## 향후 확장

랩, 심박 구간, 러닝 다이나믹스 등의 세부 데이터는 실제 원본 수치가 반복적으로 확보되고 Motion Log UI에서 활용할 필요가 생겼을 때 별도 스키마로 추가한다. 기존 레코드 구조를 깨지 않는 optional field 방식으로 확장한다.