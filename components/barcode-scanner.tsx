'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Loader2, AlertTriangle, ScanLine, Usb } from 'lucide-react';

export interface ScannedData {
  barcode: string;
  data_scadenza?: string; // YYYY-MM-DD
  lotto?: string;
  gtin?: string;
}

/** Parsa GS1 DataMatrix/GS1-128. Estrae AI: 01 GTIN, 17 scadenza, 10 lotto. */
function parseGS1(raw: string): { gtin?: string; scadenza?: string; lotto?: string } {
  const clean = raw.replace(/[()]/g, '');
  const result: { gtin?: string; scadenza?: string; lotto?: string } = {};
  let i = 0;
  while (i < clean.length) {
    const ai2 = clean.slice(i, i + 2);
    if (ai2 === '01') {
      result.gtin = clean.slice(i + 2, i + 16);
      i += 16;
    } else if (ai2 === '17') {
      const raw6 = clean.slice(i + 2, i + 8);
      const yy = parseInt(raw6.slice(0, 2), 10);
      const mm = raw6.slice(2, 4);
      const dd = raw6.slice(4, 6) === '00' ? '01' : raw6.slice(4, 6);
      const yyyy = yy <= 49 ? 2000 + yy : 1900 + yy;
      result.scadenza = `${yyyy}-${mm}-${dd}`;
      i += 8;
    } else if (ai2 === '10') {
      const end = Math.min(i + 22, clean.length);
      result.lotto = clean.slice(i + 2, end).replace(/[^\w-]/g, '').slice(0, 20);
      i += 2 + (result.lotto?.length ?? 0);
    } else if (ai2 === '21') {
      i += 22;
    } else {
      i++;
    }
  }
  return result;
}

function processRaw(raw: string): ScannedData {
  const gs1 = parseGS1(raw.trim());
  return { barcode: raw.trim(), gtin: gs1.gtin, data_scadenza: gs1.scadenza, lotto: gs1.lotto };
}

// ── Tab fotocamera ──────────────────────────────────────────────────────────

function CameraTab({ onResult }: { onResult: (d: ScannedData) => void }) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const stopRef     = useRef<(() => void) | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRaw, setLastRaw] = useState<string | null>(null);

  const handleDecode = useCallback((raw: string) => {
    setLastRaw(raw);
    onResult(processRaw(raw));
  }, [onResult]);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 300 });
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!devices.length) { setError('Nessuna fotocamera trovata.'); setLoading(false); return; }
        const cam = devices.find(d => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1];
        if (!active || !videoRef.current) return;
        setLoading(false);

        const controls = await reader.decodeFromVideoDevice(cam.deviceId, videoRef.current, (result) => {
          if (result && active) handleDecode(result.getText());
        });
        stopRef.current = () => controls.stop();
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Errore fotocamera');
        setLoading(false);
      }
    }

    start();
    return () => { active = false; stopRef.current?.(); };
  }, [handleDecode]);

  return (
    <div className="space-y-2">
      <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-52 h-28 relative">
            <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white/90 rounded-tl-sm" />
            <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white/90 rounded-tr-sm" />
            <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white/90 rounded-bl-sm" />
            <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white/90 rounded-br-sm" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-red-400/60 animate-pulse" />
          </div>
        </div>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-abx bg-abx/10 border border-abx/30 rounded-lg px-2.5 py-1.5 mx-3">
          <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
        </div>
      )}
      {lastRaw && <p className="text-[10px] text-ink-mute font-mono truncate bg-bg-soft rounded px-2 py-1 mx-3">✓ {lastRaw}</p>}
      <p className="text-[10px] text-ink-mute text-center px-3 pb-2 leading-relaxed">
        Inquadra il <strong>DataMatrix</strong> (quadratino 2D) o il codice EAN sulla scatola.
      </p>
    </div>
  );
}

// ── Tab scanner USB/Bluetooth ───────────────────────────────────────────────

function UsbTab({ onResult }: { onResult: (d: ScannedData) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue]     = useState('');
  const [done, setDone]       = useState<ScannedData | null>(null);
  const [error, setError]     = useState<string | null>(null);

  // Auto-focus all'apertura del tab
  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      submit(value);
    }
  }

  function submit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const data = processRaw(trimmed);
    if (!data.data_scadenza && !data.gtin) {
      setError('Codice letto, ma nessuna data di scadenza trovata (potrebbe essere solo EAN senza DataMatrix).');
    } else {
      setError(null);
    }
    setDone(data);
    onResult(data);
    setValue('');
  }

  return (
    <div className="px-3 pb-3 pt-2 space-y-3">
      <div className="rounded-lg border border-forest/30 bg-forest/5 p-3 space-y-1">
        <p className="text-[10px] text-forest font-semibold uppercase tracking-wide">In attesa scansione</p>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => setTimeout(() => inputRef.current?.focus(), 50)}
          placeholder="Punta lo scanner sulla scatola…"
          className="w-full text-sm bg-transparent border-none outline-none text-ink placeholder:text-ink-mute font-mono"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber/10 border border-amber/30 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {done && (
        <div className="rounded-lg border border-line bg-bg-soft px-2.5 py-2 space-y-0.5">
          <p className="text-[10px] font-semibold text-ink">Ultimo codice letto:</p>
          {done.gtin && <p className="text-[10px] text-ink-mute font-mono">GTIN: {done.gtin}</p>}
          {done.data_scadenza && <p className="text-[10px] text-forest font-semibold">Scadenza: {done.data_scadenza}</p>}
          {done.lotto && <p className="text-[10px] text-ink-mute">Lotto: {done.lotto}</p>}
          {!done.data_scadenza && <p className="text-[10px] text-ink-mute">Codice: {done.barcode}</p>}
        </div>
      )}

      <div className="text-[10px] text-ink-mute space-y-0.5 leading-relaxed">
        <p>• Collega lo scanner USB/Bluetooth al PC</p>
        <p>• Questa finestra deve restare aperta e attiva</p>
        <p>• Punta lo scanner sul <strong>DataMatrix</strong> (2D) per leggere la scadenza</p>
        <p>• Lo scanner invia il codice automaticamente (non serve premere nulla)</p>
      </div>
    </div>
  );
}

// ── Componente principale ───────────────────────────────────────────────────

interface Props {
  onResult: (data: ScannedData) => void;
  onClose: () => void;
}

type Tab = 'camera' | 'usb';

export function BarcodeScanner({ onResult, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('usb');

  // Chiudi dopo lettura riuscita con scadenza
  function handleResult(data: ScannedData) {
    onResult(data);
    if (data.data_scadenza) onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-end sm:items-center justify-center">
      <div className="bg-bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl border border-line w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-bg-soft">
          <div className="flex items-center gap-1">
            {/* Tab buttons */}
            <button
              onClick={() => setTab('usb')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${tab === 'usb' ? 'bg-forest text-white' : 'text-ink-mute hover:text-ink'}`}
            >
              <Usb className="w-3 h-3" /> Scanner USB
            </button>
            <button
              onClick={() => setTab('camera')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${tab === 'camera' ? 'bg-forest text-white' : 'text-ink-mute hover:text-ink'}`}
            >
              <Camera className="w-3 h-3" /> Fotocamera
            </button>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-mute hover:text-ink hover:bg-bg transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Contenuto tab */}
        {tab === 'camera' ? (
          <CameraTab onResult={handleResult} />
        ) : (
          <UsbTab onResult={handleResult} />
        )}
      </div>
    </div>
  );
}
