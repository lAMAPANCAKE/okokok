// Popola il database con dati DEMO fittizi (3 utenti per ruolo, 2 eventi con turni).
// Uso: node --env-file=.env.seed scripts/seed-demo.mjs
// Serve la service role key: NON usarlo in produzione con dati reali.
import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
  console.error('Imposta SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e DEMO_PASSWORD (vedi .env.seed.example)')
  process.exit(1)
}
if (DEMO_PASSWORD.length < 8) {
  console.error('DEMO_PASSWORD deve avere almeno 8 caratteri')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function check(r, cosa) {
  if (r.error) {
    console.error(`Errore durante ${cosa}:`, r.error.message)
    process.exit(1)
  }
  return r.data
}

const iso = (d) => d.toISOString().slice(0, 10)
const traGiorni = (n) => iso(new Date(Date.now() + n * 86400000))

const UTENTI = [
  ...[1, 2, 3].map((n) => ({ ruolo: 'admin', nome: 'DEMO Admin', cognome: String(n), tariffa: 0, competenze: [] })),
  ...[1, 2, 3].map((n) => ({ ruolo: 'responsabile', nome: 'DEMO Responsabile', cognome: String(n), tariffa: 0, competenze: ['sala'] })),
  { ruolo: 'collaboratore', nome: 'DEMO Collaboratore', cognome: '1', tariffa: 12, competenze: ['sala', 'inglese'] },
  { ruolo: 'collaboratore', nome: 'DEMO Collaboratore', cognome: '2', tariffa: 13, competenze: ['bar', 'patente B'] },
  { ruolo: 'collaboratore', nome: 'DEMO Collaboratore', cognome: '3', tariffa: 12, competenze: ['hostess', 'inglese', 'francese'] },
].map((u, i) => ({ ...u, email: `demo.${u.ruolo}.${u.cognome}@example.com`, indice: i }))

async function trovaUtente(email) {
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => x.email === email)
    if (u) return u
    if (data.users.length < 200) return null
  }
}

console.log('Creo gli utenti DEMO…')
const ids = {}
for (const u of UTENTI) {
  let utente = await trovaUtente(u.email)
  if (!utente) {
    check(await db.from('inviti').insert({ email: u.email, ruolo: u.ruolo, tariffa_oraria: u.tariffa }), `invito ${u.email}`)
    utente = check(await db.auth.admin.createUser({ email: u.email, password: DEMO_PASSWORD, email_confirm: true }), `utente ${u.email}`).user
  }
  ids[u.email] = utente.id
  check(
    await db
      .from('profiles')
      .update({ nome: u.nome, cognome: u.cognome, ruolo: u.ruolo, tariffa_oraria: u.tariffa, competenze: u.competenze, attivo: true, profilo_completo: true, telefono: '+39 000 000 000' + u.indice })
      .eq('id', utente.id),
    `profilo ${u.email}`,
  )
}

const responsabile = ids['demo.responsabile.1@example.com']
const [c1, c2, c3] = [1, 2, 3].map((n) => ids[`demo.collaboratore.${n}@example.com`])

console.log('Creo gli eventi DEMO…')
// I turni completati non si possono eliminare: per rigenerare i DEMO li si riporta prima ad annullati
const vecchi = check(await db.from('eventi').select('id').like('nome', 'DEMO %'), 'lettura eventi DEMO')
if (vecchi.length) {
  const idVecchi = vecchi.map((e) => e.id)
  check(await db.from('turni').update({ ore_totali: null, ore_notturne: 0, ore_festive: 0, ore_straordinarie: 0, stato: 'annullato' }).in('evento_id', idVecchi), 'pulizia turni DEMO')
  check(await db.from('eventi').delete().in('id', idVecchi), 'pulizia eventi DEMO')
}

const passato = check(
  await db
    .from('eventi')
    .insert({ nome: 'DEMO Cena aziendale', cliente: 'DEMO Cliente S.r.l.', data: traGiorni(-5), luogo: 'DEMO Villa, Milano', ora_inizio: '19:00', ora_fine: '00:30', personale_richiesto: 2, stato: 'concluso', note: 'DEMO: divisa nera, ritrovo 18:30', creato_da: responsabile })
    .select()
    .single(),
  'evento passato',
)
const futuro = check(
  await db
    .from('eventi')
    .insert({ nome: 'DEMO Matrimonio', cliente: 'DEMO Famiglia Rossi', data: traGiorni(4), luogo: 'DEMO Cascina, Bergamo', ora_inizio: '16:00', ora_fine: '01:00', personale_richiesto: 4, note: 'DEMO: aperitivo in giardino, poi cena placée', creato_da: responsabile })
    .select()
    .single(),
  'evento futuro',
)

// Turni dell'evento passato: confermati e poi completati con ore registrate
const turniPassati = check(
  await db
    .from('turni')
    .insert([
      { evento_id: passato.id, collaboratore_id: c1, data: passato.data, ora_inizio: '18:30', ora_fine: '00:30', mansione: 'cameriere di sala', tariffa_oraria: 12, stato: 'confermato' },
      { evento_id: passato.id, collaboratore_id: c2, data: passato.data, ora_inizio: '18:30', ora_fine: '01:00', mansione: 'bartender', tariffa_oraria: 13, stato: 'confermato' },
    ])
    .select(),
  'turni evento passato',
)
for (const t of turniPassati) {
  check(await db.from('turni').update({ ore_totali: 6, ore_notturne: 0.5 }).eq('id', t.id), 'ore turno passato')
}

// Turni dell'evento futuro: uno confermato, due da confermare
check(
  await db.from('turni').insert([
    { evento_id: futuro.id, collaboratore_id: c1, data: futuro.data, ora_inizio: '15:30', ora_fine: '01:00', mansione: 'capo sala', tariffa_oraria: 14, stato: 'confermato' },
    { evento_id: futuro.id, collaboratore_id: c2, data: futuro.data, ora_inizio: '16:00', ora_fine: '01:00', mansione: 'bartender', tariffa_oraria: 13 },
    { evento_id: futuro.id, collaboratore_id: c3, data: futuro.data, ora_inizio: '16:00', ora_fine: '20:00', mansione: 'hostess', tariffa_oraria: 12 },
  ]),
  'turni evento futuro',
)

console.log('\nFatto. Utenti DEMO (password = DEMO_PASSWORD):')
for (const u of UTENTI) console.log(`  ${u.ruolo.padEnd(13)} ${u.email}`)
