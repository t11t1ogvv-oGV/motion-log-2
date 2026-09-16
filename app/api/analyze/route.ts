import { NextResponse } from 'next/server';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    date: { type: ['string', 'null'] },
    type: { type: ['string', 'null'] },
    distanceKm: { type: ['number', 'null'] },
    durationSec: { type: ['number', 'null'] },
    calories: { type: ['number', 'null'] },
    steps: { type: ['number', 'null'] },
    avgPaceSecPerKm: { type: ['number', 'null'] },
    bestPaceSecPerKm: { type: ['number', 'null'] },
    avgSpeedKmh: { type: ['number', 'null'] },
    bestSpeedKmh: { type: ['number', 'null'] },
    elevationGainM: { type: ['number', 'null'] },
    elevationMinM: { type: ['number', 'null'] },
    elevationMaxM: { type: ['number', 'null'] },
    totalAscentKm: { type: ['number', 'null'] },
    totalDescentKm: { type: ['number', 'null'] },
    avgHeartRate: { type: ['number', 'null'] },
    maxHeartRate: { type: ['number', 'null'] },
    avgCadence: { type: ['number', 'null'] },
    maxCadence: { type: ['number', 'null'] },
    vo2max: { type: ['number', 'null'] },
    thresholdAerobicBpm: { type: ['number', 'null'] },
    thresholdAnaerobicBpm: { type: ['number', 'null'] },
    recoveryBpm: { type: ['number', 'null'] },
    laps: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          lap: { type: 'number' },
          distanceKm: { type: 'number' },
          durationSec: { type: 'number' },
          paceSecPerKm: { type: 'number' }
        },
        required: ['lap', 'distanceKm', 'durationSec', 'paceSecPerKm']
      }
    },
    hrZones: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          zone: { type: 'string' },
          range: { type: 'string' },
          seconds: { type: 'number' },
          percent: { type: 'number' }
        },
        required: ['zone', 'range', 'seconds', 'percent']
      }
    },
    dynamics: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        balance: { type: ['string', 'null'] },
        groundContactMs: { type: ['number', 'null'] },
        flightMs: { type: ['number', 'null'] },
        regularity: { type: ['string', 'null'] },
        verticalOscillationCm: { type: ['number', 'null'] },
        stiffness: { type: ['number', 'null'] }
      },
      required: ['balance', 'groundContactMs', 'flightMs', 'regularity', 'verticalOscillationCm', 'stiffness']
    },
    note: { type: ['string', 'null'] }
  },
  required: [
    'date','type','distanceKm','durationSec','calories','steps','avgPaceSecPerKm','bestPaceSecPerKm',
    'avgSpeedKmh','bestSpeedKmh','elevationGainM','elevationMinM','elevationMaxM','totalAscentKm',
    'totalDescentKm','avgHeartRate','maxHeartRate','avgCadence','maxCadence','vo2max',
    'thresholdAerobicBpm','thresholdAnaerobicBpm','recoveryBpm','laps','hrZones','dynamics','note'
  ]
};

function normalizeData(value: unknown) {
  const v = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  const numberOrUndefined = (x: unknown) => typeof x === 'number' && Number.isFinite(x) ? x : undefined;
  const stringOrUndefined = (x: unknown) => typeof x === 'string' && x.trim() ? x.trim() : undefined;
  return {
    date: stringOrUndefined(v.date), type: stringOrUndefined(v.type),
    distanceKm: numberOrUndefined(v.distanceKm), durationSec: numberOrUndefined(v.durationSec),
    calories: numberOrUndefined(v.calories), steps: numberOrUndefined(v.steps),
    avgPaceSecPerKm: numberOrUndefined(v.avgPaceSecPerKm), bestPaceSecPerKm: numberOrUndefined(v.bestPaceSecPerKm),
    avgSpeedKmh: numberOrUndefined(v.avgSpeedKmh), bestSpeedKmh: numberOrUndefined(v.bestSpeedKmh),
    elevationGainM: numberOrUndefined(v.elevationGainM), elevationMinM: numberOrUndefined(v.elevationMinM), elevationMaxM: numberOrUndefined(v.elevationMaxM),
    totalAscentKm: numberOrUndefined(v.totalAscentKm), totalDescentKm: numberOrUndefined(v.totalDescentKm),
    avgHeartRate: numberOrUndefined(v.avgHeartRate), maxHeartRate: numberOrUndefined(v.maxHeartRate),
    avgCadence: numberOrUndefined(v.avgCadence), maxCadence: numberOrUndefined(v.maxCadence),
    vo2max: numberOrUndefined(v.vo2max), thresholdAerobicBpm: numberOrUndefined(v.thresholdAerobicBpm),
    thresholdAnaerobicBpm: numberOrUndefined(v.thresholdAnaerobicBpm), recoveryBpm: numberOrUndefined(v.recoveryBpm),
    laps: Array.isArray(v.laps) ? v.laps : undefined,
    hrZones: Array.isArray(v.hrZones) ? v.hrZones : undefined,
    dynamics: v.dynamics && typeof v.dynamics === 'object' ? v.dynamics : undefined,
    note: stringOrUndefined(v.note)
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const images = Array.isArray(body?.images) ? body.images.slice(0, 3) : [];
    if (!images.length) return NextResponse.json({ error: '분석할 캡처가 없습니다.' }, { status: 400 });
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Vercel 환경변수 OPENAI_API_KEY가 설정되어 있지 않습니다.' }, { status: 500 });
    }

    const content: any[] = [{
      type: 'input_text',
      text: `You extract workout data from Samsung Health screenshots. Identify the workout type and merge duplicate values across screenshots. Use only values that are visibly present; never guess missing values. Convert durations to seconds and paces such as 06\'34\"/km to seconds per km. Convert decimal comma/dot values carefully. For laps, preserve only explicitly shown rows. For HR zones, preserve the shown zone ranges, duration and percentage. Return null for missing values. Answer only JSON matching the requested schema.`
    }];
    for (const image of images) {
      if (typeof image !== 'string' || !image.startsWith('data:image/')) continue;
      content.push({ type: 'input_image', image_url: image });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: [{ role: 'user', content }],
        text: { format: { type: 'json_schema', name: 'motion_log_workout', strict: true, schema } },
        max_output_tokens: 1800
      })
    });
    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error?.message || 'OpenAI 분석 요청이 실패했습니다.';
      return NextResponse.json({ error: detail }, { status: response.status });
    }

    const text = data?.output?.flatMap((item: any) => item?.content || [])
      ?.find((part: any) => part?.type === 'output_text')?.text;
    if (!text) return NextResponse.json({ error: 'AI가 분석 결과를 반환하지 않았습니다.' }, { status: 502 });
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return NextResponse.json({ error: 'AI 결과를 JSON으로 읽지 못했습니다.' }, { status: 502 }); }

    return NextResponse.json({ activity: normalizeData(parsed) });
  } catch (error) {
    const message = error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
