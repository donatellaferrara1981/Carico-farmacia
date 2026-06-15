'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    if (spinning) return;
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 800);
  }

  return (
    <button
      onClick={handleRefresh}
      title="Aggiorna"
      className="p-1.5 rounded-lg hover:bg-bg-soft text-ink-soft hover:text-forest transition-colors"
    >
      <RefreshCw className={`w-4 h-4 ${spinning ? 'animate-spin text-forest' : ''}`} />
    </button>
  );
}
