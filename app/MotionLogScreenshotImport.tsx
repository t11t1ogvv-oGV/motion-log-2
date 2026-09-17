'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type ActivityType = '러닝' | '걷기' | '자전거' | '등산' | '수영' | '기타';

type Draft = {
  date: string;
  type: ActivityType;
  distanceKm: string;
  duration: string;
  avgPace: string;
  bestPace: string;
  avgSpeed: string;
  bestSpeed: string;
  calories: string;
  steps: string;
  avgHeartRate: string;
  maxHeartRate: string;
  avgCadence: string;
  maxCadence: string;
  vo2max: string;
  elevationGain: string;
  elevationLoss: string;
  note: string;
};

type Activity = Draft & { id: string; source: string };

const STORAGE = 'motion-log-records-v4';
const MAX_FILES = 3;

const blankDraft = (): Draft => ({
  date: '', type: '러닝', distanceKm: '', duration: '', avgPace: '', bestPace: '', avgSpeed: '', bestSpeed: '',
  calories: '', steps: '', avgHeartRate: '', maxHeartRate: '', avgCadence: '', maxCadence: '', vo2max: '',
  elevationGain: '', elevationLoss: '', note: '',
});

const cleanText = (value: string) => value
  .replace(/[\u200b\u200c\u200d]/g, '')
  .replace(/[′’]/g, "'")
  .replace(/[″”]/g, '"')
  .replace(/,/g, ', ')
  .replace(/\s+/g, ' ')
  .trim();

const firstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
};

const numberValue = (value: string) => {
  const parsed = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const paceValue = (value: string) => {
  const match = value.match(/(\d{1,2})\s*(?:'|:|분)?\s*(\d{2})/);
  if (!match) return undefined;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) return undefined;
  return minutes * 60 + seconds;
};

const durationValue = (value: string) => {
  const colon = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (colon) {
    const first = Number(colon[1]);
    const second = Number(colon[2]);
    const third = colon[3] ? Number(colon[3]) : 0;
    return colon[3] ? first * 3600 + second * 60 + third : first * 60 + second;
  }
  const hour = value.match(/(?:(\d+)\s*시간\s*)?(\d+)\s*분(?:\s*(\d+)\s*초)?/);
  if (hour) return Number(hour[1] || 0) * 3600 + Number(hour[2] || 0) * 60 + Number(hour[3] || 0);
  return undefined;
};

const normalizeDate = (value: string) => {
  const match = value.match(/(20\d{2})[^0-9]?(\d{1,2})[^0-9]?(\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`;
};

const parseDraft = (rawTexts: string[]): Draft => {
  const text = rawTexts.map(cleanText).join(' ');
  const result = blankDraft();
  const date = firstMatch(text, [
    /((?:20\d{2})\s*[./년-]\s*\d{1,2}\s*[./월-]\s*\d{1,2}(?:\s*일)?)/i,
    /((?:20\d{2})[./-]\d{1,2}[./-]\d{1,2})/i,
  ]);
  result.date = normalizeDate(date);

  if (/등산|하이킹|hiking/i.test(text)) result.type = '등산';
  else if (/러닝|달리기|running|run/i.test(text)) result.type = '러닝';

  result.distanceKm = firstMatch(text, [
    /(?:거리|distance)\s*[^0-9]{0,18}(\d+(?:\.\d+)?)\s*km/i,
    /(\d+(?:\.\d+)?)\s*km\s*(?:거리)?/i,
  ]);
  result.duration = firstMatch(text, [
    /(?:운동\s*시간|운동시간|duration|time)\s*[^0-9]{0,22}((?:\d{1,2}:){1,2}\d{2}(?::\d{2})?)/i,
    /(?:운동\s*시간|운동시간|duration|time)\s*[^0-9]{0,22}(\d+\s*시간\s*\d+\s*분(?:\s*\d+\s*초)?)/i,
  ]);
  result.avgPace = firstMatch(text, [
    /(?:평균\s*페이스|average\s*pace)\s*[^0-9]{0,20}(\d{1,2}\s*(?:'|:|분)?\s*\d{2}(?:\s*"|초)?\s*\/?\s*km?)/i,
  ]);
  result.bestPace = firstMatch(text, [
    /(?:최고\s*페이스|best\s*pace)\s*[^0-9]{0,20}(\d{1,2}\s*(?:'|:|분)?\s*\d{2}(?:\s*"|초)?\s*\/?\s*km?)/i,
  ]);
  result.avgSpeed = firstMatch(text, [
    /(?:평균\s*속도|average\s*speed)\s*[^0-9]{0,20}(\d+(?:\.\d+)?)\s*km\/?h/i,
  ]);
  result.bestSpeed = firstMatch(text, [
    /(?:최고\s*속도|best\s*speed)\s*[^0-9]{0,20}(\d+(?:\.\d+)?)\s*km\/?h/i,
  ]);
  result.calories = firstMatch(text, [
    /(?:칼로리|소모\s*칼로리|calories?)\s*[^0-9]{0,20}([\d,]+(?:\.\d+)?)\s*k?cal/i,
  ]);
  result.steps = firstMatch(text, [
    /(?:걸음\s*수|걸음수|steps?)\s*[^0-9]{0,20}([\d,]+)/i,
  ]);
  result.avgHeartRate = firstMatch(text, [
    /(?:평균\s*심박(?:수)?|average\s*heart\s*rate)\s*[^0-9]{0,20}(\d{2,3})\s*bpm/i,
  ]);
  result.maxHeartRate = firstMatch(text, [
    /(?:최대\s*심박(?:수)?|max(?:imum)?\s*heart\s*rate)\s*[^0-9]{0,20}(\d{2,3})\s*bpm/i,
  ]);
  result.avgCadence = firstMatch(text, [
    /(?:평균\s*케이던스|average\s*cadence)\s*[^0-9]{0,20}(\d{2,3})\s*spm/i,
  ]);
  result.maxCadence = firstMatch(text, [
    /(?:최대\s*케이던스|max(?:imum)?\s*cadence)\s*[^0-9]{0,20}(\d{2,3})\s*spm/i,
  ]);
  result.vo2max = firstMatch(text, [
    /(?:vo[₂2]?\s*max|vo2\s*max)\s*[^0-9]{0,20}(\d+(?:\.\d+)?)/i,
  ]);
  result.elevationGain = firstMatch(text, [
    /(?:상승\s*고도|고도\s*상승|elevation\s*gain)\s*[^0-9]{0,20}(\d+(?:\.\d+)?)\s*m/i,
  ]);
  result.elevationLoss = firstMatch(text, [
    /(?:하강\s*고도|고도\s*하강|elevation\s*loss)\s*[^0-9]{0,20}(\d+(?:\.\d+)?)\s*m/i,
  ]);

  return result;
};

const draftToActivity = (draft: Draft): Activity | null => {
  const distanceKm = numberValue(draft.distanceKm);
  const durationSec = durationValue(draft.duration);
  if (!draft.date || !distanceKm || !durationSec) return null;

  const now = new Date();
  const suffix = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  const id = `ocr-${draft.date.replace(/-/g, '')}-${suffix}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    ...draft,
    id,
    source: 'Samsung Health OCR',
    distanceKm,
    duration: String(durationSec),
  };
};

const readStored = (): any[] => {
  try {
    const raw = localStorage.getItem(STORAGE);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const updateRecordFields = (draft: Draft): Record<string, any> => ({
  date: draft.date,
  type: draft.type,
  distanceKm: numberValue(draft.distanceKm) || 0,
  durationSec: durationValue(draft.duration) || 0,
  avgPaceSecPerKm: paceValue(draft.avgPace),
  bestPaceSecPerKm: paceValue(draft.bestPace),
  avgSpeedKmh: numberValue(draft.avgSpeed),
  bestSpeedKmh: numberValue(draft.bestSpeed),
  calories: numberValue(draft.calories),
  steps: numberValue(draft.steps),
  avgHeartRate: numberValue(draft.avgHeartRate),
  maxHeartRate: numberValue(draft.maxHeartRate),
  avgCadence: numberValue(draft.avgCadence),
  maxCadence: numberValue(draft.maxCadence),
  vo2max: numberValue(draft.vo2max),
  elevationGainM: numberValue(draft.elevationGain),
  elevationLossM: numberValue(draft.elevationLoss),
  note: draft.note || undefined,
  source: 'Samsung Health OCR',
});

const fields: { key: keyof Draft; label: string; placeholder?: string; type?: string }[] = [
  { key: 'date', label: '날짜', type: 'date' },
  { key: 'distanceKm', label: '거리 (km)', placeholder: '2.12' },
  { key: 'duration', label: '운동시간', placeholder: '15:00' },
  { key: 'avgPace', label: '평균 페이스', placeholder: "7'03\"/km" },
  { key: 'bestPace', label: '최고 페이스' },
  { key: 'avgSpeed', label: '평균 속도' },
  { key: 'bestSpeed', label: '최고 속도' },
  { key: 'calories', label: '칼로리' },
  { key: 'steps', label: '걸음 수' },
  { key: 'avgHeartRate', label: '평균 심박' },
  { key: 'maxHeartRate', label: '최대 심박' },
  { key: 'avgCadence', label: '평균 케이던스' },
  { key: 'maxCadence', label: '최대 케이던스' },
  { key: 'vo2max', label: 'VO₂ Max' },
  { key: 'elevationGain', label: '상승 고도' },
  { key: 'elevationLoss', label: '하강 고도' },
];

export default function MotionLogScreenshotImport() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [ocrStatus, setOcrStatus] = useState('캡처 최대 3장 · 브라우저에서 OCR');
  const [busy, setBusy] = useState(false);
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<any | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const element = document.querySelector('.topbar');
      setTarget(element instanceof HTMLElement ? element : null);
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  const summary = useMemo(() => {
    const values = [
      draft.distanceKm && `${draft.distanceKm} km`,
      draft.duration && draft.duration,
      draft.avgPace && draft.avgPace,
      draft.avgHeartRate && `${draft.avgHeartRate} bpm`,
      draft.avgCadence && `${draft.avgCadence} spm`,
    ].filter(Boolean);
    return values.join(' · ');
  }, [draft]);

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).slice(0, MAX_FILES);
    setFiles(selected);
    setDraft(blankDraft());
    setRawText('');
    setError('');
    setDuplicate(null);
    setSaved(false);
    setOcrStatus(selected.length ? `${selected.length}장 선택됨 · 인식 버튼을 눌러주세요.` : '캡처 최대 3장 · 브라우저에서 OCR');
  };

  const runOcr = async () => {
    if (!files.length) {
      setError('삼성헬스 캡처를 먼저 선택해주세요.');
      return;
    }
    setBusy(true);
    setError('');
    setDuplicate(null);
    setSaved(false);
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker(['kor', 'eng'], 1, {
        logger: message => {
          if (message.status === 'recognizing text') {
            setOcrStatus(`OCR 진행 ${Math.round((message.progress || 0) * 100)}%`);
          }
        },
      });
      const texts: string[] = [];
      for (let i = 0; i < files.length; i += 1) {
        setOcrStatus(`캡처 ${i + 1}/${files.length} 인식 중…`);
        const result = await worker.recognize(files[i]);
        texts.push(result.data.text || '');
      }
      await worker.terminate();
      const parsed = parseDraft(texts);
      setDraft(parsed);
      setRawText(texts.join('\n\n--- 캡처 구분 ---\n\n'));
      const local = readStored();
      const existing = local.find(row => row.date === parsed.date && row.type === parsed.type && Math.abs(Number(row.distanceKm) - Number(parsed.distanceKm)) < 0.01 && Math.abs(Number(row.durationSec) - Number(durationValue(parsed.duration) || 0)) <= 2);
      setDuplicate(existing || null);
      const required = parsed.date && parsed.distanceKm && parsed.duration;
      setOcrStatus(required ? '자동 추출 완료 · 아래 값을 확인하세요.' : '일부 필수값을 읽지 못했습니다 · 아래에서 직접 입력하세요.');
    } catch (ocrError) {
      setError(`OCR 실패: ${ocrError instanceof Error ? ocrError.message : String(ocrError)}`);
      setOcrStatus('OCR을 완료하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    setError('');
    const record = draftToActivity(draft);
    if (!record) {
      setError('날짜, 거리, 운동시간은 반드시 확인해주세요.');
      return;
    }
    const local = readStored();
    const existing = local.find(row => row.date === draft.date && row.type === draft.type && Math.abs(Number(row.distanceKm) - record.distanceKm) < 0.01 && Math.abs(Number(row.durationSec) - Number(record.duration)) <= 2);
    if (existing && !duplicate) {
      setDuplicate(existing);
      setError('동일한 운동으로 보이는 기존 기록이 있습니다. 아래에서 중복 저장을 확인해주세요.');
      return;
    }
    const savedRecord = { id: record.id, ...updateRecordFields(draft) };
    localStorage.setItem(STORAGE, JSON.stringify([...local, savedRecord]));
    setSaved(true);
    setOcrStatus('저장 완료 · 현재 기기에 기록됨');
    setTimeout(() => window.location.reload(), 500);
  };

  const reset = () => {
    setFiles([]);
    setDraft(blankDraft());
    setOcrStatus('캡처 최대 3장 · 브라우저에서 OCR');
    setRawText('');
    setError('');
    setDuplicate(null);
    setSaved(false);
  };

  return (
    <>
      {target && createPortal(
        <button className="motion-import-trigger" onClick={() => setOpen(true)} aria-label="운동 캡처 추가">
          + 운동 캡처 추가
        </button>,
        target,
      )}

      {open && createPortal(
        <div className="motion-import-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="motion-import-modal" role="dialog" aria-modal="true" aria-labelledby="motion-import-title">
            <div className="motion-import-head">
              <div>
                <div className="eyebrow">V2.0 · SCREENSHOT IMPORT</div>
                <h2 id="motion-import-title">운동 캡처로 기록 추가</h2>
                <p>삼성헬스 캡처를 최대 3장 넣으면 브라우저에서 OCR로 숫자를 추출합니다. 저장 전 직접 수정할 수 있습니다.</p>
              </div>
              <button className="close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
            </div>

            <div className="motion-import-section">
              <label className="motion-file-drop">
                <input type="file" accept="image/*" multiple onChange={chooseFiles} />
                <strong>{files.length ? `${files.length}장 선택됨` : '삼성헬스 캡처 선택'}</strong>
                <span>운동 상세 + 그래프/지도 + 랩 캡처 순서로 넣어도 됩니다.</span>
              </label>
              {files.length > 0 && (
                <div className="motion-file-list">
                  {files.map((file, index) => <span key={`${file.name}-${file.lastModified}`}>{index + 1}. {file.name}</span>)}
                </div>
              )}
            </div>

            <div className="motion-import-actions">
              <button className="primary" onClick={runOcr} disabled={busy || !files.length}>{busy ? '인식 중…' : '자동 인식'}</button>
              <button className="secondary" onClick={reset} disabled={busy}>초기화</button>
              <span className="motion-import-status">{ocrStatus}</span>
            </div>

            {(summary || duplicate || error) && <div className="motion-import-summary">
              <div><span>추출 미리보기</span><b>{summary || '필수값을 입력해주세요.'}</b></div>
              {duplicate && <div className="motion-import-warning">기존 기록과 매우 유사합니다 · 저장을 다시 누르면 같은 운동이 한 건 더 추가됩니다.</div>}
              {error && <div className="motion-import-error">{error}</div>}
            </div>}

            <div className="motion-import-grid">
              <label><span>종목</span><select value={draft.type} onChange={event => setDraft(current => ({ ...current, type: event.target.value as ActivityType }))}><option>러닝</option><option>등산</option><option>걷기</option><option>자전거</option><option>수영</option><option>기타</option></select></label>
              {fields.map(field => <label key={field.key}><span>{field.label}</span><input type={field.type || 'text'} inputMode={field.type ? undefined : 'decimal'} placeholder={field.placeholder} value={draft[field.key]} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))} /></label>)}
            </div>

            <label className="motion-import-note"><span>메모</span><textarea value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} placeholder="오늘 운동 메모 (선택)" /></label>

            {rawText && <details className="motion-import-raw"><summary>OCR 원문 확인</summary><pre>{rawText}</pre></details>}

            <div className="motion-import-foot">
              <span>{saved ? '저장 완료' : '저장하면 현재 브라우저 기록에 추가됩니다.'}</span>
              <button className="primary motion-import-save" onClick={save} disabled={busy}>{saved ? '저장됨' : '기록 저장'}</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
