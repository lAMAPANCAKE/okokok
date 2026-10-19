import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgePipeline, SchedeCommerciale } from '../../components/commerciale'
import { Avviso, Caricamento, Input, Intestazione, SchedaLink, Vuoto } from '../../components/ui'
import { formatData, oggiIso } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { ETICHETTA_PIPELINE, type Azienda, type FollowUp, type StatoPipeline } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

export default function Aziende() {
  const [filtro, setFiltro] = useState<StatoPipeline | 'tutte'>('tutte')
  const [cerca, setCerca] = useState('')
  const oggi = oggiIso()

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const [aziende, followup] = await Promise.all([
      supabase.from('aziende').select('*').order('nome'),
      supabase.from('followup').select('*').is('completato_il', null).lte('data', oggi).order('data'),
    ])
    return { aziende: oppureErrore(aziende) as Azienda[], followup: oppureErrore(followup) as FollowUp[] }
  }, [oggi])

  const conteggi = useMemo(() => {
    const c = {} as Record<StatoPipeline, number>
    for (const a of dati?.aziende ?? []) c[a.stato_pipeline] = (c[a.stato_pipeline] ?? 0) + 1
    return c
  }, [dati])

  const elenco = (dati?.aziende ?? []).filter((a) => {
    const q = cerca.trim().toLowerCase()
    return (filtro === 'tutte' || a.stato_pipeline === filtro) &&
      (!q || [a.nome, a.referente, a.settore, a.email].some((v) => v?.toLowerCase().includes(q)))
  })
  const nomeAzienda = (id: string) => dati?.aziende.find((a) => a.id === id)?.nome ?? 'Azienda'

  async function completa(id: string) {
    await supabase.from('followup').update({ completato_il: new Date().toISOString() }).eq('id', id)
    await ricarica()
  }

  return (
    <>
      <SchedeCommerciale />
      <Intestazione
        titolo="Clienti"
        sottotitolo={dati ? `${dati.aziende.length} aziende nel CRM` : undefined}
        azione={<Link to="/crm/nuova" className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">+ Nuova</Link>}
      />
      {errore && <Avviso>{errore}</Avviso>}
      {caricamento || !dati ? (
        <Caricamento />
      ) : (
        <div className="space-y-4">
          {dati.followup.length > 0 && (
            <section className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <h2 className="mb-2 font-semibold text-amber-900">Follow-up da fare ({dati.followup.length})</h2>
              <ul className="space-y-2">
                {dati.followup.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 text-sm">
                    <Link to={`/crm/${f.azienda_id}`} className="min-w-0">
                      <span className="font-medium">{nomeAzienda(f.azienda_id)}</span>
                      <span className="block text-amber-900/80">{f.nota}</span>
                      <span className={`text-xs ${f.data < oggi ? 'font-medium text-red-700' : 'text-amber-800'}`}>{f.data < oggi ? `Scaduto il ${formatData(f.data)}` : 'Oggi'}</span>
                    </Link>
                    <button className="min-h-10 shrink-0 rounded-lg bg-white px-3 text-xs font-medium ring-1 ring-amber-300" onClick={() => void completa(f.id)}>Fatto</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex w-max gap-2" role="tablist">
              {(['tutte', ...Object.keys(ETICHETTA_PIPELINE)] as (StatoPipeline | 'tutte')[]).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={filtro === s}
                  onClick={() => setFiltro(s)}
                  className={`min-h-10 rounded-full px-4 text-sm font-medium whitespace-nowrap ring-1 ${filtro === s ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
                >
                  {s === 'tutte' ? `Tutte (${dati.aziende.length})` : `${ETICHETTA_PIPELINE[s]} (${conteggi[s] ?? 0})`}
                </button>
              ))}
            </div>
          </div>
          <Input type="search" placeholder="Cerca per nome, referente, settore" value={cerca} onChange={(e) => setCerca(e.target.value)} />

          {elenco.length === 0 ? (
            <Vuoto titolo={dati.aziende.length ? 'Nessuna azienda con questi filtri' : 'Nessuna azienda nel CRM'} testo={dati.aziende.length ? undefined : 'Aggiungi i clienti e i potenziali clienti per seguirne la trattativa.'} />
          ) : (
            <ul className="space-y-2">
              {elenco.map((a) => (
                <li key={a.id}>
                  <SchedaLink to={`/crm/${a.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{a.nome}</p>
                        <p className="truncate text-sm text-slate-500">{[a.referente, a.settore].filter(Boolean).join(' · ') || 'Nessun referente'}</p>
                      </div>
                      <BadgePipeline stato={a.stato_pipeline} />
                    </div>
                  </SchedaLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
