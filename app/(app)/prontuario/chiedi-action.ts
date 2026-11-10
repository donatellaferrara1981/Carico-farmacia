'use server';

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { caricaCatalogoProntuario } from '@/lib/prontuario';
import { isAltoCosto } from '@/lib/antibiotici';

export interface MessaggioChat { ruolo: 'utente' | 'assistente'; testo: string }
export interface FonteChat { titolo: string; url: string }

const DOMINI_UFFICIALI = [
  'farmaci.agenziafarmaco.gov.it',
  'agenziafarmaco.gov.it',
  'aifa.gov.it',
  'ema.europa.eu',
  'salute.gov.it',
  'iss.it',
];

export async function chiediProntuarioAction(
  messaggi: MessaggioChat[],
): Promise<{ testo?: string; fonti?: FonteChat[]; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };
  const { data: member } = await supabase.from('organization_members').select('org_id').eq('user_id', user.id).single();
  if (!member) return { error: 'Organizzazione non trovata.' };
  if (!process.env.ANTHROPIC_API_KEY) return { error: 'Chiave API non configurata sul server.' };

  const ultimi = messaggi.slice(-12);
  if (!ultimi.length || ultimi[ultimi.length - 1].ruolo !== 'utente') return { error: 'Scrivi una domanda.' };

  const catalogo = await caricaCatalogoProntuario(supabase, member.org_id as string);
  const righe = catalogo.slice(0, 700).map((p) =>
    `- ${p.principio_attivo}${p.dosaggio ? ' ' + p.dosaggio : ''}${p.nome_commerciale ? ` (${p.nome_commerciale})` : ''} [${p.forma_farmaceutica}]` +
    `${isAltoCosto(p.principio_attivo) ? ' ALTO COSTO/prescrizione motivata' : ''}${p.nominativa ? ' NOMINATIVA' : ''}${p.pazienti ? ` · ${p.pazienti} degenti` : ''}`,
  );

  const system = `Sei l'assistente del prontuario farmaceutico di un reparto ospedaliero italiano (neuroriabilitazione / unità spinale). Parli con una professionista sanitaria del reparto: rispondi in italiano, in modo chiaro e sintetico.

CATALOGO DEL REPARTO (i farmaci effettivamente in uso, aggiornato in tempo reale):
${righe.join('\n') || '(catalogo vuoto)'}

Regole:
- Per domande su ciò che c'è in reparto usa solo il catalogo qui sopra; se un farmaco non c'è, dillo.
- Per indicazioni, controindicazioni, interazioni, posologie, avvertenze, equivalenti e note AIFA cerca sul web nelle fonti ufficiali (AIFA Banca Dati Farmaci / RCP e foglio illustrativo, EMA, Ministero della Salute) e cita sempre la fonte.
- Non inventare dosi o dati: se non trovi una conferma in fonte ufficiale scrivi «non verificato» e dì cosa manca.
- Per interazioni tra farmaci del catalogo indica gravità e raccomandazione pratica, e segnala quando serve il parere di medico o farmacista.
- Sei un supporto: non sostituisci la valutazione clinica del medico e del farmacista ospedaliero. Una riga finale di promemoria basta, senza ripeterla se già detta.`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 3, allowed_domains: DOMINI_UFFICIALI }],
      messages: ultimi.map((m) => ({ role: m.ruolo === 'utente' ? 'user' as const : 'assistant' as const, content: m.testo })),
    });

    let testo = '';
    const fonti = new Map<string, string>();
    for (const b of msg.content) {
      if (b.type === 'text') {
        testo += b.text;
        for (const c of (b as { citations?: { url?: string; title?: string }[] }).citations ?? []) {
          if (c.url && !fonti.has(c.url)) fonti.set(c.url, c.title ?? c.url);
        }
      }
    }
    return { testo: testo.trim() || 'Nessuna risposta.', fonti: [...fonti].map(([url, titolo]) => ({ url, titolo })) };
  } catch (err) {
    return { error: `Errore: ${err instanceof Error ? err.message : String(err)}` };
  }
}
