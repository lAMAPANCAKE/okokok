// Verifica migrazioni, RLS e trigger su Postgres in WebAssembly (PGlite) con stub minimi di Supabase.
// Uso: npm run test:db  — non richiede Docker né un progetto Supabase.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = process.argv[2] ?? fileURLToPath(new URL('../supabase/migrations', import.meta.url))
const db = new PGlite()
let ok = 0, ko = 0
const pass = (m) => { ok++; console.log('  ✓ ' + m) }
const fail = (m) => { ko++; console.log('  ✗ ' + m) }

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  grant all on storage.objects to authenticated;
`)

console.log('Migrazioni:')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  try { await db.exec(readFileSync(join(dir, f), 'utf8')); pass(f) } catch (e) { fail(`${f}: ${e.message}`); process.exit(1) }
}

// Esegue come utente autenticato (o come service/SQL editor se id è null)
async function come(id, sql, params = []) {
  await db.exec(id ? `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);` : `reset role; select set_config('request.jwt.claim.sub', '', false);`)
  try { return await db.query(sql, params) } finally { await db.exec('reset role') }
}
async function deveFallire(id, sql, msg) {
  try { await come(id, sql); fail(msg + ' (non ha dato errore)') } catch (e) { pass(`${msg} → bloccato: ${e.message.slice(0, 80)}`) }
}

console.log('\nRegistrazione su invito:')
await come(null, `insert into inviti (email, ruolo, tariffa_oraria) values ('admin@x.it','admin',0), ('resp@x.it','responsabile',0), ('c1@x.it','collaboratore',12), ('c2@x.it','collaboratore',13)`)
const ids = {}
for (const e of ['admin@x.it', 'resp@x.it', 'c1@x.it', 'c2@x.it', 'intruso@x.it']) {
  ids[e] = (await come(null, `insert into auth.users (email) values ($1) returning id`, [e])).rows[0].id
}
const P = (await come(null, `select email, ruolo, tariffa_oraria::float t, attivo from profiles order by email`)).rows
const prof = Object.fromEntries(P.map((r) => [r.email, r]))
prof['admin@x.it'].ruolo === 'admin' && prof['admin@x.it'].attivo ? pass('admin creato da invito, attivo') : fail('admin da invito')
prof['c1@x.it'].t === 12 ? pass('tariffa presa dall’invito') : fail('tariffa invito')
prof['intruso@x.it'].attivo === false ? pass('utente senza invito resta disattivato') : fail('utente senza invito attivo')
const inv = (await come(null, `select count(*)::int n from inviti where accettato_il is null`)).rows[0].n
inv === 0 ? pass('inviti segnati come accettati') : fail('inviti non accettati')

const [A, R, C1, C2, X] = ['admin@x.it', 'resp@x.it', 'c1@x.it', 'c2@x.it', 'intruso@x.it'].map((e) => ids[e])
await come(null, `update profiles set profilo_completo = true`)

console.log('\nPermessi sul profilo:')
await deveFallire(C1, `update profiles set ruolo = 'admin' where id = '${C1}'`, 'collaboratore si promuove admin')
await deveFallire(C1, `update profiles set tariffa_oraria = 99 where id = '${C1}'`, 'collaboratore si alza la tariffa')
const r1 = await come(C1, `update profiles set nome = 'Mario' where id = '${C1}' returning nome`)
r1.rows[0]?.nome === 'Mario' ? pass('collaboratore modifica il proprio nome') : fail('modifica nome')
const vis = (await come(C1, `select count(*)::int n from profiles`)).rows[0].n
vis === 1 ? pass('collaboratore vede solo il proprio profilo') : fail(`collaboratore vede ${vis} profili`)
const visR = (await come(R, `select count(*)::int n from profiles`)).rows[0].n
visR === 5 ? pass('responsabile vede il roster') : fail(`responsabile vede ${visR}`)
await come(C1, `update profili_privati set iban = 'IT60X0542811101000000123456' where id = '${C1}'`)
const ibanR = (await come(R, `select count(*)::int n from profili_privati where id = '${C1}'`)).rows[0].n
ibanR === 0 ? pass('responsabile NON vede IBAN del collaboratore') : fail('responsabile vede IBAN')
const ibanA = (await come(A, `select iban from profili_privati where id = '${C1}'`)).rows[0]?.iban
ibanA ? pass('admin vede IBAN') : fail('admin non vede IBAN')
const xr = (await come(X, `select public.is_staff() s`)).rows[0].s
xr === false ? pass('utente disattivato non ha permessi') : fail('disattivato con permessi')
await come(A, `update profiles set tariffa_oraria = 14 where id = '${C1}'`)
pass('admin modifica la tariffa')

console.log('\nEventi e turni:')
await deveFallire(C1, `insert into eventi (nome, data) values ('X', current_date)`, 'collaboratore crea evento')
const ev = (await come(R, `insert into eventi (nome, data, personale_richiesto) values ('Gala', current_date + 3, 3) returning id`)).rows[0].id
const t1 = (await come(R, `insert into turni (evento_id, collaboratore_id, data, ora_inizio, ora_fine, mansione, tariffa_oraria) values ('${ev}','${C1}', current_date + 3, '19:00','01:00','sala',12) returning id`)).rows[0].id
const t2 = (await come(R, `insert into turni (evento_id, collaboratore_id, data, ora_inizio, ora_fine, mansione, tariffa_oraria) values ('${ev}','${C2}', current_date + 3, '19:00','01:00','bar',13) returning id`)).rows[0].id
const evC1 = (await come(C1, `select count(*)::int n from eventi`)).rows[0].n
evC1 === 1 ? pass('collaboratore vede l’evento in cui ha un turno') : fail('collaboratore non vede evento')
const tC1 = (await come(C1, `select count(*)::int n from turni`)).rows[0].n
tC1 === 1 ? pass('collaboratore vede solo il proprio turno') : fail(`collaboratore vede ${tC1} turni`)
const evX = (await come(X, `select count(*)::int n from eventi`)).rows[0].n
evX === 0 ? pass('estraneo non vede eventi') : fail('estraneo vede eventi')
await come(C1, `update turni set tariffa_oraria = 50 where id = '${t1}'`)
;(await come(null, `select tariffa_oraria::float t from turni where id = '${t1}'`)).rows[0].t === 12 ? pass('collaboratore non cambia la tariffa del turno (0 righe aggiornate)') : fail('tariffa turno modificata dal collaboratore')
const upd = await come(C1, `update turni set stato = 'confermato' where id = '${t1}' returning id`)
upd.rows.length === 0 ? pass('collaboratore non aggiorna turni direttamente') : fail('collaboratore aggiorna turni')
await come(C1, `select rispondi_turno('${t1}', true)`)
const st = (await come(R, `select stato from turni where id = '${t1}'`)).rows[0].stato
st === 'confermato' ? pass('rispondi_turno: accettato') : fail(`stato ${st}`)
await deveFallire(C1, `select rispondi_turno('${t1}', false)`, 'risposta doppia')
await deveFallire(C1, `select rispondi_turno('${t2}', true)`, 'risposta a turno altrui')

console.log('\nOrdine di servizio:')
await come(R, `insert into ordini_servizio (evento_id, menu, scaletta) values ('${ev}', '[{"portata":"Antipasti","piatto":"Vitello tonnato","allergeni":[3,4]}]', '[{"ora":"19:00","attivita":"Arrivo ospiti"}]')`)
;(await come(C1, `select count(*)::int n from ordini_servizio`)).rows[0].n === 1 ? pass('il collaboratore con turno confermato legge l’ordine di servizio') : fail('ordine non visibile al collaboratore confermato')
;(await come(C2, `select count(*)::int n from ordini_servizio`)).rows[0].n === 0 ? pass('chi ha il turno solo proposto non lo vede') : fail('ordine visibile a turno proposto')
;(await come(X, `select count(*)::int n from ordini_servizio`)).rows[0].n === 0 ? pass('chi non lavora all’evento non lo vede') : fail('ordine visibile a estranei')
await come(C1, `update ordini_servizio set note = 'x' where evento_id = '${ev}'`)
;(await come(R, `select coalesce(note, '') n from ordini_servizio where evento_id = '${ev}'`)).rows[0].n === '' ? pass('il collaboratore non modifica l’ordine di servizio') : fail('collaboratore modifica ordine')
await deveFallire(R, `insert into ordini_servizio (evento_id, menu) values ('${ev}', '{}')`, 'menù che non è un elenco')
const regola = (await come(A, `select coperti_per_cameriere_min a, coperti_per_cameriere_max b from impostazioni`)).rows[0]
regola.a === 10 && regola.b === 12 ? pass('regola camerieri predefinita: 1 ogni 10–12 coperti') : fail('regola camerieri ' + JSON.stringify(regola))
await deveFallire(A, `update impostazioni set coperti_per_cameriere_min = 15`, 'minimo coperti per cameriere oltre il massimo')
await come(C2, `select rispondi_turno('${t2}', false, 'impegno')`)
const cop = (await come(R, `select * from eventi_copertura where evento_id = '${ev}'`)).rows[0]
cop.confermati === 1 && cop.rifiutati === 1 && cop.mancanti === 2 ? pass('copertura: 1 confermato, 1 rifiutato, mancano 2') : fail('copertura ' + JSON.stringify(cop))

console.log('\nOre e compensi:')
await come(R, `update impostazioni set magg_notturno = 99`)
;(await come(null, `select magg_notturno::float m from impostazioni`)).rows[0].m === 0 ? pass('responsabile non cambia le maggiorazioni (0 righe aggiornate)') : fail('maggiorazioni modificate dal responsabile')
await come(A, `update impostazioni set magg_notturno = 20, magg_festivo = 50`)
await deveFallire(R, `update turni set ore_totali = 6 where id = '${t2}'`, 'ore su turno rifiutato')
await deveFallire(R, `update turni set ore_totali = 6, ore_notturne = 7 where id = '${t1}'`, 'notturne > totali')
const comp = (await come(R, `update turni set ore_totali = 6, ore_notturne = 1 where id = '${t1}' returning compenso_lordo::float c, stato`)).rows[0]
comp.c === 74.4 && comp.stato === 'completato' ? pass('compenso 12 €/h × (6 + 1×20%) = 74,40 e stato completato') : fail('compenso ' + JSON.stringify(comp))
await come(A, `update impostazioni set magg_notturno = 30`)
const comp2 = (await come(R, `update turni set note = 'ok' where id = '${t1}' returning compenso_lordo::float c`)).rows[0].c
comp2 === 74.4 ? pass('cambio maggiorazioni non altera compensi già registrati') : fail('storico alterato ' + comp2)
const riep = (await come(C1, `select * from riepilogo_mensile`)).rows
riep.length === 1 && Number(riep[0].compenso_lordo) === 74.4 ? pass('riepilogo mensile del collaboratore') : fail('riepilogo ' + JSON.stringify(riep))
const riepC2 = (await come(C2, `select count(*)::int n from riepilogo_mensile`)).rows[0].n
riepC2 === 0 ? pass('riepilogo non mostra compensi altrui') : fail('riepilogo altrui visibile')
await deveFallire(R, `delete from turni where id = '${t1}'`, 'eliminazione turno completato')
await deveFallire(R, `delete from eventi where id = '${ev}'`, 'eliminazione evento con ore registrate')

console.log('\nAudit log:')
const aud = (await come(A, `select tabella, azione from audit_log`)).rows
aud.some((r) => r.tabella === 'turni' && r.azione === 'UPDATE') && aud.some((r) => r.tabella === 'profiles') && aud.some((r) => r.tabella === 'impostazioni')
  ? pass(`registrate ${aud.length} modifiche (turni, tariffe, maggiorazioni)`) : fail('audit incompleto')
const audUser = (await come(A, `select utente_id from audit_log where tabella = 'impostazioni' limit 1`)).rows[0].utente_id
audUser === A ? pass('audit registra chi ha fatto la modifica') : fail('audit senza utente')
const audR = (await come(R, `select count(*)::int n from audit_log`)).rows[0].n
audR === 0 ? pass('responsabile non legge l’audit log') : fail('responsabile legge audit')

console.log('\nStorage foto:')
await come(C1, `insert into storage.objects (bucket_id, name) values ('foto-profilo', '${C1}/foto.jpg')`)
pass('collaboratore carica nella propria cartella')
await deveFallire(C1, `insert into storage.objects (bucket_id, name) values ('foto-profilo', '${C2}/foto.jpg')`, 'caricamento nella cartella altrui')
const fotoC2 = (await come(C2, `select count(*)::int n from storage.objects`)).rows[0].n
fotoC2 === 0 ? pass('collaboratore non vede foto altrui') : fail('foto altrui visibili')
const fotoR = (await come(R, `select count(*)::int n from storage.objects`)).rows[0].n
fotoR === 1 ? pass('responsabile vede le foto del roster') : fail('responsabile non vede foto')

// ============================ Fase 2 ============================
console.log('\nNotifiche:')
const notC1 = (await come(C1, `select tipo, titolo from notifiche`)).rows
notC1.some((n) => n.titolo === 'Nuovo turno da confermare') ? pass('turno proposto → notifica al collaboratore') : fail('notifica turno mancante')
const notAltrui = (await come(C2, `select count(*)::int n from notifiche where utente_id = '${C1}'`)).rows[0].n
notAltrui === 0 ? pass('notifiche altrui non visibili') : fail('notifiche altrui visibili')
await deveFallire(C1, `select notifica('${C2}', 'x', 'falsa', null, null)`, 'utente crea notifiche a piacere')

console.log('\nDocumenti:')
const mancantiPrima = (await come(C1, `select count(*)::int n from documenti_mancanti`)).rows[0].n
mancantiPrima === 3 ? pass('3 documenti obbligatori mancanti all’inizio') : fail(`mancanti ${mancantiPrima}`)
await come(C1, `insert into storage.objects (bucket_id, name) values ('documenti', '${C1}/ci.jpg')`)
await deveFallire(C1, `insert into storage.objects (bucket_id, name) values ('documenti', '${C2}/ci.jpg')`, 'file documento nella cartella altrui')
const doc = (await come(C1, `insert into documenti (tipo, file_path, scadenza, stato_verifica) values ('carta_identita', '${C1}/ci.jpg', current_date + 10, 'approvato') returning id, stato_verifica`)).rows[0]
doc.stato_verifica === 'in_verifica' ? pass('il collaboratore non può auto-approvarsi (forzato “in verifica”)') : fail('auto-approvazione documento')
await deveFallire(C1, `insert into documenti (collaboratore_id, tipo, file_path) values ('${C2}', 'altro', 'x')`, 'documento a nome di altri')
const docR = (await come(R, `select count(*)::int n from documenti`)).rows[0].n
docR === 0 ? pass('il responsabile NON vede i documenti personali') : fail('responsabile vede documenti')
const fileR = (await come(R, `select count(*)::int n from storage.objects where bucket_id = 'documenti'`)).rows[0].n
fileR === 0 ? pass('il responsabile NON scarica i file dei documenti') : fail('responsabile vede file documenti')
const mancantiDopo = (await come(C1, `select count(*)::int n from documenti_mancanti`)).rows[0].n
mancantiDopo === 2 ? pass('dopo il caricamento ne mancano 2') : fail(`mancanti dopo ${mancantiDopo}`)
const val = (await come(C1, `select validita, giorni_alla_scadenza g from documenti_validita where id = '${doc.id}'`)).rows[0]
val.validita === 'in_scadenza' && val.g === 10 ? pass('validità: in scadenza tra 10 giorni') : fail('validità ' + JSON.stringify(val))
const appr = (await come(A, `update documenti set stato_verifica = 'approvato' where id = '${doc.id}' returning verificato_da`)).rows[0]
appr.verificato_da === A ? pass('admin approva e resta traccia di chi ha verificato') : fail('verifica admin')
;(await come(C1, `select count(*)::int n from notifiche where titolo = 'Documento approvato'`)).rows[0].n === 1 ? pass('notifica di approvazione al collaboratore') : fail('notifica approvazione')
await deveFallire(C1, `update documenti set scadenza = current_date + 900 where id = '${doc.id}'`, 'modifica di un documento già approvato')
await come(C1, `delete from documenti where id = '${doc.id}'`)
;(await come(A, `select count(*)::int n from documenti where id = '${doc.id}'`)).rows[0].n === 1 ? pass('documento approvato non eliminabile dal collaboratore') : fail('documento approvato eliminato')
const prom = (await come(null, `select genera_promemoria_scadenze() n`)).rows[0].n
const promC1 = (await come(C1, `select count(*)::int n from notifiche where tipo = 'scadenza'`)).rows[0].n
const promA = (await come(A, `select count(*)::int n from notifiche where tipo = 'scadenza'`)).rows[0].n
prom === 1 && promC1 === 1 && promA === 1 ? pass('promemoria scadenza (soglia 15 gg) a collaboratore e admin') : fail(`promemoria ${prom}/${promC1}/${promA}`)
await come(null, `select genera_promemoria_scadenze()`)
;(await come(C1, `select count(*)::int n from notifiche where tipo = 'scadenza'`)).rows[0].n === 1 ? pass('promemoria non duplicato se rilanciato') : fail('promemoria duplicato')
await deveFallire(C1, `select genera_promemoria_scadenze()`, 'utente lancia i promemoria')

console.log('\nRimborsi e pagamenti:')
const rb = (await come(C1, `insert into rimborsi (tipo, data_spesa, importo, stato) values ('viaggio', current_date, 20, 'rimborsato') returning id, stato`)).rows[0]
rb.stato === 'richiesto' ? pass('nuova richiesta forzata a “richiesto”') : fail('stato iniziale ' + rb.stato)
await deveFallire(C1, `update rimborsi set stato = 'approvato' where id = '${rb.id}'`, 'collaboratore approva il proprio rimborso')
;(await come(C2, `select count(*)::int n from rimborsi`)).rows[0].n === 0 ? pass('rimborsi altrui non visibili') : fail('rimborsi altrui visibili')
await deveFallire(R, `update rimborsi set stato = 'rimborsato' where id = '${rb.id}'`, 'rimborsato senza approvazione')
await deveFallire(R, `update rimborsi set stato = 'approvato', importo = 200 where id = '${rb.id}'`, 'responsabile cambia l’importo approvando')
await come(R, `update rimborsi set stato = 'approvato' where id = '${rb.id}'`)
const saldo1 = Number((await come(C1, `select saldo from saldi`)).rows[0].saldo)
saldo1 === 94.4 ? pass('saldo = 74,40 compensi + 20 rimborso approvato = 94,40') : fail('saldo ' + saldo1)
await come(R, `update rimborsi set stato = 'rimborsato' where id = '${rb.id}'`)
const pagR = (await come(C1, `select tipo, importo::float i from pagamenti`)).rows
pagR.length === 1 && pagR[0].tipo === 'rimborso' && pagR[0].i === 20 ? pass('rimborso pagato → pagamento registrato automaticamente') : fail('pagamento rimborso ' + JSON.stringify(pagR))
await deveFallire(R, `update rimborsi set stato = 'rifiutato' where id = '${rb.id}'`, 'modifica di un rimborso già pagato')
await deveFallire(A, `delete from pagamenti where tipo = 'rimborso'`, 'eliminazione del pagamento di un rimborso')
await deveFallire(C1, `insert into pagamenti (collaboratore_id, importo) values ('${C1}', 1000)`, 'collaboratore registra un pagamento')
await come(R, `insert into pagamenti (collaboratore_id, importo, tipo) values ('${C1}', 50, 'acconto')`)
const saldo2 = (await come(C1, `select compensi::float c, rimborsi::float r, pagato::float p, saldo::float s from saldi`)).rows[0]
saldo2.s === 24.4 && saldo2.p === 70 ? pass('saldo dopo acconto 50 € e rimborso pagato: 24,40 € dovuti') : fail('saldo2 ' + JSON.stringify(saldo2))
;(await come(C1, `select count(*)::int n from saldi`)).rows[0].n === 1 ? pass('il collaboratore vede solo il proprio saldo') : fail('saldi altrui visibili')
const mov = (await come(C1, `select tipo from movimenti`)).rows.map((r) => r.tipo).sort()
JSON.stringify(mov) === JSON.stringify(['compenso', 'pagamento', 'pagamento', 'rimborso']) ? pass('movimenti: compenso, rimborso, 2 pagamenti') : fail('movimenti ' + JSON.stringify(mov))
const rbR = (await come(R, `insert into rimborsi (tipo, data_spesa, importo) values ('pasti', current_date, 15) returning id`)).rows[0].id
await deveFallire(R, `update rimborsi set stato = 'approvato' where id = '${rbR}'`, 'responsabile approva un proprio rimborso')
await come(A, `update rimborsi set stato = 'approvato' where id = '${rbR}'`)
pass('l’admin può approvare il rimborso del responsabile')
await come(C1, `insert into storage.objects (bucket_id, name) values ('ricevute', '${C1}/scontrino.jpg')`)
;(await come(R, `select count(*)::int n from storage.objects where bucket_id = 'ricevute'`)).rows[0].n === 1 ? pass('il responsabile vede le ricevute da approvare') : fail('ricevute non visibili allo staff')
;(await come(C2, `select count(*)::int n from storage.objects where bucket_id = 'ricevute'`)).rows[0].n === 0 ? pass('ricevute altrui non visibili') : fail('ricevute altrui visibili')
const audP = (await come(A, `select count(*)::int n from audit_log where tabella in ('pagamenti', 'rimborsi', 'documenti')`)).rows[0].n
audP >= 5 ? pass(`audit su pagamenti/rimborsi/documenti (${audP} voci)`) : fail('audit fase 2 ' + audP)

// ============================ Fase 3 ============================
console.log('\nCRM, preventivi e sopralluoghi:')
await deveFallire(C1, `insert into aziende (nome) values ('X')`, 'collaboratore crea un’azienda')
const az = (await come(R, `insert into aziende (nome, referente) values ('Cliente Prova', 'Rossi') returning id, stato_pipeline, responsabile_id`)).rows[0]
az.stato_pipeline === 'da_contattare' && az.responsabile_id === R ? pass('azienda creata “da contattare”, assegnata a chi la crea') : fail('azienda ' + JSON.stringify(az))
;(await come(C1, `select count(*)::int n from aziende`)).rows[0].n === 0 ? pass('il collaboratore non vede il CRM') : fail('collaboratore vede aziende')
const so = (await come(R, `insert into sopralluoghi (azienda_id, titolo, checklist) values ('${az.id}', 'Villa', '[{"chiave":"accessi","stato":"ok"}]') returning id`)).rows[0].id
;(await come(C1, `select count(*)::int n from sopralluoghi`)).rows[0].n === 0 ? pass('il collaboratore non vede i sopralluoghi') : fail('collaboratore vede sopralluoghi')
const zona = (await come(R, `insert into sopralluogo_zone (sopralluogo_id, tipo, nome, voci) values ('${so}', 'bar', 'Bar', '["Bancone bar operativo"]') returning id`)).rows[0].id
;(await come(C1, `select count(*)::int n from sopralluogo_zone`)).rows[0].n === 0 ? pass('il collaboratore non vede le zone del sopralluogo') : fail('collaboratore vede zone')
await deveFallire(R, `insert into sopralluogo_zone (sopralluogo_id, tipo, nome) values ('${so}', 'piscina', 'X')`, 'zona di tipo sconosciuto')
const orig = (await come(R, `insert into sopralluogo_file (sopralluogo_id, zona_id, file_path, tipo) values ('${so}', '${zona}', '${so}/vuota.jpg', 'foto') returning id`)).rows[0].id
await come(R, `insert into sopralluogo_file (sopralluogo_id, zona_id, origine_id, file_path, tipo, scelto) values ('${so}', '${zona}', '${orig}', '${so}/allestita.jpg', 'rendering', true)`)
;(await come(R, `select count(*)::int n from sopralluogo_file where zona_id = '${zona}' and tipo = 'rendering' and origine_id = '${orig}'`)).rows[0].n === 1 ? pass('rendering della zona collegato alla foto originale') : fail('rendering zona')
await come(R, `delete from sopralluogo_zone where id = '${zona}'`)
;(await come(R, `select count(*)::int n from sopralluogo_file where file_path like '${so}/%alla%' or file_path like '${so}/vuota%'`)).rows[0].n === 0 ? pass('eliminando la zona si eliminano le sue foto') : fail('foto zona orfane')
await come(R, `update sopralluoghi set allestimento = '{"versione":1,"oggetti":[{"id":"t1","tipo":"tondo_150","x":0,"z":0,"rot":0,"sedie":8}]}' where id = '${so}'`)
;(await come(R, `select allestimento->'oggetti'->0->>'tipo' t from sopralluoghi where id = '${so}'`)).rows[0].t === 'tondo_150' ? pass('allestimento 3D salvato sul sopralluogo') : fail('allestimento 3D')
await deveFallire(R, `update sopralluoghi set allestimento = '[]' where id = '${so}'`, 'allestimento 3D che non è un oggetto')
await come(R, `insert into storage.objects (bucket_id, name) values ('sopralluoghi', '${so}/foto.jpg')`)
await deveFallire(C1, `insert into storage.objects (bucket_id, name) values ('sopralluoghi', '${so}/x.jpg')`, 'collaboratore carica foto di sopralluogo')
;(await come(C1, `select count(*)::int n from storage.objects where bucket_id = 'sopralluoghi'`)).rows[0].n === 0 ? pass('foto sopralluoghi riservate allo staff') : fail('foto sopralluoghi visibili')

const p1 = (await come(R, `insert into preventivi (azienda_id, sopralluogo_id, titolo, stato, iva_pct, sconto_pct) values ('${az.id}', '${so}', 'Gala', 'accettato', 22, 10) returning id, numero, stato, valido_fino`)).rows[0]
const p2 = (await come(A, `insert into preventivi (azienda_id, titolo) values ('${az.id}', 'Cena') returning numero`)).rows[0]
const anno = new Date().getFullYear()
p1.numero === `${anno}-001` && p2.numero === `${anno}-002` ? pass(`numerazione progressiva ${p1.numero}, ${p2.numero}`) : fail('numerazione ' + p1.numero + ' ' + p2.numero)
p1.stato === 'bozza' && p1.valido_fino ? pass('nuovo preventivo sempre in bozza, con validità predefinita') : fail('stato iniziale ' + p1.stato)
await come(R, `insert into preventivo_voci (preventivo_id, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
  ('${p1.id}', 'personale', 'Camerieri', 4, 6, 25, 15),
  ('${p1.id}', 'servizio', 'Guardaroba', 1, null, 100, 40)`)
const tot = (await come(R, `select subtotale::float s, sconto::float sc, imponibile::float i, iva::float v, totale::float t, costo::float c, margine::float m, margine_pct::float mp, persone::float pe from preventivi_totali where preventivo_id = '${p1.id}'`)).rows[0]
tot.s === 700 && tot.sc === 70 && tot.i === 630 && tot.v === 138.6 && tot.t === 768.6 && tot.c === 400 && tot.m === 230 && tot.pe === 4
  ? pass('totali: 700 − 10% = 630 + IVA 138,60 = 768,60; costo 400, margine 230 (36,5%)') : fail('totali ' + JSON.stringify(tot))
;(await come(C1, `select count(*)::int n from preventivi_totali`)).rows[0].n === 0 ? pass('margini invisibili al collaboratore') : fail('collaboratore vede margini')
await come(R, `update preventivi set stato = 'inviato' where id = '${p1.id}'`)
const dopoInvio = (await come(R, `select p.data_invio, a.stato_pipeline from preventivi p join aziende a on a.id = p.azienda_id where p.id = '${p1.id}'`)).rows[0]
dopoInvio.data_invio && dopoInvio.stato_pipeline === 'in_trattativa' ? pass('inviato → data di invio e azienda “in trattativa”') : fail('invio ' + JSON.stringify(dopoInvio))
await deveFallire(R, `update preventivi set sconto_pct = 50 where id = '${p1.id}'`, 'modifica di un preventivo già inviato')
await deveFallire(R, `insert into preventivo_voci (preventivo_id, descrizione) values ('${p1.id}', 'extra')`, 'nuova voce su preventivo inviato')
await deveFallire(R, `delete from preventivo_voci where preventivo_id = '${p1.id}'`, 'eliminazione voci da preventivo inviato')
await come(R, `update preventivi set note_interne = 'cliente chiede sconto' where id = '${p1.id}'`)
pass('note interne modificabili anche dopo l’invio')
await come(R, `delete from preventivi where id = '${p1.id}'`)
;(await come(R, `select count(*)::int n from preventivi where id = '${p1.id}'`)).rows[0].n === 1 ? pass('il responsabile non elimina un preventivo inviato') : fail('preventivo inviato eliminato')
await come(R, `update preventivi set stato = 'accettato' where id = '${p1.id}'`)
const acc = (await come(R, `select p.data_esito, a.stato_pipeline from preventivi p join aziende a on a.id = p.azienda_id where p.id = '${p1.id}'`)).rows[0]
acc.data_esito && acc.stato_pipeline === 'cliente_attivo' ? pass('accettato → azienda “cliente attivo”') : fail('accettato ' + JSON.stringify(acc))
await come(R, `update preventivi set stato = 'bozza' where id = '${p1.id}'`)
const riaperto = (await come(R, `select data_invio, data_esito from preventivi where id = '${p1.id}'`)).rows[0]
!riaperto.data_invio && !riaperto.data_esito ? pass('riportato in bozza: date di invio ed esito azzerate') : fail('riapertura ' + JSON.stringify(riaperto))
await deveFallire(R, `update preventivi set progressivo = 99 where id = '${p1.id}'`, 'cambio del numero di preventivo')
;(await come(A, `select count(*)::int n from audit_log where tabella = 'preventivi'`)).rows[0].n >= 3 ? pass('cambi di stato dei preventivi nel registro modifiche') : fail('audit preventivi')

await come(R, `insert into followup (azienda_id, data, nota) values ('${az.id}', current_date - 1, 'Richiamare per conferma')`)
await come(R, `insert into followup (azienda_id, data, nota) values ('${az.id}', current_date + 7, 'Più avanti')`)
const nfu = (await come(null, `select genera_promemoria_followup() n`)).rows[0].n
const notFu = (await come(R, `select titolo, link from notifiche where tipo = 'followup'`)).rows
nfu === 1 && notFu.length === 1 && notFu[0].link === `/crm/${az.id}` ? pass('follow-up scaduto → notifica a chi è assegnato (solo quelli dovuti)') : fail(`follow-up ${nfu} ${JSON.stringify(notFu)}`)
await come(null, `select genera_promemoria_followup()`)
;(await come(R, `select count(*)::int n from notifiche where tipo = 'followup'`)).rows[0].n === 1 ? pass('promemoria follow-up non duplicato') : fail('follow-up duplicato')
;(await come(C1, `select count(*)::int n from followup`)).rows[0].n === 0 ? pass('follow-up invisibili al collaboratore') : fail('follow-up visibili')
await come(R, `update eventi set azienda_id = '${az.id}' where id = '${ev}'`)
pass('evento collegato all’azienda cliente')

// ============================ Fase 4 ============================
console.log('\nDisponibilità, valutazioni, push, report:')
const dataEv = (await come(null, `select data::text d from eventi where id = '${ev}'`)).rows[0].d
const t3 = (await come(R, `insert into turni (evento_id, collaboratore_id, data, ora_inizio, ora_fine, mansione, tariffa_oraria) values ('${ev}','${C2}', '${dataEv}', '19:00','23:00','bar',13) returning id`)).rows[0].id
await come(C2, `insert into indisponibilita (data, nota) values ('${dataEv}', 'impegno familiare')`)
;(await come(R, `select count(*)::int n from indisponibilita where collaboratore_id = '${C2}'`)).rows[0].n === 1 ? pass('lo staff vede le indisponibilità per assegnare i turni') : fail('indisponibilità non visibile allo staff')
;(await come(C1, `select count(*)::int n from indisponibilita`)).rows[0].n === 0 ? pass('indisponibilità altrui non visibili') : fail('indisponibilità altrui visibili')
await deveFallire(C1, `insert into indisponibilita (collaboratore_id, data) values ('${C2}', current_date)`, 'segnare indisponibile un altro')
await deveFallire(C2, `insert into indisponibilita (data) values ('${dataEv}')`, 'stesso giorno due volte')
;(await come(R, `select count(*)::int n from notifiche where tipo = 'indisponibilita'`)).rows[0].n === 1 ? pass('chi ha creato l’evento viene avvisato dell’indisponibilità su un turno già proposto') : fail('avviso indisponibilità mancante')
await come(R, `delete from turni where id = '${t3}'`)

await deveFallire(R, `insert into valutazioni (evento_id, collaboratore_id, punteggio) values ('${ev}', '${C2}', 4)`, 'valutare chi non ha lavorato all’evento')
await deveFallire(R, `insert into valutazioni (evento_id, collaboratore_id, punteggio) values ('${ev}', '${C1}', 6)`, 'punteggio fuori scala 1–5')
await come(R, `insert into valutazioni (evento_id, collaboratore_id, punteggio, note) values ('${ev}', '${C1}', 4, 'puntuale')`)
await deveFallire(R, `insert into valutazioni (evento_id, collaboratore_id, punteggio) values ('${ev}', '${C1}', 5)`, 'doppia valutazione per lo stesso evento')
const media = (await come(A, `select media::float m, valutazioni n from valutazioni_medie where collaboratore_id = '${C1}'`)).rows[0]
media.m === 4 && media.n === 1 ? pass('media valutazioni 4,0 su 1 evento') : fail('media ' + JSON.stringify(media))
;(await come(C1, `select count(*)::int n from valutazioni`)).rows[0].n === 0 ? pass('il collaboratore non vede le valutazioni') : fail('valutazioni visibili al collaboratore')

await come(C1, `insert into push_iscrizioni (endpoint, p256dh, auth) values ('https://push.example/1', 'k', 'a')`)
;(await come(C2, `select count(*)::int n from push_iscrizioni`)).rows[0].n === 0 ? pass('iscrizioni push private') : fail('iscrizioni push altrui visibili')
await deveFallire(C2, `insert into push_iscrizioni (utente_id, endpoint, p256dh, auth) values ('${C1}', 'https://push.example/2', 'k', 'a')`, 'iscrivere un altro utente ai push')
await come(null, `select notifica('${C1}', 'test', 'Prova push', null, null)`)
pass('senza pg_net/Vault la notifica in-app funziona comunque (push saltato)')

await come(R, `update preventivi set evento_id = '${ev}', stato = 'inviato' where id = '${p1.id}'`)
await come(R, `update preventivi set stato = 'accettato' where id = '${p1.id}'`)
await come(C1, `insert into rimborsi (tipo, data_spesa, importo, evento_id) values ('viaggio', current_date, 10, '${ev}')`)
await come(R, `update rimborsi set stato = 'approvato' where evento_id = '${ev}'`)
const rep = (await come(R, `select ricavo::float r, costo_preventivato::float cp, costo_personale::float cpe, costo_rimborsi::float cr, preventivo_numero n from report_eventi where evento_id = '${ev}'`)).rows[0]
rep.r === 630 && rep.cp === 400 && rep.cpe === 74.4 && rep.cr === 10 && rep.n === p1.numero
  ? pass('report evento: ricavo 630, costo personale 74,40 + rimborsi 10 (preventivato 400)') : fail('report ' + JSON.stringify(rep))
;(await come(C1, `select count(*)::int n from report_eventi where ricavo > 0`)).rows[0].n === 0 ? pass('il collaboratore non vede ricavi e margini') : fail('ricavi visibili al collaboratore')

// ============================ Fatture e incassi ============================
console.log('\nFatture e incassi:')
await deveFallire(R, `insert into fatture (numero, azienda_id, descrizione, imponibile) values ('1', '${az.id}', 'Gala', 630)`, 'il responsabile emette una fattura')
const fa = (await come(A, `insert into fatture (numero, azienda_id, preventivo_id, evento_id, descrizione, imponibile, iva_pct) values ('1', '${az.id}', '${p1.id}', '${ev}', 'Gala', 630, 22) returning id, iva::float iva, totale::float t`)).rows[0]
fa.iva === 138.6 && fa.t === 768.6 ? pass('fattura 630 + IVA 22% = 768,60') : fail('totali fattura ' + JSON.stringify(fa))
await deveFallire(A, `insert into fatture (numero, azienda_id, descrizione, imponibile) values ('1', '${az.id}', 'Doppia', 10)`, 'stesso numero di fattura nello stesso anno')
await deveFallire(A, `insert into fatture (numero, azienda_id, descrizione, imponibile, data_emissione, data_scadenza) values ('9', '${az.id}', 'X', 10, current_date, current_date - 1)`, 'scadenza prima dell’emissione')
;(await come(R, `select count(*)::int n from fatture_stato`)).rows[0].n === 0 ? pass('fatture invisibili al responsabile') : fail('responsabile vede fatture')
;(await come(C1, `select count(*)::int n from fatture_stato`)).rows[0].n === 0 ? pass('fatture invisibili al collaboratore') : fail('collaboratore vede fatture')
const statoF = async () => (await come(A, `select stato, incassato::float i, residuo::float r from fatture_stato where id = '${fa.id}'`)).rows[0]
;(await statoF()).stato === 'da_incassare' ? pass('nuova fattura “da incassare”') : fail('stato iniziale fattura')
await come(A, `insert into incassi (fattura_id, importo) values ('${fa.id}', 300)`)
const s1 = await statoF()
s1.stato === 'parziale' && s1.r === 468.6 ? pass('incasso parziale: restano 468,60') : fail('parziale ' + JSON.stringify(s1))
await deveFallire(A, `insert into incassi (fattura_id, importo) values ('${fa.id}', 500)`, 'incasso oltre il totale')
await deveFallire(R, `insert into incassi (fattura_id, importo) values ('${fa.id}', 10)`, 'il responsabile registra un incasso')
await deveFallire(A, `update fatture set annullata = true where id = '${fa.id}'`, 'annullare una fattura con incassi')
await deveFallire(A, `update fatture set imponibile = 100 where id = '${fa.id}'`, 'totale sotto quanto già incassato')
await deveFallire(A, `delete from fatture where id = '${fa.id}'`, 'eliminare una fattura con incassi')
await come(A, `insert into incassi (fattura_id, importo, metodo) values ('${fa.id}', 468.6, 'contanti')`)
;(await statoF()).stato === 'pagata' ? pass('saldata con il secondo incasso → pagata') : fail('stato dopo saldo')
const fs = (await come(A, `insert into fatture (numero, azienda_id, descrizione, imponibile, data_emissione, data_scadenza) values ('2', '${az.id}', 'Vecchia', 100, current_date - 60, current_date - 30) returning id`)).rows[0].id
;(await come(A, `select stato from fatture_stato where id = '${fs}'`)).rows[0].stato === 'scaduta' ? pass('non pagata oltre la scadenza → scaduta') : fail('scaduta')
await come(A, `update fatture set annullata = true where id = '${fs}'`)
;(await come(A, `select stato from fatture_stato where id = '${fs}'`)).rows[0].stato === 'annullata' ? pass('fattura senza incassi annullata') : fail('annullamento')
await deveFallire(A, `insert into incassi (fattura_id, importo) values ('${fs}', 10)`, 'incasso su fattura annullata')
;(await come(A, `select count(*)::int n from audit_log where tabella in ('fatture', 'incassi')`)).rows[0].n >= 5 ? pass('fatture e incassi nel registro modifiche') : fail('audit fatture')

console.log('\nScript DEMO commerciale:')
try {
  const seed = readFileSync(join(dir, '..', 'seed-demo-fase3.sql'), 'utf8')
  await db.exec('reset role; select set_config(\'request.jwt.claim.sub\', \'\', false);')
  await db.exec(seed)
  await db.exec(seed) // rieseguibile
  const demo = (await come(null, `select count(*)::int a, (select count(*)::int from preventivi p join aziende z on z.id = p.azienda_id where z.nome like 'DEMO %') p from aziende where nome like 'DEMO %'`)).rows[0]
  const statoInviato = (await come(null, `select p.stato, z.stato_pipeline from preventivi p join aziende z on z.id = p.azienda_id where z.nome = 'DEMO Studio Legale Bianchi'`)).rows[0]
  demo.a === 3 && demo.p === 2 && statoInviato.stato === 'inviato' && statoInviato.stato_pipeline === 'in_trattativa'
    ? pass('seed-demo-fase3.sql: 3 aziende, 2 preventivi, rieseguibile') : fail('seed fase 3 ' + JSON.stringify({ demo, statoInviato }))
} catch (e) {
  fail('seed-demo-fase3.sql: ' + e.message)
}
try {
  // Il seed di fase 4 richiede gli utenti DEMO: qui deve fermarsi con un messaggio chiaro
  await db.exec(readFileSync(join(dir, '..', 'seed-demo-fase4.sql'), 'utf8'))
  fail('seed-demo-fase4.sql senza dati DEMO avrebbe dovuto fermarsi')
} catch (e) {
  ;/Esegui prima/.test(e.message) ? pass('seed-demo-fase4.sql: si ferma se mancano i dati DEMO precedenti') : fail('seed-demo-fase4.sql: ' + e.message)
}

console.log(`\nRisultato: ${ok} ok, ${ko} falliti`)
process.exit(ko ? 1 : 0)
