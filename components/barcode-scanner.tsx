'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Loader2, AlertTriangle } from 'lucide-react';

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
      const raw6 = clean.slice(i + 2, i + 8); // YYMMDD
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

interface Props {
  onResult: (data: ScannedData) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onResult, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const stopRef     = useRef<(() => void) | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRaw, setLastRaw] = useState<string | null>(null);

  const handleDecode = useCallback((raw: string) => {
    setLastRaw(raw);
    const gs1 = parseGS1(raw);
    onResult({ barcode: raw, gtin: gs1.gtin, data_scadenza: gs1.scadenza, lotto: gs1.lotto });
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
        // Preferisci fotocamera posteriore (environment)
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
    <div className="fixed inset-0 z-[70] bg-black/85 flex items-end sm:items-center justify-center">
      <div className="bg-bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl border border-line w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-bg-soft">
          <div className="flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-ink-mute" />
            <span className="text-xs font-semibold text-ink">Scansione codice a barre</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-ink-mute hover:text-ink hover:bg-bg transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Video */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {/* Mirino */}
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

        <div className="px-3 py-2.5 space-y-1.5">
          {error && (
            <div className="flex items-center gap-2 text-xs text-abx bg-abx/10 border border-abx/30 rounded-lg px-2.5 py-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
            </div>
          )}
          {lastRaw && (
            <p className="text-[10px] text-ink-mute font-mono truncate bg-bg-soft rounded px-2 py-1">✓ {lastRaw}</p>
          )}
          <p className="text-[10px] text-ink-mute text-center leading-relaxed">
            Inquadra il <strong>DataMatrix</strong> (quadratino 2D) o il codice a barre EAN.<br />
            La data di scadenza viene estratta automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
