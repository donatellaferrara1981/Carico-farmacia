'use client';

import { useState, useTransition } from 'react';
import { Globe, Search, Loader2, Plus, Check, ExternalLink, X } from 'lucide-react';
import { cercaBandiOnlineAction, importaBandoAction, type BandoTrovato } from '@/app/(app)/gare/cerca-online-action';

export function GareCercaOnline({ orgId }: { orgId: string }) {
  const [aperto, setAperto] = useState(false);
  const [query, setQuery] = useState('');
  const [risultati, setRisultati] = useState<BandoTrovato[]>([]);
  const [cercando, startCerca] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  const [importati, setImportati] = useState<Set<number>>(new Set());
  const [importando, setImportando] = useState<number | null>(null);

  function cerca() {
    if (!query.trim()) return;
    setErrore(null);
    setRisultati([]);
    setImportati(new Set());
    startCerca(async () => {
      const res = await cercaBandiOnlineAction(query);
      if (res.error) { setErrore(res.error); return; }
      setRisultati(res.risultati ?? []);
      if ((res.risultati ?? []).length === 0) setErrore('Nessun bando trovato. Prova con termini diversi (es. nome farmaco, CIG, ditta).');
    });
  }

  async function importa(bando: BandoTrovato, idx: number) {
    setImportando(idx);
    const res = await importaBandoAction(bando, orgId);
    setImportando(null);
    if (res.error) { alert('Errore: ' + res.error); return; }
    setImportati(prev => new Set(prev).add(idx));
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        title="Cerca bandi online"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-ink-soft hover:text-forest hover:border-forest/50 transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-forest/30 bg-forest/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-forest" />
          <p className="text-sm font-semibold text-ink">Cerca bandi online</p>
          <span className="text-[10px] text-ink-mute bg-bg-soft px-2 py-0.5 rounded-full border border-line">ANAC · CONSIP · Portali regionali</span>
        </div>
        <button onClick={() => setAperto(false)} className="text-ink-mute hover:text-ink">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cerca()}
            placeholder="es. Amoxicillina Sicilia, guanti nitrile ASP, CIG 12345…"
            className="input-base w-full pl-9 pr-3 py-2 text-sm"
            autoFocus
          />
        </div>
        <button
          onClick={cerca}
          disabled={cercando || !query.trim()}
          className="btn-primary text-sm px-4 flex items-center gap-2 shrink-0"
        >
          {cercando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {cercando ? 'Ricerca…' : 'Cerca'}
        </button>
      </div>

      {errore && (
        <p className="text-xs text-amber-700 bg-amber/10 border border-amber/30 px-3 py-2 rounded-lg">{errore}</p>
      )}

      {risultati.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-mute font-medium">{risultati.length} bando{risultati.length > 1 ? 'i' : ''} trovato{risultati.length > 1 ? 'i' : ''}</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {risultati.map((b, i) => (
              <div key={i} className="rounded-lg border border-line bg-bg-card p-3 flex gap-3 items-start">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-xs font-bold text-ink">{b.descrizione}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-forest/10 text-forest border border-forest/20 font-semibold">{b.categoria}</span>
                  </div>
                  <p className="text-[10px] text-ink-mute">
                    {b.numero_gara && <span className="font-mono mr-2">{b.numero_gara}</span>}
                    {b.ditta_aggiudicataria && <span>{b.ditta_aggiudicataria}</span>}
                    {b.prezzo_unitario && <span className="ml-2 font-semibold text-forest">€ {b.prezzo_unitario.toFixed(4)}{b.unita_misura ? `/${b.unita_misura}` : ''}</span>}
                  </p>
                  {(b.data_scadenza || b.lotto || b.aic) && (
                    <p className="text-[10px] text-ink-mute">
                      {b.data_scadenza && <span>Scad: {new Date(b.data_scadenza).toLocaleDateString('it-IT')} · </span>}
                      {b.lotto && <span>Lotto: {b.lotto} · </span>}
                      {b.aic && <span>AIC: {b.aic}</span>}
                    </p>
                  )}
                  {b.fonte && (
                    <p className="text-[10px] text-ink-mute flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" />
                      {b.fonte}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => importa(b, i)}
                  disabled={importati.has(i) || importando === i}
                  className={`shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                    importati.has(i)
                      ? 'bg-forest/10 text-forest border-forest/30'
                      : 'bg-bg text-ink-soft border-line hover:text-forest hover:border-forest/50'
                  }`}
                >
                  {importando === i
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : importati.has(i)
                    ? <Check className="w-3.5 h-3.5" />
                    : <Plus className="w-3.5 h-3.5" />}
                  {importati.has(i) ? 'Aggiunto' : 'Importa'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
