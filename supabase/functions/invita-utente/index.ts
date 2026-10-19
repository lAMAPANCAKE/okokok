// Edge Function: l'admin invita un nuovo utente.
// Registra l'invito (ruolo e tariffa) e fa inviare da Supabase Auth l'email di invito
// tramite l'SMTP configurato (Brevo). La service role key resta solo lato server.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function risposta(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const RUOLI = ['collaboratore', 'responsabile', 'admin'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return risposta(405, { errore: 'Metodo non consentito' })

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const appUrl = Deno.env.get('APP_URL')
  const authHeader = req.headers.get('Authorization') ?? ''

  // Verifica che chi chiama sia un admin attivo
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: utente, error: errUtente } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (errUtente || !utente.user) return risposta(401, { errore: 'Sessione non valida' })

  const { data: profilo } = await admin
    .from('profiles')
    .select('ruolo, attivo')
    .eq('id', utente.user.id)
    .single()
  if (!profilo || profilo.ruolo !== 'admin' || !profilo.attivo) {
    return risposta(403, { errore: 'Solo un amministratore può invitare utenti' })
  }

  let input: { email?: string; ruolo?: string; tariffa_oraria?: number }
  try {
    input = await req.json()
  } catch {
    return risposta(400, { errore: 'Richiesta non valida' })
  }

  const email = (input.email ?? '').trim().toLowerCase()
  const ruolo = (input.ruolo ?? 'collaboratore') as (typeof RUOLI)[number]
  const tariffa = Number(input.tariffa_oraria ?? 0)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return risposta(400, { errore: 'Email non valida' })
  if (!RUOLI.includes(ruolo)) return risposta(400, { errore: 'Ruolo non valido' })
  if (!Number.isFinite(tariffa) || tariffa < 0) return risposta(400, { errore: 'Tariffa non valida' })

  // L'invito va registrato prima: il trigger su auth.users lo legge per assegnare il ruolo
  const { error: errInvito } = await admin
    .from('inviti')
    .insert({ email, ruolo, tariffa_oraria: tariffa, creato_da: utente.user.id })
  if (errInvito) {
    const giaInvitato = errInvito.code === '23505'
    return risposta(giaInvitato ? 409 : 500, {
      errore: giaInvitato ? 'Esiste già un invito aperto per questa email' : 'Impossibile registrare l’invito',
    })
  }

  const { error: errEmail } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: appUrl ? `${appUrl}/benvenuto` : undefined,
  })
  if (errEmail) {
    await admin.from('inviti').delete().eq('email', email).is('accettato_il', null)
    return risposta(400, { errore: `Invio dell’invito non riuscito: ${errEmail.message}` })
  }

  return risposta(200, { ok: true })
})
