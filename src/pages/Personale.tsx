import { Link, useParams } from 'react-router-dom'
import { FotoProfilo } from '../components/ModuloProfilo'
import { Stelle } from '../components/Stelle'
import { Avviso, BadgeTurno, Caricamento, Intestazione, Scheda, Statistica, Vuoto } from '../components/ui'
import { formatData, formatEuro, formatOre, nomeCompleto, oggiIso } from '../lib/format'
import { supabase } from '../lib/supabase'
import { ETICHETTA_RUOLO, type Evento, type Profilo, type Turno, type Valutazione } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'

type TurnoEv = Turno & { eventi: Pick<Evento, 'nome'> | null }

/** Scheda di un collaboratore per lo staff: storico valutazioni, turni e prossime indisponibilità. */
export default function Personale() {
  const { id } = useParams() as { id: string }
  const oggi = oggiIso()

  const { dati, errore, caricamento } = useDati(async () => {
    const [profilo, valutazioni, turni, ind] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('valutazioni').select('*, eventi(nome, data)').eq('collaboratore_id', id).order('created_at', { ascending: false }),
      supabase.from('turni').select('*, eventi(nome)').eq('collaboratore_id', id).order('data', { ascending: false }).limit(30),
      supabase.from('indisponibilita').select('data, nota').eq('collaboratore_id', id).gte('data', oggi).order('data').limit(20),
    ])
    return {
      p: oppureErrore(profilo) as Profilo,
      valutazioni: oppureErrore(valutazioni) as (Valutazione & { eventi: Pick<Evento, 'nome' | 'data'> | null })[],
      turni: oppureErrore(turni) as TurnoEv[],
      ind: oppureErrore(ind) as { data: string; nota: string | null }[],
    }
  }, [id, oggi])

  if (caricamento) return <Caricamento />
  if (!dati) return <Avviso>{errore || 'Persona non trovata'}</Avviso>
  const { p } = dati
  const media = dati.valutazioni.length ? dati.valutazioni.reduce((s, v) => s + v.punteggio, 0) / dati.valutazioni.length : 0
  const completati = dati.turni.filter((t) => t.stato === 'completato')
  const rifiutati = dati.turni.filter((t) => t.stato === 'rifiutato').length

  return (
    <>
      <Intestazione titolo={nomeCompleto(p)} sottotitolo={`${ETICHETTA_RUOLO[p.ruolo]} · ${formatEuro(p.tariffa_oraria)}/h`} indietro="/eventi" />
      <Scheda className="mb-4 flex items-center gap-4">
        <FotoProfilo profilo={p} />
        <div className="min-w-0 text-sm">
          {p.telefono && <a href={`tel:${p.telefono}`} className="block text-brand-700 hover:underline">{p.telefono}</a>}
          <p className="text-slate-500">{p.competenze.join(', ') || 'Nessuna competenza indicata'}</p>
          {(p.taglia_giacca || p.taglia_pantalone || p.numero_scarpe) && (
            <p className="text-slate-500">Divisa: {[p.taglia_giacca && `giacca ${p.taglia_giacca}`, p.taglia_pantalone && `pantalone ${p.taglia_pantalone}`, p.numero_scarpe && `scarpe ${p.numero_scarpe}`].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </Scheda>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Statistica etichetta="Media" valore={dati.valutazioni.length ? String(Math.round(media * 10) / 10).replace('.', ',') : '—'} />
        <Statistica etichetta="Turni svolti" valore={completati.length} />
        <Statistica etichetta="Rifiutati" valore={rifiutati} />
      </div>

      {dati.ind.length > 0 && (
        <Scheda className="mb-4 text-sm">
          <p className="mb-1 font-medium">Prossime indisponibilità</p>
          <p className="text-slate-600">{dati.ind.map((i) => formatData(i.data, { day: 'numeric', month: 'short' }) + (i.nota ? ` (${i.nota})` : '')).join(' · ')}</p>
        </Scheda>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Valutazioni ({dati.valutazioni.length})</h2>
        {dati.valutazioni.length === 0 ? (
          <Vuoto titolo="Nessuna valutazione" />
        ) : (
          <ul className="space-y-2">
            {dati.valutazioni.map((v) => (
              <li key={v.id}>
                <Scheda>
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/eventi/${v.evento_id}`} className="min-w-0 truncate font-medium hover:underline">{v.eventi?.nome ?? 'Evento'}</Link>
                    <Stelle valore={v.punteggio} piccole />
                  </div>
                  <p className="text-xs text-slate-500">{v.eventi?.data && formatData(v.eventi.data)}</p>
                  {v.note && <p className="mt-1 text-sm">{v.note}</p>}
                </Scheda>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Ultimi turni</h2>
        {dati.turni.length === 0 ? (
          <Vuoto titolo="Nessun turno" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {dati.turni.map((t) => (
              <li key={t.id}>
                <Link to={`/eventi/${t.evento_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.eventi?.nome ?? 'Evento'}</span>
                    <span className="text-sm text-slate-500">{formatData(t.data)} · {t.mansione}{t.stato === 'completato' && ` · ${formatOre(t.ore_totali)}`}</span>
                  </span>
                  <BadgeTurno stato={t.stato} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
