# Carico Farmacia — Note per Claude

## Accesso app
- **URL:** https://carico-farmacia.vercel.app/login
- **Email:** donatella.ferrara1981@gmail.com
- (password: chiedila a Claude in chat, non va nel repo)

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
Tabella `pazienti`: id, org_id, unita_operativa_id, sala, numero_letto, nominativo, piano,
  codice_sdo, data_ricovero, data_dimissione, diagnosi_principale.
Tabella `terapie_pazienti`: collega paziente_id → prodotto_id.
L'estrazione PDF terapie legge il nome paziente e inserisce automaticamente in `terapie_pazienti`.

## Checklist dimissione (SDO/DRG/PACA)
La checklist di chiusura cartella è CRITICA per il rimborso economico del reparto.

Contesto:
- Quando un paziente viene **dimesso, trasferito o deceduto**, la cartella clinica viene
  valutata dalla **PACA** (organo inviato dall'ASP di competenza).
- Se la cartella è completa e conforme → il reparto riceve il rimborso DRG
  (tariffa variabile per tipo di degenza e diagnosi codificata nella SDO).
- Una voce mancante = cartella non idonea = rimborso non erogato.

Tabella `checklist_dimissione`: org_id, paziente_id, codice_sdo, voce, completata,
  completata_da, completata_at, ordine.

Le voci standard sono in `app/(app)/pazienti/checklist-actions.ts → VOCI_STANDARD`.
Donatella caricherà la checklist ufficiale PACA con le voci esatte richieste dall'ASP —
SOSTITUIRE le voci placeholder con quelle ufficiali quando fornite.

Il numero SDO è l'identificatore primario della pratica di rimborso — va sempre compilato.

## Struttura UI
- Liste compatte (stesso stile sanitario) per tutte le categorie
- Antibiotici prima in ordine A→Z, poi nominative, poi altri farmaci
- Badge classe farmacologica visibile su ogni riga
- Alto costo: nome sottolineato arancio + "⚠ prescrizione motivata"
- Nominative: semaforo verde/giallo/rosso per scadenza prescrizione
