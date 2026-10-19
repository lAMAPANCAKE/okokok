import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avviso, Bottone, Caricamento, Intestazione, Scheda, Statistica, Vuoto } from '../components/ui'
import { formatData, formatEuro, formatOre, formatPercentuale, isoGiorno, oggiIso } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Azienda, ReportEvento } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'

function calcola(r: ReportEvento) {
  const costo = Number(r.costo_personale) + Number(r.costo_rimborsi)
  const ricavo = Number(r.ricavo)
  const margine = ricavo - costo
  const preventivato = ricavo - Number(r.costo_preventivato)
  return { costo, ricavo, margine, pct: ricavo > 0 ? (margine / ricavo) * 100 : null, preventivato, scostamento: margine - preventivato }
}

/** Riquadro economico nella pagina dell'evento (solo staff). */
export function EconomiaEvento({ r }: { r: ReportEvento }) {
  const c = calcola(r)
  if (!c.ricavo && !c.costo) return null
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-semibold">Economia dell’evento</h2>
      <Scheda className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Ricavo {r.preventivo_numero ? `(preventivo ${r.preventivo_numero})` : ''}</span><span className="tabular-nums">{r.preventivo_id ? formatEuro(c.ricavo) : 'nessun preventivo accettato'}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Compensi registrati ({formatOre(r.ore_lavorate)})</span><span className="tabular-nums">−{formatEuro(r.costo_personale)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Rimborsi spese</span><span className="tabular-nums">−{formatEuro(r.costo_rimborsi)}</span></div>
        <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold">
          <span>Margine reale</span>
          <span className={`tabular-nums ${c.margine < 0 ? 'text-red-700' : ''}`}>{formatEuro(c.margine)}{c.pct !== null && ` (${formatPercentuale(c.pct)})`}</span>
        </div>
        {r.preventivo_id && (
          <p className="text-xs text-slate-500">
            Margine previsto nel preventivo {formatEuro(c.preventivato)} · scostamento{' '}
            <span className={c.scostamento < 0 ? 'text-red-700' : 'text-emerald-700'}>{c.scostamento >= 0 ? '+' : ''}{formatEuro(c.scostamento)}</span>
          </p>
        )}
        {r.turni_senza_ore > 0 && <p className="text-xs text-amber-700">{r.turni_senza_ore} turni confermati senza ore registrate: il costo è ancora parziale.</p>}
      </Scheda>
    </section>
  )
}

function scaricaCsv(nome: string, righe: (string | number)[][]) {
  const cella = (v: string | number) => {
    const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const url = URL.createObjectURL(new Blob(['﻿' + righe.map((r) => r.map(cella).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  Object.assign(document.createElement('a'), { href: url, download: nome }).click()
  URL.revokeObjectURL(url)
}

const PERIODI = [
  { id: '90', etichetta: 'Ultimi 90 giorni', giorni: 90 },
  { id: '365', etichetta: 'Ultimo anno', giorni: 365 },
  { id: 'tutto', etichetta: 'Tutto', giorni: null },
] as const

export default function Report() {
  const [periodo, setPeriodo] = useState<(typeof PERIODI)[number]['id']>('90')
  const oggi = oggiIso()
  const dal = useMemo(() => {
    const g = PERIODI.find((p) => p.id === periodo)!.giorni
    return g ? isoGiorno(new Date(Date.now() - g * 86400000)) : null
  }, [periodo])

  const { dati, errore, caricamento } = useDati(async () => {
    let q = supabase.from('report_eventi').select('*').lte('data', oggi).neq('stato', 'annullato').order('data', { ascending: false })
    if (dal) q = q.gte('data', dal)
    const [righe, aziende] = await Promise.all([q, supabase.from('aziende').select('id, nome')])
    return {
      righe: (oppureErrore(righe) as ReportEvento[]).filter((r) => Number(r.ricavo) > 0 || Number(r.costo_personale) > 0),
      aziende: new Map((oppureErrore(aziende) as Pick<Azienda, 'id' | 'nome'>[]).map((a) => [a.id, a.nome])),
    }
  }, [dal, oggi])

  const totali = useMemo(() => {
    const t = { ricavo: 0, costo: 0, margine: 0, conPreventivo: 0 }
    for (const r of dati?.righe ?? []) {
      const c = calcola(r)
      if (!r.preventivo_id) continue
      t.ricavo += c.ricavo
      t.costo += c.costo
      t.margine += c.margine
      t.conPreventivo++
    }
    return t
  }, [dati])

  function esporta() {
    scaricaCsv(`report-eventi-${oggi}.csv`, [
      ['Data', 'Evento', 'Cliente', 'Preventivo', 'Ricavo (€)', 'Compensi (€)', 'Rimborsi (€)', 'Margine (€)', 'Margine %', 'Margine previsto (€)', 'Ore lavorate'],
      ...(dati?.righe ?? []).map((r) => {
        const c = calcola(r)
        return [r.data, r.nome, (r.azienda_id && dati?.aziende.get(r.azienda_id)) || '', r.preventivo_numero ?? '', c.ricavo, Number(r.costo_personale), Number(r.costo_rimborsi), c.margine, c.pct === null ? '' : Math.round(c.pct * 10) / 10, r.preventivo_id ? c.preventivato : '', Number(r.ore_lavorate)]
      }),
    ])
  }

  return (
    <>
      <Intestazione titolo="Report margini" sottotitolo="Ricavi dai preventivi accettati, costi reali da ore e rimborsi" />
      <div className="mb-4 grid grid-cols-3 rounded-xl bg-slate-200/70 p-1 text-sm font-medium" role="tablist">
        {PERIODI.map((p) => (
          <button key={p.id} role="tab" aria-selected={periodo === p.id} onClick={() => setPeriodo(p.id)} className={`min-h-10 rounded-lg ${periodo === p.id ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
            {p.etichetta}
          </button>
        ))}
      </div>
      {errore && <Avviso>{errore}</Avviso>}
      {caricamento || !dati ? (
        <Caricamento />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Statistica etichetta="Ricavi" valore={<span className="text-lg">{formatEuro(totali.ricavo)}</span>} />
            <Statistica etichetta="Costi" valore={<span className="text-lg">{formatEuro(totali.costo)}</span>} />
            <Statistica etichetta="Margine" valore={<span className="text-lg">{totali.ricavo ? formatPercentuale((totali.margine / totali.ricavo) * 100) : '—'}</span>} />
          </div>
          <p className="text-xs text-slate-500">Totali calcolati sui {totali.conPreventivo} eventi con preventivo accettato. Gli eventi senza preventivo mostrano solo i costi.</p>
          {dati.righe.length > 0 && <Bottone variante="secondario" className="min-h-10 text-sm" onClick={esporta}>Esporta CSV</Bottone>}
          {dati.righe.length === 0 ? (
            <Vuoto titolo="Nessun evento con ricavi o costi nel periodo" testo="Collega un preventivo accettato all’evento (pulsante “Crea evento”) e registra le ore." />
          ) : (
            <ul className="space-y-2">
              {dati.righe.map((r) => {
                const c = calcola(r)
                return (
                  <li key={r.evento_id}>
                    <Link to={`/eventi/${r.evento_id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:ring-slate-300">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-500">{formatData(r.data)}{r.azienda_id && ` · ${dati.aziende.get(r.azienda_id) ?? ''}`}</p>
                          <p className="truncate font-semibold">{r.nome}</p>
                          <p className="text-sm text-slate-500">
                            {r.preventivo_id ? `Ricavo ${formatEuro(c.ricavo)}` : 'Senza preventivo'} · costi {formatEuro(c.costo)}
                          </p>
                        </div>
                        {r.preventivo_id && (
                          <div className="shrink-0 text-right">
                            <p className={`font-semibold tabular-nums ${c.margine < 0 ? 'text-red-700' : ''}`}>{formatEuro(c.margine)}</p>
                            <p className="text-xs text-slate-500">{formatPercentuale(c.pct)}</p>
                            {r.turni_senza_ore > 0 && <p className="text-xs text-amber-700">ore mancanti</p>}
                          </div>
                        )}
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
