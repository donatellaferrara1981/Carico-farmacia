'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-abx/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-abx" />
          </div>
        </div>

        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-2">Qualcosa è andato storto</h1>
          {error.message && (
            <p className="text-sm text-ink-soft bg-bg-soft rounded-lg px-4 py-2 font-mono break-all">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-line text-sm text-ink-soft hover:text-ink hover:border-ink/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna indietro
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forest text-white text-sm hover:bg-forest-dark transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Riprova
          </button>
        </div>
      </div>
    </div>
  );
}
