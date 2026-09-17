'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  OcrDraft,
  normalizeOcrText,
  parseOcrDraft,
  recognizeSamsungHealthImages,
} from './samsungHealthOcr';

type ActivityType = OcrDraft['type'];

type Draft = OcrDraft & { note: string };

type StoredActivity = {
  id?: string;
  date?: string;
  type?: string;
  distanceKm?: number;
  durationSec?: number;
  [key: string]: unknown;
};

const STORAGE = 'motion-log-records-v4';

const blankDraft = (): Draft => ({
  date: '',
  type: '러닝',
  distanceKm: '',
  duration: '',
  avgPace: '',
  bestPace: '',
  avgSpeed: '',
  bestSpeed: '',
  calories: '',
  steps: '',
  avgHeartRate: '',
  maxHeartRate: '',
  avgCadence: '',
  maxCadence: '',
  vo2max: '',
  elevationGain: '',
  elevationLoss: '',
  note: '',
});

const parseNumber = (value: string) => {
  const normalized = value.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/,/g, '').trim();
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
};

const parsePace = (value: string) => {
  const match = value.match(/(\d{1,2})\s*(?:'|:|분)?\s*(\d{2})/);
  if (!match) return undefined;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return seconds <= 59 ? minutes * 60 + seconds : undefined;
};

const parseDuration = (value: string) => {
  const colon = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (colon) {
    const first = Number(colon[1]);
    const second = Number(colon[2]);
    const third = colon[3] ? Number(colon[3]) : 0;
    return colon[3] ? first * 3600 + second * 60 + third : first * 60 + second;
  }
  const word = value.match(/(?:(\d+)\s*시간\s*)?(\d+)\s*분(?:\s*(\d+)\s*초)?/);
  if (word) return Number(word[1] || 0) * 3600 + Number(word[2] || 0) * 60 + Number(word[3] || 0);
  return undefined;
};

const hasRequiredFields = (draft: Draft) => Boolean(
  draft.date && parseNumber(draft.distanceKm) && parseDuration(draft.duration),
);

const toActivity = (draft: Draft) => {
  const distanceKm = parseNumber(draft.distanceKm);
  const durationSec = parseDuration(draft.duration);
  if (!draft.date || !distanceKm || !durationSec) return null;

  return {
    id: `ocr-${draft.date.replace(/-/g, '')}-${Date.now().toString(36)}`,
    date: draft.date,
    type: draft.type,
    distanceKm,
    durationSec,
    avgPaceSecPerKm: parsePace(draft.avgPace),
    bestPaceSecPerKm: parsePace(draft.bestPace),
    avgSpeedKmh: parseNumber(draft.avgSpeed),
    bestSpeedKmh: parseNumber(draft.bestSpeed),
    calories: parseNumber(draft.calories),
    steps: parseNumber(draft.steps),
    avgHeartRate: parseNumber(draft.avgHeartRate),
    maxHeartRate: parseNumber(draft.maxHeartRate),
    avgCadence: parseNumber(draft.avgCadence),
    maxCadence: parseNumber(draft.maxCadence),
    vo2max: parseNumber(draft.vo2max),
    elevationGainM: parseNumber(draft.elevationGain),
    elevationLossM: parseNumber(draft.elevationLoss),
    note: draft.note || undefined,
    source: 'Samsung Health OCR',
  };
};

const fields: { key: keyof Draft; label: string; placeholder?: string; type?: 'date' }[] = [
  { key: 'date', label: '날짜', type: 'date' },
  { key: 'distanceKm', label: '거리 (km)', placeholder: '2.12' },
  { key: 'duration', label: '운동시간', placeholder: '15:00' },
  { key: 'avgPace', label: '평균 페이스', placeholder: "7'03\"" },
  { key: 'bestPace', label: '최고 페이스', placeholder: "5'51\"" },
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

const FIELD_KEYS: (keyof Draft)[] = fields.map(field => field.key);

export default function MotionLogScreenshotImport() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [ocrStatus, setOcrStatus] = useState('캡처 최대 3장 · 정밀 OCR 준비');
  const [busy, setBusy] = useState(false);
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passCount, setPassCount] = useState(0);

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

  const recognizedCount = useMemo(
    () => FIELD_KEYS.filter(key => Boolean(String(draft[key] || '').trim())).length,
    [draft],
  );

  const summary = useMemo(() => [
    draft.distanceKm && `${draft.distanceKm} km`,
    draft.duration,
    draft.avgPace,
    draft.avgHeartRate && `${draft.avgHeartRate} bpm`,
    draft.avgCadence && `${draft.avgCadence} spm`,
  ].filter(Boolean).join(' · '), [draft]);

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).slice(0, 3);
    setFiles(selected);
    setDraft(blankDraft());
    setRawText('');
    setError('');
    setDuplicate(false);
    setSaved(false);
    setPassCount(0);
    setOcrStatus(selected.length ? `${selected.length}장 선택됨 · 정밀 OCR 준비` : '캡처 최대 3장 · 정밀 OCR 준비');
    event.target.value = '';
  };

  const runOcr = async () => {
    if (!files.length) {
      setError('삼성헬스 캡처를 먼저 선택해주세요.');
      return;
    }

    setBusy(true);
    setError('');
    setDuplicate(false);
    setSaved(false);
    setPassCount(0);

    try {
      const result = await recognizeSamsungHealthImages(files, message => setOcrStatus(message));
      const parsed = { ...result.draft, note: '' } as Draft;
      const normalizedRaw = result.texts
        .map(pass => `[캡처 ${pass.imageIndex + 1} · ${pass.mode}]\n${normalizeOcrText(pass.text)}`)
        .join('\n\n--- 다음 인식 패스 ---\n\n');

      setDraft(parsed);
      setRawText(normalizedRaw);
      setPassCount(result.texts.length);

      const distance = parseNumber(parsed.distanceKm) || 0;
      const duration = parseDuration(parsed.duration) || 0;
      const local = readLocal();
      const hasDuplicate = local.some(row => (
        row.date === parsed.date
        && row.type === parsed.type
        && Math.abs(Number(row.distanceKm) - distance) < 0.01
        && Math.abs(Number(row.durationSec) - duration) <= 2
      ));
      setDuplicate(hasDuplicate);

      if (hasRequiredFields(parsed)) {
        setOcrStatus(`자동 추출 완료 · ${recognizedCountFrom(parsed)}/${FIELD_KEYS.length}개 항목 인식`);
      } else {
        setOcrStatus('필수 항목 일부 미인식 · 아래 값을 확인/수정해주세요.');
      }
    } catch (err) {
      setError(`OCR 실패: ${err instanceof Error ? err.message : String(err)}`);
      setOcrStatus('OCR을 완료하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    setError('');
    const activity = toActivity(draft);
    if (!activity) {
      setError('날짜, 거리, 운동시간은 필수입니다.');
      return;
    }

    const local = readLocal();
    const exactDuplicate = local.some(row => (
      row.date === activity.date
      && row.type === activity.type
      && Math.abs(Number(row.distanceKm) - activity.distanceKm) < 0.01
      && Math.abs(Number(row.durationSec) - activity.durationSec) <= 2
    ));

    if (exactDuplicate && !duplicate) {
      setDuplicate(true);
      setError('기존 기록과 매우 유사합니다. 중복 여부를 확인한 뒤 저장 버튼을 다시 눌러주세요.');
      return;
    }

    localStorage.setItem(STORAGE, JSON.stringify([...local, activity]));
    setSaved(true);
    setOcrStatus('저장 완료 · 현재 기기에 기록됨');
    setTimeout(() => window.location.reload(), 450);
  };

  const reset = () => {
    setFiles([]);
    setDraft(blankDraft());
    setRawText('');
    setError('');
    setDuplicate(false);
    setSaved(false);
    setPassCount(0);
    setOcrStatus('캡처 최대 3장 · 정밀 OCR 준비');
  };

  const fileSummary = files.length
    ? files.map((file, index) => `${index + 1}. ${file.name.length > 28 ? `${file.name.slice(0, 25)}…` : file.name}`).join(' · ')
    : '운동 상세 · 그래프/지도 · 랩 캡처 순서로 넣어도 됩니다.';

  return (
    <>
      {target && createPortal(
        <button className="motion-import-trigger" onClick={() => setOpen(true)}>+ 운동 캡처 추가</button>,
        target,
      )}
      {open && createPortal(
        <div
          className="motion-import-backdrop"
          onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}
        >
          <section className="motion-import-modal" role="dialog" aria-modal="true" aria-labelledby="motion-import-title">
            <div className="motion-import-head">
              <div>
                <div className="eyebrow">V2.0.1 · OCR ACCURACY</div>
                <h2 id="motion-import-title">운동 캡처로 기록 추가</h2>
                <p>
                  삼성헬스 캡처를 최대 3장 선택합니다. 이미지 확대·고대비 전처리와 복수 OCR 패스를 사용하고,
                  인식이 불확실한 값은 빈칸으로 남깁니다. 저장 전 직접 확인·수정할 수 있습니다.
                </p>
              </div>
              <button className="close" onClick={() => setOpen(false)} aria-label="닫기">×</button>
            </div>

            <label className="motion-import-drop">
              <input type="file" accept="image/*" multiple onChange={chooseFiles} />
              <strong>{files.length ? `${files.length}장 선택됨` : '삼성헬스 캡처 선택'}</strong>
              <span>{fileSummary}</span>
            </label>

            <div className="motion-import-actions">
              <button className="primary" disabled={busy || !files.length} onClick={runOcr}>
                {busy ? '정밀 인식 중…' : '정밀 자동 인식'}
              </button>
              <button className="secondary" disabled={busy} onClick={reset}>초기화</button>
              <span>{ocrStatus}</span>
            </div>

            <div className="motion-import-quality">
              <span>인식 항목</span>
              <b>{recognizedCount}/{FIELD_KEYS.length}</b>
              <span>{passCount ? `OCR 패스 ${passCount}회` : '아직 인식 전'}</span>
            </div>

            {summary && <div className="motion-import-preview"><span>추출 미리보기</span><b>{summary}</b></div>}
            {duplicate && <div className="motion-import-warning">기존 기록과 매우 유사한 운동입니다. 날짜·종목·거리·시간을 확인하세요.</div>}
            {error && <div className="motion-import-error">{error}</div>}

            <div className="motion-import-grid">
              <label>
                <span>종목</span>
                <select
                  value={draft.type}
                  onChange={event => setDraft(current => ({ ...current, type: event.target.value as ActivityType }))}
                >
                  <option>러닝</option>
                  <option>등산</option>
                  <option>걷기</option>
                  <option>자전거</option>
                  <option>수영</option>
                  <option>기타</option>
                </select>
              </label>
              {fields.map(field => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <input
                    type={field.type || 'text'}
                    inputMode={field.type ? undefined : 'decimal'}
                    placeholder={field.placeholder}
                    value={draft[field.key] as string}
                    onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))}
                  />
                </label>
              ))}
            </div>

            <label className="motion-import-note">
              <span>메모</span>
              <textarea
                value={draft.note}
                onChange={event => setDraft(current => ({ ...current, note: event.target.value }))}
                placeholder="오늘 운동 메모 (선택)"
              />
            </label>

            {rawText && (
              <details className="motion-import-raw">
                <summary>OCR 원문 / 패스 결과 확인</summary>
                <pre>{rawText}</pre>
              </details>
            )}

            <div className="motion-import-foot">
              <span>
                {saved ? '저장 완료' : '자동 인식값은 확정값이 아닙니다. 화면과 비교한 뒤 저장하세요.'}
              </span>
              <button className="primary" disabled={busy} onClick={save}>
                {saved ? '저장됨' : '기록 저장'}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

const readLocal = (): StoredActivity[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    return Array.isArray(stored) ? stored as StoredActivity[] : [];
  } catch {
    return [];
  }
};

const recognizedCountFrom = (draft: Draft) => FIELD_KEYS.filter(key => Boolean(String(draft[key] || '').trim())).length;
