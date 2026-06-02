'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signupAction, type AuthState } from '../actions';
import { ArrowRight, Loader2, MailCheck } from 'lucide-react';

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthState | null, FormData>(
    signupAction,
    null,
  );

  if (state && 'needsConfirmation' in state) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-forest-tint border border-forest/30 mb-6">
          <MailCheck className="w-8 h-8 text-forest" />
        </div>
        <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">
          Controlla l&apos;email
        </h1>
        <p className="text-ink-soft mt-3 leading-relaxed">
          Abbiamo inviato un link di conferma a <strong>{state.email}</strong>. Aprilo per
          attivare l&apos;account, poi torna qui per accedere.
        </p>
        <Link href="/login?signedup=1" className="btn-secondary mt-8 inline-flex">
          Vai al login
          <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-6 text-xs text-ink-mute">
          Non vedi l&apos;email? Controlla nella cartella spam o promozioni.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold text-ink tracking-tight">
          Crea il tuo account
        </h1>
        <p className="text-ink-soft mt-2">
          Diventerai automaticamente Amministratore della tua organizzazione.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="full_name" className="label-base">
            Nome e cognome
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            className="input-base"
            placeholder="Donatella Ferrara"
          />
        </div>

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
          <label htmlFor="password" className="label-base">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input-base"
            placeholder="almeno 8 caratteri"
          />
          <p className="text-[11px] text-ink-mute mt-1.5">
            Almeno 8 caratteri. Consigliata una passphrase memorabile.
          </p>
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
              Creazione in corso…
            </>
          ) : (
            <>
              Crea account
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-line text-sm text-center text-ink-soft">
        Hai già un account?{' '}
        <Link href="/login" className="text-forest font-semibold hover:text-forest-soft">
          Accedi
        </Link>
      </div>
    </>
  );
}
