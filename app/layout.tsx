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
  const versionKey = 'motion-log-direct-test-v5';

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

  const load = async () => {
    try {
      const raw = localStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : null;
      if (Array.isArray(existing) && existing.length > 0) return;

      const res = await fetch('/motion-log-data-test.json?v=5', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();

      if (!Array.isArray(data) || data.length !== 42) {
        throw new Error(
          'expected 42 records, got ' +
          (Array.isArray(data) ? data.length : 'invalid data')
        );
      }

      const normalized = data.map((row, i) => ({
        ...row,
        id: row?.id || ('sh-test-' + i),
        source: row?.source || 'Samsung Health',
      }));

      localStorage.setItem(key, JSON.stringify(normalized));
      localStorage.setItem(versionKey, '1');
    } catch (error) {
      console.error('[Motion Log] test data bootstrap failed:', error);
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
      </body>
    </html>
  );
}