import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SchedeCommerciale } from '../../components/commerciale'
import { Avviso, Caricamento, Input, Intestazione, SchedaLink, Vuoto } from '../../components/ui'
import { formatData } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Azienda, Sopralluogo } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

export default function Sopralluoghi() {
  const [cerca, setCerca] = useState('')
  const { dati, errore, caricamento } = useDati(async () => {
    const [sopralluoghi, aziende] = await Promise.all([
      supabase.from('sopralluoghi').select('*').order('data', { ascending: false }).limit(300),
      supabase.from('aziende').select('id, nome'),
    ])
    return {
      sopralluoghi: oppureErrore(sopralluoghi) as Sopralluogo[],
      aziende: new Map((oppureErrore(aziende) as Pick<Azienda, 'id' | 'nome'>[]).map((a) => [a.id, a.nome])),
    }
  }, [])

  const elenco = (dati?.sopralluoghi ?? []).filter((s) => {
    const q = cerca.trim().toLowerCase()
    return !q || [s.titolo, s.indirizzo, s.azienda_id && dati?.aziende.get(s.azienda_id)].some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
  })

  return (
    <>
      <SchedeCommerciale />
      <Intestazione
        titolo="Sopralluoghi"
        azione={<Link to="/sopralluoghi/nuovo" className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white">+ Nuovo</Link>}
      />
      {errore && <Avviso>{errore}</Avviso>}
      {caricamento || !dati ? (
        <Caricamento />
      ) : (
        <div className="space-y-3">
          <Input type="search" placeholder="Cerca per location, indirizzo o cliente" value={cerca} onChange={(e) => setCerca(e.target.value)} />
          {elenco.length === 0 ? (
            <Vuoto titolo="Nessun sopralluogo" testo="Compila la checklist direttamente in loco dal telefono, con foto e misure." />
          ) : (
            <ul className="space-y-2">
              {elenco.map((s) => {
                const problemi = s.checklist.filter((c) => c.stato === 'problema').length
                const compilate = s.checklist.filter((c) => c.stato).length
                return (
                  <li key={s.id}>
                    <SchedaLink to={`/sopralluoghi/${s.id}`}>
                      <p className="text-sm text-slate-500">{formatData(s.data)}{s.azienda_id && ` · ${dati.aziende.get(s.azienda_id)}`}</p>
                      <p className="font-semibold">{s.titolo}</p>
                      {s.indirizzo && <p className="truncate text-sm text-slate-500">{s.indirizzo}</p>}
                      <p className="mt-1 text-xs text-slate-500">
                        Checklist {compilate}/{s.checklist.length}
                        {problemi > 0 && <span className="font-medium text-amber-700"> · {problemi} da gestire</span>}
                      </p>
                    </SchedaLink>
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
