'use server';

import { createClient } from '@/lib/supabase/server';

export async function recuperaPasswordAction(email: string) {
  if (!email) return { error: 'Inserisci la tua email.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://carico-farmacia.vercel.app'}/login/nuova-password`,
  });

  if (error) return { error: error.message };
  return { ok: true };
}
