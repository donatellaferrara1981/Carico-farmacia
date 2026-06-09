import { createClient } from '@/lib/supabase/server';
import { AlertBell, type AlertItem } from './alert-bell';

function nextWeekday(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

export async function AlertBellServer({ orgId }: { orgId: string }) {
  const supabase = await createClient();

  const [prodottiRes, configRes, archivRes] = await Promise.all([
    supabase.from('prodotti').select('*').eq('org_id', orgId),
    supabase.from('alert_config').select('*').eq('org_id', orgId).maybeSingle(),
    supabase.from('avvisi_archiviati').select('prodotto_id, tipo').eq('org_id', orgId),
  ]);

  const prodotti = prodottiRes.data ?? [];
  const config = configRes.data;
  const anticipo = config?.scadenza_anticipo_giorni ?? 14;

  // Set archiviati: "prodottoId|tipo"
  const archiviati = new Set((archivRes.data ?? []).map((r: { prodotto_id: string; tipo: string }) => `${r.prodotto_id}|${r.tipo}`));

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const alerts: AlertItem[] = [];

  for (const p of prodotti) {
    // ── Scorta bassa ──
    const soglia = p.soglia_minima ?? Math.ceil((p.consumo_giornaliero ?? 1) * 3);
    if (p.quantita <= soglia && !archiviati.has(`${p.id}|scorta`)) {
      alerts.push({
        id: p.id, tipo: 'scorta',
        principio_attivo: p.principio_attivo, nome_commerciale: p.nome_commerciale,
        dosaggio: p.dosaggio, categoria: p.categoria, quantita: p.quantita, soglia,
      });
    }

    // ── Scadenza farmaco ──
    if (p.data_scadenza && !archiviati.has(`${p.id}|scadenza`)) {
      const scad = new Date(p.data_scadenza);
      const gg = Math.ceil((scad.getTime() - oggi.getTime()) / 86400000);
      if (gg >= 0 && gg <= anticipo) {
        alerts.push({
          id: p.id, tipo: 'scadenza',
          principio_attivo: p.principio_attivo, nome_commerciale: p.nome_commerciale,
          dosaggio: p.dosaggio, categoria: p.categoria,
          data_scadenza: p.data_scadenza, giorni_alla_scadenza: gg,
        });
      }
    }

    // ── Esaurimento scorta consegnata ──
    if (
      p.alert_esaurimento !== false &&
      p.quantita_consegnata && p.quantita_consegnata > 0 &&
      p.consumo_giornaliero > 0 &&
      p.data_consegna &&
      !archiviati.has(`${p.id}|esaurimento`)
    ) {
      const dataConsegna = new Date(p.data_consegna);
      const giorniScorta = Math.ceil(p.quantita_consegnata / p.consumo_giornaliero);
      const dataEsaurimento = new Date(dataConsegna);
      dataEsaurimento.setDate(dataEsaurimento.getDate() + giorniScorta);

      const alertDay = nextWeekday(dataEsaurimento);
      alertDay.setHours(0, 0, 0, 0);

      if (oggi >= alertDay && oggi <= dataEsaurimento) {
        const ggMancanti = Math.ceil((dataEsaurimento.getTime() - oggi.getTime()) / 86400000);
        alerts.push({
          id: p.id, tipo: 'esaurimento',
          principio_attivo: p.principio_attivo, nome_commerciale: p.nome_commerciale,
          dosaggio: p.dosaggio, categoria: p.categoria,
          quantita: p.quantita_consegnata,
          data_esaurimento: dataEsaurimento.toLocaleDateString('it-IT'),
          giorni_alla_scadenza: ggMancanti,
        });
      }
    }
  }

  return <AlertBell alerts={alerts} />;
}
