import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Motion Log',
  description: '개인 운동 기록 대시보드',
  applicationName: 'Motion Log',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3f0ea',
};

const bootstrapScript = `
(() => {
  const key = 'motion-log-records-v4';
  const loadedKey = 'motion-log-bundled-v8';
  const typeMap = ['걷기','러닝','자전거','등산','수영','기타'];

  const setStatus = (message, isError = false) => {
    let el = document.getElementById('motion-log-loader-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'motion-log-loader-status';
      el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:84px;z-index:9999;padding:10px 12px;border:1px solid rgba(0,0,0,.12);border-radius:10px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.08);font:12px/1.4 system-ui,sans-serif;color:#222;';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    el.style.borderColor = isError ? '#b42318' : 'rgba(0,0,0,.12)';
    el.style.color = isError ? '#b42318' : '#222';
  };

  const clearStatus = () => {
    const el = document.getElementById('motion-log-loader-status');
    if (el) el.remove();
  };

  const normalize = (value) => value.replace(/\\uFEFF/g, '').replace(/\\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');

  const decodeGzipJson = async (b64) => {
    b64 = b64.replace(/=+$/g, '');
    if (b64.length % 4 === 1) throw new Error('invalid base64 candidate length: ' + b64.length);
    b64 += '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const DecompressionStreamCtor = globalThis.DecompressionStream;
    if (!DecompressionStreamCtor) throw new Error('gzip decompression unsupported');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStreamCtor('gzip'));
    return await new Response(stream).json();
  };

  const makeCandidates = (parts) => {
    const joined = parts.join('');
    const out = [joined];
    const push = (s) => { if (s && !out.includes(s)) out.push(s); };
    if (joined.length % 4 === 1) {
      push(joined.slice(0, -1));
      // Try one-character repairs at every part boundary (the likely split points).
      let offset = 0;
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        const candidates = [0, 1, 2, part.length - 3, part.length - 2, part.length - 1];
        for (const idx of candidates) {
          if (idx >= 0 && idx < part.length) {
            const alt = parts.slice();
            alt[i] = part.slice(0, idx) + part.slice(idx + 1);
            push(alt.join(''));
          }
        }
        offset += part.length;
      }
    }
    return out;
  };

  const loadBundled = async () => {
    setStatus('Samsung Health 데이터 불러오는 중…');
    const parts = await Promise.all([1,2,3,4].map(async (n) => {
      const res = await fetch('/motion-log-data.part' + n + '?v=8', { cache: 'no-store' });
      if (!res.ok) throw new Error('dataset part ' + n + ' HTTP ' + res.status);
      const text = normalize(await res.text());
      if (!text) throw new Error('dataset part ' + n + ' is empty');
      return text;
    }));

    let payload = null;
    let lastError = null;
    for (const candidate of makeCandidates(parts)) {
      try {
        const parsed = await decodeGzipJson(candidate);
        if (parsed && Array.isArray(parsed.r) && parsed.r.length > 0) {
          payload = parsed;
          break;
        }
      } catch (e) {
        lastError = e;
      }
    }
    if (!payload) throw new Error('dataset decode failed' + (lastError instanceof Error ? ': ' + lastError.message : ''));

    const baseMs = Date.UTC(2020, 0, 1);
    return payload.r.map((row, i) => {
      const date = new Date(baseMs + Number(row[0] || 0) * 86400000).toISOString().slice(0, 10);
      const n = (value) => Number(value) ? Number(value) / 10 : undefined;
      return {
        id: 'sh-' + i,
        date,
        type: typeMap[Number(row[1])] || '기타',
        distanceKm: Number(row[2] || 0) / 1000,
        durationSec: Number(row[3] || 0),
        calories: n(row[4]),
        avgPaceSecPerKm: n(row[5]),
        avgSpeedKmh: n(row[6]),
        bestSpeedKmh: n(row[7]),
        avgHeartRate: n(row[8]),
        avgCadence: n(row[9]),
        vo2max: n(row[10]),
        elevationGainM: n(row[11]),
        elevationLossM: n(row[12]),
        source: 'Samsung Health',
      };
    });
  };

  (async () => {
    try {
      const raw = localStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : null;
      if (Array.isArray(existing) && existing.length > 0) {
        clearStatus();
        return;
      }
      const data = await loadBundled();
      if (!data.length) throw new Error('dataset contains 0 records');
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(loadedKey, '1');
      setStatus(data.length.toLocaleString('ko-KR') + '개 기록을 불러왔습니다.');
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Motion Log] Samsung Health import failed:', error);
      setStatus('Samsung Health 데이터 불러오기 실패: ' + message, true);
    }
  })();
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
