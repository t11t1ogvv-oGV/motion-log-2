'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';

type ActivityType = '러닝'|'걷기'|'자전거'|'등산'|'수영'|'기타';
type Activity = {
  id:string; date:string; type:ActivityType; distanceKm:number; durationSec:number;
  calories?:number; steps?:number; avgPaceSecPerKm?:number; bestPaceSecPerKm?:number;
  avgSpeedKmh?:number; bestSpeedKmh?:number; elevationGainM?:number; elevationLossM?:number; minAltitudeM?:number; maxAltitudeM?:number; uphillDistanceKm?:number; downhillDistanceKm?:number;
  avgHeartRate?:number; maxHeartRate?:number; avgCadence?:number; maxCadence?:number; vo2max?:number;
  note?:string; source?:string; deletedAt?:string;
};
type Tab='home'|'records'|'analysis'|'trash'|'more';
type SnapshotType = '러닝'|'등산';
type TrendMetric = 'distance'|'pace'|'heartRate'|'cadence'|'speed'|'duration'|'calories'|'elevationGain'|'elevationLoss';
type ChartPoint = {date:string; value:number};

const STORAGE='motion-log-records-v4';
const THEME='motion-log-theme-v4';
const DATA_URL='/motion-log-data-test.json?v=8';
const TYPES:ActivityType[]=['러닝','걷기','자전거','등산','수영','기타'];
const SNAPSHOT_TYPES:SnapshotType[]=['러닝','등산'];
const fmtDate=(d:string)=>{const x=new Date(`${d}T00:00:00`);return `${x.getMonth()+1}월 ${x.getDate()}일`};
const fmtFullDate=(d:string)=>{const x=new Date(`${d}T00:00:00`);return `${x.getFullYear()}.${String(x.getMonth()+1).padStart(2,'0')}.${String(x.getDate()).padStart(2,'0')}`};
const fmtShortDate=(d:string)=>{const x=new Date(`${d}T00:00:00`);return `${x.getMonth()+1}/${x.getDate()}`};
const fmtDur=(s=0)=>{const n=Math.max(0,Math.round(s)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),r=n%60;return h?`${h}시간 ${m}분`:`${m}분 ${String(r).padStart(2,'0')}초`};
const fmtPace=(s?:number)=>{if(!Number.isFinite(s)||!s||s<0)return '—';const n=Math.max(0,Math.round(s));return `${Math.floor(n/60)}'${String(n%60).padStart(2,'0')}\"/km`};
const avg=(v:number[])=>{const a=v.filter(Number.isFinite);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0};
const sum=(a:Activity[],k:'distanceKm'|'durationSec'|'calories')=>a.reduce((s,x)=>s+(Number(x[k])||0),0);
const sumField=(a:Activity[],get:(x:Activity)=>number)=>a.reduce((s,x)=>s+(Number(get(x))||0),0);
const dayKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays=(d:string,n:number)=>{const x=new Date(`${d}T00:00:00`);x.setDate(x.getDate()+n);return dayKey(x)};
const validType=(v:unknown):v is ActivityType=>TYPES.includes(v as ActivityType);
const normalizeRecord=(row:any,i:number):Activity=>{if(!row||typeof row!=='object')throw new Error(`기록 ${i+1} 형식 오류`);if(!row.id||!row.date||!validType(row.type))throw new Error(`기록 ${i+1} 필수값 오류`);const distance=Number(row.distanceKm),duration=Number(row.durationSec);if(!Number.isFinite(distance)||distance<0||!Number.isFinite(duration)||duration<0)throw new Error(`기록 ${i+1} 거리/시간 오류`);return {...row,id:String(row.id),date:String(row.date),type:row.type,distanceKm:distance,durationSec:duration,source:row.source||'Samsung Health'};};

const TREND_OPTIONS:Record<'전체'|SnapshotType,{metric:TrendMetric,label:string}[]>= {
 '전체':[
  {metric:'distance',label:'거리'},
  {metric:'duration',label:'시간'},
  {metric:'heartRate',label:'심박'},
  {metric:'calories',label:'칼로리'}
 ],
 '러닝':[
  {metric:'distance',label:'거리'},
  {metric:'pace',label:'페이스'},
  {metric:'heartRate',label:'심박'},
  {metric:'cadence',label:'케이던스'},
  {metric:'speed',label:'평균 속도'},
  {metric:'calories',label:'칼로리'}
 ],
 '등산':[
  {metric:'distance',label:'거리'},
  {metric:'elevationGain',label:'상승고도'},
  {metric:'elevationLoss',label:'하강고도'},
  {metric:'heartRate',label:'심박'},
  {metric:'duration',label:'시간'},
  {metric:'calories',label:'칼로리'}
 ]
};

const metricValue=(a:Activity,m:TrendMetric)=>{
 if(m==='distance')return a.distanceKm;
 if(m==='pace')return a.avgPaceSecPerKm;
 if(m==='heartRate')return a.avgHeartRate;
 if(m==='cadence')return a.avgCadence;
 if(m==='speed')return a.avgSpeedKmh;
 if(m==='duration')return a.durationSec/60;
 if(m==='calories')return a.calories;
 if(m==='elevationGain')return a.elevationGainM;
 return a.elevationLossM;
};

const aggregateTrend=(activities:Activity[],metric:TrendMetric):ChartPoint[]=>{
 const grouped=new Map<string,number[]>();
 activities.forEach(a=>{const value=metricValue(a,metric);if(!Number.isFinite(value))return;const list=grouped.get(a.date)||[];list.push(Number(value));grouped.set(a.date,list)});
 return [...grouped.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,values])=>({date,value:['distance','duration','calories','elevationGain','elevationLoss'].includes(metric)?values.reduce((s,v)=>s+v,0):values.reduce((s,v)=>s+v,0)/values.length}));
};

const formatTrendValue=(metric:TrendMetric,value:number)=>{
 if(metric==='pace')return fmtPace(value);
 if(metric==='distance')return `${value.toFixed(2)} km`;
 if(metric==='duration')return `${Math.round(value)}분`;
 if(metric==='heartRate')return `${Math.round(value)} bpm`;
 if(metric==='cadence')return `${Math.round(value)} spm`;
 if(metric==='speed')return `${value.toFixed(1)} km/h`;
 if(metric==='calories')return `${Math.round(value)} kcal`;
 return `${Math.round(value)} m`;
};

function Metric({label,value,unit}:{label:string;value:string|number;unit?:string}){return <div className="metric"><span>{label}</span><strong>{value}{unit&&<small>{unit}</small>}</strong></div>}
function RecordCard({a,onOpen,onTrash}:{a:Activity;onOpen:()=>void;onTrash:()=>void}){return <article className="record-card" onClick={onOpen}><div><div className="record-date"><b>{fmtDate(a.date)}</b><span>{a.type}</span></div><div className="record-main"><b>{a.distanceKm.toFixed(2)}<small> km</small></b><span>{fmtDur(a.durationSec)} · {fmtPace(a.avgPaceSecPerKm)}</span></div></div><div className="record-tags">{a.avgHeartRate&&<span style={{fontSize:10,color:'var(--text)',fontWeight:650,border:'1px solid var(--line)'}}>심박 {Math.round(a.avgHeartRate)} bpm</span>}{a.avgCadence&&<span style={{fontSize:10,color:'var(--text)',fontWeight:650,border:'1px solid var(--line)'}}>케이던스 {Math.round(a.avgCadence)} spm</span>}{a.calories&&<span style={{fontSize:10,color:'var(--text)',fontWeight:650,border:'1px solid var(--line)'}}>{Math.round(a.calories)} kcal</span>}{a.vo2max&&<span style={{fontSize:10,color:'var(--text)',fontWeight:650,border:'1px solid var(--line)'}}>VO₂ {a.vo2max}</span>}</div><button className="icon-button" aria-label="휴지통 이동" onClick={e=>{e.stopPropagation();onTrash()}}>×</button></article>}

function TrendChart({points,metric}:{points:ChartPoint[];metric:TrendMetric}){
 if(!points.length)return <div className="empty" style={{marginTop:10,padding:28}}>선택한 기간에 표시할 데이터가 없습니다.</div>;
 const width=760,height=290,left=46,right=18,top=22,bottom=38,innerW=width-left-right,innerH=height-top-bottom;
 const values=points.map(p=>p.value);const rawMin=Math.min(...values),rawMax=Math.max(...values);const pad=rawMin===rawMax?Math.max(rawMin*0.08,1):Math.max((rawMax-rawMin)*0.12,metric==='pace'?5:0.5);const min=rawMin-pad,max=rawMax+pad;
 const x=(i:number)=>left+(points.length===1?innerW/2:(i/(points.length-1))*innerW);const y=(v:number)=>top+(1-(v-min)/(max-min))*innerH;
 const line=points.map((p,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
 const labelIndexes=points.length<=5?points.map((_,i)=>i):[0,Math.floor((points.length-1)*.25),Math.floor((points.length-1)*.5),Math.floor((points.length-1)*.75),points.length-1];
 const grid=[0,.25,.5,.75,1];
 return <div style={{marginTop:12}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:5}}><span style={{fontSize:9,color:'var(--muted)'}}>운동일 기준 추이</span><span style={{fontSize:10,color:'var(--text)',fontWeight:700}}>{formatTrendValue(metric,points[points.length-1].value)}</span></div><div style={{overflow:'hidden',borderRadius:12,background:'var(--surface2)',border:'1px solid var(--line)'}}><svg viewBox={`0 0 ${width} ${height}`} style={{width:'100%',height:'auto',display:'block'}} role="img" aria-label={`${metric} 추이 그래프`}>
 {grid.map((g,i)=>{const yy=top+g*innerH;const value=max-g*(max-min);return <g key={i}><line x1={left} y1={yy} x2={width-right} y2={yy} stroke="var(--line)" strokeWidth="1"/><text x={left-8} y={yy+3} textAnchor="end" fontSize="10" fill="var(--muted)">{formatTrendValue(metric,value).replace(/ \/km| km|분| bpm| spm| km\/h| kcal| m/g,'')}</text></g>})}
 <path d={line} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
 {points.map((p,i)=><circle key={p.date} cx={x(i)} cy={y(p.value)} r={points.length>80?1.8:3.5} fill="var(--accent)"/>) }
 {labelIndexes.map(i=><text key={i} x={x(i)} y={height-13} textAnchor={i===0?'start':i===points.length-1?'end':'middle'} fontSize="10" fill="var(--muted)">{fmtShortDate(points[i].date)}</text>)}
 </svg></div></div>;
}

function RunningEfficiency({activities}:{activities:Activity[]}){
 const points=activities.filter(a=>a.type==='러닝'&&Number.isFinite(a.avgPaceSecPerKm)&&Number.isFinite(a.avgHeartRate)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-20);
 if(!points.length)return <div className="empty" style={{marginTop:10,padding:24}}>심박과 페이스가 함께 있는 러닝 기록이 없습니다.</div>;
 const w=720,h=250,l=42,r=14,t=18,b=32,iw=w-l-r,ih=h-t-b;
 const paces=points.map(a=>a.avgPaceSecPerKm||0),hrs=points.map(a=>a.avgHeartRate||0),pmin=Math.min(...paces),pmax=Math.max(...paces),hmin=Math.min(...hrs),hmax=Math.max(...hrs);
 const xp=(v:number)=>l+(v-pmin)/(Math.max(1,pmax-pmin))*iw; const yh=(v:number)=>t+(1-(v-hmin)/(Math.max(1,hmax-hmin)))*ih;
 return <div style={{marginTop:12}}><div className="eff-summary">최근 {points.length}회 · 페이스가 빠를수록 왼쪽, 심박이 낮을수록 아래</div><div className="eff-chart"><svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',display:'block'}} role="img" aria-label="러닝 페이스와 평균 심박 산점도">{[0,.25,.5,.75,1].map((g,i)=><line key={i} x1={l} y1={t+g*ih} x2={w-r} y2={t+g*ih} stroke="var(--line)" strokeWidth="1"/>)}{points.map(a=><circle key={a.id} cx={xp(a.avgPaceSecPerKm||0)} cy={yh(a.avgHeartRate||0)} r="4" fill="var(--accent)"/>)}<line x1={l} y1={h-b} x2={w-r} y2={h-b} stroke="var(--muted)"/><line x1={l} y1={t} x2={l} y2={h-b} stroke="var(--muted)"/></svg></div><div className="eff-caption">최근 기록: {fmtPace(points[points.length-1].avgPaceSecPerKm)} · {Math.round(points[points.length-1].avgHeartRate||0)} bpm</div></div>;
}
function ComparisonItem({label,current,previous,formatter}:{label:string;current:number;previous:number;formatter:(v:number)=>string}){const delta=current-previous;return <div style={{background:'var(--surface2)',borderRadius:10,padding:'10px 11px',border:'1px solid var(--line)'}}><span style={{display:'block',fontSize:8,color:'var(--muted)'}}>{label}</span><b style={{display:'block',fontSize:14,marginTop:4,color:'var(--text)'}}>{formatter(current)}</b><span style={{display:'block',fontSize:8,color:'var(--muted)',marginTop:3}}>이전 {formatter(previous)} · 변화 {delta>0?'+':''}{formatter(delta)}</span></div>}

export default function Home(){
 const [tab,setTab]=useState<Tab>('home');
 const [acts,setActs]=useState<Activity[]>([]);
 const [selected,setSelected]=useState<Activity|null>(null);
 const [confirm,setConfirm]=useState<{kind:'trash'|'restore'|'delete';id:string}|null>(null);
 const [dark,setDark]=useState(false);
 const [period,setPeriod]=useState<7|30|90|365>(30);
 const [query,setQuery]=useState('');
 const [typeFilter,setTypeFilter]=useState<'전체'|ActivityType>('전체');
 const [sort,setSort]=useState<'latest'|'distance'|'pace'>('latest');
 const [monthOffset,setMonthOffset]=useState(0);
 const [analysisType,setAnalysisType]=useState<'전체'|ActivityType>('전체');
 const [analysisView,setAnalysisView]=useState<'workout'|'report'>('workout');
 const [customMode,setCustomMode]=useState(false);
 const [customStart,setCustomStart]=useState('');
 const [customEnd,setCustomEnd]=useState('');
 const [syncStatus,setSyncStatus]=useState('자동 동기화 대기');
 const [importStatus,setImportStatus]=useState('');
 const [calendarDate,setCalendarDate]=useState('');
 const [snapshotType,setSnapshotType]=useState<SnapshotType>('러닝');
 const [trendMetric,setTrendMetric]=useState<TrendMetric>('distance');

 const mergeRecords=(local:Activity[],remote:Activity[])=>{const localById=new Map(local.map(a=>[a.id,a]));const merged=remote.map(a=>{const l=localById.get(a.id);return l?{...a,...(l.note?{note:l.note}:{}),...(l.deletedAt?{deletedAt:l.deletedAt}:{} )}:a});const remoteIds=new Set(remote.map(a=>a.id));for(const a of local)if(!remoteIds.has(a.id))merged.push(a);return merged};
 const fetchRemote=async()=>{const res=await fetch(DATA_URL,{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);const raw=await res.json();if(!Array.isArray(raw)||!raw.length)throw new Error('서버 데이터가 비어 있습니다.');return raw.map(normalizeRecord)};
 const syncNow=async()=>{setSyncStatus('GitHub 데이터 확인 중…');try{const remote=await fetchRemote();const merged=mergeRecords(acts.slice(),remote);setActs(merged);setSyncStatus(`GitHub ${remote.length}건 · 현재 ${merged.length}건`)}catch(e){setSyncStatus(`동기화 실패: ${e instanceof Error?e.message:String(e)}`)}};

 useEffect(()=>{try{const raw=localStorage.getItem(STORAGE);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))setActs(parsed.map(normalizeRecord))}const t=localStorage.getItem(THEME);if(t)setDark(t==='dark')}catch{setActs([])}},[]);
 useEffect(()=>{localStorage.setItem(STORAGE,JSON.stringify(acts));localStorage.setItem(THEME,dark?'dark':'light')},[acts,dark]);
 useEffect(()=>{let cancelled=false;syncOnMount();async function syncOnMount(){try{const remote=await fetchRemote();if(cancelled)return;const raw=localStorage.getItem(STORAGE);let local:Activity[]=[];if(raw){try{const p=JSON.parse(raw);if(Array.isArray(p))local=p.map(normalizeRecord)}catch{}}const merged=mergeRecords(local,remote);if(!cancelled){setActs(merged);setSyncStatus(`GitHub ${remote.length}건 · 현재 ${merged.length}건`)}}catch{if(!cancelled)setSyncStatus('자동 동기화 실패 — 로컬 기록 유지')}}return()=>{cancelled=true}},[]);

 const active=useMemo(()=>acts.filter(a=>!a.deletedAt).sort((a,b)=>b.date.localeCompare(a.date)),[acts]);
 const trash=useMemo(()=>acts.filter(a=>a.deletedAt).sort((a,b)=>String(b.deletedAt).localeCompare(String(a.deletedAt))),[acts]);
 const latest=active[0];
 const now=new Date();
 const today=dayKey(now);
 const year=now.getFullYear();
 const yearActivities=active.filter(a=>a.date.startsWith(String(year)));
 const week=active.filter(a=>{const d=new Date();d.setDate(d.getDate()-6);return a.date>=dayKey(d)});
 const since=useMemo(()=>{const d=new Date();d.setDate(d.getDate()-(period-1));return dayKey(d)},[period]);
 const scoped=active.filter(a=>a.date>=since);
 const analysisScoped=active.filter(a=>{const typeOk=analysisType==='전체'||a.type===analysisType;if(customMode&&customStart&&customEnd)return typeOk&&a.date>=customStart&&a.date<=customEnd;return typeOk&&a.date>=since});
 const allDist=sum(active,'distanceKm');
 const weekDist=sum(week,'distanceKm');
 const weekAvgPace=avg(week.map(a=>a.avgPaceSecPerKm||NaN));
 const yearDist=sum(yearActivities,'distanceKm');
 const runs=active.filter(a=>a.type==='러닝');
 const hikes=active.filter(a=>a.type==='등산');
 const longestRun=runs.slice().sort((a,b)=>b.distanceKm-a.distanceKm)[0];
 const fastestRun=runs.filter(a=>a.avgPaceSecPerKm).slice().sort((a,b)=>(a.avgPaceSecPerKm||99999)-(b.avgPaceSecPerKm||99999))[0];
 const bestSpeedRun=runs.filter(a=>a.avgSpeedKmh).slice().sort((a,b)=>(b.avgSpeedKmh||0)-(a.avgSpeedKmh||0))[0];
 const currentMonth=useMemo(()=>{const d=new Date(year,now.getMonth()+monthOffset,1);return {year:d.getFullYear(),month:d.getMonth()}},[year,monthOffset,now.getMonth()]);
 const currentMonthActivities=useMemo(()=>{const prefix=`${currentMonth.year}-${String(currentMonth.month+1).padStart(2,'0')}-`;return active.filter(a=>a.date.startsWith(prefix))},[active,currentMonth]);
 const currentMonthDist=sum(currentMonthActivities,'distanceKm');
 const currentMonthPace=avg(currentMonthActivities.map(a=>a.avgPaceSecPerKm||NaN));
 const currentMonthTime=sum(currentMonthActivities,'durationSec');
 const monthDays=useMemo(()=>{const first=new Date(currentMonth.year,currentMonth.month,1);const last=new Date(currentMonth.year,currentMonth.month+1,0);const start=(first.getDay()+6)%7;const days:number[]=[];for(let i=0;i<start;i++)days.push(0);for(let d=1;d<=last.getDate();d++)days.push(d);return days},[currentMonth]);
 const daySet=useMemo(()=>new Set(active.map(a=>a.date)),[active]);
 let streak=0;{const d=new Date();while(daySet.has(dayKey(d))){streak+=1;d.setDate(d.getDate()-1)}}
 const filtered=useMemo(()=>active.filter(a=>(typeFilter==='전체'||a.type===typeFilter)&&(query.trim()===''||a.type.includes(query.trim())||fmtFullDate(a.date).includes(query.trim())||a.date.includes(query.trim())||String(a.note||'').includes(query.trim()))).sort((a,b)=>sort==='distance'?b.distanceKm-a.distanceKm:sort==='pace'?(a.avgPaceSecPerKm||99999)-(b.avgPaceSecPerKm||99999):b.date.localeCompare(a.date)),[active,typeFilter,query,sort]);
 const monthly=Array.from({length:12},(_,i)=>({m:i+1,d:yearActivities.filter(a=>new Date(`${a.date}T00:00:00`).getMonth()===i).reduce((s,a)=>s+a.distanceKm,0)}));
 const typeCounts=useMemo(()=>{const t:Record<ActivityType,{n:number;d:number}>={러닝:{n:0,d:0},걷기:{n:0,d:0},자전거:{n:0,d:0},등산:{n:0,d:0},수영:{n:0,d:0},기타:{n:0,d:0}};analysisScoped.forEach(a=>{t[a.type].n+=1;t[a.type].d+=a.distanceKm});return t},[analysisScoped]);
 const calendarActivities=useMemo(()=>active.filter(a=>a.date===calendarDate),[active,calendarDate]);
 const snapshotActivities=snapshotType==='러닝'?runs:hikes;
 const snapshotLongest=snapshotActivities.slice().sort((a,b)=>b.distanceKm-a.distanceKm)[0];
 const snapshotBestPace=snapshotType==='러닝'?fastestRun:undefined;
 const snapshotBestSpeed=snapshotType==='러닝'?bestSpeedRun:undefined;
 const snapshotAvgHr=avg(snapshotActivities.map(a=>a.avgHeartRate||NaN));
 const snapshotAvgCadence=avg(snapshotActivities.map(a=>a.avgCadence||NaN));
 const snapshotElevationGain=sumField(snapshotActivities,a=>a.elevationGainM||0);
 const snapshotElevationLoss=sumField(snapshotActivities,a=>a.elevationLossM||0);
 const snapshotCalories=sum(snapshotActivities,'calories');
 const currentAnalysisStart=useMemo(()=>customMode&&customStart&&customEnd&&customStart<=customEnd?customStart:since,[customMode,customStart,customEnd,since]);
 const currentAnalysisEnd=useMemo(()=>customMode&&customStart&&customEnd&&customStart<=customEnd?customEnd:today,[customMode,customStart,customEnd,today]);
 const rangeDays=Math.max(1,Math.round((new Date(`${currentAnalysisEnd}T00:00:00`).getTime()-new Date(`${currentAnalysisStart}T00:00:00`).getTime())/86400000)+1);
 const previousAnalysisEnd=addDays(currentAnalysisStart,-1);
 const previousAnalysisStart=addDays(previousAnalysisEnd,-(rangeDays-1));
 const previousAnalysisScoped=active.filter(a=>{const typeOk=analysisType==='전체'||a.type===analysisType;return typeOk&&a.date>=previousAnalysisStart&&a.date<=previousAnalysisEnd});
 const trendPoints=useMemo(()=>aggregateTrend(analysisScoped,trendMetric),[analysisScoped,trendMetric]);
 const trendOptions=TREND_OPTIONS[analysisType==='러닝'||analysisType==='등산'?analysisType:'전체'];
 const applyConfirm=()=>{if(!confirm)return;setActs(prev=>confirm.kind==='delete'?prev.filter(a=>a.id!==confirm.id):prev.map(a=>a.id===confirm.id?(confirm.kind==='trash'?{...a,deletedAt:new Date().toISOString()}:{...a,deletedAt:undefined}):a));setSelected(null);setConfirm(null)};
 const exportJson=()=>{const b=new Blob([JSON.stringify(acts,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`motion-log-backup-${today}.json`;a.click();URL.revokeObjectURL(u)};
 const exportCsv=()=>{const cols=['id','date','type','distanceKm','durationSec','calories','steps','avgPaceSecPerKm','bestPaceSecPerKm','avgSpeedKmh','bestSpeedKmh','elevationGainM','elevationLossM','avgHeartRate','maxHeartRate','avgCadence','maxCadence','vo2max','minAltitudeM','maxAltitudeM','uphillDistanceKm','downhillDistanceKm','note','source'];const esc=(v:any)=>`\"${String(v??'').replaceAll('\\"','\\"\\"')}\"`;const body=[cols.join(','),...active.map(a=>cols.map(c=>esc((a as any)[c])).join(','))].join('\n');const b=new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`motion-log-${today}.csv`;a.click();URL.revokeObjectURL(u)};
 const importJson=(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;setImportStatus('백업 파일 확인 중…');const r=new FileReader();r.onload=()=>{try{const parsed=JSON.parse(String(r.result));if(!Array.isArray(parsed))throw new Error('배열 형식이 아닙니다.');const incoming=parsed.map(normalizeRecord);const merged=mergeRecords(acts,incoming);setActs(merged);setImportStatus(`복원 완료 · ${incoming.length}건 확인 / 현재 ${merged.length}건`)}catch(err){setImportStatus(`복원 실패: ${err instanceof Error?err.message:String(err)}`)}};r.readAsText(file);e.target.value=''};
 const jumpCalendarDay=(key:string)=>{setCalendarDate(key);setQuery(key);setTypeFilter('전체');setTab('records')};
 const title=tab==='home'?'운동 대시보드':tab==='records'?'운동 기록':tab==='analysis'?'분석':tab==='trash'?'휴지통':'설정';
 return <main className={dark?'app dark':'app'}>
  <aside className="sidebar"><div className="brand"><span>MOTION</span> LOG</div><div className="brand-sub">GALAXY WATCH FITNESS ARCHIVE</div><nav>{[['home','대시보드'],['records','운동 기록'],['analysis','분석'],['trash',`휴지통${trash.length?` (${trash.length})`:''}`],['more','설정']].map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k as Tab)}>{l}</button>)}</nav><div className="sidebar-foot"><button className="ghost" onClick={()=>setDark(v=>!v)}>{dark?'☼ 라이트 모드':'◐ 다크 모드'}</button><small>Samsung Health → Motion Log</small></div></aside>
  <section className="content"><header className="topbar"><div><div className="eyebrow">MOTION LOG</div><h1>{title}</h1></div><div className="status-pill">{active.length.toLocaleString()} RECORDS</div></header>
   {tab==='home'&&<>
    <section className="dashboard-calendar panel">
      <div className="eyebrow">WORKOUT CALENDAR</div>
      <div className="section-head" style={{marginTop:0}}>
        <div><h3>{currentMonth.year}년 {currentMonth.month+1}월</h3><span className="calendar-summary">{currentMonthActivities.length}회 운동 · {currentMonthDist.toFixed(1)} km</span></div>
        <div style={{display:'flex',gap:5}}><button className="secondary" onClick={()=>setMonthOffset(v=>v-1)}>←</button><button className="secondary" onClick={()=>setMonthOffset(0)}>오늘</button><button className="secondary" onClick={()=>setMonthOffset(v=>v+1)}>→</button></div>
      </div>
      <div className="workout-calendar-grid">{['월','화','수','목','금','토','일'].map(d=><div key={d} className="calendar-weekday">{d}</div>)}{monthDays.map((d,i)=>{const key=d?dayKey(new Date(currentMonth.year,currentMonth.month,d)):'',has=!!(d&&daySet.has(key));return <button key={i} onClick={()=>d&&jumpCalendarDay(key)} aria-label={d?`${key} 운동 보기`:undefined} className={has?'calendar-day active':'calendar-day'}>{d||''}</button>})}</div>
      {calendarDate&&<div className="detail-note" style={{marginTop:10}}>선택 날짜 {fmtFullDate(calendarDate)} · {calendarActivities.length}회 · {sum(calendarActivities,'distanceKm').toFixed(2)} km</div>}
    </section>
    <section className="home-week-summary panel">
      <div className="section-head" style={{marginTop:0}}><div><div className="eyebrow">THIS WEEK</div><h3>이번 주</h3></div></div>
      <div className="home-week-grid"><Metric label="운동" value={week.length} unit="회"/><Metric label="거리" value={weekDist.toFixed(1)} unit="km"/><Metric label="평균 페이스" value={weekAvgPace?fmtPace(weekAvgPace):'—'}/></div>
    </section>
    <div className="section-head home-recent-head"><div><div className="eyebrow">RECENT</div><h3>최근 운동</h3></div><button className="text-btn" onClick={()=>setTab('records')}>전체 보기 →</button></div>
    <div className="records-list home-recent-list">{active.slice(0,5).map(a=><article className="home-recent-card" key={a.id} onClick={()=>setSelected(a)}>
      <div className="home-recent-main"><div className="record-date"><b>{fmtDate(a.date)}</b><span>{a.type}</span></div><div className="record-main"><b>{a.distanceKm.toFixed(2)}<small> km</small></b><span>{fmtDur(a.durationSec)} · {fmtPace(a.avgPaceSecPerKm)}</span></div></div>
      <div className="record-tags">{a.avgHeartRate&&<span>심박 {Math.round(a.avgHeartRate)}</span>}{a.avgCadence&&<span>케이던스 {Math.round(a.avgCadence)}</span>}{a.calories&&<span>{Math.round(a.calories)} kcal</span>}</div>
      <button className="icon-button" aria-label="휴지통 이동" onClick={e=>{e.stopPropagation();setConfirm({kind:'trash',id:a.id})}}>×</button>
    </article>)}</div>
   </>}
   {tab==='records'&&<><div className="section-head"><div><div className="eyebrow">ARCHIVE</div><h3>운동 기록</h3></div><span className="count-pill">총 {active.length.toLocaleString()}회 · {allDist.toFixed(1)} km</span></div><div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,marginBottom:10}}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="날짜·운동종류·메모 검색" style={{width:'100%',padding:'11px 12px',border:'1px solid var(--line)',borderRadius:11,background:'var(--surface)',color:'var(--text)',outline:'none'}}/><select value={sort} onChange={e=>setSort(e.target.value as 'latest'|'distance'|'pace')} style={{padding:'0 10px',border:'1px solid var(--line)',borderRadius:11,background:'var(--surface)',color:'var(--text)'}}><option value="latest">최신순</option><option value="distance">거리순</option><option value="pace">페이스순</option></select></div><div className="period-tabs">{(['전체',...TYPES] as const).map(t=><button key={t} className={typeFilter===t?'active':''} onClick={()=>setTypeFilter(t)}>{t}</button>)}</div>{calendarDate&&<div className="trash-note">선택 날짜: <b>{fmtFullDate(calendarDate)}</b> · 검색창에서 날짜를 지우면 전체 기록을 다시 볼 수 있습니다.</div>}<div className="records-list">{filtered.map(a=><RecordCard key={a.id} a={a} onOpen={()=>setSelected(a)} onTrash={()=>setConfirm({kind:'trash',id:a.id})}/>)}</div>{!filtered.length&&<div className="empty">조건에 맞는 기록이 없습니다.</div>}</>}
   {tab==='analysis'&&<>
    <div className="analysis-switch"><button className={analysisView==='workout'?'active':''} onClick={()=>setAnalysisView('workout')}>운동 분석</button><button className={analysisView==='report'?'active':''} onClick={()=>setAnalysisView('report')}>통계·리포트</button></div>
    {analysisView==='workout'&&<>
      <div className="period-tabs">{([7,30,90,365] as const).map(p=><button key={p} className={!customMode&&period===p?'active':''} onClick={()=>{setCustomMode(false);setPeriod(p)}}>{p===365?'1년':`${p}일`}</button>)}<button className={customMode?'active':''} onClick={()=>setCustomMode(true)}>기간 직접 지정</button></div>
      <div className="panel" style={{marginBottom:12}}><div className="section-head" style={{marginTop:0}}><div><div className="eyebrow">ANALYSIS FILTER</div><h3>분석 대상</h3></div><select value={analysisType} onChange={e=>{const v=e.target.value as '전체'|ActivityType;setAnalysisType(v);setTrendMetric('distance')}} style={{padding:'9px 10px',border:'1px solid var(--line)',borderRadius:10,background:'var(--surface)',color:'var(--text)'}}><option value="전체">전체 종목</option><option value="러닝">러닝</option><option value="등산">등산</option></select></div>{customMode&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}><label style={{fontSize:9,color:'var(--muted)'}}>시작일<input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{display:'block',width:'100%',marginTop:5,padding:'10px',border:'1px solid var(--line)',borderRadius:10,background:'var(--surface)',color:'var(--text)'}}/></label><label style={{fontSize:9,color:'var(--muted)'}}>종료일<input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{display:'block',width:'100%',marginTop:5,padding:'10px',border:'1px solid var(--line)',borderRadius:10,background:'var(--surface)',color:'var(--text)'}}/></label></div>}{customMode&&customStart&&customEnd&&customStart>customEnd&&<div className="detail-note">시작일이 종료일보다 늦습니다.</div>}</div>
      <section className="stats-grid"><Metric label="기간 운동" value={analysisScoped.length} unit="회"/><Metric label="기간 거리" value={sum(analysisScoped,'distanceKm').toFixed(1)} unit="km"/><Metric label="기간 시간" value={fmtDur(sum(analysisScoped,'durationSec'))}/><Metric label="평균 심박" value={avg(analysisScoped.map(a=>a.avgHeartRate||NaN))||'—'} unit={avg(analysisScoped.map(a=>a.avgHeartRate||NaN))?'bpm':undefined}/><Metric label="평균 케이던스" value={avg(analysisScoped.map(a=>a.avgCadence||NaN))||'—'} unit={avg(analysisScoped.map(a=>a.avgCadence||NaN))?'spm':undefined}/><Metric label="칼로리" value={Math.round(sum(analysisScoped,'calories')).toLocaleString()} unit="kcal"/></section>
      <section className="panel analysis-section"><div className="eyebrow">RUNNING EFFICIENCY</div><h3>페이스 ↔ 심박 효율</h3><p className="analysis-hint">러닝 기록을 기준으로 페이스와 평균 심박의 관계를 확인합니다.</p><RunningEfficiency activities={analysisScoped}/></section>
      <section className="panel analysis-section"><div className="section-head" style={{marginTop:0}}><div><div className="eyebrow">TREND CHART</div><h3>운동 추세</h3><span className="analysis-hint">{fmtFullDate(currentAnalysisStart)} — {fmtFullDate(currentAnalysisEnd)} · 운동일 기준</span></div><div className="period-tabs" style={{marginBottom:0,justifyContent:'flex-end',flexWrap:'wrap'}}>{trendOptions.map(o=><button key={o.metric} className={trendMetric===o.metric?'active':''} onClick={()=>setTrendMetric(o.metric)}>{o.label}</button>)}</div></div><TrendChart points={trendPoints} metric={trendMetric}/></section>
      <section className="panel analysis-section"><div className="eyebrow">PERIOD COMPARISON</div><h3>이전 기간과 비교</h3><span className="analysis-hint">현재 {fmtFullDate(currentAnalysisStart)} — {fmtFullDate(currentAnalysisEnd)} · 이전 {fmtFullDate(previousAnalysisStart)} — {fmtFullDate(previousAnalysisEnd)}</span><div className="mini-grid" style={{marginTop:12}}><ComparisonItem label="운동 횟수" current={analysisScoped.length} previous={previousAnalysisScoped.length} formatter={v=>`${v>0?v:0}회`}/><ComparisonItem label="거리" current={sum(analysisScoped,'distanceKm')} previous={sum(previousAnalysisScoped,'distanceKm')} formatter={v=>`${v.toFixed(1)} km`}/><ComparisonItem label="시간" current={sum(analysisScoped,'durationSec')/60} previous={sum(previousAnalysisScoped,'durationSec')/60} formatter={v=>`${Math.round(v)}분`}/><ComparisonItem label="평균 심박" current={avg(analysisScoped.map(a=>a.avgHeartRate||NaN))} previous={avg(previousAnalysisScoped.map(a=>a.avgHeartRate||NaN))} formatter={v=>`${v?Math.round(v):0} bpm`}/>{analysisType==='러닝'&&<ComparisonItem label="평균 케이던스" current={avg(analysisScoped.map(a=>a.avgCadence||NaN))} previous={avg(previousAnalysisScoped.map(a=>a.avgCadence||NaN))} formatter={v=>`${v?Math.round(v):0} spm`}/>}</div></section>
    </>}
    {analysisView==='report'&&<>
      <section className="report-grid">
        <div className="panel"><div className="eyebrow">PERSONAL BEST</div><h3>개인 기록</h3><div className="mini-grid report-best-grid"><div><span>최장 러닝</span><b>{longestRun?`${longestRun.distanceKm.toFixed(2)} km`:'—'}</b></div><div><span>최고 평균 페이스</span><b>{fastestRun?fmtPace(fastestRun.avgPaceSecPerKm):'—'}</b></div><div><span>최고 평균 속도</span><b>{bestSpeedRun?`${bestSpeedRun.avgSpeedKmh?.toFixed(1)} km/h`:'—'}</b></div><div><span>최신 VO₂ Max</span><b>{runs.slice().sort((a,b)=>b.date.localeCompare(a.date)).find(a=>a.vo2max)?.vo2max??'—'}</b></div></div></div>
        <div className="panel"><div className="eyebrow">MONTHLY REPORT</div><h3>{currentMonth.year}년 {currentMonth.month+1}월</h3><div className="mini-grid report-best-grid"><div><span>운동 횟수</span><b>{currentMonthActivities.length}회</b></div><div><span>거리</span><b>{currentMonthDist.toFixed(1)} km</b></div><div><span>운동 시간</span><b>{fmtDur(currentMonthTime)}</b></div><div><span>평균 페이스</span><b>{currentMonthPace?fmtPace(currentMonthPace):'—'}</b></div></div></div>
      </section>
      <section className="panel analysis-section"><div className="eyebrow">ACTIVITY SNAPSHOT</div><div className="period-tabs"><button className="active">러닝</button><button disabled>등산</button></div><h3>종목 핵심 기록</h3>{snapshotActivities.length?<div className="mini-grid" style={{marginTop:12}}>{snapshotType==='러닝'?<><div><span>최고 평균 페이스</span><b>{snapshotBestPace?fmtPace(snapshotBestPace.avgPaceSecPerKm):'—'}</b></div><div><span>최장 러닝</span><b>{snapshotLongest?`${snapshotLongest.distanceKm.toFixed(2)} km`:'—'}</b></div><div><span>최고 평균 속도</span><b>{snapshotBestSpeed?.avgSpeedKmh?`${snapshotBestSpeed.avgSpeedKmh.toFixed(1)} km/h`:'—'}</b></div><div><span>평균 심박</span><b>{snapshotAvgHr?`${snapshotAvgHr} bpm`:'—'}</b></div><div><span>평균 케이던스</span><b>{snapshotAvgCadence?`${snapshotAvgCadence} spm`:'—'}</b></div><div><span>최신 VO₂ Max</span><b>{[...runs].sort((a,b)=>b.date.localeCompare(a.date)).find(a=>a.vo2max)?.vo2max??'—'}</b></div></>:<><div><span>최장 등산</span><b>{snapshotLongest?`${snapshotLongest.distanceKm.toFixed(2)} km`:'—'}</b></div><div><span>누적 상승고도</span><b>{snapshotElevationGain?snapshotElevationGain.toFixed(0)+' m':'—'}</b></div><div><span>누적 하강고도</span><b>{snapshotElevationLoss?snapshotElevationLoss.toFixed(0)+' m':'—'}</b></div><div><span>평균 심박</span><b>{snapshotAvgHr?`${snapshotAvgHr} bpm`:'—'}</b></div><div><span>총 칼로리</span><b>{snapshotCalories?`${Math.round(snapshotCalories).toLocaleString()} kcal`:'—'}</b></div><div><span>총 등산 거리</span><b>{sum(snapshotActivities,'distanceKm').toFixed(1)} km</b></div>}</div>:<div className="empty" style={{marginTop:10,padding:20}}>기록이 없습니다.</div>}</section>
      <section className="panel analysis-section"><div className="eyebrow">YEAR AT A GLANCE</div><h3>{year} 월별 거리</h3><div className="bar-list" style={{marginTop:12}}>{monthly.map(x=><div key={x.m}><span>{x.m}월</span><i><em style={{width:`${yearDist?Math.min(100,(x.d/Math.max(...monthly.map(y=>y.d),1))*100):0}%`}}/></i><b>{x.d.toFixed(1)}</b></div>)}</div></section>
      <section className="panel analysis-section"><div className="eyebrow">ACTIVITY MIX</div><h3>종목별 기록</h3><div className="report-type-grid">{TYPES.map(t=>{const items=active.filter(a=>a.type===t);return items.length?<div key={t}><span>{t}</span><b>{items.length}회 · {sum(items,'distanceKm').toFixed(1)} km</b></div>:null})}</div></section>
      <section className="panel analysis-section"><div className="eyebrow">RECENT PERFORMANCE</div><h3>최근 성과</h3><div className="report-recent-list">{active.slice(0,5).map(a=><button key={a.id} className="report-recent-row" onClick={()=>setSelected(a)}><span>{fmtDate(a.date)} · {a.type}</span><b>{a.distanceKm.toFixed(2)} km · {fmtPace(a.avgPaceSecPerKm)}</b></button>)}</div></section>
    </>}
   </>}
   {tab==='trash'&&<><div className="trash-note">삭제한 기록을 복원하거나 영구 삭제할 수 있습니다.</div><div className="records-list">{trash.map(a=><article className="trash-card" key={a.id}><div><b>{fmtDate(a.date)} · {a.type}</b><span>{a.distanceKm.toFixed(2)} km · {fmtDur(a.durationSec)}</span></div><div><button className="secondary" onClick={()=>setConfirm({kind:'restore',id:a.id})}>복원</button><button className="danger" onClick={()=>setConfirm({kind:'delete',id:a.id})}>영구 삭제</button></div></article>)}</div>{!trash.length&&<div className="empty">휴지통이 비어 있습니다.</div>}</>}
   {tab==='more'&&<><section className="panel settings-panel"><div className="eyebrow">SYNC</div><h3>GitHub 데이터 동기화</h3><p>웹에서 사진을 업로드하지 않습니다. GitHub에 저장된 Motion Log 데이터셋을 브라우저 캐시와 ID 기준으로 병합합니다.</p><div className="actions"><button className="primary" onClick={syncNow}>지금 동기화</button><span style={{alignSelf:'center',fontSize:9,color:'var(--muted)'}}>{syncStatus}</span></div></section><section className="panel settings-panel"><div className="eyebrow">BACKUP</div><h3>데이터 백업 / 복원</h3><p>JSON은 운동 기록 전체 복원용, CSV는 엑셀/분석용입니다.</p><div className="actions"><button className="secondary" onClick={exportJson}>JSON 내보내기</button><button className="secondary" onClick={exportCsv}>CSV 내보내기</button><label className="secondary file-btn">JSON 복원<input type="file" accept="application/json,.json" onChange={importJson}/></label></div>{importStatus&&<div className="detail-note">{importStatus}</div>}</section><section className="panel settings-panel"><div className="eyebrow">SOURCE</div><h3>운동 입력 흐름</h3><p>Galaxy Watch → Samsung Health → 캡처 → ChatGPT 프로젝트의 운동 대화 → 기록 추출·분석 → GitHub 데이터셋 반영 → Motion Log 조회.</p></section><section className="panel settings-panel"><div className="eyebrow">MAINTENANCE</div><h3>화면 테마</h3><button className="secondary" onClick={()=>setDark(v=>!v)}>{dark?'라이트 모드로 전환':'다크 모드로 전환'}</button></section></>}
  </section>
  <nav className="bottom-nav">{[['home','⌂','홈'],['records','▤','기록'],['analysis','⌁','분석'],['trash','♜','휴지통'],['more','⋯','설정']].map(([k,i,l])=><button key={k} className={tab===k?'active':''} onClick={()=>setTab(k as Tab)}><span>{i}</span><small>{l}</small></button>)}</nav>
  {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">ACTIVITY DETAIL</div><h2>{selected.type} · {selected.distanceKm.toFixed(2)} km</h2><p>{fmtFullDate(selected.date)} · {fmtDur(selected.durationSec)}</p></div><button className="close" onClick={()=>setSelected(null)}>×</button></div><div className="metric-grid"><Metric label="평균 페이스" value={fmtPace(selected.avgPaceSecPerKm)}/><Metric label="최고 페이스" value={fmtPace(selected.bestPaceSecPerKm)}/><Metric label="평균 속도" value={selected.avgSpeedKmh?selected.avgSpeedKmh.toFixed(1):'—'} unit={selected.avgSpeedKmh?'km/h':undefined}/><Metric label="최고 속도" value={selected.bestSpeedKmh?selected.bestSpeedKmh.toFixed(1):'—'} unit={selected.bestSpeedKmh?'km/h':undefined}/><Metric label="평균 심박" value={selected.avgHeartRate?Math.round(selected.avgHeartRate):'—'} unit={selected.avgHeartRate?'bpm':undefined}/><Metric label="최대 심박" value={selected.maxHeartRate?Math.round(selected.maxHeartRate):'—'} unit={selected.maxHeartRate?'bpm':undefined}/><Metric label="케이던스" value={selected.avgCadence?Math.round(selected.avgCadence):'—'} unit={selected.avgCadence?'spm':undefined}/><Metric label="최대 케이던스" value={selected.maxCadence?Math.round(selected.maxCadence):'—'} unit={selected.maxCadence?'spm':undefined}/><Metric label="칼로리" value={selected.calories?Math.round(selected.calories):'—'} unit={selected.calories?'kcal':undefined}/><Metric label="걸음수" value={selected.steps?Math.round(selected.steps).toLocaleString():'—'}/><Metric label="VO₂ Max" value={selected.vo2max??'—'}/><Metric label="고도 상승" value={selected.elevationGainM?selected.elevationGainM.toFixed(1):'—'} unit={selected.elevationGainM?'m':undefined}/><Metric label="고도 하강" value={selected.elevationLossM?selected.elevationLossM.toFixed(1):'—'} unit={selected.elevationLossM?'m':undefined}/></div>{selected.note&&<div className="detail-note">메모: {selected.note}</div>}<div className="modal-actions"><button className="danger" onClick={()=>setConfirm({kind:'trash',id:selected.id})}>휴지통으로 이동</button><button className="primary" onClick={()=>setSelected(null)}>닫기</button></div></div></div>}
  {confirm&&<div className="modal-backdrop" onClick={()=>setConfirm(null)}><div className="modal confirm" onClick={e=>e.stopPropagation()}><div className="eyebrow">CONFIRM ACTION</div><h2>{confirm.kind==='trash'?'휴지통으로 이동':confirm.kind==='restore'?'기록 복원':'영구 삭제'}</h2><p>{confirm.kind==='trash'?'선택한 운동 기록을 휴지통으로 이동합니다.':confirm.kind==='restore'?'휴지통의 기록을 다시 활성화합니다.':'영구 삭제한 기록은 이 브라우저에서 복구할 수 없습니다.'}</p><div className="modal-actions"><button className="secondary" onClick={()=>setConfirm(null)}>취소</button><button className={confirm.kind==='delete'?'danger':'primary'} onClick={applyConfirm}>{confirm.kind==='trash'?'휴지통으로':confirm.kind==='restore'?'복원':'영구 삭제'}</button></div></div></div>}
 </main>;
}
