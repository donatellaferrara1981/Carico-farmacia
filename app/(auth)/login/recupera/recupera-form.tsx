'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { recuperaPasswordAction } from './action';

export function RecuperaPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    start(async () => {
      const res = await recuperaPasswordAction(email.trim().toLowerCase());
      if (res?.error) setError(res.error);
      else setSent(true);
    });
  }

  return (
    <>
      <div className="mb-8">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Torna al login
        </Link>
        <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">
          Password dimenticata
        </h1>
        <p className="text-ink-soft mt-2 text-sm">
          Inserisci la tua email e ti mandiamo il link per reimpostare la password.
        </p>
      </div>

      {sent ? (
        <div className="p-5 rounded-xl bg-forest/10 border border-forest/30 text-center">
          <Mail className="w-8 h-8 text-forest mx-auto mb-2" />
          <p className="font-semibold text-ink">Email inviata!</p>
          <p className="text-sm text-ink-soft mt-1">
            Controlla la casella <strong>{email}</strong> e clicca il link per reimpostare la password.
          </p>
          <p className="text-xs text-ink-mute mt-3">Controlla anche la cartella spam.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="label-base">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              placeholder="nome@esempio.it"
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={pending || !email} className="btn-primary w-full">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invia link di recupero'}
          </button>
        </form>
      )}
    </>
  );
}
