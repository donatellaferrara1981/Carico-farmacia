'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Indietro
    </button>
  );
}
