'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function uploadDocumentoAction(formData: FormData) {
  const file = formData.get('file') as File | null;
  const orgId = String(formData.get('org_id') ?? '');
  const categoria = String(formData.get('categoria') ?? '');

  const TIPI_ACCETTATI = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp',
  ];

  if (!file || file.size === 0) return { error: 'Nessun file selezionato.' };
  if (!TIPI_ACCETTATI.includes(file.type) && !file.type.startsWith('image/'))
    return { error: 'Formato non supportato. Carica un PDF o un\'immagine (JPG, PNG, HEIC).' };
  if (file.size > 20 * 1024 * 1024) return { error: 'Il file supera i 20 MB.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const storagePath = `${orgId}/${categoria}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const prodottoId = formData.get('prodotto_id') ? String(formData.get('prodotto_id')) : null;
  const sala = formData.get('sala') ? String(formData.get('sala')) : null;

  const { error: uploadError } = await supabase.storage
    .from('documenti')
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { error: dbError } = await supabase.from('documenti').insert({
    org_id: orgId,
    categoria,
    nome_file: file.name,
    storage_path: storagePath,
    dimensione: file.size,
    uploaded_by: user.id,
    ...(prodottoId ? { prodotto_id: prodottoId } : {}),
    ...(sala ? { sala } : {}),
  });

  if (dbError) {
    await supabase.storage.from('documenti').remove([storagePath]);
    return { error: dbError.message };
  }

  revalidatePath(`/${categoria}`);
  return { ok: true };
}

export async function svuotaDocumentiAction(orgId: string, categoria: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  const { data: docs } = await supabase
    .from('documenti')
    .select('storage_path')
    .eq('org_id', orgId)
    .eq('categoria', categoria);

  if (docs && docs.length > 0) {
    await supabase.storage.from('documenti').remove(docs.map((d) => d.storage_path));
    await supabase.from('documenti').delete().eq('org_id', orgId).eq('categoria', categoria);
  }

  revalidatePath(`/${categoria}`);
  return { ok: true };
}

export async function deleteDocumentoAction(id: string, storagePath: string, categoria: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non autenticato.' };

  await supabase.storage.from('documenti').remove([storagePath]);
  await supabase.from('documenti').delete().eq('id', id);

  revalidatePath(`/${categoria}`);
  return { ok: true };
}

export async function getDownloadUrlAction(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from('documenti')
    .createSignedUrl(storagePath, 60 * 60); // 1 ora
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
