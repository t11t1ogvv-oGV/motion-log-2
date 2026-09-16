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
  const loadedKey = 'motion-log-direct-test-v1';

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

  const loadDirect = async () => {
    setStatus('최근 60일 삼성 Health 데이터 불러오는 중…');
    const res = await fetch('/motion-log-data-test.json?v=1', { cache: 'no-store' });
    if (!res.ok) throw new Error('test dataset HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('test dataset is empty');
    return data.map((row, i) => ({
      ...row,
      id: row.id || ('sh-test-' + i),
      source: row.source || 'Samsung Health',
    }));
  };

  (async () => {
    try {
      const raw = localStorage.getItem(key);
      const existing = raw ? JSON.parse(raw) : null;
      if (Array.isArray(existing) && existing.length > 0) {
        clearStatus();
        return;
      }
      const data = await loadDirect();
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(loadedKey, '1');
      setStatus(data.length.toLocaleString('ko-KR') + '개 기록을 불러왔습니다.');
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Motion Log] direct Samsung Health test import failed:', error);
      setStatus('Samsung Health 테스트 데이터 불러오기 실패: ' + message, true);
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
