import { Link } from 'react-router-dom'
import { useAuth, usePermessi } from '../auth/AuthProvider'
import { Tessera } from '../components/aree'
import { AREE } from '../lib/aree'
import { Avviso, Caricamento, SchedaLink, Statistica, Vuoto } from '../components/ui'
import { formatData, formatEuro, formatOre, intervalloOre, isoGiorno, oggiIso } from '../lib/format'
import { supabase } from '../lib/supabase'
import { ETICHETTA_PIPELINE, type Copertura, type Evento, type Profilo, type StatoPipeline } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'
import { IndicatoreCopertura } from './eventi/Eventi'
import { SchedaTurno, type TurnoConEvento } from './MieiTurni'

function saluto() {
  const h = new Date().getHours()
  return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
}

export default function Dashboard() {
  const { profilo } = useAuth()
  const { isStaff } = usePermessi()
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        {saluto()}, {profilo?.nome || 'benvenuto'}
      </h1>
      <p className="mb-5 text-sm text-slate-500 capitalize">{formatData(oggiIso(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      {isStaff ? <DashboardStaff /> : <DashboardCollaboratore />}
    </>
  )
}

/** Riquadri per entrare nelle aree principali, con un numero quando c'è qualcosa da guardare */
function AccessoRapido({ chiavi, badge = {} }: { chiavi: string[]; badge?: Record<string, { valore: number; allerta?: boolean }> }) {
  const { isStaff, isAdmin } = usePermessi()
  const aree = chiavi.map((k) => AREE.find((a) => a.chiave === k)).filter((a) => a && a.visibile({ isStaff, isAdmin }))
  return (
    <section aria-label="Accesso rapido" className="grid grid-cols-3 gap-2.5">
      {aree.map((a) => a && (
        <Tessera key={a.chiave} to={a.to} icona={a.icona} colore={a.colore} etichetta={a.etichetta}
          badge={badge[a.chiave]?.valore || undefined} allerta={badge[a.chiave]?.allerta} />
      ))}
    </section>
  )
}

function DashboardCollaboratore() {
  const { profilo } = useAuth()
  const oggi = oggiIso()
  const inizioMese = oggi.slice(0, 8) + '01'

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const [prossimi, mese, documenti, mancanti, saldo] = await Promise.all([
      supabase.from('turni').select('*, eventi(nome, luogo, note, cliente, punto_ritrovo, ora_ritrovo, divisa, referente)').eq('collaboratore_id', profilo!.id).gte('data', oggi).in('stato', ['proposto', 'confermato']).order('data').order('ora_inizio').limit(10),
      supabase.from('turni').select('ore_totali, compenso_lordo').eq('collaboratore_id', profilo!.id).eq('stato', 'completato').gte('data', inizioMese),
      supabase.from('documenti_validita').select('validita').eq('collaboratore_id', profilo!.id).eq('piu_recente', true),
      supabase.from('documenti_mancanti').select('tipo').eq('collaboratore_id', profilo!.id),
      supabase.from('saldi').select('saldo').eq('collaboratore_id', profilo!.id).maybeSingle(),
    ])
    const righeMese = oppureErrore(mese) as { ore_totali: number; compenso_lordo: number }[]
    const validita = (oppureErrore(documenti) as { validita: string }[]).map((d) => d.validita)
    return {
      prossimi: oppureErrore(prossimi) as TurnoConEvento[],
      ore: righeMese.reduce((s, r) => s + Number(r.ore_totali ?? 0), 0),
      compenso: righeMese.reduce((s, r) => s + Number(r.compenso_lordo ?? 0), 0),
      documentiDaSistemare: validita.filter((v) => v !== 'valido').length + (oppureErrore(mancanti) as unknown[]).length,
      saldo: Number((oppureErrore(saldo) as { saldo: number } | null)?.saldo ?? 0),
    }
  }, [profilo?.id, oggi])

  if (caricamento) return <Caricamento />
  if (errore || !dati) return <Avviso>{errore}</Avviso>

  const daConfermare = dati.prossimi.filter((t) => t.stato === 'proposto')
  const prossimo = dati.prossimi.find((t) => t.stato === 'confermato')

  return (
    <div className="space-y-6">
      <AccessoRapido
        chiavi={['turni', 'disponibilita', 'compensi', 'documenti', 'rimborsi', 'profilo']}
        badge={{ turni: { valore: daConfermare.length, allerta: true }, documenti: { valore: dati.documentiDaSistemare, allerta: true } }}
      />
      {dati.documentiDaSistemare > 0 && (
        <Link to="/documenti" className="block rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="font-medium text-amber-900">Documenti da sistemare: {dati.documentiDaSistemare}</p>
          <p className="text-sm text-amber-800">Mancanti, in scadenza, scaduti o rifiutati. Tocca per aggiornarli →</p>
        </Link>
      )}
      {daConfermare.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-amber-800">Turni da confermare ({daConfermare.length})</h2>
          <ul className="space-y-3">
            {daConfermare.map((t) => (
              <li key={t.id}><SchedaTurno turno={t} onRisposto={() => void ricarica()} /></li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Prossimo turno</h2>
        {prossimo ? <SchedaTurno turno={prossimo} /> : <Vuoto titolo="Nessun turno confermato in programma" />}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <Link to="/turni" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">Vedi tutti i turni →</Link>
          <Link to="/disponibilita" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">Segna quando non sei disponibile →</Link>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Questo mese</h2>
        <div className="grid grid-cols-2 gap-3">
          <Statistica etichetta="Ore lavorate" valore={formatOre(dati.ore)} />
          <Statistica etichetta="Compenso lordo" valore={formatEuro(dati.compenso)} />
        </div>
        <Link to="/compensi" className="mt-3 flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <span className="text-sm text-slate-600">Saldo da ricevere</span>
          <span className="text-lg font-semibold tabular-nums">{formatEuro(dati.saldo)}</span>
        </Link>
      </section>
    </div>
  )
}

function DaFare({ isAdmin }: { isAdmin: boolean }) {
  const { profilo } = useAuth()
  const { dati } = useDati(async () => {
    const conta = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
      const r = await q
      if (r.error) throw r.error
      return r.count ?? 0
    }
    let rimborsiQ = supabase.from('rimborsi').select('id', { count: 'exact', head: true }).eq('stato', 'richiesto')
    if (!isAdmin) rimborsiQ = rimborsiQ.neq('collaboratore_id', profilo!.id)
    const rimborsi = await conta(rimborsiQ)
    if (!isAdmin) return { rimborsi, verifica: 0, scadenze: 0, daPagare: 0, daAttivare: 0, fattureScadute: 0, importoScaduto: 0 }
    const [verifica, scadenze, saldi, daAttivare, scadute] = await Promise.all([
      conta(supabase.from('documenti').select('id', { count: 'exact', head: true }).eq('stato_verifica', 'in_verifica')),
      conta(supabase.from('documenti_validita').select('id', { count: 'exact', head: true }).eq('piu_recente', true).neq('stato_verifica', 'rifiutato').in('validita', ['in_scadenza', 'scaduto'])),
      supabase.from('saldi').select('saldo').gt('saldo', 0),
      // Include chi si è registrato da solo e attende l'abilitazione
      conta(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('attivo', false)),
      supabase.from('fatture_stato').select('residuo').eq('stato', 'scaduta'),
    ])
    const daPagare = (oppureErrore(saldi) as { saldo: number }[]).reduce((s, r) => s + Number(r.saldo), 0)
    const righeScadute = oppureErrore(scadute) as { residuo: number }[]
    const importoScaduto = righeScadute.reduce((s, r) => s + Number(r.residuo), 0)
    return { rimborsi, verifica, scadenze, daPagare, daAttivare, fattureScadute: righeScadute.length, importoScaduto }
  }, [isAdmin, profilo?.id])

  if (!dati) return null
  const voci = [
    { to: '/rimborsi', testo: 'Rimborsi da approvare', valore: String(dati.rimborsi), attivo: dati.rimborsi > 0 },
    ...(isAdmin
      ? [
          { to: '/documenti', testo: 'Documenti da verificare', valore: String(dati.verifica), attivo: dati.verifica > 0 },
          { to: '/documenti', testo: 'Documenti in scadenza (30 gg)', valore: String(dati.scadenze), attivo: dati.scadenze > 0 },
          { to: '/compensi', testo: 'Saldi da pagare', valore: formatEuro(dati.daPagare), attivo: dati.daPagare > 0 },
          {
            to: '/fatture',
            testo: dati.fattureScadute ? `Fatture scadute da incassare (${dati.fattureScadute})` : 'Fatture scadute da incassare',
            valore: formatEuro(dati.importoScaduto),
            attivo: dati.importoScaduto > 0,
          },
          { to: '/admin/utenti', testo: 'Account da attivare', valore: String(dati.daAttivare), attivo: dati.daAttivare > 0 },
        ]
      : []),
  ]
  // Solo quello che chiede davvero un'azione: le righe a zero non servono
  const attive = voci.filter((v) => v.attivo)
  return (
    <section>
      <h2 className="mb-2 font-semibold">Da fare</h2>
      {attive.length === 0 ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">Tutto in ordine: niente da approvare, pagare o verificare.</p>
      ) : (
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {attive.map((v) => (
          <li key={v.testo}>
            <Link to={v.to} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
              <span className="text-sm">{v.testo}</span>
              <span className="font-semibold text-amber-700 tabular-nums">{v.valore}</span>
            </Link>
          </li>
        ))}
      </ul>
      )}
    </section>
  )
}

function Commerciale() {
  const oggi = oggiIso()
  const fraSette = isoGiorno(new Date(Date.now() + 7 * 86400000))
  const { dati } = useDati(async () => {
    const [aperti, followup, aziende] = await Promise.all([
      supabase.from('preventivi').select('id').eq('stato', 'inviato'),
      supabase.from('followup').select('data').is('completato_il', null).lte('data', fraSette),
      supabase.from('aziende').select('stato_pipeline'),
    ])
    const idAperti = (oppureErrore(aperti) as { id: string }[]).map((p) => p.id)
    const totali = idAperti.length ? (oppureErrore(await supabase.from('preventivi_totali').select('imponibile').in('preventivo_id', idAperti)) as { imponibile: number }[]) : []
    const fu = oppureErrore(followup) as { data: string }[]
    const pipeline = {} as Record<StatoPipeline, number>
    for (const a of oppureErrore(aziende) as { stato_pipeline: StatoPipeline }[]) pipeline[a.stato_pipeline] = (pipeline[a.stato_pipeline] ?? 0) + 1
    return {
      aperti: idAperti.length,
      valore: totali.reduce((s, t) => s + Number(t.imponibile), 0),
      followupDovuti: fu.filter((f) => f.data <= oggi).length,
      followupSettimana: fu.filter((f) => f.data > oggi).length,
      pipeline,
    }
  }, [oggi, fraSette])

  if (!dati) return null
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Commerciale</h2>
        <Link to="/crm" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700">Clienti →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/preventivi" className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Preventivi aperti</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{dati.aperti}</p>
          <p className="text-xs text-slate-500">{formatEuro(dati.valore)} + IVA</p>
        </Link>
        <Link to="/crm" className={`rounded-2xl p-4 ring-1 ${dati.followupDovuti > 0 ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-slate-200'}`}>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Follow-up</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{dati.followupDovuti}</p>
          <p className="text-xs text-slate-500">da fare oggi · {dati.followupSettimana} in settimana</p>
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(ETICHETTA_PIPELINE) as StatoPipeline[]).map((s) => (
          <span key={s} className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-slate-200">
            {ETICHETTA_PIPELINE[s]} <span className="font-semibold tabular-nums">{dati.pipeline[s] ?? 0}</span>
          </span>
        ))}
      </div>
    </section>
  )
}

function DashboardStaff() {
  const { isAdmin } = usePermessi()
  const oggi = oggiIso()
  const fraSetteGiorni = isoGiorno(new Date(Date.now() + 6 * 86400000))

  const { dati, errore, caricamento } = useDati(async () => {
    const [eventi, turniOggi, collaboratori, inAttesa] = await Promise.all([
      supabase.from('eventi').select('*').gte('data', oggi).lte('data', fraSetteGiorni).neq('stato', 'annullato').order('data').order('ora_inizio'),
      supabase.from('turni').select('collaboratore_id').eq('data', oggi).in('stato', ['proposto', 'confermato', 'completato']),
      supabase.from('profiles').select('id').eq('ruolo', 'collaboratore').eq('attivo', true),
      supabase.from('turni').select('id', { count: 'exact', head: true }).gte('data', oggi).eq('stato', 'proposto'),
    ])
    const ev = oppureErrore(eventi) as Evento[]
    const copertura = ev.length ? (oppureErrore(await supabase.from('eventi_copertura').select('*').in('evento_id', ev.map((e) => e.id))) as Copertura[]) : []
    if (inAttesa.error) throw inAttesa.error
    return {
      eventi: ev,
      copertura: new Map(copertura.map((c) => [c.evento_id, c])),
      impegnatiOggi: new Set((oppureErrore(turniOggi) as { collaboratore_id: string }[]).map((t) => t.collaboratore_id)).size,
      totaleCollaboratori: (oppureErrore(collaboratori) as Pick<Profilo, 'id'>[]).length,
      inAttesa: inAttesa.count ?? 0,
    }
  }, [oggi, fraSetteGiorni])

  if (caricamento) return <Caricamento />
  if (errore || !dati) return <Avviso>{errore}</Avviso>

  const eventiOggi = dati.eventi.filter((e) => e.data === oggi)
  const scoperti = dati.eventi.reduce((s, e) => s + (dati.copertura.get(e.id)?.mancanti ?? 0), 0)
  // Ordine: prima gli eventi con posti scoperti
  const ordinati = [...dati.eventi].sort((a, b) => Number((dati.copertura.get(b.id)?.mancanti ?? 0) > 0) - Number((dati.copertura.get(a.id)?.mancanti ?? 0) > 0) || a.data.localeCompare(b.data))

  return (
    <div className="space-y-6">
      <AccessoRapido
        chiavi={['eventi', 'personale', 'sopralluoghi', 'preventivi', 'clienti', 'report', 'compensi', 'rimborsi', 'fatture']}
        badge={{ eventi: { valore: dati.eventi.length }, personale: { valore: scoperti, allerta: true } }}
      />
      <div className="grid grid-cols-2 gap-3">
        <Statistica etichetta="Eventi oggi" valore={eventiOggi.length} />
        <Statistica etichetta="Impegnati oggi" valore={`${dati.impegnatiOggi}/${dati.totaleCollaboratori}`} />
        <Statistica etichetta="Posti scoperti (7 gg)" valore={scoperti} evidenzia={scoperti > 0} />
        <Statistica etichetta="Risposte in attesa" valore={dati.inAttesa} />
      </div>

      <DaFare isAdmin={isAdmin} />

      <Commerciale />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Prossimi 7 giorni</h2>
          <Link to="/eventi/nuovo" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700">+ Nuovo evento</Link>
        </div>
        {ordinati.length === 0 ? (
          <Vuoto titolo="Nessun evento nei prossimi 7 giorni" />
        ) : (
          <ul className="space-y-3">
            {ordinati.map((e) => (
              <li key={e.id}>
                <SchedaLink to={`/eventi/${e.id}`}>
                  <p className="font-semibold">{e.nome}</p>
                  <p className="text-sm text-slate-500">
                    {e.data === oggi ? 'Oggi' : formatData(e.data)} {intervalloOre(e.ora_inizio, e.ora_fine) && `· ${intervalloOre(e.ora_inizio, e.ora_fine)}`}
                    {e.luogo && ` · ${e.luogo}`}
                  </p>
                  <IndicatoreCopertura c={dati.copertura.get(e.id)} />
                </SchedaLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
