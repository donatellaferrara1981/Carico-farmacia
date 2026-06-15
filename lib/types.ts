export type MemberRole = 'admin' | 'collaboratore' | 'visualizzatore';

export type CategoriaArticolo = 'terapie' | 'nutrizioni' | 'sanitario' | 'economale';
export type Turno = 'mattino' | 'pomeriggio' | 'notte';
export type FormaFarmaceutica =
  | 'cp' | 'caps' | 'scir' | 'fl' | 'crema' | 'pomata' | 'gel' | 'sup'
  | 'bust' | 'gtt' | 'spr' | 'coll' | 'cer' | 'non_specificata';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  default_organization_id: string | null;
  locale: string;
  timezone: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
}

export interface CurrentUserContext {
  user: { id: string; email: string };
  profile: Profile;
  organization: Organization;
  role: MemberRole;
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Amministratore',
  collaboratore: 'Collaboratore',
  visualizzatore: 'Visualizzatore',
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  admin: 'gestisce utenti, modifica tutto, cancella storico',
  collaboratore: 'modifica articoli, cicli, archivi e promemoria',
  visualizzatore: 'sola lettura ed esportazioni',
};

export const CAT_LABELS: Record<CategoriaArticolo, string> = {
  terapie: 'Terapie',
  nutrizioni: 'Nutrizioni',
  sanitario: 'Sanitario',
  economale: 'Economale',
};

export const TURNO_LABELS: Record<Turno, string> = {
  mattino: 'Mattino',
  pomeriggio: 'Pomeriggio',
  notte: 'Notte',
};
