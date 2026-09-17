import type { Metadata, Viewport } from 'next';
import './globals.css';
import './motion-enhancements.css';
import MotionLogEnhancements from './MotionLogEnhancements';
import MotionLogBrand from './MotionLogBrand';

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
  const versionKey = 'motion-log-direct-test-v8';
  const localPath = '/motion-log-data-test.json';
  const remoteUrl = 'https://raw.githubusercontent.com/t11t1ogvv-oGV/motion-log-2/workout-data/public/motion-log-data-test.json';

  // Keep the existing page code intact while transparently redirecting its
  // workout-data fetches to the GitHub data branch. This lets workout records
  // change without rebuilding or redeploying the app.
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const requested = typeof input === 'string' ? input : input?.url;
      if (requested) {
        const pathname = new URL(requested, window.location.origin).pathname;
        if (pathname === localPath) {
          return originalFetch(remoteUrl + '?t=' + Date.now(), { ...(init || {}), cache: 'no-store' });
        }
      }
    } catch {}
    return originalFetch(input, init);
  };

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(name, value) {
    if (name === key && value === '[]') {
      try {
        const current = localStorage.getItem(key);
        const parsed = current ? JSON.parse(current) : null;
        if (Array.isArray(parsed) && parsed.length > 0) return;
      } catch {}
    }
    return originalSetItem.call(this, name, value);
  };

  const normalize = (data) => {
    if (!Array.isArray(data)) throw new Error('dataset is not an array');
    return data.map((row, i) => {
      if (!row || typeof row !== 'object') throw new Error('invalid record ' + i);
      if (!row.id) throw new Error('record ' + i + ' is missing id');
      if (!row.date) throw new Error('record ' + i + ' is missing date');
      return { ...row, source: row.source || 'Samsung Health' };
    });
  };

  const merge = (local, remote) => {
    const localById = new Map(local.map(row => [row.id, row]));
    const merged = remote.map(row => {
      const localRow = localById.get(row.id);
      return localRow?.deletedAt ? { ...row, deletedAt: localRow.deletedAt } : row;
    });
    const remoteIds = new Set(remote.map(row => row.id));
    for (const row of local) {
      if (!remoteIds.has(row.id)) merged.push(row);
    }
    return merged;
  };

  const sameIds = (a, b) => {
    if (a.length !== b.length) return false;
    const aa = a.map(row => row.id).sort();
    const bb = b.map(row => row.id).sort();
    return aa.every((id, i) => id === bb[i]);
  };

  const load = async () => {
    try {
      const raw = localStorage.getItem(key);
      let local = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) local = parsed;
        } catch {}
      }
      const res = await originalFetch(remoteUrl + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const remote = normalize(await res.json());
      const merged = merge(local, remote);
      if (!sameIds(local, merged) || local.length === 0) {
        localStorage.setItem(key, JSON.stringify(merged));
        localStorage.setItem(versionKey, String(remote.length));
        setTimeout(() => window.location.reload(), 120);
      } else {
        localStorage.setItem(versionKey, String(remote.length));
      }
    } catch (error) {
      console.error('[Motion Log] GitHub workout data sync failed:', error);
    }
  };

  load();
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        {children}
        <MotionLogEnhancements />
        <MotionLogBrand />
      </body>
    </html>
  );
}
