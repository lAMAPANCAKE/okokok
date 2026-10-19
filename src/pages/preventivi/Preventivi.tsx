import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgePreventivo, SchedeCommerciale, tassoConversione } from '../../components/commerciale'
import { Avviso, Caricamento, Input, Intestazione, Statistica, Vuoto } from '../../components/ui'
import { formatData, formatEuro, formatPercentuale } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { ETICHETTA_PREVENTIVO, type Azienda, type Preventivo, type StatoPreventivo, type TotaliPreventivo } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

export default function Preventivi() {
  const [filtro, setFiltro] = useState<StatoPreventivo | 'tutti'>('tutti')
  const [cerca, setCerca] = useState('')

  const { dati, errore, caricamento } = useDati(async () => {
    const [preventivi, totali, aziende] = await Promise.all([
      supabase.from('preventivi').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('preventivi_totali').select('*'),
      supabase.from('aziende').select('id, nome'),
    ])
    return {
      preventivi: oppureErrore(preventivi) as Preventivo[],
      totali: new Map((oppureErrore(totali) as TotaliPreventivo[]).map((t) => [t.preventivo_id, t])),
      aziende: new Map((oppureErrore(aziende) as Pick<Azienda, 'id' | 'nome'>[]).map((a) => [a.id, a.nome])),
    }
  }, [])

  const elenco = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return (dati?.preventivi ?? []).filter(
      (p) => (filtro === 'tutti' || p.stato === filtro) && (!q || [p.numero, p.titolo, dati?.aziende.get(p.azienda_id)].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [dati, filtro, cerca])

  const aperti = dati?.preventivi.filter((p) => p.stato === 'inviato') ?? []
  const valoreAperti = aperti.reduce((s, p) => s + Number(dati?.totali.get(p.id)?.imponibile ?? 0), 0)
  const conversione = tassoConversione(dati?.preventivi.map((p) => p.stato) ?? [])

  return (
    <>
      <SchedeCommerciale />
      <Intestazione
        titolo="Preventivi"
        azione={<Link to="/preventivi/nuovo" className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">+ Nuovo</Link>}
      />
      {errore && <Avviso>{errore}</Avviso>}
      {caricamento || !dati ? (
        <Caricamento />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Statistica etichetta="In attesa" valore={aperti.length} />
            <Statistica etichetta="Valore" valore={<span className="text-lg">{formatEuro(valoreAperti)}</span>} />
            <Statistica etichetta="Conversione" valore={conversione === null ? '—' : `${conversione}%`} />
          </div>
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex w-max gap-2" role="tablist">
              {(['tutti', ...Object.keys(ETICHETTA_PREVENTIVO)] as (StatoPreventivo | 'tutti')[]).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={filtro === s}
                  onClick={() => setFiltro(s)}
                  className={`min-h-10 rounded-full px-4 text-sm font-medium whitespace-nowrap ring-1 ${filtro === s ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
                >
                  {s === 'tutti' ? 'Tutti' : ETICHETTA_PREVENTIVO[s]} ({s === 'tutti' ? dati.preventivi.length : dati.preventivi.filter((p) => p.stato === s).length})
                </button>
              ))}
            </div>
          </div>
          <Input type="search" placeholder="Cerca per numero, titolo o cliente" value={cerca} onChange={(e) => setCerca(e.target.value)} />
          {elenco.length === 0 ? (
            <Vuoto titolo="Nessun preventivo" testo={dati.preventivi.length ? undefined : 'Crea il primo preventivo da qui o dalla scheda di un cliente.'} />
          ) : (
            <ul className="space-y-2">
              {elenco.map((p) => {
                const t = dati.totali.get(p.id)
                return (
                  <li key={p.id}>
                    <Link to={`/preventivi/${p.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:ring-slate-300">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-500">{p.numero} · {dati.aziende.get(p.azienda_id)}</p>
                          <p className="truncate font-semibold">{p.titolo}</p>
                          <p className="text-sm text-slate-500">{p.data_evento ? formatData(p.data_evento) : 'Data da definire'}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <BadgePreventivo stato={p.stato} />
                          <span className="font-semibold tabular-nums">{formatEuro(t?.totale)}</span>
                          {t?.margine_pct !== null && t?.margine_pct !== undefined && <span className="text-xs text-slate-500">margine {formatPercentuale(t.margine_pct)}</span>}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
