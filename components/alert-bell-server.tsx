import { createClient } from '@/lib/supabase/server';
import { AlertBell, type AlertItem } from './alert-bell';

export async function AlertBellServer({ orgId }: { orgId: string }) {
  const supabase = await createClient();

  const [prodottiRes, configRes] = await Promise.all([
    supabase.from('prodotti').select('*').eq('org_id', orgId),
    supabase.from('alert_config').select('*').eq('org_id', orgId).maybeSingle(),
  ]);

  const prodotti = prodottiRes.data ?? [];
  const config = configRes.data;
  const anticipo = config?.scadenza_anticipo_giorni ?? 14;

  const oggi = new Date();
  const alerts: AlertItem[] = [];

  for (const p of prodotti) {
    // Scorte
    const soglia = p.soglia_minima ?? Math.ceil((p.consumo_giornaliero ?? 1) * 3);
    if (p.quantita <= soglia) {
      alerts.push({
        id: p.id,
        tipo: 'scorta',
        principio_attivo: p.principio_attivo,
        nome_commerciale: p.nome_commerciale,
        dosaggio: p.dosaggio,
        categoria: p.categoria,
        quantita: p.quantita,
        soglia,
      });
    }

    // Scadenza
    if (p.data_scadenza) {
      const scad = new Date(p.data_scadenza);
      const gg = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000);
      if (gg >= 0 && gg <= anticipo) {
        alerts.push({
          id: p.id,
          tipo: 'scadenza',
          principio_attivo: p.principio_attivo,
          nome_commerciale: p.nome_commerciale,
          dosaggio: p.dosaggio,
          categoria: p.categoria,
          data_scadenza: p.data_scadenza,
          giorni_alla_scadenza: gg,
        });
      }
    }
  }

  return <AlertBell alerts={alerts} />;
}
