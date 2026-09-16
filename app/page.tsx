'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type ActivityType = '러닝' | '걷기' | '자전거' | '등산' | '기타';
type Tab = 'dashboard' | 'records' | 'analysis' | 'more';

type Lap = {
  lap: number;
  distanceKm: number;
  durationSec: number;
  paceSecPerKm: number;
};

type Activity = {
  id: string;
  date: string;
  type: ActivityType;
  distanceKm: number;
  durationSec: number;
  calories?: number;
  steps?: number;
  avgPaceSecPerKm?: number;
  bestPaceSecPerKm?: number;
  avgSpeedKmh?: number;
  bestSpeedKmh?: number;
  elevationGainM?: number;
  elevationMinM?: number;
  elevationMaxM?: number;
  totalAscentKm?: number;
  totalDescentKm?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  vo2max?: number;
  thresholdAerobicBpm?: number;
  thresholdAnaerobicBpm?: number;
  recoveryBpm?: number;
  hrZones?: { zone: string; range: string; seconds: number; percent: number }[];
  laps?: Lap[];
  dynamics?: {
    balance?: string;
    groundContactMs?: number;
    flightMs?: number;
    regularity?: string;
    verticalOscillationCm?: number;
    stiffness?: number;
  };
  screenshotUrls?: string[];
  note?: string;
  source?: string;
};

type Draft = Omit<Activity, 'id'>;

const STORAGE_KEY = 'motion-log-activities-v2';
const THEME_KEY = 'motion-log-theme-v2';

const seed: Activity[] = [
  {
    id: 'demo-1', date: '2026-09-05', type: '러닝', distanceKm: 2.2, durationSec: 861,
    calories: 238, avgPaceSecPerKm: 391, avgHeartRate: 154, avgCadence: 166, vo2max: 37.4,
    note: '평지 위주', source: '예시 데이터',
  },
  {
    id: 'demo-2', date: '2026-09-08', type: '러닝', distanceKm: 2.5, durationSec: 948,
    calories: 271, avgPaceSecPerKm: 379, avgHeartRate: 157, avgCadence: 165, vo2max: 37.4,
    note: '후반 오르막', source: '예시 데이터',
  },
  {
    id: 'demo-3', date: '2026-09-12', type: '러닝', distanceKm: 3.03, durationSec: 1197,
    calories: 314, steps: 3205, avgPaceSecPerKm: 394, bestPaceSecPerKm: 323,
    avgSpeedKmh: 9.1, bestSpeedKmh: 11.1, elevationGainM: 30, elevationMinM: 39, elevationMaxM: 71,
    totalAscentKm: 0.13, totalDescentKm: 0.12, avgHeartRate: 161, maxHeartRate: 177,
    avgCadence: 160, maxCadence: 174, vo2max: 37.5,
    thresholdAerobicBpm: 133, thresholdAnaerobicBpm: 171,
    hrZones: [
      { zone: 'Z1', range: '92–133 bpm', seconds: 58, percent: 4.9 },
      { zone: 'Z2', range: '134–171 bpm', seconds: 900, percent: 75.5 },
      { zone: 'Z3', range: '172–185 bpm', seconds: 39, percent: 19.6 },
    ],
    laps: [
      { lap: 1, distanceKm: 1, durationSec: 395, paceSecPerKm: 395 },
      { lap: 2, distanceKm: 1, durationSec: 414, paceSecPerKm: 414 },
      { lap: 3, distanceKm: 1, durationSec: 372, paceSecPerKm: 372 },
      { lap: 4, distanceKm: 0.03, durationSec: 15, paceSecPerKm: 450 },
    ],
    dynamics: {
      balance: '매우 좋음', groundContactMs: 171, flightMs: 196,
      regularity: '매우 좋음', verticalOscillationCm: 9.2, stiffness: 53,
    },
    note: '3km 기록 예시. 삼성헬스 캡처 기준', source: '삼성헬스 예시',
  },
  {
    id: 'demo-4', date: '2026-09-15', type: '걷기', distanceKm: 5, durationSec: 3540,
    calories: 305, avgPaceSecPerKm: 708, avgHeartRate: 118, avgCadence: 122,
    note: '가볍게 회복', source: '예시 데이터',
  },
];

const blankDraft: Draft = {
  date: new Date().toISOString().slice(0, 10),
  type: '러닝', distanceKm: 0, durationSec: 0, calories: undefined, steps: undefined,
  avgPaceSecPerKm: undefined, bestPaceSecPerKm: undefined, avgSpeedKmh: undefined, bestSpeedKmh: undefined,
  elevationGainM: undefined, elevationMinM: undefined, elevationMaxM: undefined,
  totalAscentKm: undefined, totalDescentKm: undefined, avgHeartRate: undefined, maxHeartRate: undefined,
  avgCadence: undefined, maxCadence: undefined, vo2max: undefined, thresholdAerobicBpm: undefined,
  thresholdAnaerobicBpm: undefined, recoveryBpm: undefined, hrZones: undefined, laps: undefined,
  dynamics: undefined, screenshotUrls: [], note: '', source: '직접 입력',
};

function formatDuration(sec = 0) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  return h ? `${h}시간 ${m}분` : `${m}분 ${String(rest).padStart(2, '0')}초`;
}

function formatClock(sec = 0) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

function formatPace(sec?: number) {
  if (!Number.isFinite(sec) || !sec) return '—';
  const rounded = Math.round(sec as number);
  return `${Math.floor(rounded / 60)}'${String(rounded % 60).padStart(2, '0')}"/km`;
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function sumDuration(items: Activity[]) {
  return items.reduce((sum, a) => sum + (a.durationSec || 0), 0);
}

function average(values: number[]) {
  const valid = values.filter(v => Number.isFinite(v));
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
}

async function compressImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    img.src = dataUrl;
  });
  const maxWidth = 1400;
  const ratio = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function MiniLine({ values, unit = '' }: { values: number[]; unit?: string }) {
  if (!values.length) return <div className="empty-chart">아직 데이터가 없습니다.</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 500;
  const height = 140;
  const points = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : 18 + i * ((width - 36) / (values.length - 1));
    const y = 115 - ((v - min) / range) * 90;
    return [x, y] as const;
  });
  return (
    <div className="chart-box">
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {[25, 70, 115].map(y => <line key={y} x1="18" x2="482" y1={y} y2={y} className="chart-grid" />)}
        <polyline fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" points={points.map(p => p.join(',')).join(' ')} />
        {points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="currentColor" />)}
      </svg>
      <div className="chart-caption"><span>{min}{unit}</span><strong>{max}{unit}</strong></div>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}{unit && <small>{unit}</small>}</strong>
    </div>
  );
}

function RecordCard({ activity, onOpen, onDelete }: { activity: Activity; onOpen: () => void; onDelete: () => void }) {
  return (
    <article className="record-card" onClick={onOpen}>
      <div className="record-date"><b>{formatDate(activity.date)}</b><span>{activity.type}</span></div>
      <div className="record-main"><b>{activity.distanceKm.toFixed(2)}<small>km</small></b><span>{formatDuration(activity.durationSec)} · {formatPace(activity.avgPaceSecPerKm)}</span></div>
      <div className="record-tags">
        {activity.avgHeartRate ? <span>♥ {activity.avgHeartRate} bpm</span> : null}
        {activity.avgCadence ? <span>↟ {activity.avgCadence} spm</span> : null}
        {activity.calories ? <span>{activity.calories} kcal</span> : null}
        {activity.vo2max ? <span>VO₂ {activity.vo2max}</span> : null}
      </div>
      <button className="icon-button" aria-label="기록 삭제" onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
    </article>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [activities, setActivities] = useState<Activity[]>(seed);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [selected, setSelected] = useState<Activity | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState('');
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setActivities(JSON.parse(saved));
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme) setDark(savedTheme === 'dark');
    } catch { /* ignore bad local storage */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  const sorted = useMemo(() => [...activities].sort((a, b) => b.date.localeCompare(a.date)), [activities]);
  const latest = sorted[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (period - 1));
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const periodItems = sorted.filter(a => a.date >= cutoffDate);
  const weekItems = sorted.filter(a => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return a.date >= d.toISOString().slice(0, 10);
  });

  const totalDistance = periodItems.reduce((s, a) => s + a.distanceKm, 0);
  const totalCalories = periodItems.reduce((s, a) => s + (a.calories || 0), 0);
  const avgHr = average(periodItems.map(a => a.avgHeartRate || NaN));
  const latestVo2 = [...sorted].find(a => Number.isFinite(a.vo2max))?.vo2max;
  const distanceSeries = [...periodItems].reverse().map(a => Number(a.distanceKm.toFixed(2)));
  const vo2Series = [...periodItems].reverse().filter(a => Number.isFinite(a.vo2max)).map(a => Number(a.vo2max));
  const hrSeries = [...periodItems].reverse().filter(a => Number.isFinite(a.avgHeartRate)).map(a => a.avgHeartRate as number);

  const openRecorder = () => {
    setImages([]);
    setDraft({ ...blankDraft, date: new Date().toISOString().slice(0, 10), source: '삼성헬스 캡처' });
    setShowRecorder(true);
  };

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (!files.length) return;
    try {
      const compressed = await Promise.all(files.map(compressImage));
      setImages(compressed);
      setMessage(`${compressed.length}장 준비 완료. 최대 3장까지 한 운동으로 묶습니다.`);
    } catch {
      setMessage('이미지를 읽지 못했습니다. 다시 선택해주세요.');
    }
  };

  const analyze = async () => {
    if (!images.length) {
      setMessage('삼성헬스 캡처를 먼저 올려주세요.');
      return;
    }
    setAnalyzing(true);
    setMessage('캡처의 화면 종류와 숫자를 분석하고 있습니다…');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석에 실패했습니다.');
      setDraft(prev => ({ ...prev, ...data.activity, screenshotUrls: images, source: '삼성헬스 캡처 + AI 분석' }));
      setMessage('분석 완료. 저장하기 전에 결과를 확인하세요.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '분석에 실패했습니다. 직접 입력할 수 있습니다.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.date || !draft.distanceKm || !draft.durationSec) {
      setMessage('날짜, 거리, 운동 시간을 확인해주세요.');
      return;
    }
    const next: Activity = {
      ...draft,
      id: crypto.randomUUID(),
      screenshotUrls: images.length ? images : draft.screenshotUrls,
    };
    setActivities(prev => [next, ...prev]);
    setShowRecorder(false);
    setSelected(next);
    setTab('records');
    setMessage('운동 기록을 저장했습니다.');
  };

  const deleteActivity = (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(activities, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motion-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error();
        setActivities(parsed);
        setMessage('백업 데이터를 불러왔습니다.');
      } catch {
        setMessage('올바른 Motion Log 백업 파일이 아닙니다.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <main className={dark ? 'app dark' : 'app'}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-dot" /> Motion Log</div>
        <div className="eyebrow">GALAXY WATCH FITNESS LOG</div>
        <nav>
          {([['dashboard', '대시보드'], ['records', '운동 기록'], ['analysis', '분석'], ['more', '설정']] as const).map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="ghost" onClick={() => setDark(v => !v)}>{dark ? '☼ 라이트 모드' : '◐ 다크 모드'}</button>
          <div className="small">기본 데이터는 현재 브라우저에 저장됩니다. DB 연동은 다음 단계에서 추가할 수 있습니다.</div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <div className="eyebrow mobile-only">MOTION LOG</div>
            <h1>{tab === 'dashboard' ? '오늘의 컨디션' : tab === 'records' ? '운동 기록' : tab === 'analysis' ? '운동 분석' : '설정'}</h1>
          </div>
          <button className="primary desktop-add" onClick={openRecorder}>+ 캡처로 기록</button>
          <button className="mobile-add" aria-label="운동 기록 추가" onClick={openRecorder}>＋</button>
        </header>

        {message && <button className="notice" onClick={() => setMessage('')}>{message}<span>×</span></button>}

        {tab === 'dashboard' && (
          <>
            <section className="hero-card">
              <div>
                <div className="eyebrow">TODAY · {new Date().toLocaleDateString('ko-KR')}</div>
                <h2>갤럭시워치 기록을<br />한 곳에서 정리하세요.</h2>
                <p>운동이 끝난 뒤 삼성헬스 캡처 2장을 올리고, 필요할 때 구간기록 1장을 추가하면 됩니다. AI가 같은 운동의 데이터를 하나로 묶어줍니다.</p>
              </div>
              <div className="hero-stack">
                <div className="hero-ring"><span>{latest?.distanceKm?.toFixed(2) ?? '—'}<small>km</small></span><em>최근 거리</em></div>
                <div className="hero-side"><span>최근 운동</span><b>{latest ? formatDate(latest.date) : '—'}</b><small>{latest?.type ?? '—'}</small></div>
              </div>
            </section>

            <section className="stats-grid six">
              <Metric label="이번 주 운동" value={weekItems.length} unit="회" />
              <Metric label="이번 주 거리" value={weekItems.reduce((s, a) => s + a.distanceKm, 0).toFixed(1)} unit="km" />
              <Metric label="이번 주 시간" value={formatDuration(sumDuration(weekItems))} />
              <Metric label="평균 심박" value={avgHr || '—'} unit={avgHr ? 'bpm' : undefined} />
              <Metric label="칼로리" value={weekItems.reduce((s, a) => s + (a.calories || 0), 0)} unit="kcal" />
              <Metric label="VO₂ Max" value={latestVo2 ?? '—'} />
            </section>

            <section className="section-head"><div><div className="eyebrow">QUICK ACTION</div><h3>운동이 끝났다면</h3></div></section>
            <section className="quick-grid">
              <button className="quick-card featured" onClick={openRecorder}><span className="quick-icon">↥</span><div><b>삼성헬스 캡처 업로드</b><small>2장 기본 · 최대 3장</small></div><strong>→</strong></button>
              <button className="quick-card" onClick={() => setTab('records')}><span className="quick-icon">◫</span><div><b>최근 운동 확인</b><small>{activities.length}개 기록</small></div><strong>→</strong></button>
              <button className="quick-card" onClick={() => setTab('analysis')}><span className="quick-icon">⌁</span><div><b>추세 분석</b><small>거리 · 심박 · VO₂ Max</small></div><strong>→</strong></button>
            </section>

            <section className="section-head"><div><div className="eyebrow">RECENT</div><h3>최근 운동</h3></div><button className="text-btn" onClick={() => setTab('records')}>전체 보기 →</button></section>
            <div className="records-list">{sorted.slice(0, 5).map(a => <RecordCard key={a.id} activity={a} onOpen={() => setSelected(a)} onDelete={() => deleteActivity(a.id)} />)}</div>
          </>
        )}

        {tab === 'records' && (
          <>
            <section className="upload-card big-upload">
              <div className="upload-icon">↥</div>
              <div><div className="eyebrow">IMPORT</div><h3>캡처 2장으로 빠르게 기록</h3><p>① 운동 상세정보 ② 지도 및 차트 · 구간 분석이 필요하면 ③ 구간기록을 추가하세요.</p></div>
              <button className="secondary" onClick={openRecorder}>사진 선택</button>
            </section>
            <div className="section-head"><div><div className="eyebrow">ALL RECORDS</div><h3>전체 운동</h3></div><span className="count-pill">{activities.length}개</span></div>
            <div className="records-list">{sorted.map(a => <RecordCard key={a.id} activity={a} onOpen={() => setSelected(a)} onDelete={() => deleteActivity(a.id)} />)}</div>
          </>
        )}

        {tab === 'analysis' && (
          <>
            <div className="period-tabs">{([7, 30, 90] as const).map(p => <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>{p === 7 ? '7일' : p === 30 ? '30일' : '90일'}</button>)}</div>
            <div className="analysis-grid">
              <section className="panel"><div className="eyebrow">DISTANCE</div><h3>운동 거리</h3><div className="big-number">{totalDistance.toFixed(1)}<small>km</small></div><MiniLine values={distanceSeries} unit="km" /></section>
              <section className="panel"><div className="eyebrow">HEART RATE</div><h3>평균 심박</h3><div className="big-number">{avgHr || '—'}<small>{avgHr ? 'bpm' : ''}</small></div><MiniLine values={hrSeries} unit="bpm" /></section>
              <section className="panel"><div className="eyebrow">VO₂ MAX</div><h3>최대 산소 섭취량</h3><div className="big-number">{latestVo2 ?? '—'}</div><MiniLine values={vo2Series} /></section>
              <section className="panel"><div className="eyebrow">LOAD</div><h3>운동량 요약</h3><div className="analysis-summary"><div><span>운동</span><b>{periodItems.length}회</b></div><div><span>시간</span><b>{formatDuration(sumDuration(periodItems))}</b></div><div><span>칼로리</span><b>{totalCalories.toLocaleString()} kcal</b></div><div><span>활동 종류</span><b>{new Set(periodItems.map(a => a.type)).size}종류</b></div></div></section>
            </div>
            <section className="panel coach"><div><div className="eyebrow">MOTION NOTE</div><h3>데이터가 쌓이면 분석의 깊이가 커집니다.</h3></div><p>현재는 실제 저장된 값으로만 추세를 계산합니다. 이후 AI 분석을 연결하면 페이스 변화, 심박 구간, 케이던스, 러닝 다이내믹, 동일 코스 비교 같은 내용을 자동으로 요약할 수 있습니다.</p></section>
          </>
        )}

        {tab === 'more' && (
          <>
            <section className="panel settings-panel"><div className="eyebrow">DATA</div><h3>백업과 복원</h3><p>현재 브라우저에 저장된 운동 기록을 JSON 파일로 보관할 수 있습니다.</p><div className="settings-actions"><button className="secondary" onClick={exportData}>기록 내보내기</button><label className="secondary file-button">백업 불러오기<input type="file" accept="application/json" onChange={importData} /></label></div></section>
            <section className="panel settings-panel"><div className="eyebrow">APP</div><h3>현재 버전</h3><div className="app-info"><span>Motion Log</span><b>v2 · Galaxy Watch import</b><small>삼성헬스 캡처 → AI 추출 → 확인 → 저장</small></div></section>
            <section className="panel settings-panel danger"><div className="eyebrow">RESET</div><h3>데모 데이터 초기화</h3><p>예시 기록으로 돌아갑니다. 내가 저장한 기록은 삭제됩니다.</p><button className="danger-button" onClick={() => { if (confirm('현재 기록을 모두 예시 데이터로 초기화할까요?')) setActivities(seed); }}>초기화</button></section>
          </>
        )}
      </section>

      <div className="bottom-nav">
        {([['dashboard', '⌂', '홈'], ['records', '◫', '기록'], ['analysis', '⌁', '분석'], ['more', '⋯', '더보기']] as const).map(([key, icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><span>{icon}</span>{label}</button>)}
      </div>

      {showRecorder && <div className="modal-backdrop" onMouseDown={e => { if (e.currentTarget === e.target) setShowRecorder(false); }}>
        <form className="modal recorder" onSubmit={saveDraft}>
          <div className="modal-head"><div><div className="eyebrow">IMPORT WORKOUT</div><h2>삼성헬스 캡처</h2><p>운동 상세 1장 + 지도/차트 1장을 기본으로 올리세요.</p></div><button type="button" className="close" onClick={() => setShowRecorder(false)}>×</button></div>
          <label className="dropzone"><input type="file" accept="image/*" multiple onChange={handleFiles} /><strong>사진 선택</strong><span>최대 3장 · 순서는 상관없음</span></label>
          {!!images.length && <div className="thumb-grid">{images.map((src, i) => <div className="thumb" key={i}><img src={src} alt={`업로드 ${i + 1}`} /><button type="button" onClick={() => setImages(v => v.filter((_, idx) => idx !== i))}>×</button></div>)}</div>}
          <div className="recorder-actions"><button type="button" className="secondary" onClick={analyze} disabled={analyzing || !images.length}>{analyzing ? '분석 중…' : 'AI로 자동 읽기'}</button><span>AI 설정이 없으면 아래 값을 직접 확인/수정할 수 있습니다.</span></div>
          <div className="form-grid">
            <label>날짜<input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
            <label>운동 종류<select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as ActivityType })}><option>러닝</option><option>걷기</option><option>자전거</option><option>등산</option><option>기타</option></select></label>
            <label>거리(km)<input type="number" step="0.01" value={draft.distanceKm || ''} onChange={e => setDraft({ ...draft, distanceKm: Number(e.target.value) })} /></label>
            <label>운동 시간(초)<input type="number" value={draft.durationSec || ''} onChange={e => setDraft({ ...draft, durationSec: Number(e.target.value) })} placeholder="예: 1197" /></label>
            <label>평균 심박<input inputMode="numeric" value={draft.avgHeartRate ?? ''} onChange={e => setDraft({ ...draft, avgHeartRate: Number(e.target.value) || undefined })} /></label>
            <label>최대 심박<input inputMode="numeric" value={draft.maxHeartRate ?? ''} onChange={e => setDraft({ ...draft, maxHeartRate: Number(e.target.value) || undefined })} /></label>
            <label>평균 케이던스<input inputMode="numeric" value={draft.avgCadence ?? ''} onChange={e => setDraft({ ...draft, avgCadence: Number(e.target.value) || undefined })} /></label>
            <label>최대 케이던스<input inputMode="numeric" value={draft.maxCadence ?? ''} onChange={e => setDraft({ ...draft, maxCadence: Number(e.target.value) || undefined })} /></label>
            <label>칼로리<input inputMode="numeric" value={draft.calories ?? ''} onChange={e => setDraft({ ...draft, calories: Number(e.target.value) || undefined })} /></label>
            <label>VO₂ Max<input type="number" step="0.1" value={draft.vo2max ?? ''} onChange={e => setDraft({ ...draft, vo2max: Number(e.target.value) || undefined })} /></label>
          </div>
          <label>메모<textarea value={draft.note || ''} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="코스, 느낌, 통증, 신발 등을 남겨두세요." /></label>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowRecorder(false)}>취소</button><button className="primary" type="submit">기록 저장</button></div>
        </form>
      </div>}

      {showAdd && <div>{/* reserved for future quick add */}</div>}

      {selected && <div className="modal-backdrop" onMouseDown={e => { if (e.currentTarget === e.target) setSelected(null); }}>
        <article className="modal detail">
          <div className="modal-head"><div><div className="eyebrow">WORKOUT DETAIL · {formatDate(selected.date)}</div><h2>{selected.type} · {selected.distanceKm.toFixed(2)} km</h2><p>{formatDuration(selected.durationSec)} · {formatPace(selected.avgPaceSecPerKm)}</p></div><button className="close" onClick={() => setSelected(null)}>×</button></div>
          <div className="metric-grid">
            <Metric label="평균 심박" value={selected.avgHeartRate ?? '—'} unit={selected.avgHeartRate ? 'bpm' : undefined} />
            <Metric label="최대 심박" value={selected.maxHeartRate ?? '—'} unit={selected.maxHeartRate ? 'bpm' : undefined} />
            <Metric label="평균 케이던스" value={selected.avgCadence ?? '—'} unit={selected.avgCadence ? 'spm' : undefined} />
            <Metric label="VO₂ Max" value={selected.vo2max ?? '—'} />
            <Metric label="고도 상승" value={selected.elevationGainM ?? '—'} unit={selected.elevationGainM ? 'm' : undefined} />
            <Metric label="칼로리" value={selected.calories ?? '—'} unit={selected.calories ? 'kcal' : undefined} />
          </div>
          {selected.laps?.length ? <section className="detail-section"><div className="eyebrow">LAPS</div><h3>구간 기록</h3><div className="lap-table"><div className="lap-row head"><span>구간</span><span>시간</span><span>거리</span><span>페이스</span></div>{selected.laps.map(l => <div className="lap-row" key={l.lap}><span>{l.lap}</span><span>{formatClock(l.durationSec)}</span><span>{l.distanceKm.toFixed(2)} km</span><span>{formatPace(l.paceSecPerKm)}</span></div>)}</div></section> : null}
          {selected.hrZones?.length ? <section className="detail-section"><div className="eyebrow">HEART RATE ZONES</div><h3>심박 구간</h3><div className="zone-list">{selected.hrZones.map(z => <div className="zone-row" key={z.zone}><span>{z.zone}</span><div><b>{z.range}</b><small>{formatDuration(z.seconds)}</small></div><strong>{z.percent}%</strong></div>)}</div></section> : null}
          {selected.dynamics ? <section className="detail-section"><div className="eyebrow">RUNNING DYNAMICS</div><h3>러닝 다이내믹</h3><div className="metric-grid compact"><Metric label="밸런스" value={selected.dynamics.balance ?? '—'} /><Metric label="지면 접촉" value={selected.dynamics.groundContactMs ?? '—'} unit={selected.dynamics.groundContactMs ? 'ms' : undefined} /><Metric label="체공" value={selected.dynamics.flightMs ?? '—'} unit={selected.dynamics.flightMs ? 'ms' : undefined} /><Metric label="규칙성" value={selected.dynamics.regularity ?? '—'} /><Metric label="수직 진폭" value={selected.dynamics.verticalOscillationCm ?? '—'} unit={selected.dynamics.verticalOscillationCm ? 'cm' : undefined} /><Metric label="강성" value={selected.dynamics.stiffness ?? '—'} /></div></section> : null}
          {selected.screenshotUrls?.length ? <section className="detail-section"><div className="eyebrow">SOURCE</div><h3>원본 캡처</h3><div className="source-grid">{selected.screenshotUrls.map((src, i) => <img key={i} src={src} alt={`운동 원본 ${i + 1}`} />)}</div></section> : null}
          {selected.note ? <section className="note-box">{selected.note}</section> : null}
        </article>
      </div>}
    </main>
  );
}
