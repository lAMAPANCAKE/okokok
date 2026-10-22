import { useEffect, useRef, useState } from 'react'
import { formatEuro } from '../lib/format'
import type { RegolePersonale } from '../lib/personale'
import { proponiVoci, type VoceProposta } from '../lib/propostaPreventivo'
import { messaggioErrore, supabase } from '../lib/supabase'
import { oppureErrore } from '../lib/useDati'
import type { ZonaSopralluogo } from '../lib/zone'
import { Avviso, Bottone, Scheda } from './ui'

/**
 * Propone le voci del preventivo dal sopralluogo collegato: personale calcolato dai coperti,
 * arredi dell'allestimento 3D e voci delle zone. Si spuntano quelle da aggiungere.
 */
export function PropostaDaSopralluogo({ sopralluogoId, ospiti, regole, giaPresenti, apertaIniziale = false, onAggiungi }: {
  sopralluogoId: string
  ospiti: number | null
  regole: RegolePersonale
  giaPresenti: string[]
  apertaIniziale?: boolean
  onAggiungi: (voci: VoceProposta[]) => void
}) {
  const [proposte, setProposte] = useState<VoceProposta[] | null>(null)
  const [scelte, setScelte] = useState<Set<string>>(new Set())
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState('')
  const avviata = useRef(false)

  async function calcola() {
    setCaricamento(true)
    setErrore('')
    try {
      const [s, z] = await Promise.all([
        supabase.from('sopralluoghi').select('allestimento').eq('id', sopralluogoId).single(),
        supabase.from('sopralluogo_zone').select('*').eq('sopralluogo_id', sopralluogoId).order('ordine'),
      ])
      const base = { allestimento: (oppureErrore(s) as { allestimento: null }).allestimento, zone: oppureErrore(z) as ZonaSopralluogo[], ospiti, regole }
      // Prima le voci, poi gli ultimi prezzi usati per le stesse descrizioni
      const senzaPrezzi = proponiVoci({ ...base, prezzi: new Map() })
      const { data } = await supabase
        .from('preventivo_voci')
        .select('descrizione, prezzo_unitario, costo_unitario, ore')
        .in('descrizione', [...new Set(senzaPrezzi.map((v) => v.descrizione))])
      const prezzi = new Map<string, { prezzo: number; costo: number; ore: number | null }>()
      for (const v of (data ?? []) as { descrizione: string; prezzo_unitario: number; costo_unitario: number; ore: number | null }[]) {
        if (v.prezzo_unitario > 0) prezzi.set(v.descrizione.toLowerCase(), { prezzo: v.prezzo_unitario, costo: v.costo_unitario, ore: v.ore })
      }
      const tutte = proponiVoci({ ...base, prezzi })
      const presenti = new Set(giaPresenti.map((d) => d.trim().toLowerCase()))
      setProposte(tutte)
      setScelte(new Set(tutte.filter((v) => !presenti.has(v.descrizione.toLowerCase())).map((v) => v.chiave)))
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setCaricamento(false)
    }
  }

  // Arrivando da "Crea preventivo" nel sopralluogo la proposta si apre da sola
  useEffect(() => {
    if (!apertaIniziale || avviata.current) return
    avviata.current = true
    void calcola()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apertaIniziale])

  if (!proposte) {
    return (
      <Scheda className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Calcola personale, arredi e allestimenti dal sopralluogo collegato.</p>
        <Bottone className="min-h-10 text-sm" caricamento={caricamento} onClick={() => void calcola()}>✨ Proponi voci dal sopralluogo</Bottone>
        {errore && <div className="w-full"><Avviso>{errore}</Avviso></div>}
      </Scheda>
    )
  }

  const presenti = new Set(giaPresenti.map((d) => d.trim().toLowerCase()))
  const gruppi = (['Personale', 'Allestimento 3D', 'Zone'] as const).map((g) => ({ g, voci: proposte.filter((v) => v.gruppo === g) })).filter((x) => x.voci.length)
  const alterna = (k: string) => setScelte((s) => {
    const n = new Set(s)
    if (n.has(k)) n.delete(k)
    else n.add(k)
    return n
  })

  return (
    <Scheda className="mb-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Proposta dal sopralluogo</h2>
        <button className="text-sm text-slate-500" onClick={() => setProposte(null)}>Chiudi</button>
      </div>
      {proposte.length === 0 ? (
        <p className="text-sm text-slate-500">Nel sopralluogo non ci sono ancora coperti, allestimento 3D o zone con voci: compilali e riprova. In alternativa indica gli ospiti nel preventivo.</p>
      ) : (
        <>
          {gruppi.map(({ g, voci }) => (
            <section key={g}>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">{g}</h3>
              <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                {voci.map((v) => (
                  <li key={v.chiave}>
                    <label className="flex min-h-12 items-start gap-3 px-3 py-2">
                      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={scelte.has(v.chiave)} onChange={() => alterna(v.chiave)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {v.descrizione} <span className="font-normal text-slate-600">· {v.quantita}{v.ore ? ` × ${v.ore} h` : ''}</span>
                        </span>
                        <span className="block text-xs text-slate-500">
                          {v.motivo}
                          {v.prezzo !== null && ` · ultimo prezzo ${formatEuro(v.prezzo)}${v.tipo === 'personale' ? '/h' : ''}`}
                          {presenti.has(v.descrizione.toLowerCase()) && ' · già nel preventivo'}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Bottone className="w-full" disabled={!scelte.size} onClick={() => {
            onAggiungi(proposte.filter((v) => scelte.has(v.chiave)))
            setProposte(null)
          }}>
            Aggiungi {scelte.size} {scelte.size === 1 ? 'voce' : 'voci'} al preventivo
          </Bottone>
          <p className="text-xs text-slate-500">Le voci restano modificabili: controlla quantità e prezzi prima di inviare. Le voci senza prezzo vanno completate.</p>
        </>
      )}
    </Scheda>
  )
}
