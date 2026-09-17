'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { APP_VERSION, APP_VERSION_TITLE } from './version';

type Activity = {
  id: string;
  date: string;
  type: string;
  distanceKm: number;
  durationSec: number;
  avgPaceSecPerKm?: number;
  avgHeartRate?: number;
  avgCadence?: number;
  avgSpeedKmh?: number;
  deletedAt?: string;
};

type Targets = {
  titleHost: HTMLElement | null;
  sidebarFoot: HTMLElement | null;
  dashboardStats: HTMLElement | null;
  analysisStats: HTMLElement | null;
  analysisView: boolean;
};

const STORAGE = 'motion-log-records-v4';
const DATA_URL = '/motion-log-data-test.json?v=8';

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (date: string, amount: number) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + amount);
  return dayKey(d);
};

const fmtPace = (seconds?: number) => {
  if (!Number.isFinite(seconds) || !seconds || seconds < 0) return '—';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}'${String(total % 60).padStart(2, '0')}"/km`;
};

const fmtDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}시간 ${minutes}분` : `${minutes}분`;
};

const average = (values: number[]) => {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
};

const normalize = (row: any): Activity | null => {
  if (!row || typeof row !== 'object' || !row.id || !row.date || !row.type) return null;
  const distanceKm = Number(row.distanceKm);
  const durationSec = Number(row.durationSec);
  if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(durationSec) || durationSec < 0) return null;
  return { ...row, id: String(row.id), date: String(row.date), distanceKm, durationSec };
};

const mergeById = (local: Activity[], remote: Activity[]) => {
  const localById = new Map(local.map(row => [row.id, row]));
  const merged = remote.map(row => {
    const localRow = localById.get(row.id);
    return localRow?.deletedAt ? { ...row, deletedAt: localRow.deletedAt } : row;
  });
  const remoteIds = new Set(remote.map(row => row.id));
  for (const row of local) if (!remoteIds.has(row.id)) merged.push(row);
  return merged;
};

const readLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalize).filter(Boolean) as Activity[] : [];
  } catch {
    return [];
  }
};

function DashboardEnhancements({ records }: { records: Activity[] }) {
  const active = useMemo(() => records.filter(row => !row.deletedAt), [records]);
  const today = dayKey(new Date());
  const recentStart = addDays(today, -6);
  const recent = active.filter(row => row.date >= recentStart && row.date <= today);
  const recentRunning = recent.filter(row => row.type === '러닝');
  const recentDistance = recent.reduce((sum, row) => sum + row.distanceKm, 0);
  const recentDuration = recent.reduce((sum, row) => sum + row.durationSec, 0);
  const recentPace = average(recentRunning.map(row => row.avgPaceSecPerKm ?? NaN));
  const recentHr = average(recent.map(row => row.avgHeartRate ?? NaN));
  const recentCadence = average(recent.map(row => row.avgCadence ?? NaN));

  const running = active.filter(row => row.type === '러닝');
  const longestRun = [...running].sort((a, b) => b.distanceKm - a.distanceKm)[0];
  const fastestRun = running.filter(row => Number.isFinite(row.avgPaceSecPerKm) && row.avgPaceSecPerKm! > 0)
    .sort((a, b) => (a.avgPaceSecPerKm || Infinity) - (b.avgPaceSecPerKm || Infinity))[0];
  const fastestSpeed = running.filter(row => Number.isFinite(row.avgSpeedKmh) && row.avgSpeedKmh! > 0)
    .sort((a, b) => (b.avgSpeedKmh || 0) - (a.avgSpeedKmh || 0))[0];
  const longestWorkout = [...active].sort((a, b) => b.durationSec - a.durationSec)[0];

  const currentMonthKey = today.slice(0, 7);
  const monthDate = new Date(`${today.slice(0, 7)}-01T00:00:00`);
  monthDate.setMonth(monthDate.getMonth() - 1);
  const previousMonthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = active.filter(row => row.date.startsWith(currentMonthKey));
  const previousMonth = active.filter(row => row.date.startsWith(previousMonthKey));
  const currentMonthDistance = currentMonth.reduce((sum, row) => sum + row.distanceKm, 0);
  const previousMonthDistance = previousMonth.reduce((sum, row) => sum + row.distanceKm, 0);
  const currentMonthDuration = currentMonth.reduce((sum, row) => sum + row.durationSec, 0);
  const previousMonthDuration = previousMonth.reduce((sum, row) => sum + row.durationSec, 0);

  return (
    <div className="motion-enhancement-grid">
      <section className="motion-enhancement-card">
        <div className="eyebrow">LAST 7 DAYS</div>
        <h3>최근 7일 요약</h3>
        <div className="motion-summary-number">{recentDistance.toFixed(1)}<small> km</small></div>
        <div className="motion-summary-meta">{recent.length}회 · {fmtDuration(recentDuration)}</div>
        <div className="motion-mini-grid">
          <div><span>평균 페이스</span><b>{recentPace ? fmtPace(recentPace) : '—'}</b></div>
          <div><span>평균 심박</span><b>{recentHr ? `${Math.round(recentHr)} bpm` : '—'}</b></div>
          <div><span>평균 케이던스</span><b>{recentCadence ? `${Math.round(recentCadence)} spm` : '—'}</b></div>
        </div>
      </section>

      <section className="motion-enhancement-card">
        <div className="eyebrow">PERSONAL BEST</div>
        <h3>개인 기록</h3>
        <div className="motion-pb-list">
          <div><span>최장 러닝</span><b>{longestRun ? `${longestRun.distanceKm.toFixed(2)} km` : '—'}</b></div>
          <div><span>최고 평균 페이스</span><b>{fastestRun ? fmtPace(fastestRun.avgPaceSecPerKm) : '—'}</b></div>
          <div><span>최고 평균 속도</span><b>{fastestSpeed?.avgSpeedKmh ? `${fastestSpeed.avgSpeedKmh.toFixed(1)} km/h` : '—'}</b></div>
          <div><span>최장 운동시간</span><b>{longestWorkout ? fmtDuration(longestWorkout.durationSec) : '—'}</b></div>
        </div>
      </section>

      <section className="motion-enhancement-card">
        <div className="eyebrow">MONTHLY REPORT</div>
        <h3>{monthDate.getFullYear()}년 {monthDate.getMonth() + 2}월</h3>
        <div className="motion-pb-list">
          <div><span>운동 횟수</span><b>{currentMonth.length}회 <em>{currentMonth.length - previousMonth.length >= 0 ? '+' : ''}{currentMonth.length - previousMonth.length}</em></b></div>
          <div><span>총 거리</span><b>{currentMonthDistance.toFixed(1)} km <em>{currentMonthDistance - previousMonthDistance >= 0 ? '+' : ''}{(currentMonthDistance - previousMonthDistance).toFixed(1)}</em></b></div>
          <div><span>운동시간</span><b>{fmtDuration(currentMonthDuration)} <em>{currentMonthDuration - previousMonthDuration >= 0 ? '+' : ''}{fmtDuration(Math.abs(currentMonthDuration - previousMonthDuration))}</em></b></div>
        </div>
        <p className="motion-enhancement-note">지난달 대비 변화량 · +는 증가, −는 감소</p>
      </section>
    </div>
  );
}

function EfficiencyChart({ records }: { records: Activity[] }) {
  const [range, setRange] = useState<{ start: string; end: string; type: string }>({ start: addDays(dayKey(new Date()), -29), end: dayKey(new Date()), type: '전체' });

  useEffect(() => {
    const refreshRange = () => {
      const content = document.querySelector('.content');
      if (!content) return;
      const selects = Array.from(content.querySelectorAll('select')) as HTMLSelectElement[];
      const typeSelect = selects.find(select => ['전체', '러닝', '등산'].includes(select.value));
      const type = typeSelect?.value || '전체';
      const periodTabs = Array.from(content.querySelectorAll('.period-tabs')).find(node => {
        const text = node.textContent || '';
        return text.includes('7일') || text.includes('30일') || text.includes('90일') || text.includes('1년') || text.includes('기간 직접 지정');
      });
      const activeButton = periodTabs?.querySelector('button.active') as HTMLButtonElement | null;
      const periodText = activeButton?.textContent?.trim() || '30일';
      const today = dayKey(new Date());
      let start = addDays(today, -29);
      let end = today;
      if (periodText === '7일') start = addDays(today, -6);
      else if (periodText === '90일') start = addDays(today, -89);
      else if (periodText === '1년') start = addDays(today, -364);
      else if (periodText === '기간 직접 지정') {
        const dates = Array.from(content.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
        if (dates[0]?.value && dates[1]?.value && dates[0].value <= dates[1].value) {
          start = dates[0].value;
          end = dates[1].value;
        }
      }
      setRange(current => current.start === start && current.end === end && current.type === type ? current : { start, end, type });
    };
    refreshRange();
    const observer = new MutationObserver(refreshRange);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'value'] });
    return () => observer.disconnect();
  }, []);

  const runs = useMemo(() => records.filter(row => !row.deletedAt && row.type === '러닝' && row.date >= range.start && row.date <= range.end && Number.isFinite(row.avgPaceSecPerKm) && Number.isFinite(row.avgHeartRate)), [records, range]);

  if (range.type === '등산') return null;
  if (!runs.length) {
    return <section className="motion-efficiency-card">
      <div className="eyebrow">RUNNING EFFICIENCY</div>
      <h3>페이스 ↔ 심박 효율</h3>
      <p className="motion-enhancement-note">선택한 기간에 페이스와 평균 심박이 함께 기록된 러닝이 없습니다.</p>
    </section>;
  }

  const width = 760;
  const height = 310;
  const left = 58;
  const right = 18;
  const top = 22;
  const bottom = 50;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const paces = runs.map(row => row.avgPaceSecPerKm!);
  const hrs = runs.map(row => row.avgHeartRate!);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const minHr = Math.min(...hrs);
  const maxHr = Math.max(...hrs);
  const pacePad = Math.max((maxPace - minPace) * 0.1, 4);
  const hrPad = Math.max((maxHr - minHr) * 0.1, 2);
  const paceLo = Math.max(0, minPace - pacePad);
  const paceHi = maxPace + pacePad;
  const hrLo = Math.max(0, minHr - hrPad);
  const hrHi = maxHr + hrPad;
  const x = (pace: number) => left + ((paceHi - pace) / Math.max(1, paceHi - paceLo)) * innerW;
  const y = (hr: number) => top + ((hrHi - hr) / Math.max(1, hrHi - hrLo)) * innerH;
  const uniqueDates = [...new Set(runs.map(row => row.date))].length;

  return (
    <section className="motion-efficiency-card">
      <div className="eyebrow">RUNNING EFFICIENCY</div>
      <div className="motion-efficiency-head">
        <div>
          <h3>페이스 ↔ 심박 효율</h3>
          <span className="motion-enhancement-note">러닝 {runs.length}회 · {uniqueDates}일 · 오른쪽은 빠른 페이스, 아래는 낮은 심박</span>
        </div>
        <div className="motion-efficiency-latest">
          최근 {fmtPace(runs[runs.length - 1].avgPaceSecPerKm)} · {Math.round(runs[runs.length - 1].avgHeartRate!)} bpm
        </div>
      </div>
      <div className="motion-efficiency-chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="motion-efficiency-chart" role="img" aria-label="러닝 평균 페이스와 평균 심박의 관계 산점도">
          {[0, .25, .5, .75, 1].map((ratio, index) => {
            const gy = top + ratio * innerH;
            const gv = hrHi - ratio * (hrHi - hrLo);
            return <g key={`h-${index}`}><line x1={left} y1={gy} x2={width - right} y2={gy} stroke="var(--line)"/><text x={left - 9} y={gy + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(gv)}</text></g>;
          })}
          {[0, .25, .5, .75, 1].map((ratio, index) => {
            const gx = left + ratio * innerW;
            const gv = paceHi - ratio * (paceHi - paceLo);
            return <g key={`v-${index}`}><line x1={gx} y1={top} x2={gx} y2={height - bottom} stroke="var(--line)"/><text x={gx} y={height - 18} textAnchor="middle" fontSize="10" fill="var(--muted)">{fmtPace(gv).replace('/km', '')}</text></g>;
          })}
          <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="var(--text)" strokeWidth="1.2"/>
          <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="var(--text)" strokeWidth="1.2"/>
          {runs.map(row => <circle key={`${row.id}`} cx={x(row.avgPaceSecPerKm!)} cy={y(row.avgHeartRate!)} r="4.5" fill="var(--accent)"><title>{row.date} · {fmtPace(row.avgPaceSecPerKm)} · {Math.round(row.avgHeartRate!)} bpm</title></circle>)}
          <text x={(left + width - right) / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">평균 페이스</text>
          <text x="14" y={(top + height - bottom) / 2} textAnchor="middle" fontSize="10" fill="var(--muted)" transform={`rotate(-90 14 ${(top + height - bottom) / 2})`}>평균 심박</text>
        </svg>
      </div>
      <p className="motion-enhancement-note">같은 구간에서 페이스가 빨라질 때 평균 심박이 어떻게 변하는지 확인하는 용도의 그래프입니다. 데이터가 많을수록 점이 겹칠 수 있습니다.</p>
    </section>
  );
}

export default function MotionLogEnhancements() {
  const [mounted, setMounted] = useState(false);
  const [records, setRecords] = useState<Activity[]>([]);
  const [targets, setTargets] = useState<Targets>({ titleHost: null, sidebarFoot: null, dashboardStats: null, analysisStats: null, analysisView: false });

  useEffect(() => {
    setMounted(true);

    const loadRecords = async () => {
      const local = readLocal();
      try {
        const response = await fetch(DATA_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error('remote data error');
        const raw = await response.json();
        const remote = Array.isArray(raw) ? raw.map(normalize).filter(Boolean) as Activity[] : [];
        setRecords(mergeById(local, remote));
      } catch {
        setRecords(local);
      }
    };

    void loadRecords();
    const timer = window.setInterval(() => setRecords(readLocal()), 3000);

    const refreshTargets = () => {
      const content = document.querySelector('.content');
      const title = document.querySelector('.topbar h1')?.textContent?.trim() || '';
      const hero = document.querySelector('.hero');
      const stats = Array.from(document.querySelectorAll('.content .stats-grid')) as HTMLElement[];
      const next: Targets = {
        titleHost: document.querySelector('.topbar > div:first-child'),
        sidebarFoot: document.querySelector('.sidebar-foot'),
        dashboardStats: hero ? stats[0] || null : null,
        analysisStats: !hero && title === '분석' ? stats[0] || null : null,
        analysisView: !hero && title === '분석',
      };
      setTargets(current => (
        current.titleHost === next.titleHost &&
        current.sidebarFoot === next.sidebarFoot &&
        current.dashboardStats === next.dashboardStats &&
        current.analysisStats === next.analysisStats &&
        current.analysisView === next.analysisView
      ) ? current : next);
      if (content) content.setAttribute('data-motion-version', APP_VERSION);
    };

    refreshTargets();
    const observer = new MutationObserver(refreshTargets);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const exportVersionedBackup = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button || button.textContent?.trim() !== 'JSON 내보내기') return;
      let parsed: unknown;
      try {
        const raw = localStorage.getItem(STORAGE);
        parsed = raw ? JSON.parse(raw) : null;
        if (!Array.isArray(parsed)) return;
      } catch {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const today = dayKey(new Date());
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `motion-log-${APP_VERSION.toLowerCase()}-backup-${today}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    };
    document.addEventListener('click', exportVersionedBackup, true);
    return () => document.removeEventListener('click', exportVersionedBackup, true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {targets.titleHost && createPortal(<div className="motion-version-badge">{APP_VERSION}<span>{APP_VERSION_TITLE}</span></div>, targets.titleHost)}
      {targets.sidebarFoot && createPortal(<div className="motion-sidebar-version">{APP_VERSION} · {APP_VERSION_TITLE}</div>, targets.sidebarFoot)}
      {targets.dashboardStats && createPortal(<DashboardEnhancements records={records} />, targets.dashboardStats)}
      {targets.analysisStats && targets.analysisView && createPortal(<EfficiencyChart records={records} />, targets.analysisStats)}
    </>
  );
}
