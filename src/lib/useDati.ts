import { useCallback, useEffect, useState } from 'react'
import { messaggioErrore } from './supabase'

/** Carica dati asincroni con stato di caricamento/errore e funzione di ricarica. */
export function useDati<T>(carica: () => Promise<T>, dipendenze: unknown[]) {
  const [dati, setDati] = useState<T | null>(null)
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const caricaMemo = useCallback(carica, dipendenze)

  const ricarica = useCallback(async () => {
    setErrore('')
    try {
      setDati(await caricaMemo())
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setCaricamento(false)
    }
  }, [caricaMemo])

  useEffect(() => {
    setCaricamento(true)
    void ricarica()
  }, [ricarica])

  return { dati, errore, caricamento, ricarica }
}

/** Lancia l'errore di una risposta Supabase, altrimenti restituisce i dati. */
export function oppureErrore<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error
  return r.data as T
}
