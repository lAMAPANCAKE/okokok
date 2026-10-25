import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avviso, Caricamento, Intestazione, Select } from '../components/ui'
import { caricaDisponibilita, statoDi, type StatoGiorno } from '../lib/disponibilita'
import { dataLocale, isoGiorno, nomeCompleto, oggiIso } from '../lib/format'
import { useDati } from '../lib/useDati'

const GIORNI = 14
const SETTIMANA = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']

const lunediDi = (iso: string) => {
  const d = dataLocale(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoGiorno(d)
}
const piuGiorni = (iso: string, n: number) => {
  const d = dataLocale(iso)
  d.setDate(d.getDate() + n)
  return isoGiorno(d)
}

const STILE: Record<StatoGiorno['tipo'] | 'proposto', string> = {
  libero: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  impegnato: 'bg-sky-700 text-white ring-sky-700',
  proposto: 'bg-amber-100 text-amber-900 ring-amber-300',
  non_disponibile: 'bg-red-50 text-red-700 ring-red-200',
}

/**
 * Disponibilità del personale su due settimane: chi è libero, chi è già impegnato
 * in un evento (confermato o da confermare) e chi ha segnato di non esserci.
 */
export default function DisponibilitaPersonale() {
  const oggi = oggiIso()
  const [inizio, setInizio] = useState(lunediDi(oggi))
  const [competenza, setCompetenza] = useState('')
  const [dettaglio, setDettaglio] = useState<{ nome: string; giorno: string; stato: StatoGiorno } | null>(null)
  const giorni = useMemo(() => Array.from({ length: GIORNI }, (_, i) => piuGiorni(inizio, i)), [inizio])
  const fine = giorni[giorni.length - 1]

  const { dati, errore, caricamento } = useDati(() => caricaDisponibilita(inizio, fine), [inizio, fine])

  const competenze = useMemo(() => [...new Set((dati?.persone ?? []).flatMap((p) => p.competenze ?? []))].sort(), [dati])
  const persone = (dati?.persone ?? []).filter((p) => !competenza || p.competenze?.includes(competenza))

  return (
    <>
      <Intestazione titolo="Disponibilità del personale" sottotitolo="Chi è libero, impegnato o non disponibile" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-xl ring-1 ring-slate-300">
          <button className="min-h-11 min-w-11 px-3 text-sm hover:bg-slate-50" onClick={() => setInizio(piuGiorni(inizio, -7))} aria-label="Settimana precedente">←</button>
          <button className="min-h-11 border-x border-slate-300 px-3 text-sm hover:bg-slate-50" onClick={() => setInizio(lunediDi(oggi))}>Oggi</button>
          <button className="min-h-11 min-w-11 px-3 text-sm hover:bg-slate-50" onClick={() => setInizio(piuGiorni(inizio, 7))} aria-label="Settimana successiva">→</button>
        </div>
        {competenze.length > 0 && (
          <Select className="min-h-10 w-auto text-sm" value={competenza} onChange={(e) => setCompetenza(e.target.value)} aria-label="Filtra per competenza">
            <option value="">Tutte le competenze</option>
            {competenze.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Legenda stile={STILE.libero}>Libero</Legenda>
        <Legenda stile={STILE.impegnato}>Impegnato (confermato)</Legenda>
        <Legenda stile={STILE.proposto}>Turno da confermare</Legenda>
        <Legenda stile={STILE.non_disponibile}>Non disponibile</Legenda>
      </div>

      {caricamento && !dati ? <Caricamento /> : errore ? <Avviso>{errore}</Avviso> : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-sm font-semibold">Persona</th>
                {giorni.map((g) => {
                  const d = dataLocale(g)
                  const weekend = d.getDay() === 0 || d.getDay() === 6
                  const liberi = persone.filter((p) => statoDi(dati!, p.id, g).tipo === 'libero').length
                  return (
                    <th key={g} className={`min-w-14 px-1 py-2 text-center font-medium ${g === oggi ? 'text-brand-700' : weekend ? 'text-slate-900' : 'text-slate-500'}`}>
                      <span className="block capitalize">{SETTIMANA[(d.getDay() + 6) % 7]}</span>
                      <span className="block text-sm">{d.getDate()}</span>
                      <span className="block font-normal text-emerald-700" title="Persone libere">{liberi} lib.</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {persone.map((p) => (
                <tr key={p.id}>
                  <th className="sticky left-0 z-10 border-t border-slate-100 bg-white px-3 py-1.5 text-left font-normal">
                    <Link to={`/personale/${p.id}`} className="block max-w-36 truncate text-sm font-medium hover:underline">{nomeCompleto(p)}</Link>
                    {p.competenze?.length > 0 && <span className="block max-w-36 truncate text-xs text-slate-500">{p.competenze.join(', ')}</span>}
                  </th>
                  {giorni.map((g) => {
                    const s = statoDi(dati!, p.id, g)
                    const stile = s.tipo === 'impegnato' && s.stato === 'proposto' ? STILE.proposto : STILE[s.tipo]
                    const testo = s.tipo === 'libero' ? '✓' : s.tipo === 'non_disponibile' ? '✕' : s.evento.replace(/^DEMO\s+/, '')
                    return (
                      <td key={g} className="border-t border-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setDettaglio({ nome: nomeCompleto(p), giorno: g, stato: s })}
                          title={s.tipo === 'impegnato' ? `${s.evento} · ${s.orario}` : s.tipo === 'non_disponibile' ? `Non disponibile${s.nota ? ': ' + s.nota : ''}` : 'Libero'}
                          className={`flex h-9 w-full min-w-12 items-center justify-center truncate rounded-lg px-1 ring-1 ${stile} ${g < oggi ? 'opacity-50' : ''}`}
                        >
                          <span className="truncate">{testo}</span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {persone.length === 0 && (
                <tr><td colSpan={GIORNI + 1} className="px-3 py-6 text-center text-sm text-slate-500">Nessun collaboratore attivo{competenza ? ` con la competenza “${competenza}”` : ''}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dettaglio && (
        <div className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-md rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200 md:bottom-6" role="dialog" aria-label="Dettaglio disponibilità">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{dettaglio.nome}</p>
              <p className="text-sm text-slate-500 capitalize">{dataLocale(dettaglio.giorno).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <button className="text-slate-500" onClick={() => setDettaglio(null)} aria-label="Chiudi">✕</button>
          </div>
          <p className="mt-2 text-sm">
            {dettaglio.stato.tipo === 'libero' && '✓ Libero: si può proporre un turno.'}
            {dettaglio.stato.tipo === 'non_disponibile' && `✕ Non disponibile${dettaglio.stato.nota ? `: ${dettaglio.stato.nota}` : ''}.`}
            {dettaglio.stato.tipo === 'impegnato' && (
              <>
                {dettaglio.stato.stato === 'proposto' ? 'Turno da confermare' : 'Impegnato'} in <Link className="font-medium text-brand-700 underline" to={`/eventi/${dettaglio.stato.eventoId}/gruppo`}>{dettaglio.stato.evento}</Link>, {dettaglio.stato.orario}.
              </>
            )}
          </p>
        </div>
      )}
    </>
  )
}

function Legenda({ stile, children }: { stile: string; children: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 ring-1 ${stile}`}>{children}</span>
}
