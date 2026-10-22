import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePermessi } from '../../auth/AuthProvider'
import { Dettatura } from '../../components/Dettatura'
import { AreaTesto, Avviso, Bottone, Caricamento, Input, Intestazione, Scheda, Select } from '../../components/ui'
import { formatData, formatOra, intervalloOre, nomeCompleto } from '../../lib/format'
import {
  ALLERGENI, INTOLLERANZE_COMUNI, PORTATE, SCALETTE_TIPO, ordineVuoto, scalettaTipo,
  type Intolleranza, type OrdineServizio as Ordine, type Piatto, type RigaScaletta, type VoceChecklistMontaggio,
} from '../../lib/ordineServizio'
import { scaricaPdfOrdineServizio, type PersonaTurno } from '../../lib/pdfOrdineServizio'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { Evento, Turno } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'
import type { ZonaSopralluogo } from '../../lib/zone'

const nomeAllergene = (n: number) => ALLERGENI.find((a) => a.n === n)?.breve ?? String(n)

/**
 * Ordine di servizio dell'evento: scaletta, menù con allergeni, intolleranze degli ospiti,
 * personale, checklist di montaggio, dress code e note. Lo staff lo compila; i collaboratori
 * con turno confermato lo consultano dal telefono.
 */
export default function OrdineServizio() {
  const { id } = useParams() as { id: string }
  const { isStaff } = usePermessi()
  const [o, setO] = useState<Ordine>(() => ordineVuoto(id))
  const [modificato, setModificato] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const [messaggio, setMessaggio] = useState<{ tipo: 'errore' | 'successo' | 'info'; testo: string } | null>(null)
  const [nuovaVoce, setNuovaVoce] = useState('')

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const [ev, ord, tu] = await Promise.all([
      supabase.from('eventi').select('*').eq('id', id).single(),
      supabase.from('ordini_servizio').select('*').eq('evento_id', id).maybeSingle(),
      supabase.from('turni').select('*').eq('evento_id', id).in('stato', ['proposto', 'confermato', 'completato']).order('ora_inizio'),
    ])
    const turni = oppureErrore(tu) as Turno[]
    let nomi = new Map<string, string>()
    let zone: ZonaSopralluogo[] = []
    if (isStaff) {
      // Nomi del personale e zone del sopralluogo collegato (direttamente o tramite il preventivo)
      const [pr, so, pv] = await Promise.all([
        turni.length ? supabase.from('profiles').select('id, nome, cognome, email').in('id', turni.map((t) => t.collaboratore_id)) : Promise.resolve({ data: [], error: null }),
        supabase.from('sopralluoghi').select('id').eq('evento_id', id),
        supabase.from('preventivi').select('sopralluogo_id').eq('evento_id', id),
      ])
      nomi = new Map(((pr.data ?? []) as { id: string; nome: string; cognome: string; email: string }[]).map((p) => [p.id, nomeCompleto(p)]))
      const idSopralluoghi = [...new Set([...((so.data ?? []) as { id: string }[]).map((s) => s.id), ...((pv.data ?? []) as { sopralluogo_id: string | null }[]).map((p) => p.sopralluogo_id).filter((x): x is string => !!x)])]
      if (idSopralluoghi.length) zone = ((await supabase.from('sopralluogo_zone').select('*').in('sopralluogo_id', idSopralluoghi).order('ordine')).data ?? []) as ZonaSopralluogo[]
    }
    return { evento: oppureErrore(ev) as Evento, ordine: oppureErrore(ord) as Ordine | null, turni, nomi, zone }
  }, [id, isStaff])

  useEffect(() => {
    if (!dati) return
    setO(dati.ordine ? { ...ordineVuoto(id), ...dati.ordine } : ordineVuoto(id))
    setModificato(false)
  }, [dati, id])

  if (caricamento && !dati) return <Caricamento />
  if (!dati) return <Avviso>{errore || 'Evento non trovato'}</Avviso>
  const { evento } = dati

  const personale: PersonaTurno[] = dati.turni.map((t) => ({
    nome: dati.nomi.get(t.collaboratore_id) ?? (isStaff ? 'Collaboratore' : 'Tu'),
    mansione: t.mansione + (t.stato === 'proposto' ? ' (da confermare)' : ''),
    orario: `${formatOra(t.ora_inizio)}–${formatOra(t.ora_fine)}`,
  }))

  const cambia = (campi: Partial<Ordine>) => {
    setO((x) => ({ ...x, ...campi }))
    setModificato(true)
  }
  const cambiaRiga = <T,>(lista: T[], i: number, campi: Partial<T>) => lista.map((r, k) => (k === i ? { ...r, ...campi } : r))
  const togli = <T,>(lista: T[], i: number) => lista.filter((_, k) => k !== i)
  const sposta = <T,>(lista: T[], i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= lista.length) return lista
    const n = [...lista]
    ;[n[i], n[j]] = [n[j], n[i]]
    return n
  }

  async function salva() {
    setSalvataggio(true)
    setMessaggio(null)
    const pulito = {
      evento_id: id,
      scaletta: o.scaletta.filter((r) => r.attivita.trim()),
      menu: o.menu.filter((m) => m.piatto.trim()),
      intolleranze: o.intolleranze.filter((i) => i.tipo.trim()),
      checklist: o.checklist.filter((c) => c.voce.trim()),
      dress_code: o.dress_code?.trim() || null,
      note: o.note?.trim() || null,
    }
    const { error } = await supabase.from('ordini_servizio').upsert(pulito)
    if (error) {
      setSalvataggio(false)
      return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    }
    // Il salvataggio finisce dopo il ricaricamento: una spunta fatta nel frattempo non va persa
    await ricarica()
    setSalvataggio(false)
    setMessaggio({ tipo: 'successo', testo: 'Ordine di servizio salvato.' })
  }

  // In evento lo staff spunta la checklist: se il resto è già salvato, si salva subito
  async function spunta(i: number) {
    const checklist = cambiaRiga(o.checklist, i, { fatto: !o.checklist[i].fatto })
    setO((x) => ({ ...x, checklist }))
    if (modificato || !dati?.ordine) return setModificato(true)
    const { error } = await supabase.from('ordini_servizio').update({ checklist }).eq('evento_id', id)
    if (error) setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
  }

  function importaDalleZone() {
    const esistenti = new Set(o.checklist.map((c) => `${c.zona}|${c.voce}`.toLowerCase()))
    const nuove: VoceChecklistMontaggio[] = dati!.zone.flatMap((z) => z.voci.map((v) => ({ zona: z.nome, voce: v, fatto: false }))).filter((c) => !esistenti.has(`${c.zona}|${c.voce}`.toLowerCase()))
    if (!nuove.length) return setMessaggio({ tipo: 'info', testo: 'Nessuna nuova voce nelle zone del sopralluogo.' })
    cambia({ checklist: [...o.checklist, ...nuove] })
  }

  function applicaScaletta(nome: string) {
    if (!nome) return
    if (o.scaletta.length && !confirm('Sostituire la scaletta attuale con quella tipo?')) return
    cambia({ scaletta: scalettaTipo(nome, evento.ora_inizio) })
  }

  const totaleSpeciali = o.intolleranze.reduce((s, i) => s + (Number(i.numero) || 0), 0)
  const nomiZone = [...new Set(dati.zone.map((z) => z.nome))]
  const portate = [...PORTATE, ...new Set(o.menu.map((m) => m.portata).filter((p) => p && !PORTATE.includes(p)))]

  return (
    <>
      <Intestazione
        titolo="Ordine di servizio"
        sottotitolo={`${evento.nome} · ${formatData(evento.data, { weekday: 'short', day: 'numeric', month: 'long' })}${intervalloOre(evento.ora_inizio, evento.ora_fine) ? ' · ' + intervalloOre(evento.ora_inizio, evento.ora_fine) : ''}`}
        indietro={isStaff ? `/eventi/${id}` : '/turni'}
        azione={<Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => void scaricaPdfOrdineServizio(evento, o, personale)}>PDF</Bottone>}
      />
      {evento.luogo && <p className="-mt-2 mb-3 text-sm text-slate-600">📍 {evento.luogo}</p>}
      <Link to={`/eventi/${id}/carico`} className="mb-3 inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-brand-700 ring-1 ring-brand-100">📦 Lista di carico →</Link>
      {messaggio && <div className="mb-3" onClick={() => setMessaggio(null)}><Avviso tipo={messaggio.tipo}>{messaggio.testo}</Avviso></div>}
      {!isStaff && !dati.ordine && <Avviso tipo="info">L’ordine di servizio non è ancora pronto: lo trovi qui appena il responsabile lo compila.</Avviso>}

      {/* Scaletta */}
      {(isStaff || o.scaletta.length > 0) && (
        <section className="mb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Scaletta</h2>
            {isStaff && (
              <Select className="min-h-10 w-auto text-sm" value="" onChange={(e) => applicaScaletta(e.target.value)} aria-label="Scaletta tipo">
                <option value="">Usa una scaletta tipo…</option>
                {SCALETTE_TIPO.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}
          </div>
          {isStaff ? (
            <Scheda className="space-y-2 p-3">
              {o.scaletta.map((r, i) => (
                <div key={i} className="space-y-1.5 border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <Input type="time" className="min-h-10" value={r.ora} onChange={(e) => cambia({ scaletta: cambiaRiga<RigaScaletta>(o.scaletta, i, { ora: e.target.value }) })} aria-label="Ora" />
                    </div>
                    <Input className="min-h-10 min-w-0 flex-1" value={r.attivita} onChange={(e) => cambia({ scaletta: cambiaRiga<RigaScaletta>(o.scaletta, i, { attivita: e.target.value }) })} placeholder="Attività" aria-label="Attività" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Input className="min-h-10 min-w-0 flex-1" list="zone-evento" value={r.zona ?? ''} onChange={(e) => cambia({ scaletta: cambiaRiga<RigaScaletta>(o.scaletta, i, { zona: e.target.value }) })} placeholder="Zona (facoltativa)" aria-label="Zona" />
                    <BottoneIcona onClick={() => cambia({ scaletta: sposta(o.scaletta, i, -1) })} etichetta="Sposta su">↑</BottoneIcona>
                    <BottoneIcona onClick={() => cambia({ scaletta: sposta(o.scaletta, i, 1) })} etichetta="Sposta giù">↓</BottoneIcona>
                    <BottoneIcona onClick={() => cambia({ scaletta: togli(o.scaletta, i) })} etichetta="Elimina riga">✕</BottoneIcona>
                  </div>
                </div>
              ))}
              <datalist id="zone-evento">{nomiZone.map((z) => <option key={z} value={z} />)}</datalist>
              <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => cambia({ scaletta: [...o.scaletta, { ora: '', attivita: '' }] })}>+ Riga</Bottone>
            </Scheda>
          ) : (
            <Scheda className="p-0">
              <ul className="divide-y divide-slate-100">
                {o.scaletta.map((r, i) => (
                  <li key={i} className="flex gap-3 px-4 py-2.5">
                    <span className="w-12 shrink-0 font-semibold tabular-nums">{r.ora}</span>
                    <span>{r.attivita}{r.zona && <span className="text-slate-500"> · {r.zona}</span>}</span>
                  </li>
                ))}
              </ul>
            </Scheda>
          )}
        </section>
      )}

      {/* Personale */}
      {personale.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-lg font-semibold">{isStaff ? `Personale (${personale.length})` : 'Il tuo turno'}</h2>
          <Scheda className="p-0">
            <ul className="divide-y divide-slate-100 text-sm">
              {personale.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="min-w-0 truncate">{isStaff && <span className="font-medium">{p.nome} · </span>}{p.mansione}</span>
                  <span className="shrink-0 text-slate-500 tabular-nums">{p.orario}</span>
                </li>
              ))}
            </ul>
          </Scheda>
        </section>
      )}

      {/* Menù */}
      {(isStaff || o.menu.length > 0) && (
        <section className="mb-4">
          <h2 className="mb-2 text-lg font-semibold">Menù e allergeni</h2>
          {isStaff ? (
            <div className="space-y-2">
              {o.menu.map((m, i) => (
                <Scheda key={i} className="space-y-2 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Select className="min-h-10 w-40" value={m.portata} onChange={(e) => cambia({ menu: cambiaRiga<Piatto>(o.menu, i, { portata: e.target.value }) })} aria-label="Portata">
                      {portate.map((p) => <option key={p} value={p}>{p}</option>)}
                    </Select>
                    <Input className="min-h-10 min-w-48 flex-1" value={m.piatto} onChange={(e) => cambia({ menu: cambiaRiga<Piatto>(o.menu, i, { piatto: e.target.value }) })} placeholder="Piatto" aria-label="Piatto" />
                    <BottoneIcona onClick={() => cambia({ menu: togli(o.menu, i) })} etichetta="Elimina piatto">✕</BottoneIcona>
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Allergeni di ${m.piatto || 'questo piatto'}`}>
                    {ALLERGENI.map((a) => {
                      const attivo = m.allergeni.includes(a.n)
                      return (
                        <button
                          key={a.n}
                          type="button"
                          title={a.nome}
                          aria-pressed={attivo}
                          onClick={() => cambia({ menu: cambiaRiga<Piatto>(o.menu, i, { allergeni: attivo ? m.allergeni.filter((x) => x !== a.n) : [...m.allergeni, a.n] }) })}
                          className={`min-h-9 rounded-full px-2.5 text-xs ring-1 ${attivo ? 'bg-amber-500 font-semibold text-white ring-amber-500' : 'bg-white text-slate-600 ring-slate-300'}`}
                        >
                          {a.n} {a.breve}
                        </button>
                      )
                    })}
                  </div>
                  <Input className="min-h-10 text-sm" value={m.note ?? ''} onChange={(e) => cambia({ menu: cambiaRiga<Piatto>(o.menu, i, { note: e.target.value }) })} placeholder="Note (es. disponibile senza glutine)" aria-label="Note del piatto" />
                </Scheda>
              ))}
              <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => cambia({ menu: [...o.menu, { portata: o.menu[o.menu.length - 1]?.portata ?? 'Antipasti', piatto: '', allergeni: [] }] })}>+ Piatto</Bottone>
            </div>
          ) : (
            <Scheda className="space-y-3">
              {portate.filter((p) => o.menu.some((m) => m.portata === p)).map((p) => (
                <div key={p}>
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{p}</p>
                  <ul className="mt-1 space-y-1.5">
                    {o.menu.filter((m) => m.portata === p).map((m, i) => (
                      <li key={i}>
                        <p className="font-medium">{m.piatto}</p>
                        <p className="text-xs text-amber-800">{m.allergeni.length ? `Allergeni: ${[...m.allergeni].sort((a, b) => a - b).map(nomeAllergene).join(', ')}` : 'Nessun allergene'}</p>
                        {m.note && <p className="text-xs text-slate-500">{m.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Scheda>
          )}
        </section>
      )}

      {/* Intolleranze */}
      {(isStaff || o.intolleranze.length > 0) && (
        <section className="mb-4">
          <h2 className="mb-2 text-lg font-semibold">Intolleranze e richieste{totaleSpeciali > 0 && <span className="text-base font-normal text-slate-500"> · {totaleSpeciali} menù speciali</span>}</h2>
          {isStaff ? (
            <Scheda className="space-y-2 p-3">
              {o.intolleranze.map((r, i) => (
                <div key={i} className="space-y-1.5 border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex gap-2">
                    <div className="w-20 shrink-0">
                    <Input type="number" inputMode="numeric" min={0} className="min-h-10" value={r.numero || ''} onChange={(e) => cambia({ intolleranze: cambiaRiga<Intolleranza>(o.intolleranze, i, { numero: Math.max(0, parseInt(e.target.value, 10) || 0) }) })} aria-label="Numero di ospiti" placeholder="N." />
                    </div>
                    <Input className="min-h-10 min-w-0 flex-1" list="intolleranze-comuni" value={r.tipo} onChange={(e) => cambia({ intolleranze: cambiaRiga<Intolleranza>(o.intolleranze, i, { tipo: e.target.value }) })} placeholder="es. Celiachia" aria-label="Intolleranza o richiesta" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Input className="min-h-10 min-w-0 flex-1" value={r.note ?? ''} onChange={(e) => cambia({ intolleranze: cambiaRiga<Intolleranza>(o.intolleranze, i, { note: e.target.value }) })} placeholder="Tavolo / nome" aria-label="Tavolo o nome" />
                    <BottoneIcona onClick={() => cambia({ intolleranze: togli(o.intolleranze, i) })} etichetta="Elimina riga">✕</BottoneIcona>
                  </div>
                </div>
              ))}
              <datalist id="intolleranze-comuni">{INTOLLERANZE_COMUNI.map((x) => <option key={x} value={x} />)}</datalist>
              <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => cambia({ intolleranze: [...o.intolleranze, { tipo: '', numero: 1 }] })}>+ Richiesta</Bottone>
            </Scheda>
          ) : (
            <Scheda className="p-0">
              <ul className="divide-y divide-slate-100">
                {o.intolleranze.map((r, i) => (
                  <li key={i} className="flex gap-3 px-4 py-2.5">
                    <span className="w-8 shrink-0 font-semibold tabular-nums">{r.numero}</span>
                    <span>{r.tipo}{r.note && <span className="text-slate-500"> · {r.note}</span>}</span>
                  </li>
                ))}
              </ul>
            </Scheda>
          )}
        </section>
      )}

      {/* Checklist di montaggio */}
      {(isStaff || o.checklist.length > 0) && (
        <section className="mb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Checklist di montaggio{o.checklist.length > 0 && <span className="text-base font-normal text-slate-500"> · {o.checklist.filter((c) => c.fatto).length}/{o.checklist.length}</span>}</h2>
            {isStaff && dati.zone.some((z) => z.voci.length) && <Bottone variante="secondario" className="min-h-10 text-sm" onClick={importaDalleZone}>Importa dalle zone</Bottone>}
          </div>
          <Scheda className="space-y-1 p-3">
            {o.checklist.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="flex min-h-10 flex-1 items-center gap-3">
                  <input type="checkbox" className="h-5 w-5" checked={c.fatto} disabled={!isStaff} onChange={() => void spunta(i)} />
                  <span className={c.fatto ? 'text-slate-400 line-through' : ''}>{c.zona && <span className="text-slate-500">{c.zona}: </span>}{c.voce}</span>
                </label>
                {isStaff && <BottoneIcona onClick={() => cambia({ checklist: togli(o.checklist, i) })} etichetta="Elimina voce">✕</BottoneIcona>}
              </div>
            ))}
            {isStaff && (
              <form
                className="flex gap-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!nuovaVoce.trim()) return
                  cambia({ checklist: [...o.checklist, { zona: '', voce: nuovaVoce.trim(), fatto: false }] })
                  setNuovaVoce('')
                }}
              >
                <Input className="min-h-10" value={nuovaVoce} onChange={(e) => setNuovaVoce(e.target.value)} placeholder="Aggiungi una voce (es. prova audio)" />
                <Bottone type="submit" variante="secondario" className="min-h-10 text-sm" disabled={!nuovaVoce.trim()}>Aggiungi</Bottone>
              </form>
            )}
            {!isStaff && o.checklist.length === 0 && <p className="text-sm text-slate-500">Nessuna voce.</p>}
          </Scheda>
        </section>
      )}

      {/* Dress code e note */}
      {(isStaff || o.dress_code || o.note) && (
        <Scheda className="mb-4 space-y-3">
          <h2 className="text-lg font-semibold">Dress code e note</h2>
          {isStaff ? (
            <>
              <Input value={o.dress_code ?? ''} onChange={(e) => cambia({ dress_code: e.target.value })} placeholder="Dress code (es. camicia bianca, pantalone nero, grembiule lungo)" aria-label="Dress code" />
              <AreaTesto rows={4} value={o.note ?? ''} onChange={(e) => cambia({ note: e.target.value })} placeholder="Note per lo staff: parcheggio, ingresso di servizio, referente in loco, regole della location…" aria-label="Note per lo staff" />
              <Dettatura onTesto={(t) => cambia({ note: o.note?.trim() ? `${o.note.trimEnd()} ${t}` : t })} />
            </>
          ) : (
            <>
              {o.dress_code && <p><span className="text-slate-500">Dress code:</span> {o.dress_code}</p>}
              {o.note && <p className="whitespace-pre-line">{o.note}</p>}
            </>
          )}
        </Scheda>
      )}

      {isStaff && modificato && (
        <div className="pb-safe sticky bottom-20 z-10 md:bottom-4">
          <Bottone className="w-full shadow-lg" caricamento={salvataggio} onClick={() => void salva()}>Salva ordine di servizio</Bottone>
        </div>
      )}
    </>
  )
}

function BottoneIcona({ children, onClick, etichetta }: { children: string; onClick: () => void; etichetta: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={etichetta} title={etichetta} className="flex h-10 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
      {children}
    </button>
  )
}
