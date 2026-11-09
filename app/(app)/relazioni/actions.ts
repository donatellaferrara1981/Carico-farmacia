'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type TipoRelazione = 'ica' | 'paca' | 'antibiotici' | 'altro';

const PERCORSO: Record<TipoRelazione, string> = {
  ica: '/report-ica',
  paca: '/report-paca',
  antibiotici: '/archivio',
  altro: '/archivio',
};

const MAX_HTML = 2 * 1024 * 1024; // 2 MB per relazione

function tipoValido(t: string): t is TipoRelazione {
  return t === 'ica' || t === 'paca' || t === 'antibiotici' || t === 'altro';
}

// Salva una copia della relazione generata (HTML completo) nell'archivio.
export async function archiviaRelazioneAction(
  orgId: string,
  tipo: TipoRelazione,
  titolo: string,
  periodo: string | null,
  html: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  if (!tipoValido(tipo)) return { error: 'Tipo di relazione non valido.' };
  if (!html.trim()) return { error: 'La relazione è vuota.' };
  if (html.length > MAX_HTML) return { error: 'La relazione è troppo grande per essere archiviata.' };

  const { data: profilo } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const { error } = await supabase.from('relazioni_archiviate').insert({
    org_id: orgId,
    tipo,
    titolo: titolo.trim().slice(0, 200),
    periodo: periodo?.trim().slice(0, 100) || null,
    html,
    created_by: user.id,
    created_by_nome: profilo?.full_name ?? null,
  });

  if (error) return { error: error.message };
  revalidatePath(PERCORSO[tipo]);
  revalidatePath('/archivio');
  return { ok: true };
}

// Restituisce l'HTML di una relazione archiviata (caricato solo quando la si apre).
export async function getRelazioneHtmlAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { data, error } = await supabase
    .from('relazioni_archiviate')
    .select('html')
    .eq('id', id)
    .single();

  if (error || !data) return { error: 'Relazione non trovata.' };
  return { html: data.html as string };
}

// Elimina definitivamente le relazioni selezionate.
export async function eliminaRelazioniAction(ids: string[], tipo?: TipoRelazione) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  if (tipo && !tipoValido(tipo)) return { error: 'Tipo di relazione non valido.' };
  if (!ids.length) return { error: 'Nessuna relazione selezionata.' };

  let query = supabase.from('relazioni_archiviate').delete().in('id', ids);
  if (tipo) query = query.eq('tipo', tipo);
  const { error } = await query;

  if (error) return { error: error.message };
  revalidatePath('/archivio');
  revalidatePath('/report-ica');
  revalidatePath('/report-paca');
  return { ok: true, count: ids.length };
}

function esc(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Archivia una relazione scritta o incollata a mano (o letta da un file di testo/HTML).
export async function archiviaRelazioneManualeAction(
  orgId: string,
  titolo: string,
  periodo: string | null,
  contenuto: string,
  eHtml: boolean,
) {
  const t = titolo.trim();
  if (!t) return { error: 'Scrivi un titolo.' };
  if (!contenuto.trim()) return { error: 'La relazione è vuota.' };
  const html = eHtml
    ? contenuto
    : `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(t)}</title>` +
      `<style>body{font-family:Arial,Helvetica,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#1c1c1c;line-height:1.5}` +
      `h1{font-size:20px}pre{white-space:pre-wrap;font-family:inherit}</style></head>` +
      `<body><h1>${esc(t)}</h1>${periodo ? `<p>${esc(periodo)}</p>` : ''}<pre>${esc(contenuto)}</pre></body></html>`;
  return archiviaRelazioneAction(orgId, 'altro', t, periodo, html);
}
