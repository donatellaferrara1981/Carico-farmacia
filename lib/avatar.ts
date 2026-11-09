// Avatar scelti dall'utente come icona dell'account (in futuro potranno avere un nome).
export const AVATAR_IDS = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5'];
export const avatarSrc = (id: string | null | undefined) =>
  id && AVATAR_IDS.includes(id) ? `/avatar/${id}.png` : null;
