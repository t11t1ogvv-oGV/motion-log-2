'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type Activity = {
  id: string;
  date: string;
  type: string;
  distance: number;
  duration: string;
  heartRate: number;
  cadence: number;
  calories: number;
  weight: number;
  note: string;
  image?: string;
};

type Tab = 'dashboard' | 'records' | 'analysis';

const seed: Activity[] = [
  { id: '1', date: '2026-09-05', type: '러닝', distance: 2.2, duration: '14:21', heartRate: 154, cadence: 166, calories: 238, weight: 95.4, note: '평지 위주', },
  { id: '2', date: '2026-09-08', type: '러닝', distance: 2.5, duration: '15:48', heartRate: 157, cadence: 165, calories: 271, weight: 94.8, note: '후반 오르막', },
  { id: '3', date: '2026-09-12', type: '러닝', distance: 3.0, duration: '18:33', heartRate: 158, cadence: 164, calories: 312, weight: 94.3, note: '3km 기록', },
  { id: '4', date: '2026-09-15', type: '걷기', distance: 5.0, duration: '59:00', heartRate: 118, cadence: 122, calories: 305, weight: 94.0, note: '가볍게 회복', },
];

const blankForm = {
  date: '2026-09-16',
  type: '러닝',
  distance: '',
  duration: '',
  heartRate: '',
  cadence: '',
  calories: '',
  weight: '94',
  note: '',
};

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function pace(distance: number, duration: string) {
  if (!distance || !duration || !duration.includes(':')) return '-';
  const [m, s] = duration.split(':').map(Number);
  if (!Number.isFinite(m) || !Number.isFinite(s)) return '-';
  const total = m * 60 + s;
  const sec = Math.round(total / distance);
  return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, '0')}"`;
}

function MiniChart({ data, label }: { data: number[]; label: string }) {
  if (!data.length) return <div className="empty-chart">아직 데이터가 없습니다.</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 520;
  const height = 170;
  const pts = data.map((v, i) => {
    const x = data.length === 1 ? width / 2 : 16 + (i * (width - 32)) / (data.length - 1);
    const y = height - 28 - ((v - min) / range) * (height - 58);
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <line x1="16" y1="142" x2="504" y2="142" className="grid-line" />
        <line x1="16" y1="82" x2="504" y2="82" className="grid-line" />
        <line x1="16" y1="22" x2="504" y2="22" className="grid-line" />
        <polyline fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={pts} />
        {data.map((v, i) => {
          const [x, y] = pts.split(' ')[i].split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r="4.5" fill="currentColor" />;
        })}
      </svg>
      <div className="chart-labels"><span>최근</span><span>이전</span><strong>{max === min ? max : `${min} ~ ${max}`}</strong></div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [activities, setActivities] = useState<Activity[]>(seed);
  const [form, setForm] = useState(blankForm);
  const [image, setImage] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [dark, setDark] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('motion-log-activities');
      if (saved) setActivities(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem('motion-log-activities', JSON.stringify(activities));
  }, [activities]);

  const sorted = useMemo(() => [...activities].sort((a, b) => b.date.localeCompare(a.date)), [activities]);
  const totalDistance = activities.reduce((s, a) => s + a.distance, 0);
  const latestWeight = sorted.find(a => a.weight > 0)?.weight ?? 0;
  const thisWeek = activities.filter(a => a.date >= '2026-09-10');
  const avgHr = thisWeek.length ? Math.round(thisWeek.reduce((s, a) => s + a.heartRate, 0) / thisWeek.length) : 0;
  const weightSeries = [...sorted].reverse().filter(a => a.weight > 0).map(a => a.weight);
  const distanceSeries = [...sorted].reverse().map(a => a.distance);

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('이미지 파일만 선택해주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const distance = Number(form.distance);
    if (!form.date || !Number.isFinite(distance) || distance <= 0 || !form.duration) {
      setNotice('날짜, 거리, 시간을 입력해주세요.');
      return;
    }
    const next: Activity = {
      id: crypto.randomUUID(),
      date: form.date,
      type: form.type,
      distance,
      duration: form.duration,
      heartRate: Number(form.heartRate) || 0,
      cadence: Number(form.cadence) || 0,
      calories: Number(form.calories) || 0,
      weight: Number(form.weight) || 0,
      note: form.note,
      image: image || undefined,
    };
    setActivities(prev => [next, ...prev]);
    setForm(blankForm);
    setImage('');
    setShowForm(false);
    setNotice('운동 기록을 저장했습니다.');
  };

  const remove = (id: string) => setActivities(prev => prev.filter(a => a.id !== id));

  const nav = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className={dark ? 'app dark' : 'app'}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-dot" /> Motion Log</div>
        <div className="eyebrow">PERSONAL FITNESS LOG</div>
        <nav>
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => nav('dashboard')}>대시보드</button>
          <button className={tab === 'records' ? 'active' : ''} onClick={() => nav('records')}>운동 기록</button>
          <button className={tab === 'analysis' ? 'active' : ''} onClick={() => nav('analysis')}>분석</button>
        </nav>
        <div className="sidebar-foot">
          <button className="ghost" onClick={() => setDark(v => !v)}>{dark ? '☀ 라이트 모드' : '◐ 다크 모드'}</button>
          <div className="small">내 데이터는 이 브라우저에 저장됩니다.</div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><div className="eyebrow mobile-only">MOTION LOG</div><h1>{tab === 'dashboard' ? '오늘의 컨디션' : tab === 'records' ? '운동 기록' : '운동 분석'}</h1></div>
          <button className="primary desktop-add" onClick={() => setShowForm(true)}>+ 운동 기록</button>
          <button className="mobile-add" aria-label="운동 기록 추가" onClick={() => setShowForm(true)}>＋</button>
        </header>

        {notice && <button className="notice" onClick={() => setNotice('')}>{notice} <span>×</span></button>}

        {tab === 'dashboard' && (
          <>
            <section className="hero-card">
              <div>
                <div className="eyebrow">TODAY · 2026.09.16</div>
                <h2>작게 기록하고,<br />꾸준히 확인하세요.</h2>
                <p>운동이 끝난 뒤 캡처를 보면서 필요한 값만 간단히 입력하면 됩니다.</p>
              </div>
              <div className="hero-ring"><span>{latestWeight || '-'}<small>kg</small></span><em>현재 체중</em></div>
            </section>

            <section className="stats-grid">
              <article><span>이번주 운동</span><strong>{thisWeek.length}<small>회</small></strong></article>
              <article><span>누적 거리</span><strong>{totalDistance.toFixed(1)}<small>km</small></strong></article>
              <article><span>평균 심박</span><strong>{avgHr || '-'}<small>bpm</small></strong></article>
              <article><span>목표 체중</span><strong>89.0<small>kg</small></strong></article>
            </section>

            <section className="section-head"><div><div className="eyebrow">RECENT</div><h3>최근 운동</h3></div><button className="text-btn" onClick={() => nav('records')}>전체 보기 →</button></section>
            <div className="records-list">
              {sorted.slice(0, 3).map(a => <RecordRow key={a.id} a={a} onDelete={remove} />)}
            </div>
          </>
        )}

        {tab === 'records' && (
          <>
            <section className="upload-card">
              <div className="upload-icon">↥</div>
              <div><h3>운동 캡처를 함께 보관하세요</h3><p>삼성헬스나 워치 화면을 올려 기록과 함께 저장할 수 있습니다.</p></div>
              <button className="secondary" onClick={() => setShowForm(true)}>사진 + 기록 추가</button>
            </section>
            <div className="section-head"><div><div className="eyebrow">ALL RECORDS</div><h3>전체 운동</h3></div><span className="count-pill">{activities.length}개</span></div>
            <div className="records-list">{sorted.map(a => <RecordRow key={a.id} a={a} onDelete={remove} />)}</div>
          </>
        )}

        {tab === 'analysis' && (
          <>
            <div className="analysis-grid">
              <section className="panel"><div className="eyebrow">WEIGHT</div><h3>체중 추이</h3><div className="big-number">{latestWeight.toFixed(1)}<small>kg</small></div><MiniChart data={weightSeries} label="체중 추이" /></section>
              <section className="panel"><div className="eyebrow">DISTANCE</div><h3>운동 거리</h3><div className="big-number">{totalDistance.toFixed(1)}<small>km</small></div><MiniChart data={distanceSeries} label="운동 거리 추이" /></section>
            </div>
            <section className="panel coach"><div><div className="eyebrow">MOTION NOTE</div><h3>현재 기록에서 보이는 흐름</h3></div><p>{activities.length < 2 ? '기록이 조금 더 쌓이면 변화 추이를 자동으로 보여드릴 수 있습니다.' : `최근 ${Math.min(activities.length, 4)}회 기록이 쌓였습니다. 거리, 심박, 체중의 변화를 한 화면에서 확인해보세요.`}</p></section>
          </>
        )}
      </section>

      <div className="bottom-nav">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => nav('dashboard')}><span>⌂</span>홈</button>
        <button className={tab === 'records' ? 'active' : ''} onClick={() => nav('records')}><span>◫</span>기록</button>
        <button className={tab === 'analysis' ? 'active' : ''} onClick={() => nav('analysis')}><span>⌁</span>분석</button>
      </div>

      {showForm && <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setShowForm(false); }}>
        <form className="modal" onSubmit={save}>
          <div className="modal-head"><div><div className="eyebrow">NEW ACTIVITY</div><h2>운동 기록 추가</h2></div><button type="button" className="close" onClick={() => setShowForm(false)}>×</button></div>
          <label>운동 캡처<input type="file" accept="image/*" onChange={handleImage} /></label>
          {image && <img className="preview" src={image} alt="운동 캡처 미리보기" />}
          <div className="form-grid">
            <label>날짜<input type="date" value={form.date} onChange={e => setForm({...form, date:e.target.value})} /></label>
            <label>종류<select value={form.type} onChange={e => setForm({...form, type:e.target.value})}><option>러닝</option><option>걷기</option><option>자전거</option><option>기타</option></select></label>
            <label>거리(km)<input inputMode="decimal" value={form.distance} onChange={e => setForm({...form, distance:e.target.value})} placeholder="3.02" /></label>
            <label>시간<input value={form.duration} onChange={e => setForm({...form, duration:e.target.value})} placeholder="18:33" /></label>
            <label>평균 심박<input inputMode="numeric" value={form.heartRate} onChange={e => setForm({...form, heartRate:e.target.value})} placeholder="158" /></label>
            <label>케이던스<input inputMode="numeric" value={form.cadence} onChange={e => setForm({...form, cadence:e.target.value})} placeholder="164" /></label>
            <label>칼로리<input inputMode="numeric" value={form.calories} onChange={e => setForm({...form, calories:e.target.value})} placeholder="312" /></label>
            <label>체중(kg)<input inputMode="decimal" value={form.weight} onChange={e => setForm({...form, weight:e.target.value})} placeholder="94" /></label>
          </div>
          <label>메모<textarea value={form.note} onChange={e => setForm({...form, note:e.target.value})} placeholder="예: 오르막 구간에서 호흡이 힘들었음" /></label>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowForm(false)}>취소</button><button className="primary" type="submit">기록 저장</button></div>
        </form>
      </div>}
    </main>
  );
}

function RecordRow({ a, onDelete }: { a: Activity; onDelete: (id: string) => void }) {
  return <article className="record-row">
    <div className="date-col"><strong>{formatDate(a.date)}</strong><span>{a.type}</span></div>
    <div className="record-main"><strong>{a.distance.toFixed(2)} km</strong><span>{a.duration} · {pace(a.distance, a.duration)} /km</span></div>
    <div className="record-metrics"><span>{a.heartRate ? `${a.heartRate} bpm` : '-'}</span><span>{a.cadence ? `${a.cadence} spm` : '-'}</span><span>{a.calories ? `${a.calories} kcal` : '-'}</span></div>
    <button className="delete-btn" title="삭제" onClick={() => onDelete(a.id)}>×</button>
  </article>;
}
