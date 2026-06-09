'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getUoAttivaId } from '@/lib/uo-cookie';
import Anthropic from '@anthropic-ai/sdk';
import { inflateSync } from 'zlib';

interface PazienteEstratto {
  sala: string;
  numero_letto: number;
  nominativo: string;
}

function derivaPiano(sala: string): 'terra' | 'primo' | null {
  const s = sala.toUpperCase();
  if (s.includes('PIANO TERRA')) return 'terra';
  if (s.includes('1 PIANO') || s.includes('PRIMO')) return 'primo';
  return null;
}

// ── Estrai pazienti da JPEG/PNG ──────────────────────────────────────────────

export async function estraiPazientiDaImmagineAction(
  fileBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  orgId: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: fileBase64 },
        },
        {
          type: 'text',
          text: `Sei un assistente per una struttura ospedaliera italiana. Analizza questa immagine che mostra la mappa dei posti letto suddivisi in sale/stanze.

Estrai TUTTI i pazienti presenti (letti occupati). Per i letti vuoti NON includere nulla.

Per ogni paziente restituisci un oggetto con:
- sala: string (nome esatto della sala/stanza come appare nell'intestazione, es. "GCA1", "GCA3", "STANZA GRANDE 1 PIANO", "STANZA PICCOLA 1 PIANO", "Sala Lunga")
- numero_letto: number (numero del letto)
- nominativo: string (nome e cognome del paziente, maiuscolo come appare)

Rispondi SOLO con un array JSON valido, senza testo aggiuntivo. Esempio:
[{"sala":"GCA1","numero_letto":1,"nominativo":"ROSSI MARIO"},{"sala":"GCA3","numero_letto":5,"nominativo":"BIANCHI ANNA"}]

Se non trovi pazienti: []`,
        },
      ],
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  let estratti: PazienteEstratto[];
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    estratti = m ? JSON.parse(m[0]) : [];
  } catch {
    return { error: `Risposta non interpretabile: ${raw.slice(0, 200)}` };
  }

  if (!estratti.length) return { error: 'Nessun paziente riconosciuto nell\'immagine.' };

  // Cancella i pazienti precedenti per questa UO (aggiornamento completo)
  const delQuery = supabase.from('pazienti').delete().eq('org_id', orgId);
  if (uoAttivaId) delQuery.eq('unita_operativa_id', uoAttivaId);
  await delQuery;

  const nuovi = estratti.map((p) => ({
    org_id: orgId,
    unita_operativa_id: uoAttivaId ?? null,
    sala: p.sala,
    numero_letto: p.numero_letto,
    nominativo: p.nominativo,
    piano: derivaPiano(p.sala),
    data_aggiornamento: new Date().toISOString(),
  }));

  const { error: dbError } = await supabase.from('pazienti').insert(nuovi);
  if (dbError) return { error: dbError.message };

  revalidatePath('/pazienti');
  return { ok: true, count: nuovi.length };
}

// ── Estrai pazienti da HTML ──────────────────────────────────────────────────

export async function estraiPazientiDaHtmlAction(
  htmlText: string,
  orgId: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();

  const truncated = htmlText.slice(0, 50000);

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `This is an HTML export from a hospital bed management system. Extract all patients (occupied beds). For each return: sala (room name from section headers), numero_letto (bed number as integer), nominativo (patient full name in uppercase). Return ONLY a JSON array, no extra text. Example: [{"sala":"PIANO TERRA GCA1","numero_letto":1,"nominativo":"ROSSI MARIO"}]. If no patients found: []

HTML:
${truncated}`,
    }],
  });

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
  let estratti: PazienteEstratto[];
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    estratti = m ? JSON.parse(m[0]) : [];
  } catch {
    return { error: `Risposta non interpretabile: ${raw.slice(0, 200)}` };
  }

  if (!estratti.length) return { error: 'Nessun paziente riconosciuto nell\'HTML.' };

  const delQuery = supabase.from('pazienti').delete().eq('org_id', orgId);
  if (uoAttivaId) delQuery.eq('unita_operativa_id', uoAttivaId);
  await delQuery;

  const nuovi = estratti.map((p) => ({
    org_id: orgId,
    unita_operativa_id: uoAttivaId ?? null,
    sala: p.sala,
    numero_letto: p.numero_letto,
    nominativo: p.nominativo,
    piano: derivaPiano(p.sala),
    data_aggiornamento: new Date().toISOString(),
  }));

  const { error: dbError } = await supabase.from('pazienti').insert(nuovi);
  if (dbError) return { error: dbError.message };

  revalidatePath('/pazienti');
  return { ok: true, count: nuovi.length };
}

// ── Aggiorna singolo paziente ────────────────────────────────────────────────

export async function aggiornaPazienteAction(
  id: string,
  nominativo: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  await supabase.from('pazienti').update({ nominativo }).eq('id', id);
  revalidatePath('/pazienti');
  return { ok: true };
}

// ── Elimina paziente ─────────────────────────────────────────────────────────

export async function eliminaPazienteAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  await supabase.from('pazienti').delete().eq('id', id);
  revalidatePath('/pazienti');
  return { ok: true };
}

// ── Aggiungi paziente manuale ────────────────────────────────────────────────

export async function aggiungiPazienteAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const uoAttivaId = await getUoAttivaId();

  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();
  if (!member) return { error: 'Organizzazione non trovata.' };

  const sala = String(formData.get('sala') ?? '').trim();
  const { error } = await supabase.from('pazienti').insert({
    org_id: member.organization_id,
    unita_operativa_id: uoAttivaId ?? null,
    sala,
    numero_letto: parseInt(String(formData.get('numero_letto') ?? '0')),
    nominativo: String(formData.get('nominativo') ?? '').trim(),
    piano: derivaPiano(sala),
  });

  if (error) return { error: error.message };
  revalidatePath('/pazienti');
  return { ok: true };
}
