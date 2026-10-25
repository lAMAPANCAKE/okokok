import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePermessi } from '../../auth/AuthProvider'
import { Avviso, Bottone, Caricamento, Input, Intestazione, Scheda } from '../../components/ui'
import { normalizzaAllestimento, riepilogo, type Allestimento } from '../../lib/allestimento'
import { formatData } from '../../lib/format'
import { REPARTI, aggiornaLista, generaListaCarico, type ListaCarico as Lista, type Reparto, type VoceCarico } from '../../lib/listaCarico'
import type { Piatto } from '../../lib/ordineServizio'
import { scaricaPdfListaCarico } from '../../lib/pdfListaCarico'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { Evento } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'
import type { ZonaSopralluogo } from '../../lib/zone'

const listaVuota = (eventoId: string): Lista => ({ evento_id: eventoId, voci: [], coperti: null, ospiti: null, scorta_pct: 10 })

/**
 * Lista di carico dell'evento, divisa per reparto (sala, bar, cucina, allestimento, consumabili).
 * Lo staff la genera da sala 3D, menù e zone e la modifica; chi ha un turno confermato
 * la consulta e spunta il carico dal telefono.
 */
export default function ListaCarico() {
  const { id } = useParams() as { id: string }
  const { isStaff } = usePermessi()
  const [lista, setLista] = useState<Lista>(() => listaVuota(id))
  const [modificato, setModificato] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const [soloDaCaricare, setSoloDaCaricare] = useState(false)
  const [nuove, setNuove] = useState<Partial<Record<Reparto, string>>>({})
  const [messaggio, setMessaggio] = useState<{ tipo: 'errore' | 'successo' | 'info'; testo: string } | null>(null)

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const [ev, li] = await Promise.all([
      supabase.from('eventi').select('*').eq('id', id).single(),
      supabase.from('liste_carico').select('*').eq('evento_id', id).maybeSingle(),
    ])
    // Fonti per il calcolo (solo staff): sopralluogo collegato, menù e ospiti del preventivo
    let allestimento: Partial<Allestimento> | null = null
    let zone: ZonaSopralluogo[] = []
    let menu: Piatto[] = []
    let ospitiPreventivo: number | null = null
    if (isStaff) {
      const [so, pv, os] = await Promise.all([
        supabase.from('sopralluoghi').select('id, allestimento').eq('evento_id', id),
        supabase.from('preventivi').select('sopralluogo_id, ospiti').eq('evento_id', id),
        supabase.from('ordini_servizio').select('menu').eq('evento_id', id).maybeSingle(),
      ])
      const preventivi = (pv.data ?? []) as { sopralluogo_id: string | null; ospiti: number | null }[]
      ospitiPreventivo = preventivi.find((p) => p.ospiti)?.ospiti ?? null
      let sopralluoghi = (so.data ?? []) as { id: string; allestimento: Partial<Allestimento> | null }[]
      const daPreventivo = preventivi.map((p) => p.sopralluogo_id).filter((x): x is string => !!x && !sopralluoghi.some((s) => s.id === x))
      if (daPreventivo.length) sopralluoghi = [...sopralluoghi, ...(((await supabase.from('sopralluoghi').select('id, allestimento').in('id', daPreventivo)).data ?? []) as typeof sopralluoghi)]
      allestimento = sopralluoghi.find((s) => s.allestimento)?.allestimento ?? null
      if (sopralluoghi.length) zone = ((await supabase.from('sopralluogo_zone').select('*').in('sopralluogo_id', sopralluoghi.map((s) => s.id)).order('ordine')).data ?? []) as ZonaSopralluogo[]
      menu = ((os.data as { menu: Piatto[] } | null)?.menu ?? []) as Piatto[]
    }
    const copertiSala = allestimento ? riepilogo(normalizzaAllestimento(allestimento, null)).coperti : 0
    return { evento: oppureErrore(ev) as Evento, lista: oppureErrore(li) as Lista | null, allestimento, zone, menu, copertiSala, ospitiPreventivo }
  }, [id, isStaff])

  useEffect(() => {
    if (!dati) return
    const l = dati.lista ?? listaVuota(id)
    setLista({ ...l, coperti: l.coperti ?? (dati.copertiSala || dati.ospitiPreventivo), ospiti: l.ospiti ?? (dati.ospitiPreventivo ?? (dati.copertiSala || null)) })
    setModificato(false)
  }, [dati, id])

  if (caricamento && !dati) return <Caricamento />
  if (!dati) return <Avviso>{errore || 'Evento non trovato'}</Avviso>
  const { evento } = dati

  const cambia = (campi: Partial<Lista>) => {
    setLista((l) => ({ ...l, ...campi }))
    setModificato(true)
  }
  const cambiaVoce = (chiave: string, campi: Partial<VoceCarico>) => cambia({ voci: lista.voci.map((v) => (v.chiave === chiave ? { ...v, ...campi } : v)) })

  function genera() {
    const nuoveVoci = generaListaCarico({
      allestimento: dati!.allestimento, zone: dati!.zone, menu: dati!.menu,
      coperti: lista.coperti ?? 0, ospiti: lista.ospiti ?? 0, scortaPct: lista.scorta_pct,
    })
    if (!nuoveVoci.length) return setMessaggio({ tipo: 'info', testo: 'Indica coperti e ospiti, oppure collega un sopralluogo con l’allestimento 3D.' })
    const aggiornata = aggiornaLista(lista.voci, nuoveVoci)
    cambia({ voci: aggiornata })
    setMessaggio({ tipo: 'info', testo: lista.voci.length ? 'Lista aggiornata: le voci aggiunte a mano e quelle già caricate sono rimaste. Ricordati di salvare.' : `${aggiornata.length} voci calcolate. Controllale e salva.` })
  }

  async function salva() {
    setSalvataggio(true)
    setMessaggio(null)
    const { error } = await supabase.from('liste_carico').upsert({
      evento_id: id,
      voci: lista.voci.filter((v) => v.voce.trim() && v.quantita > 0),
      coperti: lista.coperti,
      ospiti: lista.ospiti,
      scorta_pct: lista.scorta_pct,
    })
    if (error) {
      setSalvataggio(false)
      return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    }
    await ricarica()
    setSalvataggio(false)
    setMessaggio({ tipo: 'successo', testo: 'Lista di carico salvata.' })
  }

  // La spunta al carico si salva subito, anche per i collaboratori (funzione dedicata nel database)
  async function spunta(v: VoceCarico) {
    const caricato = !v.caricato
    setLista((l) => ({ ...l, voci: l.voci.map((x) => (x.chiave === v.chiave ? { ...x, caricato } : x)) }))
    if (!dati?.lista || !dati.lista.voci.some((x) => x.chiave === v.chiave)) return setModificato(true)
    const { error } = await supabase.rpc('spunta_carico', { p_evento_id: id, p_chiave: v.chiave, p_caricato: caricato })
    if (error) {
      setLista((l) => ({ ...l, voci: l.voci.map((x) => (x.chiave === v.chiave ? { ...x, caricato: !caricato } : x)) }))
      setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    }
  }

  function aggiungi(reparto: Reparto) {
    const voce = nuove[reparto]?.trim()
    if (!voce) return
    cambia({ voci: [...lista.voci, { chiave: crypto.randomUUID(), reparto, voce, quantita: 1, unita: 'pz', caricato: false }] })
    setNuove((n) => ({ ...n, [reparto]: '' }))
  }

  const caricati = lista.voci.filter((v) => v.caricato).length
  const numero = (v: string) => (v.trim() === '' ? null : Math.max(0, parseInt(v, 10) || 0))

  return (
    <>
      <Intestazione
        titolo="Lista di carico"
        sottotitolo={`${evento.nome} · ${formatData(evento.data, { weekday: 'short', day: 'numeric', month: 'long' })}`}
        indietro={isStaff ? `/eventi/${id}` : '/turni'}
        azione={<Bottone variante="secondario" className="min-h-10 text-sm" disabled={!lista.voci.length} onClick={() => void scaricaPdfListaCarico(evento, lista)}>PDF</Bottone>}
      />
      {messaggio && <div className="mb-3" onClick={() => setMessaggio(null)}><Avviso tipo={messaggio.tipo}>{messaggio.testo}</Avviso></div>}
      {!isStaff && !dati.lista && <Avviso tipo="info">La lista di carico non è ancora pronta: la trovi qui appena il responsabile la prepara.</Avviso>}

      {isStaff && (
        <Scheda className="mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-500">Coperti</span>
              <Input type="number" inputMode="numeric" min={0} className="min-h-10" value={lista.coperti ?? ''} onChange={(e) => cambia({ coperti: numero(e.target.value) })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-500">Ospiti (bar)</span>
              <Input type="number" inputMode="numeric" min={0} className="min-h-10" value={lista.ospiti ?? ''} onChange={(e) => cambia({ ospiti: numero(e.target.value) })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-500">Scorta %</span>
              <Input type="number" inputMode="numeric" min={0} max={100} className="min-h-10" value={lista.scorta_pct} onChange={(e) => cambia({ scorta_pct: Math.min(100, numero(e.target.value) ?? 0) })} />
            </label>
          </div>
          <Bottone className="w-full" onClick={genera}>{lista.voci.length ? '↻ Aggiorna dalla sala, dal menù e dalle zone' : '✨ Calcola dalla sala, dal menù e dalle zone'}</Bottone>
          <p className="text-xs text-slate-500">
            {dati.allestimento ? `Sala 3D collegata: ${dati.copertiSala} coperti.` : 'Nessun allestimento 3D collegato: tavoli e sedie vanno aggiunti a mano.'}{' '}
            {dati.menu.length ? `Menù dall’ordine di servizio (${dati.menu.length} piatti).` : <>Senza menù si calcola un servizio classico (antipasto, primo, secondo, dolce): <Link to={`/eventi/${id}/ordine`} className="text-brand-700 underline">compila il menù</Link>.</>}
            {dati.zone.length ? ` ${dati.zone.length} zone del sopralluogo.` : ''}
          </p>
        </Scheda>
      )}

      {lista.voci.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Caricato {caricati}/{lista.voci.length}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" className="h-6 w-6" checked={soloDaCaricare} onChange={(e) => setSoloDaCaricare(e.target.checked)} />
            Solo da caricare
          </label>
        </div>
      )}
      {lista.voci.length > 0 && (
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-2 bg-emerald-500 transition-all" style={{ width: `${(caricati / lista.voci.length) * 100}%` }} />
        </div>
      )}

      {REPARTI.map(({ reparto, nome, icona, descrizione }) => {
        const tutte = lista.voci.filter((v) => v.reparto === reparto)
        const voci = soloDaCaricare ? tutte.filter((v) => !v.caricato) : tutte
        if (!tutte.length && !isStaff) return null
        return (
          <section key={reparto} className="mb-4">
            <h2 className="mb-1 text-lg font-semibold">
              {icona} {nome} <span className="text-sm font-normal text-slate-500">· {descrizione}{tutte.length ? ` · ${tutte.filter((v) => v.caricato).length}/${tutte.length}` : ''}</span>
            </h2>
            <Scheda className="space-y-1 p-2">
              {voci.map((v) => (
                <div key={v.chiave} className="flex items-center gap-2 border-b border-slate-100 py-1 last:border-0">
                  <input type="checkbox" className="h-6 w-6 shrink-0" checked={v.caricato} onChange={() => void spunta(v)} aria-label={`Caricato: ${v.voce}`} />
                  {isStaff ? (
                    <>
                      <div className="w-16 shrink-0">
                        <Input type="number" inputMode="numeric" min={0} className="min-h-10 px-2 text-right" value={v.quantita} onChange={(e) => cambiaVoce(v.chiave, { quantita: numero(e.target.value) ?? 0 })} aria-label={`Quantità di ${v.voce}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Input className={`min-h-10 ${v.caricato ? 'text-slate-400 line-through' : ''}`} value={v.voce} onChange={(e) => cambiaVoce(v.chiave, { voce: e.target.value, auto: false })} aria-label="Voce" />
                        {(v.note || (v.unita && v.unita !== 'pz')) && <p className="px-1 text-xs text-slate-500">{[v.unita && v.unita !== 'pz' ? v.unita : '', v.note].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <button type="button" onClick={() => cambia({ voci: lista.voci.filter((x) => x.chiave !== v.chiave) })} aria-label={`Elimina ${v.voce}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-700">✕</button>
                    </>
                  ) : (
                    <div className="flex min-h-10 flex-1 items-center gap-3">
                      <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{v.quantita}{v.unita && v.unita !== 'pz' ? <span className="text-xs font-normal"> {v.unita}</span> : ''}</span>
                      <span className={v.caricato ? 'text-slate-400 line-through' : ''}>{v.voce}{v.note && <span className="block text-xs text-slate-500">{v.note}</span>}</span>
                    </div>
                  )}
                </div>
              ))}
              {!voci.length && <p className="px-2 py-1 text-sm text-slate-500">{tutte.length ? 'Tutto caricato ✓' : 'Nessuna voce'}</p>}
              {isStaff && (
                <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); aggiungi(reparto) }}>
                  <Input className="min-h-10" value={nuove[reparto] ?? ''} onChange={(e) => setNuove((n) => ({ ...n, [reparto]: e.target.value }))} placeholder={`Aggiungi a ${nome.toLowerCase()}`} aria-label={`Nuova voce ${nome}`} />
                  <Bottone type="submit" variante="secondario" className="min-h-10 text-sm" disabled={!nuove[reparto]?.trim()}>Aggiungi</Bottone>
                </form>
              )}
            </Scheda>
          </section>
        )
      })}

      {isStaff && modificato && (
        <div className="pb-safe sticky bottom-20 z-10 md:bottom-4">
          <Bottone className="w-full shadow-lg" caricamento={salvataggio} onClick={() => void salva()}>Salva lista di carico</Bottone>
        </div>
      )}
    </>
  )
}
