'use server';

import { redirect } from 'next/navigation';
import { setUoAttivaId } from '@/lib/uo-cookie';

export async function selezionaUoAction(formData: FormData) {
  const id   = String(formData.get('uo_id') ?? '').trim();
  const back  = String(formData.get('back')  ?? '/app');
  if (!id) return;
  await setUoAttivaId(id);
  redirect(back);
}
