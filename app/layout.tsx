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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <script dangerouslySetInnerHTML={{ __html: "try{if(!localStorage.getItem('motion-log-theme-v2'))localStorage.setItem('motion-log-theme-v2','light')}catch{}" }} />
        {children}
      </body>
    </html>
  );
}
