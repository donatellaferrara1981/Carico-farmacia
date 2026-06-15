'use server';

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface BandoTrovato {
  numero_gara: string;
  descrizione: string;
  categoria: 'farmaci' | 'sanitario' | 'entrambi';
  ditta_aggiudicataria: string;
  prezzo_unitario: number | null;
  unita_misura: string | null;
  data_inizio: string | null;
  data_scadenza: string | null;
  lotto: string | null;
  aic: string | null;
  note: string | null;
  fonte: string;
}

export async function cercaBandiOnlineAction(query: string): Promise<{ risultati?: BandoTrovato[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  if (!query.trim()) return { error: 'Inserisci un termine di ricerca.' };

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Cerca bandi di gara d'appalto italiani per ospedali e strutture sanitarie riguardanti: "${query}"

Cerca su ANAC (anticorruzione.it), CONSIP (acquistinretepa.it), portali regionali siciliani (SITAS, ASP Sicilia), e altri portali pubblici italiani.

Per ogni bando trovato estrai queste informazioni in formato JSON:
- numero_gara: identificativo del bando (es. "2024/001" o codice CIG)
- descrizione: nome del farmaco/prodotto
- categoria: "farmaci" se è un farmaco, "sanitario" se è materiale sanitario, "entrambi" se entrambi
- ditta_aggiudicataria: nome dell'azienda aggiudicataria (se disponibile, altrimenti "da verificare")
- prezzo_unitario: prezzo in euro (numero decimale, null se non disponibile)
- unita_misura: "cpr", "fl", "pz", "conf", ecc. (null se non disponibile)
- data_inizio: data inizio validità in formato YYYY-MM-DD (null se non disponibile)
- data_scadenza: data scadenza in formato YYYY-MM-DD (null se non disponibile)
- lotto: numero lotto (null se non disponibile)
- aic: codice AIC farmaco (null se non disponibile)
- note: eventuali note utili
- fonte: URL o nome del portale dove è stato trovato

Rispondi SOLO con JSON valido:
{"risultati": [...]}

Se non trovi nessun bando: {"risultati": []}`,
      }],
    });

    // Estrai testo dalla risposta (può contenere tool_use + text)
    let testo = '';
    for (const block of msg.content) {
      if (block.type === 'text') testo += block.text;
    }

    const match = testo.match(/\{[\s\S]*"risultati"[\s\S]*\}/);
    if (!match) return { risultati: [] };

    const parsed = JSON.parse(match[0]);
    const risultati: BandoTrovato[] = (parsed.risultati ?? []).filter(
      (r: BandoTrovato) => r.descrizione && r.numero_gara
    );

    return { risultati };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Errore nella ricerca: ${msg}` };
  }
}

export async function importaBandoAction(bando: BandoTrovato, orgId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { error } = await supabase.from('gare_appalto').insert({
    org_id: orgId,
    numero_gara: bando.numero_gara,
    descrizione: bando.descrizione,
    categoria: bando.categoria,
    ditta_aggiudicataria: bando.ditta_aggiudicataria,
    prezzo_unitario: bando.prezzo_unitario,
    unita_misura: bando.unita_misura,
    data_inizio: bando.data_inizio,
    data_scadenza: bando.data_scadenza,
    lotto: bando.lotto,
    aic: bando.aic,
    note: bando.note ? `${bando.note} [Fonte: ${bando.fonte}]` : `Fonte: ${bando.fonte}`,
  });

  if (error) return { error: error.message };
  revalidatePath('/gare');
  return { ok: true };
}
