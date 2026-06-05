'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface AlertConfigData {
  email_destinatari: string[];
  alert_scorte: boolean;
  alert_scadenza: boolean;
  alert_riordino: boolean;
  riordino_ogni_giorni: number;
  scadenza_anticipo_giorni: number;
  attivo: boolean;
}

export async function salvaAlertConfigAction(orgId: string, data: AlertConfigData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { error } = await supabase
    .from('alert_config')
    .upsert({
      org_id: orgId,
      ...data,
      email_destinatario: data.email_destinatari[0] ?? '',
    }, { onConflict: 'org_id' });

  if (error) return { error: error.message };
  revalidatePath('/impostazioni');
  return { ok: true };
}

export async function inviaTestAlertAction(orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/alert-farmaci`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ org_id: orgId, test: true }),
    }
  );

  if (!res.ok) return { error: "Errore nell'invio del test." };
  return { ok: true };
}
