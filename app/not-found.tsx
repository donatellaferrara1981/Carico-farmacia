import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-bg-soft flex items-center justify-center">
            <SearchX className="w-7 h-7 text-ink-mute" />
          </div>
        </div>

        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">Pagina non trovata</h1>
          <p className="text-sm text-ink-soft">La pagina che cerchi non esiste o è stata spostata.</p>
        </div>

        <Link
          href="/app"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-line text-sm text-ink-soft hover:text-ink hover:border-ink/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna alla dashboard
        </Link>
      </div>
    </div>
  );
}
