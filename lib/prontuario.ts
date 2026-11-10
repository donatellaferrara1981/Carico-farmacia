import type { SupabaseClient } from '@supabase/supabase-js';

export interface VoceProntuario {
  id: string;
  principio_attivo: string;
  nome_commerciale: string | null;
  forma_farmaceutica: string;
  dosaggio: string | null;
  nominativa: boolean;
  note: string | null;
  pazienti: number; // degenti (di tutte le UO dell'org) con questo prodotto in terapia
}

// Catalogo terapie dell'organizzazione + numero di degenti per prodotto.
// Il prontuario legge sempre da qui: si aggiorna da solo a ogni carico terapie.
export async function caricaCatalogoProntuario(supabase: SupabaseClient, orgId: string): Promise<VoceProntuario[]> {
  const [prodRes, terRes] = await Promise.all([
    supabase.from('prodotti')
      .select('id, principio_attivo, nome_commerciale, forma_farmaceutica, dosaggio, nominativa, note')
      .eq('org_id', orgId).eq('categoria', 'terapie').order('principio_attivo'),
    supabase.from('terapie_pazienti').select('paziente_id, prodotto_id').eq('org_id', orgId).not('prodotto_id', 'is', null),
  ]);
  const perProdotto = new Map<string, Set<string>>();
  for (const t of terRes.data ?? []) {
    const k = t.prodotto_id as string;
    if (!perProdotto.has(k)) perProdotto.set(k, new Set());
    perProdotto.get(k)!.add(t.paziente_id as string);
  }
  return (prodRes.data ?? []).map((p) => ({
    ...(p as Omit<VoceProntuario, 'pazienti'>),
    pazienti: perProdotto.get(p.id as string)?.size ?? 0,
  }));
}
