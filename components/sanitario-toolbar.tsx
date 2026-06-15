'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { svuotaProdottiAction } from '@/app/(app)/[categoria]/prodotti-actions';

export function SanitarioToolbar({ orgId, hasItems }: { orgId: string; hasItems: boolean }) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);
  const [svuotando, startSvuota] = useTransition();

  function aggiorna() {
    if (spinning) return;
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 800);
  }

  function svuota() {
    if (!confirm('Eliminare tutti gli articoli dalla lista sanitario? L\'operazione non è reversibile.')) return;
    startSvuota(async () => {
      await svuotaProdottiAction(orgId, 'sanitario');
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={aggiorna}
        title="Aggiorna"
        className="flex items-center px-3 py-1.5 rounded-lg border border-line text-xs text-ink-soft hover:text-forest hover:border-forest/50 transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${spinning ? 'animate-spin text-forest' : ''}`} />
      </button>

      {hasItems && (
        <button
          onClick={svuota}
          disabled={svuotando}
          title="Svuota elenco"
          className="flex items-center px-3 py-1.5 rounded-lg border border-red-200 text-xs text-red-400 hover:text-red-600 hover:border-red-400 transition-colors disabled:opacity-40"
        >
          {svuotando
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
