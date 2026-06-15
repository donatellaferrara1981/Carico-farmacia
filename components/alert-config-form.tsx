'use client';

import { useState, useTransition } from 'react';
import { Bell, BellOff, Mail, Send, Loader2, CheckCircle, Plus, X } from 'lucide-react';
import { salvaAlertConfigAction, inviaTestAlertAction } from '@/app/(app)/impostazioni/alert-actions';

interface AlertConfig {
  email_destinatari: string[];
  alert_scorte: boolean;
  alert_scadenza: boolean;
  alert_riordino: boolean;
  riordino_ogni_giorni: number;
  scadenza_anticipo_giorni: number;
  attivo: boolean;
}

interface Props {
  orgId: string;
  config: AlertConfig | null;
  defaultEmail: string;
}

export function AlertConfigForm({ orgId, config, defaultEmail }: Props) {
  const [isPending, start] = useTransition();
  const [isTestPending, startTest] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialEmails = config?.email_destinatari?.length
    ? config.email_destinatari
    : [defaultEmail];

  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [newEmail, setNewEmail] = useState('');
  const [scorte, setScorte] = useState(config?.alert_scorte ?? true);
  const [scadenza, setScadenza] = useState(config?.alert_scadenza ?? true);
  const [riordino, setRiordino] = useState(config?.alert_riordino ?? false);
  const [riordiniGiorni, setRiordiniGiorni] = useState(config?.riordino_ogni_giorni ?? 7);
  const [anticipo, setAnticipo] = useState(config?.scadenza_anticipo_giorni ?? 14);
  const [attivo, setAttivo] = useState(config?.attivo ?? true);

  function addEmail() {
    const e = newEmail.trim().toLowerCase();
    if (!e || emails.includes(e)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setError('Email non valida'); return; }
    setEmails([...emails, e]);
    setNewEmail('');
    setError(null);
  }

  function removeEmail(idx: number) {
    setEmails(emails.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (emails.length === 0) { setError('Aggiungi almeno un indirizzo email.'); return; }
    setError(null); setSaved(false);
    start(async () => {
      const res = await salvaAlertConfigAction(orgId, {
        email_destinatari: emails,
        alert_scorte: scorte,
        alert_scadenza: scadenza,
        alert_riordino: riordino,
        riordino_ogni_giorni: riordiniGiorni,
        scadenza_anticipo_giorni: anticipo,
        attivo,
      });
      if (res && 'error' in res) { setError(res.error ?? 'Errore'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  function handleTest() {
    setError(null);
    startTest(async () => {
      const res = await inviaTestAlertAction(orgId);
      if (res && 'error' in res) { setError(res.error ?? 'Errore'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="space-y-5">
      {/* Toggle attivo */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-bg-soft">
        <div className="flex items-center gap-3">
          {attivo ? <Bell className="w-5 h-5 text-forest" /> : <BellOff className="w-5 h-5 text-ink-mute" />}
          <div>
            <p className="text-sm font-medium text-ink">Alert email</p>
            <p className="text-xs text-ink-mute">{attivo ? 'Notifiche attive' : 'Notifiche disattivate'}</p>
          </div>
        </div>
        <button
          onClick={() => setAttivo(!attivo)}
          className={`relative w-12 h-6 rounded-full transition-colors ${attivo ? 'bg-forest' : 'bg-line'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${attivo ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Lista destinatari */}
      <div>
        <label className="label-base flex items-center gap-1.5 mb-2">
          <Mail className="w-3.5 h-3.5" /> Destinatari
        </label>

        <div className="space-y-2 mb-2">
          {emails.map((e, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-soft border border-line">
              <span className="text-sm text-ink flex-1">{e}</span>
              {emails.length > 1 && (
                <button onClick={() => removeEmail(i)} className="text-ink-mute hover:text-abx transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="email"
            className="input-base flex-1"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
            placeholder="collega@irccsme.it"
          />
          <button
            onClick={addEmail}
            disabled={!newEmail.trim()}
            title="Aggiungi"
            className="btn-ghost flex items-center gap-1 text-sm disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tipi di alert */}
      <div className="space-y-2">
        <p className="label-base">Tipo di alert</p>

        <label className="flex items-center gap-3 p-3 rounded-lg border border-line cursor-pointer hover:bg-bg-soft">
          <input type="checkbox" checked={scorte} onChange={(e) => setScorte(e.target.checked)} className="w-4 h-4 accent-forest" />
          <div>
            <p className="text-sm font-medium text-ink">Scorte in esaurimento</p>
            <p className="text-xs text-ink-mute">Quando un farmaco scende sotto la soglia minima impostata</p>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 rounded-lg border border-line cursor-pointer hover:bg-bg-soft">
          <input type="checkbox" checked={scadenza} onChange={(e) => setScadenza(e.target.checked)} className="w-4 h-4 accent-forest" />
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">Scadenza farmaci</p>
            <p className="text-xs text-ink-mute">Avviso anticipato prima della data di scadenza</p>
          </div>
          {scadenza && (
            <div className="flex items-center gap-1.5">
              <input
                type="number" min={1} max={90} value={anticipo}
                onChange={(e) => setAnticipo(parseInt(e.target.value) || 14)}
                className="w-14 px-2 py-1 text-xs border border-line rounded-lg text-center focus:outline-none focus:border-forest"
              />
              <span className="text-xs text-ink-mute">gg prima</span>
            </div>
          )}
        </label>

        <label className="flex items-center gap-3 p-3 rounded-lg border border-line cursor-pointer hover:bg-bg-soft">
          <input type="checkbox" checked={riordino} onChange={(e) => setRiordino(e.target.checked)} className="w-4 h-4 accent-forest" />
          <div className="flex-1">
            <p className="text-sm font-medium text-ink">Riordino programmato</p>
            <p className="text-xs text-ink-mute">Promemoria periodico per effettuare il carico</p>
          </div>
          {riordino && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-mute">ogni</span>
              <input
                type="number" min={1} max={90} value={riordiniGiorni}
                onChange={(e) => setRiordiniGiorni(parseInt(e.target.value) || 7)}
                className="w-14 px-2 py-1 text-xs border border-line rounded-lg text-center focus:outline-none focus:border-forest"
              />
              <span className="text-xs text-ink-mute">giorni</span>
            </div>
          )}
        </label>
      </div>

      {error && (
        <p className="text-sm text-abx bg-abx/5 border border-abx/30 rounded-lg px-3 py-2">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-forest flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" /> Salvato
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleTest}
          disabled={isTestPending || emails.length === 0}
          className="btn-ghost flex items-center gap-1.5 text-sm disabled:opacity-40"
        >
          {isTestPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Invia test
        </button>
        <button
          onClick={handleSave}
          disabled={isPending || emails.length === 0}
          className="btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva configurazione'}
        </button>
      </div>
    </div>
  );
}
