'use client';

import { useState, useTransition } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PasswordInput } from '@/components/password-input';

export function CambiaPasswordForm() {
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; testo: string } | null>(null);
  const [pending, start] = useTransition();

  function invia(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password.length < 8) return setMsg({ ok: false, testo: 'Almeno 8 caratteri.' });
    if (password !== conferma) return setMsg({ ok: false, testo: 'Le password non coincidono.' });
    start(async () => {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) return setMsg({ ok: false, testo: error.message });
      setPassword(''); setConferma('');
      setMsg({ ok: true, testo: 'Password aggiornata.' });
    });
  }

  return (
    <form onSubmit={invia} className="space-y-3 max-w-sm">
      <PasswordInput className="input-base" placeholder="Nuova password (min. 8 caratteri)" autoComplete="new-password"
        value={password} onChange={(e) => setPassword(e.target.value)} required />
      <PasswordInput className="input-base" placeholder="Ripeti la nuova password" autoComplete="new-password"
        value={conferma} onChange={(e) => setConferma(e.target.value)} required />
      {msg && (
        <p className={`text-sm flex items-center gap-1.5 ${msg.ok ? 'text-ok' : 'text-abx'}`}>
          {msg.ok && <CheckCircle className="w-4 h-4" />}{msg.testo}
        </p>
      )}
      <button type="submit" disabled={pending || !password || !conferma} className="btn-primary">
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cambia password'}
      </button>
    </form>
  );
}
