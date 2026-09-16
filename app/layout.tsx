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
  const loadedKey = 'motion-log-bundled-v1';
  const typeMap = ['걷기','러닝','자전거','등산','수영','기타'];

  const loadBundled = async () => {
    const parts = await Promise.all([1,2,3,4].map((n) =>
      fetch('/motion-log-data.part' + n, { cache: 'no-store' }).then((res) => {
        if (!res.ok) throw new Error('dataset part ' + n + ' failed');
        return res.text();
      })
    ));

    const b64 = parts.join('');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);

    const DecompressionStreamCtor = globalThis.DecompressionStream;
    if (!DecompressionStreamCtor) throw new Error('gzip decompression unsupported');

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStreamCtor('gzip'));
    const payload = await new Response(stream).json();
    if (!payload || !Array.isArray(payload.r)) throw new Error('invalid dataset');

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

  try {
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : null;
    if (Array.isArray(existing) && existing.length > 0) return;
    if (localStorage.getItem(loadedKey) === '1') return;

    loadBundled()
      .then((data) => {
        if (!data.length) return;
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(loadedKey, '1');
        window.location.reload();
      })
      .catch(() => {});
  } catch (_) {}
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
