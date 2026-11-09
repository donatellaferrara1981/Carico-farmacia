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
    .select('html, file_path')
    .eq('id', id)
    .single();

  if (error || !data) return { error: 'Relazione non trovata.' };
  if (data.file_path) {
    const { data: firmato, error: errUrl } = await supabase.storage
      .from('documenti')
      .createSignedUrl(data.file_path as string, 60 * 15); // 15 minuti
    if (errUrl || !firmato) return { error: 'Impossibile aprire il PDF.' };
    return { pdfUrl: firmato.signedUrl };
  }
  return { html: data.html as string };
}

// Elimina definitivamente le relazioni selezionate.
export async function eliminaRelazioniAction(ids: string[], tipo?: TipoRelazione) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  if (tipo && !tipoValido(tipo)) return { error: 'Tipo di relazione non valido.' };
  if (!ids.length) return { error: 'Nessuna relazione selezionata.' };

  let sel = supabase.from('relazioni_archiviate').select('id, file_path').in('id', ids);
  if (tipo) sel = sel.eq('tipo', tipo);
  const { data: righe } = await sel;
  const files = (righe ?? []).map((r) => r.file_path as string | null).filter((f): f is string => !!f);

  let query = supabase.from('relazioni_archiviate').delete().in('id', ids);
  if (tipo) query = query.eq('tipo', tipo);
  const { error } = await query;

  if (error) return { error: error.message };
  // il PDF viene tolto dallo storage solo dopo che la riga è stata cancellata
  if (files.length) await supabase.storage.from('documenti').remove(files);
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

const MAX_PDF = 4_000_000; // 4 MB (limite dei caricamenti dell'app)

// Archivia una relazione già pronta in formato PDF (file nel bucket privato "documenti").
export async function archiviaRelazionePdfAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const file = formData.get('file') as File | null;
  const orgId = String(formData.get('org_id') ?? '');
  const titolo = String(formData.get('titolo') ?? '').trim();
  const periodo = String(formData.get('periodo') ?? '').trim();
  if (!file || !orgId) return { error: 'File mancante.' };
  if (!titolo) return { error: 'Scrivi un titolo.' };
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return { error: 'Il file non è un PDF.' };
  if (file.size > MAX_PDF) return { error: 'PDF troppo grande (massimo 4 MB).' };

  const { data: profilo } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

  const percorso = `${orgId}/relazioni/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: errUp } = await supabase.storage
    .from('documenti')
    .upload(percorso, file, { contentType: 'application/pdf', upsert: false });
  if (errUp) return { error: errUp.message };

  const { error } = await supabase.from('relazioni_archiviate').insert({
    org_id: orgId,
    tipo: 'altro',
    titolo: titolo.slice(0, 200),
    periodo: periodo.slice(0, 100) || null,
    html: '<p>Relazione in formato PDF.</p>',
    file_path: percorso,
    created_by: user.id,
    created_by_nome: profilo?.full_name ?? null,
  });
  if (error) {
    await supabase.storage.from('documenti').remove([percorso]);
    return { error: error.message };
  }
  revalidatePath('/archivio');
  return { ok: true };
}
