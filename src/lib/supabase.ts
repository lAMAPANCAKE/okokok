import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configurato = Boolean(url && anonKey)

// Con chiavi mancanti l'app mostra una schermata di configurazione invece di rompersi.
export const supabase = createClient(url || 'http://localhost', anonKey || 'chiave-mancante', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** Traduce gli errori più comuni di Supabase in messaggi comprensibili. */
export function messaggioErrore(e: unknown): string {
  const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/Invalid login credentials/i.test(msg)) return 'Email o password non corretti'
  if (/Email not confirmed/i.test(msg)) return 'Email non ancora confermata'
  if (/Password should be at least/i.test(msg)) return 'La password deve avere almeno 8 caratteri'
  if (/rate limit/i.test(msg)) return 'Troppi tentativi, riprova tra qualche minuto'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Connessione assente, riprova'
  if (/row-level security|permission denied/i.test(msg)) return 'Non hai i permessi per questa operazione'
  if (/Failed to send a request to the Edge Function/i.test(msg)) return 'Servizio inviti non raggiungibile: la funzione "invita-utente" non è ancora pubblicata su Supabase (vedi README)'
  return msg
}
