import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Avviso, Bottone, Caricamento, Input, Intestazione, Scheda } from '../components/ui'
import { formatData, formatMese, isoGiorno, oggiIso } from '../lib/format'
import { messaggioErrore, supabase } from '../lib/supabase'
import type { Indisponibilita, StatoTurno } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'

const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

function giorniDelMese(primo: string) {
  const [y, m] = primo.split('-').map(Number)
  const inizio = new Date(y, m - 1, 1)
  const vuoti = (inizio.getDay() + 6) % 7 // lunedì = 0
  const totale = new Date(y, m, 0).getDate()
  return { vuoti, giorni: Array.from({ length: totale }, (_, i) => isoGiorno(new Date(y, m - 1, i + 1))) }
}

/** Il collaboratore segna i giorni in cui NON è disponibile: un tocco per giorno. */
export default function Disponibilita() {
  const { profilo } = useAuth()
  const oggi = oggiIso()
  const [mese, setMese] = useState(oggi.slice(0, 8) + '01')
  const [nota, setNota] = useState('')
  const [errore, setErrore] = useState('')
  const [inCorso, setInCorso] = useState<string | null>(null)

  const fine = useMemo(() => {
    const [y, m] = mese.split('-').map(Number)
    return isoGiorno(new Date(y, m, 1))
  }, [mese])

  const { dati, caricamento, ricarica } = useDati(async () => {
    const [ind, turni] = await Promise.all([
      supabase.from('indisponibilita').select('*').eq('collaboratore_id', profilo!.id).gte('data', mese).lt('data', fine),
      supabase.from('turni').select('data, stato').eq('collaboratore_id', profilo!.id).gte('data', mese).lt('data', fine).in('stato', ['proposto', 'confermato', 'completato']),
    ])
    return {
      ind: new Map((oppureErrore(ind) as Indisponibilita[]).map((i) => [i.data, i])),
      turni: new Map((oppureErrore(turni) as { data: string; stato: StatoTurno }[]).map((t) => [t.data, t.stato])),
    }
  }, [mese, fine, profilo?.id])

  async function alterna(giorno: string) {
    if (!dati || giorno < oggi) return
    setErrore('')
    const esistente = dati.ind.get(giorno)
    if (!esistente && dati.turni.get(giorno) === 'confermato' && !confirm('Hai già un turno confermato in questo giorno. Segnarti comunque non disponibile? Il responsabile verrà avvisato.')) return
    setInCorso(giorno)
    const { error } = esistente
      ? await supabase.from('indisponibilita').delete().eq('id', esistente.id)
      : await supabase.from('indisponibilita').insert({ collaboratore_id: profilo!.id, data: giorno, nota: nota.trim() || null })
    setInCorso(null)
    if (error) setErrore(messaggioErrore(error))
    await ricarica()
  }

  const { vuoti, giorni } = giorniDelMese(mese)
  const sposta = (delta: number) => {
    const [y, m] = mese.split('-').map(Number)
    setMese(isoGiorno(new Date(y, m - 1 + delta, 1)))
  }
  const prossime = [...(dati?.ind.values() ?? [])].filter((i) => i.data >= oggi).sort((a, b) => a.data.localeCompare(b.data))

  return (
    <>
      <Intestazione titolo="Disponibilità" sottotitolo="Tocca i giorni in cui NON puoi lavorare" indietro="/turni" />
      <Scheda className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <button className="min-h-11 min-w-11 rounded-lg text-xl hover:bg-slate-100 disabled:opacity-30" disabled={mese <= oggi.slice(0, 8) + '01'} onClick={() => sposta(-1)} aria-label="Mese precedente">‹</button>
          <span className="font-medium">{formatMese(mese)}</span>
          <button className="min-h-11 min-w-11 rounded-lg text-xl hover:bg-slate-100" onClick={() => sposta(1)} aria-label="Mese successivo">›</button>
        </div>
        {caricamento || !dati ? (
          <Caricamento />
        ) : (
          <div className="grid grid-cols-7 gap-1 text-center">
            {GIORNI.map((g, i) => <div key={i} className="pb-1 text-xs font-medium text-slate-500">{g}</div>)}
            {Array.from({ length: vuoti }, (_, i) => <div key={`v${i}`} />)}
            {giorni.map((g) => {
              const passato = g < oggi
              const non = dati.ind.has(g)
              const turno = dati.turni.get(g)
              return (
                <button
                  key={g}
                  disabled={passato || inCorso === g}
                  onClick={() => void alterna(g)}
                  aria-pressed={non}
                  aria-label={`${formatData(g, { weekday: 'long', day: 'numeric', month: 'long' })}${non ? ', non disponibile' : ''}${turno ? `, turno ${turno}` : ''}`}
                  className={`relative flex aspect-square min-h-11 items-center justify-center rounded-xl text-sm font-medium transition ${
                    non ? 'bg-red-600 text-white' : passato ? 'text-slate-300' : 'bg-slate-50 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100'
                  } ${g === oggi ? 'outline-2 outline-offset-1 outline-slate-900' : ''}`}
                >
                  {Number(g.slice(8))}
                  {turno && <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${non ? 'bg-white' : turno === 'proposto' ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-600" /> Non disponibile</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Turno confermato</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Da confermare</span>
        </div>
      </Scheda>

      <Scheda className="mb-4">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Motivo (facoltativo, per i prossimi giorni che segni)</span>
          <Input className="mt-1" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="es. esami, vacanza, altro lavoro" />
        </label>
      </Scheda>

      {errore && <div className="mb-3"><Avviso>{errore}</Avviso></div>}

      {prossime.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Giorni segnati in {formatMese(mese).toLowerCase()}</h2>
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {prossime.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium capitalize">{formatData(i.data, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  {i.nota && <span className="block truncate text-slate-500">{i.nota}</span>}
                </span>
                <Bottone variante="fantasma" className="min-h-9 text-sm" onClick={() => void alterna(i.data)}>Togli</Bottone>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
