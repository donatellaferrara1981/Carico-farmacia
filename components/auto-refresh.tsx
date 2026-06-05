'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setSyncing(true);
      router.refresh();
      setLastSaved(new Date());
      setTimeout(() => setSyncing(false), 600);
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  const ora = lastSaved.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
      <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin text-forest' : ''}`} />
      Aggiornato alle {ora}
    </span>
  );
}
