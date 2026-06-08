'use client';

import { useState } from 'react';
import { Printer, Share2, Mail, MessageCircle, Copy, Check, ChevronDown } from 'lucide-react';

interface SharePrintBarProps {
  titolo: string;
  testoCondivisione: () => string;
  generaHtml: () => string;
  className?: string;
}

export function SharePrintBar({ titolo, testoCondivisione, generaHtml, className = '' }: SharePrintBarProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied]       = useState(false);

  function stampa() {
    const html = generaHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, '_blank');
    if (!w) { URL.revokeObjectURL(url); return; }
    w.addEventListener('load', () => { w.print(); URL.revokeObjectURL(url); });
  }

  async function condividi() {
    const testo = testoCondivisione();
    if (navigator.share) {
      try { await navigator.share({ title: titolo, text: testo }); return; } catch { /* annullato */ }
    }
    setShareOpen((v) => !v);
  }

  function whatsapp() {
    const testo = encodeURIComponent(testoCondivisione());
    window.open(`https://wa.me/?text=${testo}`, '_blank');
    setShareOpen(false);
  }

  function email() {
    const testo = encodeURIComponent(testoCondivisione());
    window.open(`mailto:?subject=${encodeURIComponent(titolo)}&body=${testo}`, '_blank');
    setShareOpen(false);
  }

  async function copia() {
    await navigator.clipboard.writeText(testoCondivisione());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShareOpen(false);
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={stampa}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line bg-bg-soft hover:border-forest/40 text-ink-soft hover:text-forest transition-colors"
      >
        <Printer className="w-3.5 h-3.5" /> Stampa
      </button>

      <div className="relative">
        <button
          onClick={condividi}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-line bg-bg-soft hover:border-forest/40 text-ink-soft hover:text-forest transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" /> Condividi
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>

        {shareOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShareOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-40 bg-bg-card border border-line rounded-xl shadow-xl w-44 py-1 text-sm overflow-hidden">
              <button
                onClick={whatsapp}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-green-600 shrink-0" /> WhatsApp
              </button>
              <button
                onClick={email}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors"
              >
                <Mail className="w-4 h-4 text-forest shrink-0" /> Email
              </button>
              <button
                onClick={copia}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-bg-soft text-ink transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-forest shrink-0" /> : <Copy className="w-4 h-4 text-ink-mute shrink-0" />}
                {copied ? 'Copiato!' : 'Copia testo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helper HTML comune ──────────────────────────────────────────────────────
export function htmlBase(titolo: string, sottotitolo: string, corpo: string) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>${titolo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:14px}
  h1{font-size:13px;font-weight:700;margin-bottom:3px}
  h2{font-size:11px;font-weight:700;margin:10px 0 4px}
  .sub{font-size:10px;color:#6b7280;margin-bottom:10px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th{background:#f3f4f6;font-size:10px;font-weight:600;padding:4px 6px;border:1px solid #d1d5db;text-align:left}
  td{font-size:11px;padding:3px 6px;border:1px solid #e5e7eb;vertical-align:middle}
  tr:nth-child(even) td{background:#fafafa}
  .num{text-align:right}
  .red{color:#dc2626;font-weight:700}
  .green{color:#166534;font-weight:700}
  @media print{@page{size:A4;margin:1cm}body{padding:0}}
</style></head><body>
<h1>${titolo}</h1><div class="sub">${sottotitolo}</div>
${corpo}
</body></html>`;
}
