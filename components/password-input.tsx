'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/* Campo password con occhio per mostrare/nascondere il testo. */
export function PasswordInput({ className = '', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visibile, setVisibile] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visibile ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setVisibile((v) => !v)}
        aria-label={visibile ? 'Nascondi password' : 'Mostra password'}
        title={visibile ? 'Nascondi password' : 'Mostra password'}
        className="absolute inset-y-0 right-0 px-3 text-ink-mute hover:text-ink"
      >
        {visibile ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}
