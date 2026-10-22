import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AreaTesto, Avviso, BadgeTurno, Bottone, Campo, Caricamento, Input, Intestazione, Scheda } from '../../components/ui'
import { caricaDisponibilita, statoDi, type Disponibilita } from '../../lib/disponibilita'
import { formatData, formatOra, intervalloOre, nomeCompleto } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { Evento, Turno } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

const MANSIONI = ['Cameriere di sala', 'Responsabile di sala', 'Barista', 'Cuoco', 'Aiuto cuoco', 'Lavapiatti', 'Runner', 'Hostess', 'Addetto buffet', 'Magazziniere / autista']
const ATTIVI = ['proposto', 'confermato', 'completato']

const togliMinuti = (ora: string | null | undefined, minuti: number) => {
  if (!ora) return null
  const [h, m] = ora.split(':').map(Number)
  const t = (((h * 60 + m - minuti) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Testo da mandare al gruppo (WhatsApp, email): dati dell'evento, ritrovo, divisa e squadra con gli orari. */
function messaggioGruppo(e: Evento, squadra: { nome: string; mansione: string; orario: string }[]) {
  const righe = [
    `*${e.nome}*`,
    `📅 ${formatData(e.data, { weekday: 'long', day: 'numeric', month: 'long' })}${intervalloOre(e.ora_inizio, e.ora_fine) ? ` · evento ${intervalloOre(e.ora_inizio, e.ora_fine)}` : ''}`,
    e.luogo && `📍 ${e.luogo}`,
    (e.punto_ritrovo || e.ora_ritrovo) && `🕒 Ritrovo: ${[e.ora_ritrovo && `ore ${formatOra(e.ora_ritrovo)}`, e.punto_ritrovo].filter(Boolean).join(' – ')}`,
    e.divisa && `👔 Divisa: ${e.divisa}`,
    e.referente && `📞 Referente in loco: ${e.referente}`,
    '',
    `*Gruppo di lavoro (${squadra.length})*`,
    ...squadra.map((s) => `• ${s.nome} – ${s.mansione} ${s.orario}`),
  ]
  return righe.filter((r): r is string => typeof r === 'string').join('\n')
}

/**
 * Gruppo di lavoro della giornata di evento: dati per lo staff (ritrovo, divisa, referente),
 * squadra con orari di inizio e fine, aggiunta di persone guardando chi è libero, messaggio da inviare.
 */
export default function GruppoLavoro() {
  const { id } = useParams() as { id: string }
  const [info, setInfo] = useState({ punto_ritrovo: '', ora_ritrovo: '', divisa: '', referente: '' })
  const [infoModificata, setInfoModificata] = useState(false)
  const [orari, setOrari] = useState<Record<string, { ora_inizio: string; ora_fine: string; mansione: string }>>({})
  const [scelti, setScelti] = useState<Set<string>>(new Set())
  const [nuovo, setNuovo] = useState({ mansione: 'Cameriere di sala', ora_inizio: '', ora_fine: '' })
  const [salvataggio, setSalvataggio] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<{ tipo: 'errore' | 'successo' | 'info'; testo: string } | null>(null)

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const evento = oppureErrore(await supabase.from('eventi').select('*').eq('id', id).single()) as Evento
    const [tu, disp] = await Promise.all([
      supabase.from('turni').select('*').eq('evento_id', id).order('ora_inizio'),
      caricaDisponibilita(evento.data, evento.data),
    ])
    const turni = oppureErrore(tu) as Turno[]
    // Nomi anche di chi non è più tra i collaboratori attivi
    const mancanti = turni.map((t) => t.collaboratore_id).filter((c) => !disp.persone.some((p) => p.id === c))
    const altri = mancanti.length ? (((await supabase.from('profiles').select('id, nome, cognome, email').in('id', mancanti)).data ?? []) as { id: string; nome: string; cognome: string; email: string }[]) : []
    const nomi = new Map([...disp.persone, ...altri].map((p) => [p.id, nomeCompleto(p)]))
    return { evento, turni, disp, nomi }
  }, [id])

  useEffect(() => {
    if (!dati) return
    const e = dati.evento
    setInfo({ punto_ritrovo: e.punto_ritrovo ?? '', ora_ritrovo: formatOra(e.ora_ritrovo), divisa: e.divisa ?? '', referente: e.referente ?? '' })
    setInfoModificata(false)
    setOrari({})
    setScelti(new Set())
    setNuovo((n) => ({
      ...n,
      ora_inizio: formatOra(e.ora_ritrovo) || togliMinuti(e.ora_inizio, 60) || '18:00',
      ora_fine: formatOra(e.ora_fine) || '00:00',
    }))
  }, [dati])

  const squadra = useMemo(() => (dati?.turni ?? []).filter((t) => ATTIVI.includes(t.stato)), [dati])

  if (caricamento && !dati) return <Caricamento />
  if (!dati) return <Avviso>{errore || 'Evento non trovato'}</Avviso>
  const { evento, disp, nomi } = dati

  const nelGruppo = new Set(squadra.map((t) => t.collaboratore_id))
  const candidati = disp.persone.filter((p) => !nelGruppo.has(p.id))
  const statoCandidato = (pid: string) => statoDi(disp as Disponibilita, pid, evento.data)
  const ordine = { libero: 0, impegnato: 1, non_disponibile: 2 } as const
  candidati.sort((a, b) => ordine[statoCandidato(a.id).tipo] - ordine[statoCandidato(b.id).tipo])

  const righeMessaggio = squadra.map((t) => {
    const o = orari[t.id]
    return { nome: nomi.get(t.collaboratore_id) ?? 'Collaboratore', mansione: o?.mansione ?? t.mansione, orario: `${formatOra(o?.ora_inizio ?? t.ora_inizio)}–${formatOra(o?.ora_fine ?? t.ora_fine)}${t.stato === 'proposto' ? ' (da confermare)' : ''}` }
  })
  const testoMessaggio = messaggioGruppo({ ...evento, punto_ritrovo: info.punto_ritrovo || null, ora_ritrovo: info.ora_ritrovo || null, divisa: info.divisa || null, referente: info.referente || null }, righeMessaggio)

  async function salvaInfo() {
    setSalvataggio('info')
    const { error } = await supabase.from('eventi').update({
      punto_ritrovo: info.punto_ritrovo.trim() || null, ora_ritrovo: info.ora_ritrovo || null, divisa: info.divisa.trim() || null, referente: info.referente.trim() || null,
    }).eq('id', id)
    if (error) {
      setSalvataggio(null)
      return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    }
    await ricarica()
    setSalvataggio(null)
    setMessaggio({ tipo: 'successo', testo: 'Dati per lo staff salvati: ogni collaboratore li vede nella scheda del suo turno.' })
  }

  async function salvaOrari() {
    setSalvataggio('orari')
    for (const [tid, o] of Object.entries(orari)) {
      const { error } = await supabase.from('turni').update({ ora_inizio: o.ora_inizio, ora_fine: o.ora_fine, mansione: o.mansione.trim() || 'Staff' }).eq('id', tid)
      if (error) {
        setSalvataggio(null)
        return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
      }
    }
    await ricarica()
    setSalvataggio(null)
    setMessaggio({ tipo: 'successo', testo: 'Orari aggiornati.' })
  }

  async function aggiungi() {
    if (!nuovo.ora_inizio || !nuovo.ora_fine) return setMessaggio({ tipo: 'errore', testo: 'Indica ora di inizio e di fine.' })
    setSalvataggio('aggiungi')
    const righe = disp.persone.filter((p) => scelti.has(p.id)).map((p) => ({
      evento_id: id, collaboratore_id: p.id, data: evento.data, ora_inizio: nuovo.ora_inizio, ora_fine: nuovo.ora_fine,
      mansione: nuovo.mansione.trim() || 'Staff', tariffa_oraria: p.tariffa_oraria ?? 0,
    }))
    const { error } = await supabase.from('turni').insert(righe)
    if (error) {
      setSalvataggio(null)
      return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    }
    await ricarica()
    setSalvataggio(null)
    setMessaggio({ tipo: 'successo', testo: `${righe.length} ${righe.length === 1 ? 'persona aggiunta' : 'persone aggiunte'}: ricevono la proposta di turno da accettare.` })
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(testoMessaggio)
      setMessaggio({ tipo: 'successo', testo: 'Messaggio copiato: incollalo nel gruppo WhatsApp o in una email.' })
    } catch {
      setMessaggio({ tipo: 'errore', testo: 'Copia non riuscita: seleziona il testo e copialo a mano.' })
    }
  }

  async function pdf() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pulito = testoMessaggio.replace(/\*/g, '').replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/[^\n\x20-\xff€]/g, '').replace(/^ +/gm, '')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Gruppo di lavoro', 18, 20)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(doc.splitTextToSize(pulito, 174) as string[], 18, 30, { lineHeightFactor: 1.5 })
    doc.save(`${evento.nome.replace(/[^\w\s-]/g, '')} - gruppo di lavoro.pdf`)
  }

  const cambiaOrario = (t: Turno, campi: Partial<{ ora_inizio: string; ora_fine: string; mansione: string }>) =>
    setOrari((o) => ({ ...o, [t.id]: { ...(o[t.id] ?? { ora_inizio: formatOra(t.ora_inizio), ora_fine: formatOra(t.ora_fine), mansione: t.mansione }), ...campi } }))
  const alterna = (pid: string) => setScelti((s) => {
    const n = new Set(s)
    if (n.has(pid)) n.delete(pid)
    else n.add(pid)
    return n
  })

  return (
    <>
      <Intestazione
        titolo="Gruppo di lavoro"
        sottotitolo={`${evento.nome} · ${formatData(evento.data, { weekday: 'long', day: 'numeric', month: 'long' })}${intervalloOre(evento.ora_inizio, evento.ora_fine) ? ' · ' + intervalloOre(evento.ora_inizio, evento.ora_fine) : ''}`}
        indietro={`/eventi/${id}`}
      />
      {evento.luogo && <p className="-mt-2 mb-3 text-sm text-slate-600">📍 {evento.luogo}</p>}
      {messaggio && <div className="mb-3" onClick={() => setMessaggio(null)}><Avviso tipo={messaggio.tipo}>{messaggio.testo}</Avviso></div>}

      {/* Dati per lo staff */}
      <Scheda className="mb-4 space-y-3">
        <h2 className="text-lg font-semibold">Ritrovo e divisa</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
          <Campo etichetta="Punto di ritrovo">
            <Input value={info.punto_ritrovo} onChange={(e) => { setInfo({ ...info, punto_ritrovo: e.target.value }); setInfoModificata(true) }} placeholder="es. Ingresso di servizio sul retro, parcheggio B" />
          </Campo>
          <Campo etichetta="Ora di ritrovo">
            <Input type="time" value={info.ora_ritrovo} onChange={(e) => { setInfo({ ...info, ora_ritrovo: e.target.value }); setInfoModificata(true) }} />
          </Campo>
        </div>
        <Campo etichetta="Divisa">
          <Input value={info.divisa} onChange={(e) => { setInfo({ ...info, divisa: e.target.value }); setInfoModificata(true) }} placeholder="es. Camicia bianca, pantalone e scarpe nere, grembiule lungo" />
        </Campo>
        <Campo etichetta="Referente in loco">
          <Input value={info.referente} onChange={(e) => { setInfo({ ...info, referente: e.target.value }); setInfoModificata(true) }} placeholder="Nome e telefono" />
        </Campo>
        {infoModificata && <Bottone className="w-full" caricamento={salvataggio === 'info'} onClick={() => void salvaInfo()}>Salva ritrovo e divisa</Bottone>}
      </Scheda>

      {/* Squadra */}
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Squadra ({squadra.length}{evento.personale_richiesto ? `/${evento.personale_richiesto}` : ''})</h2>
          <Link to={`/eventi/${id}`} className="text-sm text-brand-700 hover:underline">Turni e ore →</Link>
        </div>
        {squadra.length === 0 ? (
          <p className="text-sm text-slate-500">Nessuno ancora: scegli le persone qui sotto.</p>
        ) : (
          <Scheda className="space-y-2 p-3">
            {squadra.map((t) => {
              const o = orari[t.id]
              return (
                <div key={t.id} className="space-y-1.5 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-medium">{nomi.get(t.collaboratore_id) ?? 'Collaboratore'}</p>
                    <BadgeTurno stato={t.stato} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_7rem]">
                    <Input className="col-span-2 min-h-10 text-sm sm:col-span-1" list="mansioni" value={o?.mansione ?? t.mansione} onChange={(e) => cambiaOrario(t, { mansione: e.target.value })} aria-label="Mansione" disabled={t.stato === 'completato'} />
                    <div><Input type="time" className="min-h-10 px-2 text-sm" value={o?.ora_inizio ?? formatOra(t.ora_inizio)} onChange={(e) => cambiaOrario(t, { ora_inizio: e.target.value })} aria-label="Inizio" disabled={t.stato === 'completato'} /></div>
                    <div><Input type="time" className="min-h-10 px-2 text-sm" value={o?.ora_fine ?? formatOra(t.ora_fine)} onChange={(e) => cambiaOrario(t, { ora_fine: e.target.value })} aria-label="Fine" disabled={t.stato === 'completato'} /></div>
                  </div>
                </div>
              )
            })}
            {Object.keys(orari).length > 0 && <Bottone className="w-full" caricamento={salvataggio === 'orari'} onClick={() => void salvaOrari()}>Salva orari e mansioni</Bottone>}
          </Scheda>
        )}
        <datalist id="mansioni">{MANSIONI.map((m) => <option key={m} value={m} />)}</datalist>
      </section>

      {/* Aggiungi persone */}
      <section className="mb-4">
        <h2 className="mb-2 text-lg font-semibold">Aggiungi al gruppo</h2>
        <Scheda className="space-y-3 p-3">
          <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_7rem_7rem]">
            <label className="col-span-2 block sm:col-span-1">
              <span className="mb-1 block text-xs text-slate-500">Mansione</span>
              <Input className="min-h-10" list="mansioni" value={nuovo.mansione} onChange={(e) => setNuovo({ ...nuovo, mansione: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Inizio</span>
              <Input type="time" className="min-h-10 px-2" value={nuovo.ora_inizio} onChange={(e) => setNuovo({ ...nuovo, ora_inizio: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Fine</span>
              <Input type="time" className="min-h-10 px-2" value={nuovo.ora_fine} onChange={(e) => setNuovo({ ...nuovo, ora_fine: e.target.value })} />
            </label>
          </div>
          <ul className="divide-y divide-slate-100">
            {candidati.map((p) => {
              const s = statoCandidato(p.id)
              const bloccato = s.tipo === 'non_disponibile'
              return (
                <li key={p.id}>
                  <label className={`flex min-h-12 items-center gap-3 py-1.5 ${bloccato ? 'opacity-60' : ''}`}>
                    <input type="checkbox" className="h-5 w-5 shrink-0" disabled={bloccato} checked={scelti.has(p.id)} onChange={() => alterna(p.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{nomeCompleto(p)}</span>
                      {p.competenze?.length > 0 && <span className="block truncate text-xs text-slate-500">{p.competenze.join(', ')}</span>}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ${s.tipo === 'libero' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : s.tipo === 'impegnato' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>
                      {s.tipo === 'libero' ? 'Libero' : s.tipo === 'impegnato' ? `Già in ${s.evento.replace(/^DEMO\s+/, '')}` : `Non disp.${s.nota ? ' · ' + s.nota.replace(/^DEMO\s+/, '') : ''}`}
                    </span>
                  </label>
                </li>
              )
            })}
            {candidati.length === 0 && <li className="py-2 text-sm text-slate-500">Tutti i collaboratori attivi sono già nel gruppo.</li>}
          </ul>
          <Bottone className="w-full" disabled={!scelti.size} caricamento={salvataggio === 'aggiungi'} onClick={() => void aggiungi()}>
            Aggiungi {scelti.size || ''} al gruppo · {nuovo.ora_inizio}–{nuovo.ora_fine}
          </Bottone>
          <p className="text-xs text-slate-500">Ogni persona riceve la proposta di turno con notifica e la accetta dal telefono. Chi è già impegnato altrove si può aggiungere, ma va gestito il conflitto.</p>
        </Scheda>
      </section>

      {/* Messaggio per il gruppo */}
      {squadra.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-2 text-lg font-semibold">Messaggio per il gruppo</h2>
          <Scheda className="space-y-2 p-3">
            <AreaTesto rows={Math.min(16, testoMessaggio.split('\n').length + 1)} readOnly value={testoMessaggio} className="text-sm" aria-label="Messaggio per il gruppo" />
            <div className="grid grid-cols-3 gap-2">
              <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => void copia()}>Copia</Bottone>
              <a href={`https://wa.me/?text=${encodeURIComponent(testoMessaggio)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-medium text-white">WhatsApp</a>
              <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => void pdf()}>PDF</Bottone>
            </div>
            {infoModificata && <p className="text-xs text-amber-700">Salva ritrovo e divisa: così li vedono anche i collaboratori nell’app.</p>}
          </Scheda>
        </section>
      )}
    </>
  )
}
