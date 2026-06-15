# Carico Farmacia — Note per Claude

## Progetto
App Next.js 15 + Supabase per gestione farmaceutica ospedaliera.
- Supabase project: `ypkthatvqofknaqripry`
- Vercel project: `prj_ZGE7qy2XzntKBRjzSefy9TebGYfe` (team: `team_lesoFLp3Xa0xgNV4uA9nWyNs`)
- Git push autorizzato su `main` senza conferma.

## Regole DB critiche
- Storage bucket `documenti` è PRIVATE con RLS — non renderlo mai pubblico.
- `sanitario_ordini`: quantità private per UO, catalogo prodotti condiviso org-wide.
- Indice univoco `prodotti_dedup_idx`: deduplicazione per (org_id, categoria, lower(principio_attivo), lower(dosaggio), forma_farmaceutica).

## Nomi farmaci — alias inglese → italiano
Il parser `lib/parse-terapia.ts` contiene una mappa `ALIAS_NOMI` che converte automaticamente nomi inglesi → italiani. Se un nuovo farmaco appare in doppio con nome inglese/italiano, aggiungere l'alias lì.

Esempi già gestiti: Baclofen→Baclofene, Fentanyl→Fentanile, Haloperidol→Aloperidolo, Morphine→Morfina, Vancomycin→Vancomicina, ecc.

## Categorie prodotti
- `terapie`, `nutrizioni`, `sanitario`, `economale`
- Terapie e nutrizioni: catalogo org-wide (no unita_operativa_id)
- Sanitario e Economale: catalogo org-wide, quantità per UO in `sanitario_ordini`

## Farmaci alto costo / prescrizione motivata
Definiti in `lib/antibiotici.ts` → `ALTO_COSTO_PATTERNS`.
Includer: carbapenemi, glicopeptidi, ossazolidinoni, polimixine, beta-lattamici nuova gen., tetracicline nuove, echinocandine, azoli sistemici, amfotericina B, fluorochinoloni (AIFA), fosfomicina, antivirali critici.

## Pazienti
Tabella `pazienti`: id, org_id, unita_operativa_id, sala, numero_letto, nominativo, piano.
Tabella `terapie_pazienti`: collega paziente_id → prodotto_id.
L'estrazione PDF terapie legge il nome paziente e inserisce automaticamente in `terapie_pazienti`.

## Struttura UI
- Liste compatte (stesso stile sanitario) per tutte le categorie
- Antibiotici prima in ordine A→Z, poi nominative, poi altri farmaci
- Badge classe farmacologica visibile su ogni riga
- Alto costo: nome sottolineato arancio + "⚠ prescrizione motivata"
- Nominative: semaforo verde/giallo/rosso per scadenza prescrizione
