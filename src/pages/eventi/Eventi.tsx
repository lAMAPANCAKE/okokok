import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avviso, BadgeEvento, Caricamento, Intestazione, SchedaLink, Vuoto } from '../../components/ui'
import { formatData, intervalloOre, oggiIso } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Copertura, Evento } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

export function IndicatoreCopertura({ c }: { c: Copertura | undefined }) {
  if (!c || c.richiesti === 0) return <span className="text-xs text-slate-500">Fabbisogno non indicato</span>
  const percentuale = Math.min(100, Math.round((c.confermati / c.richiesti) * 100))
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-600">
          {c.confermati}/{c.richiesti} confermati{c.in_attesa > 0 && ` · ${c.in_attesa} in attesa`}
        </span>
        {c.mancanti > 0 ? <span className="font-medium text-amber-700">Mancano {c.mancanti}</span> : <span className="font-medium text-emerald-700">Coperto</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${c.mancanti > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percentuale}%` }} />
      </div>
    </div>
  )
}

export default function Eventi() {
  const [vista, setVista] = useState<'prossimi' | 'passati'>('prossimi')
  const oggi = oggiIso()

  const { dati, errore, caricamento } = useDati(async () => {
    let q = supabase.from('eventi').select('*')
    q = vista === 'prossimi' ? q.gte('data', oggi).order('data').order('ora_inizio') : q.lt('data', oggi).order('data', { ascending: false }).limit(100)
    const eventi = oppureErrore(await q) as Evento[]
    const ids = eventi.map((e) => e.id)
    const copertura = ids.length ? (oppureErrore(await supabase.from('eventi_copertura').select('*').in('evento_id', ids)) as Copertura[]) : []
    return { eventi, copertura: new Map(copertura.map((c) => [c.evento_id, c])) }
  }, [vista, oggi])

  return (
    <>
      <Intestazione
        titolo="Eventi"
        azione={
          <Link to="/eventi/nuovo" className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">
            + Nuovo
          </Link>
        }
      />
      <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-200/70 p-1 text-sm font-medium" role="tablist">
        {(['prossimi', 'passati'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={vista === v}
            onClick={() => setVista(v)}
            className={`min-h-10 rounded-lg capitalize ${vista === v ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            {v}
          </button>
        ))}
      </div>

      {errore && <Avviso>{errore}</Avviso>}
      {caricamento ? (
        <Caricamento />
      ) : !dati?.eventi.length ? (
        <Vuoto titolo={vista === 'prossimi' ? 'Nessun evento in programma' : 'Nessun evento passato'} testo={vista === 'prossimi' ? 'Crea un evento per iniziare ad assegnare i turni.' : undefined} />
      ) : (
        <ul className="space-y-3">
          {dati.eventi.map((e) => (
            <li key={e.id}>
              <SchedaLink to={`/eventi/${e.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.nome}</p>
                    <p className="text-sm text-slate-500">
                      {formatData(e.data)} {intervalloOre(e.ora_inizio, e.ora_fine) && `· ${intervalloOre(e.ora_inizio, e.ora_fine)}`}
                    </p>
                    {(e.luogo || e.cliente) && <p className="truncate text-sm text-slate-500">{[e.cliente, e.luogo].filter(Boolean).join(' · ')}</p>}
                  </div>
                  {e.stato !== 'pianificato' && <BadgeEvento stato={e.stato} />}
                </div>
                {e.stato !== 'annullato' && <IndicatoreCopertura c={dati.copertura.get(e.id)} />}
              </SchedaLink>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
