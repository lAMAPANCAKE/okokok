import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AreaTesto, Avviso, BadgeTurno, Bottone, Caricamento, Intestazione, Scheda, Vuoto } from '../components/ui'
import { formatData, formatEuro, formatOra, formatOre, oggiIso } from '../lib/format'
import { messaggioErrore, supabase } from '../lib/supabase'
import type { Evento, Turno } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'

export type TurnoConEvento = Turno & { eventi: Pick<Evento, 'nome' | 'luogo' | 'note' | 'cliente'> | null }

export function SchedaTurno({ turno, onRisposto }: { turno: TurnoConEvento; onRisposto?: () => void }) {
  const [rifiuto, setRifiuto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState<'si' | 'no' | null>(null)

  async function rispondi(accetta: boolean) {
    setErrore('')
    setInvio(accetta ? 'si' : 'no')
    const { error } = await supabase.rpc('rispondi_turno', { p_turno_id: turno.id, p_accetta: accetta, p_motivo: accetta ? null : motivo })
    setInvio(null)
    if (error) return setErrore(messaggioErrore(error))
    onRisposto?.()
  }

  const ev = turno.eventi
  return (
    <Scheda className={turno.stato === 'proposto' ? 'ring-2 ring-amber-300' : ''}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 capitalize">{formatData(turno.data, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="truncate text-lg font-semibold">{ev?.nome ?? 'Evento'}</p>
        </div>
        <BadgeTurno stato={turno.stato} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">Orario</dt>
        <dd>{formatOra(turno.ora_inizio)}–{formatOra(turno.ora_fine)}</dd>
        <dt className="text-slate-500">Mansione</dt>
        <dd>{turno.mansione}</dd>
        {ev?.luogo && (
          <>
            <dt className="text-slate-500">Luogo</dt>
            <dd>
              <a className="text-brand-700 underline-offset-2 hover:underline" href={`https://maps.google.com/?q=${encodeURIComponent(ev.luogo)}`} target="_blank" rel="noreferrer">
                {ev.luogo}
              </a>
            </dd>
          </>
        )}
        <dt className="text-slate-500">Tariffa</dt>
        <dd>{formatEuro(turno.tariffa_oraria)}/h</dd>
        {turno.stato === 'completato' && (
          <>
            <dt className="text-slate-500">Ore registrate</dt>
            <dd>{formatOre(turno.ore_totali)} · {formatEuro(turno.compenso_lordo)}</dd>
          </>
        )}
      </dl>
      {ev?.note && turno.stato !== 'annullato' && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm whitespace-pre-line text-slate-700">{ev.note}</p>}

      {turno.stato === 'proposto' && onRisposto && (
        <div className="mt-4 space-y-3">
          {rifiuto && (
            <AreaTesto placeholder="Motivo (facoltativo)" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
          )}
          {errore && <Avviso>{errore}</Avviso>}
          <div className="grid grid-cols-2 gap-3">
            {rifiuto ? (
              <>
                <Bottone variante="fantasma" onClick={() => setRifiuto(false)}>Indietro</Bottone>
                <Bottone variante="pericolo" caricamento={invio === 'no'} onClick={() => void rispondi(false)}>Conferma rifiuto</Bottone>
              </>
            ) : (
              <>
                <Bottone variante="secondario" onClick={() => setRifiuto(true)}>Rifiuta</Bottone>
                <Bottone caricamento={invio === 'si'} onClick={() => void rispondi(true)}>Accetta</Bottone>
              </>
            )}
          </div>
        </div>
      )}
    </Scheda>
  )
}

export default function MieiTurni() {
  const { profilo } = useAuth()
  const [vista, setVista] = useState<'prossimi' | 'passati'>('prossimi')
  const oggi = oggiIso()

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    let q = supabase.from('turni').select('*, eventi(nome, luogo, note, cliente)').eq('collaboratore_id', profilo!.id)
    q = vista === 'prossimi' ? q.gte('data', oggi).order('data').order('ora_inizio') : q.lt('data', oggi).order('data', { ascending: false }).limit(60)
    return oppureErrore(await q) as TurnoConEvento[]
  }, [vista, oggi, profilo?.id])

  const daConfermare = dati?.filter((t) => t.stato === 'proposto') ?? []
  const altri = dati?.filter((t) => t.stato !== 'proposto') ?? []

  return (
    <>
      <Intestazione
        titolo="I miei turni"
        azione={<Link to="/disponibilita" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300">Disponibilità</Link>}
      />
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-200/70 p-1 text-sm font-medium" role="tablist">
        {(['prossimi', 'passati'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={vista === v} onClick={() => setVista(v)} className={`min-h-10 rounded-lg capitalize ${vista === v ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
            {v}
          </button>
        ))}
      </div>
      {errore && <Avviso>{errore}</Avviso>}
      {caricamento ? (
        <Caricamento />
      ) : !dati?.length ? (
        <Vuoto titolo={vista === 'prossimi' ? 'Nessun turno in programma' : 'Nessun turno passato'} testo={vista === 'prossimi' ? 'Quando ti verrà proposto un turno lo troverai qui.' : undefined} />
      ) : (
        <div className="space-y-6">
          {daConfermare.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold text-amber-800">Da confermare ({daConfermare.length})</h2>
              <ul className="space-y-3">
                {daConfermare.map((t) => (
                  <li key={t.id}><SchedaTurno turno={t} onRisposto={() => void ricarica()} /></li>
                ))}
              </ul>
            </section>
          )}
          {altri.length > 0 && (
            <section>
              {daConfermare.length > 0 && <h2 className="mb-2 font-semibold">Altri turni</h2>}
              <ul className="space-y-3">
                {altri.map((t) => (
                  <li key={t.id}><SchedaTurno turno={t} /></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}
