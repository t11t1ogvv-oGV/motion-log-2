'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function MotionLogBrand() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const refresh = () => setTarget(document.querySelector('.sidebar .brand'));
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;
  return createPortal(
    <div className="motion-rebrand">
      GALAXY WATCH
      <strong>FITNESS LOG</strong>
      <small>PERSONAL WORKOUT DASHBOARD</small>
    </div>,
    target,
  );
}
