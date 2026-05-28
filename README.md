# Carico Farmacia

App per la gestione del carico farmacia con cicli terapia, archivio e promemoria, costruita con Next.js 15, Supabase e Tailwind.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS 3** con palette personalizzata (verde foresta, avorio, ambra)
- **@supabase/ssr** per autenticazione SSR e Row Level Security
- **PWA** installabile su iOS e Android tramite link

## Setup locale

```bash
npm install
cp .env.example .env.local
# inserisci le credenziali Supabase in .env.local
npm run dev
```

Apri http://localhost:3000.

## Variabili d'ambiente

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Il progetto attualmente collegato è `bunmnzeabuewoyhacuqb` (region `eu-central-1`). Dashboard: https://supabase.com/dashboard/project/bunmnzeabuewoyhacuqb

## Struttura

```
app/
├── (auth)/              # login, signup, callback OAuth
│   ├── login/
│   ├── signup/
│   └── actions.ts       # server actions auth
├── (app)/               # area autenticata
│   ├── layout.tsx       # header + footer
│   └── page.tsx         # dashboard
├── auth/callback/       # OAuth callback Google/Microsoft (futuro)
├── layout.tsx
├── page.tsx             # redirect login/app
└── manifest.ts          # PWA manifest

components/
├── logo.tsx             # SVG inline in 3 varianti
├── app-header.tsx       # header autenticato
└── role-badge.tsx       # badge ruolo

lib/
├── supabase/            # client, server, middleware SSR
├── auth.ts              # getCurrentUserContext()
├── types.ts             # tipi dominio
└── utils.ts             # cn() per className

middleware.ts            # protegge le route, refresh sessione
public/                  # icone PWA, logo SVG
```

## Sicurezza

- Tutte le tabelle hanno Row Level Security attiva
- Ruoli: **Amministratore**, **Collaboratore**, **Visualizzatore**
- L'utente vede solo i dati della propria organizzazione
- Il primo signup crea automaticamente l'organizzazione e nomina l'utente Admin

## Deploy

### Vercel (consigliato)

1. Push del repo su GitHub
2. Importa il progetto da [vercel.com/new](https://vercel.com/new)
3. Configura le env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy

Una volta ottenuto l'URL pubblico (es. `carico-farmacia.vercel.app`), aprilo dal telefono in Safari (iOS) o Chrome (Android) e scegli "Aggiungi a schermata Home". L'app comparirà come applicazione nativa con il logo capsula.

## Cosa manca (roadmap)

- [ ] CRUD articoli (terapie/nutrizioni/sanitario × turni)
- [ ] Cicli terapia (start/end/prosecuzione, segnalazione scadenze)
- [ ] Archivio con esportazione Word
- [ ] Promemoria con sincronizzazione Google Calendar e Microsoft 365
- [ ] Analisi consumo medio
- [ ] Gestione utenti via UI (inviti, ruoli, rimozione)
- [ ] OAuth Google e Microsoft per login diretto
- [ ] Edge Function notturna per calendarizzazione ottimale dei rifornimenti
