// Voci standard checklist dimissione PACA — costanti condivise (NO 'use server')

export const VOCI_STANDARD = [
  'Documento Tribunale per Amministratore di Sostegno',
  'Foglio di ricovero stampato da ADT e firma del consenso al trattamento dei dati personali in calce al foglio',
  'Accettazione condizioni di ricovero firmato dal paziente o dal suo rappresentante legale e dal medico che accetta il paziente',
  'Elenco documentazione consegnata e firmata dal paziente/familiare controfirmata anche dal medico',
  'Consenso informato al trattamento neuroriabilitativo controfirmato dal paziente/familiare e medico',
  'Documento di riconoscimento e tessera sanitaria',
  'Algoritmo per la definizione del rischio datato e firmato dal medico che accetta il paziente',
  'Scala di valutazione del rischio caduta compilata e firmata dal medico',
  'Visual Analogue Scale (VAS) per il dolore compilata al ricovero e ogni 3 giorni per tutta la durata del ricovero',
  'Scheda di valutazione delle ulcere da decubito',
  'Scheda alta criticità',
  'Check list ICF da compilare, datare e firmare; inserire il caregiver nell\'ultimo foglio',
  'Proposta di ricovero',
  'Scheda di valutazione al ricovero firmata',
  'Impegnativa (se proveniente dal domicilio)',
  'Scheda di accesso ospedaliero del medico curante ALLEGATO E/D (se proveniente dal domicilio)',
  'Diaria giornaliera su Tabula',
  'Relazione di dimissione datata e firmata dal medico, dal medico in doppia copia',
  'SDO stampata e firmata',
  'Frontespizio cartella elettronica + diagnosi di ingresso e dimissione stampato e firmato',
];

export interface VoceChecklist {
  id: string;
  voce: string;
  completata: boolean;
  completata_da: string | null;
  completata_at: string | null;
  ordine: number;
}
