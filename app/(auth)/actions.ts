'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthState =
  | { ok: true }
  | { ok: false; error: string }
  | { needsConfirmation: true; email: string };

export async function loginAction(_prev: AuthState | null, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/app');

  if (!email || !password) {
    return { ok: false, error: 'Inserisci email e password.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes('invalid login')) {
      return { ok: false, error: 'Email o password non corrette.' };
    }
    if (error.message.toLowerCase().includes('email not confirmed')) {
      return { ok: false, error: "Devi prima confermare l'email. Controlla la posta in arrivo." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect(next || '/app');
}

export async function signupAction(
  _prev: AuthState | null,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email || !password || !fullName) {
    return { ok: false, error: 'Compila nome, email e password.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'La password deve essere lunga almeno 8 caratteri.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data.session) {
    return { needsConfirmation: true, email };
  }

  revalidatePath('/', 'layout');
  redirect('/app');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
