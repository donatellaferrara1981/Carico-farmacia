'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function NuovaPasswordForm() {
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La password deve essere di almeno 8 caratteri.'); return; }
    if (password !== conferma) { setError('Le password non coincidono.'); return; }

    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      setDone(true);
      setTimeout(() => router.push('/app'), 2000);
    });
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">
          Nuova password
        </h1>
        <p className="text-ink-soft mt-2 text-sm">Scegli una nuova password per il tuo account.</p>
      </div>

      {done ? (
        <div className="p-5 rounded-xl bg-forest/10 border border-forest/30 text-center">
          <CheckCircle className="w-8 h-8 text-forest mx-auto mb-2" />
          <p className="font-semibold text-ink">Password aggiornata!</p>
          <p className="text-sm text-ink-soft mt-1">Stai per essere reindirizzato…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="label-base">Nuova password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
              placeholder="Minimo 8 caratteri"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="conferma" className="label-base">Conferma password</label>
            <input
              id="conferma"
              type="password"
              required
              value={conferma}
              onChange={(e) => setConferma(e.target.value)}
              className="input-base"
              placeholder="Ripeti la password"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={pending || !password || !conferma} className="btn-primary w-full">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva nuova password'}
          </button>
        </form>
      )}
    </>
  );
}
