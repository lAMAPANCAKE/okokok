import { supabase } from './supabase'

export type BucketPrivato = 'documenti' | 'ricevute' | 'sopralluoghi'

export const TIPI_FILE_ACCETTATI = 'image/jpeg,image/png,image/webp,image/heic,application/pdf'
const DIMENSIONE_MASSIMA = 10 * 1024 * 1024

/** Carica un file in un bucket privato, nella cartella indicata (id utente o id sopralluogo). */
export async function caricaFile(bucket: BucketPrivato, cartella: string, file: File, dimensioneMassima = DIMENSIONE_MASSIMA): Promise<string> {
  if (file.size > dimensioneMassima) throw new Error(`Il file supera i ${Math.round(dimensioneMassima / 1024 / 1024)} MB`)
  const estensione = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const percorso = `${cartella}/${crypto.randomUUID()}.${estensione}`
  const { error } = await supabase.storage.from(bucket).upload(percorso, file, { contentType: file.type || undefined })
  if (error) throw error
  return percorso
}

/** Apre un file privato con un link firmato valido 60 secondi. */
export async function apriFile(bucket: BucketPrivato, percorso: string) {
  // La finestra va aperta subito (prima dell'await) per non essere bloccata dal browser
  const finestra = window.open('', '_blank')
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(percorso, 60)
  if (error || !data) {
    finestra?.close()
    throw error ?? new Error('File non disponibile')
  }
  if (finestra) finestra.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}

/** Link firmati per più file (es. anteprime), validi un'ora. */
export async function linkFirmati(bucket: BucketPrivato, percorsi: string[]): Promise<Map<string, string>> {
  if (!percorsi.length) return new Map()
  const { data } = await supabase.storage.from(bucket).createSignedUrls(percorsi, 3600)
  const coppie: [string, string][] = []
  for (const d of data ?? []) if (d.path && d.signedUrl) coppie.push([d.path, d.signedUrl])
  return new Map(coppie)
}

export async function eliminaFile(bucket: BucketPrivato, percorso: string) {
  await supabase.storage.from(bucket).remove([percorso])
}
