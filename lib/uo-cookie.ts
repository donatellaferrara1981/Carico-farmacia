import { cookies } from 'next/headers';

const COOKIE = 'uo_attiva';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 giorni

export async function getUoAttivaId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}

export async function setUoAttivaId(id: string) {
  const jar = await cookies();
  jar.set(COOKIE, id, { path: '/', maxAge: MAX_AGE, sameSite: 'lax' });
}

export async function clearUoAttivaId() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
