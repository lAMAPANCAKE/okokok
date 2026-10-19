import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeFattura } from '../../components/commerciale'
import { Avviso, Caricamento, Input, Intestazione, Statistica, Vuoto } from '../../components/ui'
import { formatData, formatEuro } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { ETICHETTA_FATTURA, type Azienda, type Fattura, type Incasso, type StatoFattura } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

type Filtro = StatoFattura | 'tutte' | 'aperte'

export default function Fatture() {
  const [filtro, setFiltro] = useState<Filtro>('aperte')
  const [cerca, setCerca] = useState('')
  const anno = new Date().getFullYear()

  const { dati, errore, caricamento } = useDati(async () => {
    const [fatture, aziende, incassi] = await Promise.all([
      supabase.from('fatture_stato').select('*').order('data_emissione', { ascending: false }).order('numero', { ascending: false }).limit(1000),
      supabase.from('aziende').select('id, nome'),
      supabase.from('incassi').select('importo').gte('data', `${anno}-01-01`),
    ])
    return {
      fatture: oppureErrore(fatture) as Fattura[],
      aziende: new Map((oppureErrore(aziende) as Pick<Azienda, 'id' | 'nome'>[]).map((a) => [a.id, a.nome])),
      incassatoAnno: (oppureErrore(incassi) as Pick<Incasso, 'importo'>[]).reduce((s, i) => s + Number(i.importo), 0),
    }
  }, [anno])

  const aperta = (f: Fattura) => f.stato === 'da_incassare' || f.stato === 'parziale' || f.stato === 'scaduta'
  const conta = (s: Filtro) => (dati?.fatture ?? []).filter((f) => (s === 'tutte' ? true : s === 'aperte' ? aperta(f) : f.stato === s)).length

  const elenco = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return (dati?.fatture ?? []).filter(
      (f) =>
        (filtro === 'tutte' || (filtro === 'aperte' ? aperta(f) : f.stato === filtro)) &&
        (!q || [f.numero, f.descrizione, dati?.aziende.get(f.azienda_id)].some((v) => v?.toLowerCase().includes(q))),
    )
  }, [dati, filtro, cerca])

  const daIncassare = dati?.fatture.filter(aperta).reduce((s, f) => s + Number(f.residuo), 0) ?? 0
  const scadute = dati?.fatture.filter((f) => f.stato === 'scaduta').reduce((s, f) => s + Number(f.residuo), 0) ?? 0

  return (
    <>
      <Intestazione
        titolo="Fatture e incassi"
        sottotitolo="Fatture emesse ai clienti e pagamenti ricevuti"
        azione={<Link to="/fatture/nuova" className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">+ Nuova</Link>}
      />
      {errore && <Avviso>{errore}</Avviso>}
      {caricamento || !dati ? (
        <Caricamento />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Statistica etichetta="Da incassare" valore={formatEuro(daIncassare)} />
            <Statistica etichetta="Di cui scadute" valore={formatEuro(scadute)} evidenzia={scadute > 0} />
            <Statistica etichetta={`Incassato ${anno}`} valore={formatEuro(dati.incassatoAnno)} />
          </div>
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex w-max gap-2" role="tablist">
              {(['aperte', 'scaduta', 'pagata', 'annullata', 'tutte'] as Filtro[]).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={filtro === s}
                  onClick={() => setFiltro(s)}
                  className={`min-h-10 rounded-full px-4 text-sm font-medium whitespace-nowrap ring-1 ${filtro === s ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
                >
                  {s === 'tutte' ? 'Tutte' : s === 'aperte' ? 'Da incassare' : s === 'scaduta' ? 'Scadute' : ETICHETTA_FATTURA[s]} ({conta(s)})
                </button>
              ))}
            </div>
          </div>
          <Input type="search" placeholder="Cerca per numero, descrizione o cliente" value={cerca} onChange={(e) => setCerca(e.target.value)} />
          {elenco.length === 0 ? (
            <Vuoto
              titolo="Nessuna fattura"
              testo={dati.fatture.length ? undefined : 'Registra qui le fatture che emetti, anche partendo da un preventivo accettato.'}
            />
          ) : (
            <ul className="space-y-2">
              {elenco.map((f) => (
                <li key={f.id}>
                  <Link to={`/fatture/${f.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:ring-slate-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500">N. {f.numero}/{f.anno} · {dati.aziende.get(f.azienda_id)}</p>
                        <p className="truncate font-semibold">{f.descrizione}</p>
                        <p className={`text-sm ${f.stato === 'scaduta' ? 'font-medium text-red-700' : 'text-slate-500'}`}>
                          {f.stato === 'pagata' ? `Pagata${f.ultimo_incasso ? ` il ${formatData(f.ultimo_incasso)}` : ''}` : `Scade ${formatData(f.data_scadenza)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <BadgeFattura stato={f.stato} />
                        <span className="font-semibold tabular-nums">{formatEuro(f.totale)}</span>
                        {(f.stato === 'parziale' || f.stato === 'scaduta') && Number(f.incassato) > 0 && (
                          <span className="text-xs text-slate-500">restano {formatEuro(f.residuo)}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
