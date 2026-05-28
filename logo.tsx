'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { loginAction, type AuthState } from '../actions';
import { ArrowRight, Loader2 } from 'lucide-react';

export function LoginForm() {
  const sp = useSearchParams();
  const next = sp.get('next') || '/app';
  const justSignedUp = sp.get('signedup') === '1';
  const [state, formAction, pending] = useActionState<AuthState | null, FormData>(
    loginAction,
    null,
  );

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold text-ink tracking-tight">
          Bentornato
        </h1>
        <p className="text-ink-soft mt-2">
          Accedi per gestire il carico della tua farmacia.
        </p>
      </div>

      {justSignedUp && (
        <div className="mb-6 p-4 rounded-lg bg-forest-tint border border-forest/30 text-sm text-forest">
          Account creato. Ora puoi accedere con le tue credenziali.
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="email" className="label-base">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input-base"
            placeholder="nome@esempio.it"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="label-base mb-0">
              Password
            </label>
            <Link
              href="/login/recupera"
              className="text-xs text-forest hover:text-forest-soft font-medium"
            >
              dimenticata?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            className="input-base"
            placeholder="••••••••"
          />
        </div>

        {state && 'error' in state && (
          <div className="p-3 rounded-lg bg-abx-soft border border-abx/30 text-sm text-abx">
            {state.error}
          </div>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Accesso in corso…
            </>
          ) : (
            <>
              Accedi
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-line text-sm text-center text-ink-soft">
        Primo accesso?{' '}
        <Link href="/signup" className="text-forest font-semibold hover:text-forest-soft">
          Crea un account
        </Link>
      </div>

      <p className="mt-6 text-[11px] text-ink-mute text-center leading-relaxed">
        Presto disponibile: accesso con Google e Microsoft 365 per la sincronizzazione
        diretta col calendario.
      </p>
    </>
  );
}
