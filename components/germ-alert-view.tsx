'use client';

import { useState, useRef, useTransition } from 'react';
import { Upload, Loader2, Trash2, ChevronDown, ChevronUp, AlertTriangle, FileText, Microscope } from 'lucide-react';
import { estraiGermAlertAction, eliminaGermAlertAction } from '@/app/(app)/germ-alert/actions';

export interface GermAlert {
  id: string;
  germe: string;
  fonte_campione: string | null;
  data_rilevamento: string | null;
  sala: string | null;
  numero_letto: number | null;
  nominativo: string | null;
  sensibile: string[] | null;
  resistente: string[] | null;
  intermedio: string[] | null;
  note: string | null;
  created_at: string;
}

interface Props {
  alerts: GermAlert[];
  orgId: string;
}

function AntibioticBadges({ items, color }: { items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((a) => (
        <span key={a} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${color}`}>{a}</span>
      ))}
    </div>
  );
}

function GermCard({ alert, onDelete }: { alert: GermAlert; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [delPending, startDel] = useTransition();

  const sensibile = alert.sensibile ?? [];
  const resistente = alert.resistente ?? [];
  const intermedio = alert.intermedio ?? [];
  const hasMds = resistente.length > 0;

  return (
    <div className={`border rounded-xl overflow-hidden ${hasMds ? 'border-red-200 bg-red-50/30' : 'border-line bg-bg'}`}>
      <div className="flex items-start gap-3 p-3">
        <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${hasMds ? 'bg-red-100' : 'bg-amber-100'}`}>
          <Microscope className={`w-4 h-4 ${hasMds ? 'text-red-600' : 'text-amber-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-ink">{alert.germe}</p>
              {alert.nominativo && (
                <p className="text-xs text-ink-soft mt-0.5">
                  {alert.nominativo}
                  {alert.sala && <span> · {alert.sala}{alert.numero_letto ? ` letto ${alert.numero_letto}` : ''}</span>}
                </p>
              )}
              {!alert.nominativo && alert.sala && (
                <p className="text-xs text-ink-soft mt-0.5">{alert.sala}{alert.numero_letto ? ` · letto ${alert.numero_letto}` : ''}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {alert.note && (
                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold uppercase">{alert.note}</span>
              )}
              <button onClick={() => setExpanded(v => !v)} className="p-1 rounded hover:bg-bg-soft text-ink-mute">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => startDel(async () => { await eliminaGermAlertAction(alert.id); onDelete(); })}
                disabled={delPending}
                className="p-1 rounded hover:bg-red-50 text-ink-mute hover:text-red-500"
              >
                {delPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-ink-soft">
            {alert.fonte_campione && <span>Campione: <b>{alert.fonte_campione}</b></span>}
            {alert.data_rilevamento && (
              <span>Data: <b>{new Date(alert.data_rilevamento).toLocaleDateString('it-IT')}</b></span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-line px-3 pb-3 pt-2 space-y-2">
          {resistente.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-600 uppercase mb-1">Resistente</p>
              <AntibioticBadges items={resistente} color="bg-red-100 text-red-700" />
            </div>
          )}
          {intermedio.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">Intermedio</p>
              <AntibioticBadges items={intermedio} color="bg-amber-100 text-amber-700" />
            </div>
          )}
          {sensibile.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-forest uppercase mb-1">Sensibile</p>
              <AntibioticBadges items={sensibile} color="bg-green-100 text-green-700" />
            </div>
          )}
          {resistente.length === 0 && intermedio.length === 0 && sensibile.length === 0 && (
            <p className="text-xs text-ink-mute">Nessun dato antibiogramma.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function GermAlertView({ alerts: initialAlerts, orgId }: Props) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    const mediaType = isPdf ? 'application/pdf'
      : ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      startTransition(async () => {
        setMsg(null);
        const res = await estraiGermAlertAction(b64, mediaType, orgId);
        if ('error' in res) {
          setMsg({ type: 'err', text: res.error ?? 'Errore.' });
        } else {
          setMsg({ type: 'ok', text: `Germ Alert aggiunto: ${res.germe}` });
          // Reload via router would be better but we're client-side; just show message
          window.location.reload();
        }
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className="border-2 border-dashed border-line rounded-xl p-6 flex flex-col items-center gap-3 cursor-pointer hover:border-forest/50 hover:bg-forest/5 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        {isPending ? (
          <Loader2 className="w-8 h-8 text-forest animate-spin" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-bg-soft flex items-center justify-center">
            <FileText className="w-5 h-5 text-ink-mute" />
          </div>
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-ink">{isPending ? 'Analisi in corso…' : 'Carica referto microbiologico'}</p>
          <p className="text-xs text-ink-mute mt-0.5">PDF, JPEG o PNG · Claude estrae germe e antibiogramma</p>
        </div>
      </div>

      {msg && (
        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-forest/10 text-forest' : 'bg-red-50 text-red-600'}`}>
          {msg.type === 'err' && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          {msg.text}
        </div>
      )}

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 text-ink-mute text-sm">
          <Microscope className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Nessun Germ Alert registrato.
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <GermCard
              key={a.id}
              alert={a}
              onDelete={() => setAlerts(prev => prev.filter(x => x.id !== a.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
