'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AVATAR_IDS } from '@/lib/avatar';

export async function salvaAvatarAction(avatar: string | null): Promise<{ ok: boolean }> {
  if (avatar !== null && !AVATAR_IDS.includes(avatar)) return { ok: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from('profiles').update({ avatar }).eq('id', user.id);
  if (error) return { ok: false };
  revalidatePath('/', 'layout');
  return { ok: true };
}
