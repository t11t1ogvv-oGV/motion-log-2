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
  try {
    const raw = localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) : null;
    if (Array.isArray(existing) && existing.length > 0) return;
    fetch('/motion-log-data.json', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('dataset fetch failed')))
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;
        localStorage.setItem(key, JSON.stringify(data));
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
