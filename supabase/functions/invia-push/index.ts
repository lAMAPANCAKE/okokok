// Edge Function: invia una notifica push a tutti i dispositivi di un utente.
// La chiama il database (trigger notifiche_push via pg_net) con l'header x-push-secret.
// Segreti richiesti: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SECRET.
// Va pubblicata con: npx supabase functions deploy invia-push --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const risposta = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Confronto a tempo costante del segreto condiviso */
function uguali(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return risposta(405, { errore: 'Metodo non consentito' })

  const segreto = Deno.env.get('PUSH_SECRET') ?? ''
  if (!segreto || !uguali(req.headers.get('x-push-secret') ?? '', segreto)) {
    return risposta(401, { errore: 'Non autorizzato' })
  }

  let corpo: { utente_id?: string; titolo?: string; testo?: string | null; link?: string | null; id?: number }
  try {
    corpo = await req.json()
  } catch {
    return risposta(400, { errore: 'Richiesta non valida' })
  }
  if (!corpo.utente_id || !corpo.titolo) return risposta(400, { errore: 'Dati mancanti' })

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: iscrizioni, error } = await db.from('push_iscrizioni').select('id, endpoint, p256dh, auth').eq('utente_id', corpo.utente_id)
  if (error) return risposta(500, { errore: 'Lettura iscrizioni non riuscita' })

  const contenuto = JSON.stringify({ titolo: corpo.titolo, testo: corpo.testo ?? '', link: corpo.link ?? '/notifiche', id: corpo.id })
  let inviate = 0
  const scadute: string[] = []

  await Promise.all(
    (iscrizioni ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, contenuto, { TTL: 60 * 60 * 24 })
        inviate++
      } catch (e) {
        const codice = (e as { statusCode?: number }).statusCode
        // 404/410: il dispositivo ha revocato l'iscrizione, la togliamo
        if (codice === 404 || codice === 410) scadute.push(s.id)
      }
    }),
  )
  if (scadute.length) await db.from('push_iscrizioni').delete().in('id', scadute)

  return risposta(200, { inviate, rimosse: scadute.length })
})
