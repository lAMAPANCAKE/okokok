// Coda delle modifiche fatte senza rete (in location il segnale spesso manca):
// zone e foto si salvano sul telefono (IndexedDB) e partono appena torna la connessione.
import { useEffect, useState } from 'react'
import { caricaFile, eliminaFile } from './file'
import { supabase } from './supabase'
import type { ZonaSopralluogo } from './zone'

export interface RigaFoto {
  id: string
  sopralluogo_id: string
  zona_id: string | null
  origine_id: string | null
  tipo: 'foto' | 'rendering'
  didascalia: string | null
  scelto: boolean
}

export type Operazione =
  | { id: string; creata: number; tipo: 'zona'; riga: Omit<ZonaSopralluogo, 'created_at' | 'ordine'> & { ordine?: number }; errore?: string }
  | { id: string; creata: number; tipo: 'foto'; riga: RigaFoto; blob: Blob; nome: string; errore?: string }

/** Operazione da accodare: la data di creazione la mette la coda */
export type OperazioneNuova = Operazione extends infer O ? (O extends Operazione ? Omit<O, 'creata'> : never) : never

const DB = 'gestionale-coda', NEGOZIO = 'operazioni'
const EVENTO = 'coda-cambiata'
const MAX_FOTO = 15 * 1024 * 1024

function apri(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(NEGOZIO, { keyPath: 'id' })
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ko(r.error)
  })
}

async function transazione<T>(modo: IDBTransactionMode, fai: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await apri()
  return new Promise((ok, ko) => {
    const r = fai(db.transaction(NEGOZIO, modo).objectStore(NEGOZIO))
    r.onsuccess = () => ok(r.result)
    r.onerror = () => ko(r.error)
  })
}

export async function operazioniInCoda(): Promise<Operazione[]> {
  try {
    return ((await transazione('readonly', (s) => s.getAll())) as Operazione[]).sort((a, b) => a.creata - b.creata)
  } catch {
    return []
  }
}

const notifica = () => window.dispatchEvent(new Event(EVENTO))

async function metti(op: Operazione) {
  await transazione('readwrite', (s) => s.put(op))
  notifica()
}

async function togli(id: string) {
  await transazione('readwrite', (s) => s.delete(id))
  notifica()
}

/** Errori dovuti alla rete assente o instabile: l'operazione si ritenta più tardi. */
export function erroreDiRete(e: unknown) {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return !navigator.onLine || /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg)
}

async function esegui(op: Operazione) {
  if (op.tipo === 'zona') {
    const { error } = await supabase.from('sopralluogo_zone').upsert(op.riga)
    if (error) throw error
    return
  }
  const file = new File([op.blob], op.nome, { type: op.blob.type || 'image/jpeg' })
  const percorso = await caricaFile('sopralluoghi', op.riga.sopralluogo_id, file, MAX_FOTO)
  const { error } = await supabase.from('sopralluogo_file').upsert({ ...op.riga, file_path: percorso })
  if (error) {
    await eliminaFile('sopralluoghi', percorso)
    throw error
  }
}

/**
 * Prova a eseguire subito; senza rete mette l'operazione in coda e restituisce false.
 * Gli altri errori (permessi, dati non validi) vengono rilanciati.
 */
export async function eseguiOAccoda(op: OperazioneNuova): Promise<boolean> {
  const completa = { ...op, creata: Date.now() } as Operazione
  try {
    if (!navigator.onLine) throw new Error('Failed to fetch')
    await esegui(completa)
    return true
  } catch (e) {
    if (!erroreDiRete(e)) throw e
    // Per le zone conta solo l'ultima versione salvata
    await metti(completa)
    return false
  }
}

let inCorso = false

/** Invia tutto quello che è in coda: prima le zone, poi le foto, in ordine. */
export async function svuotaCoda() {
  if (inCorso || !navigator.onLine) return
  inCorso = true
  try {
    const ops = await operazioniInCoda()
    for (const op of [...ops.filter((o) => o.tipo === 'zona'), ...ops.filter((o) => o.tipo === 'foto')]) {
      try {
        await esegui(op)
        await togli(op.id)
      } catch (e) {
        if (erroreDiRete(e)) break
        // Errore permanente: resta in coda con il motivo, così non si perde
        await metti({ ...op, errore: e instanceof Error ? e.message : String((e as { message?: string }).message ?? e) })
      }
    }
  } finally {
    inCorso = false
  }
}

/** Da chiamare una volta all'avvio dell'app: invia la coda ora, al ritorno della rete e ogni minuto. */
export function avviaCoda() {
  const invia = () => void svuotaCoda()
  invia()
  window.addEventListener('online', invia)
  const timer = window.setInterval(invia, 60_000)
  return () => {
    window.removeEventListener('online', invia)
    window.clearInterval(timer)
  }
}

export function ascoltaCoda(cb: () => void) {
  window.addEventListener(EVENTO, cb)
  return () => window.removeEventListener(EVENTO, cb)
}

export async function scartaOperazione(id: string) {
  await togli(id)
}

/** Operazioni in coda, aggiornate a ogni cambiamento. */
export function useCoda() {
  const [ops, setOps] = useState<Operazione[]>([])
  useEffect(() => {
    const leggi = () => void operazioniInCoda().then(setOps)
    leggi()
    return ascoltaCoda(leggi)
  }, [])
  return ops
}
