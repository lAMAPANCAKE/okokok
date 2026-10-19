import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePermessi } from '../../auth/AuthProvider'
import { BadgeFattura, BadgePipeline, BadgePreventivo, tassoConversione } from '../../components/commerciale'
import { Avviso, Bottone, Caricamento, Input, Intestazione, Scheda, Vuoto } from '../../components/ui'
import { formatData, formatEuro, isoGiorno, nomeCompleto, oggiIso } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { ETICHETTA_PIPELINE, type Azienda, type Evento, type Fattura, type FollowUp, type Preventivo, type Profilo, type Sopralluogo, type StatoPipeline, type TotaliPreventivo } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

export default function AziendaDettaglio() {
  const { id } = useParams() as { id: string }
  const { isAdmin } = usePermessi()
  const [errore, setErrore] = useState('')

  const { dati, errore: erroreCaricamento, caricamento, ricarica } = useDati(async () => {
    const azienda = oppureErrore(await supabase.from('aziende').select('*').eq('id', id).single()) as Azienda
    const [followup, preventivi, sopralluoghi, eventi, profili] = await Promise.all([
      supabase.from('followup').select('*').eq('azienda_id', id).order('completato_il', { nullsFirst: true }).order('data'),
      supabase.from('preventivi').select('*').eq('azienda_id', id).order('created_at', { ascending: false }),
      supabase.from('sopralluoghi').select('id, titolo, data, indirizzo').eq('azienda_id', id).order('data', { ascending: false }),
      supabase.from('eventi').select('id, nome, data, stato').eq('azienda_id', id).order('data', { ascending: false }),
      supabase.from('profiles').select('id, nome, cognome, email, ruolo').in('ruolo', ['responsabile', 'admin']).eq('attivo', true),
    ])
    const prev = oppureErrore(preventivi) as Preventivo[]
    const totali = prev.length ? (oppureErrore(await supabase.from('preventivi_totali').select('*').in('preventivo_id', prev.map((p) => p.id))) as TotaliPreventivo[]) : []
    return {
      azienda,
      followup: oppureErrore(followup) as FollowUp[],
      preventivi: prev,
      totali: new Map(totali.map((t) => [t.preventivo_id, t])),
      sopralluoghi: oppureErrore(sopralluoghi) as Pick<Sopralluogo, 'id' | 'titolo' | 'data' | 'indirizzo'>[],
      eventi: oppureErrore(eventi) as Pick<Evento, 'id' | 'nome' | 'data' | 'stato'>[],
      staff: oppureErrore(profili) as Pick<Profilo, 'id' | 'nome' | 'cognome' | 'email'>[],
    }
  }, [id])

  async function cambiaStato(stato: StatoPipeline) {
    setErrore('')
    const { error } = await supabase.from('aziende').update({ stato_pipeline: stato }).eq('id', id)
    if (error) setErrore(messaggioErrore(error))
    await ricarica()
  }

  if (caricamento) return <Caricamento />
  if (!dati) return <Avviso>{erroreCaricamento || 'Azienda non trovata'}</Avviso>
  const { azienda: a } = dati
  const conversione = tassoConversione(dati.preventivi.map((p) => p.stato))
  const valoreAccettato = dati.preventivi.filter((p) => p.stato === 'accettato').reduce((s, p) => s + Number(dati.totali.get(p.id)?.imponibile ?? 0), 0)

  return (
    <>
      <Intestazione
        titolo={a.nome}
        sottotitolo={a.settore ?? undefined}
        indietro="/crm"
        azione={<Link to={`/crm/${id}/modifica`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300">Modifica</Link>}
      />
      {errore && <div className="mb-3"><Avviso>{errore}</Avviso></div>}

      <Scheda className="mb-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-slate-500">Trattativa</span>
          <BadgePipeline stato={a.stato_pipeline} />
        </div>
        <div className="-mx-1 flex flex-wrap gap-1.5">
          {(Object.keys(ETICHETTA_PIPELINE) as StatoPipeline[]).map((s) => (
            <button
              key={s}
              onClick={() => void cambiaStato(s)}
              disabled={s === a.stato_pipeline}
              className={`min-h-9 rounded-full px-3 text-xs font-medium ring-1 ${s === a.stato_pipeline ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50'}`}
            >
              {ETICHETTA_PIPELINE[s]}
            </button>
          ))}
        </div>
        <dl className="grid grid-cols-1 gap-1 border-t border-slate-100 pt-3 text-sm">
          {a.referente && <div><dt className="inline text-slate-500">Referente: </dt><dd className="inline">{a.referente}{a.ruolo_referente && ` (${a.ruolo_referente})`}</dd></div>}
          {a.telefono && <div><dt className="inline text-slate-500">Telefono: </dt><dd className="inline"><a className="text-brand-700 hover:underline" href={`tel:${a.telefono}`}>{a.telefono}</a></dd></div>}
          {a.email && <div><dt className="inline text-slate-500">Email: </dt><dd className="inline"><a className="text-brand-700 hover:underline" href={`mailto:${a.email}`}>{a.email}</a></dd></div>}
          {a.indirizzo && <div><dt className="inline text-slate-500">Indirizzo: </dt><dd className="inline">{a.indirizzo}</dd></div>}
          {a.partita_iva && <div><dt className="inline text-slate-500">P. IVA: </dt><dd className="inline">{a.partita_iva}</dd></div>}
          {a.note && <p className="mt-1 whitespace-pre-line">{a.note}</p>}
        </dl>
      </Scheda>

      <FollowUpAzienda aziendaId={id} followup={dati.followup} staff={dati.staff} onCambiato={() => void ricarica()} />

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Preventivi</h2>
          <Link to={`/preventivi/nuovo?azienda=${id}`} className="text-sm font-medium text-brand-700">+ Nuovo</Link>
        </div>
        {dati.preventivi.length > 0 && (
          <p className="mb-2 text-sm text-slate-500">
            Conversione {conversione === null ? '—' : `${conversione}%`} · accettati per {formatEuro(valoreAccettato)} + IVA
          </p>
        )}
        {dati.preventivi.length === 0 ? (
          <Vuoto titolo="Nessun preventivo" />
        ) : (
          <ul className="space-y-2">
            {dati.preventivi.map((p) => (
              <li key={p.id}>
                <Link to={`/preventivi/${p.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:ring-slate-300">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.numero} · {p.titolo}</p>
                    <p className="text-sm text-slate-500">{p.data_evento ? formatData(p.data_evento) : 'Data da definire'} · {formatEuro(dati.totali.get(p.id)?.totale)}</p>
                  </div>
                  <BadgePreventivo stato={p.stato} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin && <FattureAzienda aziendaId={id} />}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sopralluoghi</h2>
          <Link to={`/sopralluoghi/nuovo?azienda=${id}`} className="text-sm font-medium text-brand-700">+ Nuovo</Link>
        </div>
        {dati.sopralluoghi.length === 0 ? (
          <Vuoto titolo="Nessun sopralluogo" />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {dati.sopralluoghi.map((s) => (
              <li key={s.id}>
                <Link to={`/sopralluoghi/${s.id}`} className="block p-4 hover:bg-slate-50">
                  <p className="font-medium">{s.titolo}</p>
                  <p className="text-sm text-slate-500">{formatData(s.data)}{s.indirizzo && ` · ${s.indirizzo}`}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Eventi realizzati e in programma</h2>
        {dati.eventi.length === 0 ? (
          <Vuoto titolo="Nessun evento collegato" testo="Collega un evento a questa azienda dal modulo dell’evento o da un preventivo accettato." />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {dati.eventi.map((e) => (
              <li key={e.id}>
                <Link to={`/eventi/${e.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50">
                  <span className="min-w-0 truncate font-medium">{e.nome}</span>
                  <span className="shrink-0 text-sm text-slate-500">{formatData(e.data)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function FollowUpAzienda({ aziendaId, followup, staff, onCambiato }: { aziendaId: string; followup: FollowUp[]; staff: Pick<Profilo, 'id' | 'nome' | 'cognome' | 'email'>[]; onCambiato: () => void }) {
  const [nota, setNota] = useState('')
  const [data, setData] = useState(isoGiorno(new Date(Date.now() + 7 * 86400000)))
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const [mostraFatti, setMostraFatti] = useState(false)
  const oggi = oggiIso()
  const aperti = followup.filter((f) => !f.completato_il)
  const fatti = followup.filter((f) => f.completato_il)

  async function aggiungi(e: FormEvent) {
    e.preventDefault()
    if (!nota.trim()) return
    setErrore('')
    setInvio(true)
    const { error } = await supabase.from('followup').insert({ azienda_id: aziendaId, data, nota: nota.trim() })
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    setNota('')
    onCambiato()
  }

  async function completa(f: FollowUp) {
    await supabase.from('followup').update({ completato_il: f.completato_il ? null : new Date().toISOString() }).eq('id', f.id)
    onCambiato()
  }

  const tra = (giorni: number) => isoGiorno(new Date(Date.now() + giorni * 86400000))
  const nomeStaff = (id: string | null) => nomeCompleto(staff.find((s) => s.id === id))

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">Follow-up</h2>
      <Scheda className="space-y-3">
        {aperti.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun promemoria aperto.</p>
        ) : (
          <ul className="space-y-2">
            {aperti.map((f) => (
              <li key={f.id} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" aria-label="Segna come fatto" onChange={() => void completa(f)} />
                <div className="min-w-0 text-sm">
                  <p>{f.nota}</p>
                  <p className={`text-xs ${f.data < oggi ? 'font-medium text-red-700' : f.data === oggi ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
                    {f.data === oggi ? 'Oggi' : formatData(f.data)}{f.data < oggi && ' · scaduto'}{nomeStaff(f.assegnato_a) && ` · ${nomeStaff(f.assegnato_a)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={aggiungi} className="space-y-2 border-t border-slate-100 pt-3">
          <Input placeholder="es. richiamare per conferma data" value={nota} onChange={(e) => setNota(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            {[3, 7, 14, 30].map((g) => (
              <button key={g} type="button" onClick={() => setData(tra(g))} className={`min-h-9 rounded-full px-3 text-xs font-medium ring-1 ${data === tra(g) ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-300'}`}>
                +{g} gg
              </button>
            ))}
            <input type="date" value={data} min={oggi} onChange={(e) => setData(e.target.value)} className="min-h-9 rounded-lg px-2 text-sm ring-1 ring-slate-300" aria-label="Data del follow-up" />
          </div>
          {errore && <Avviso>{errore}</Avviso>}
          <Bottone type="submit" className="min-h-10 text-sm" caricamento={invio} disabled={!nota.trim()}>Aggiungi promemoria</Bottone>
        </form>
        {fatti.length > 0 && (
          <div className="border-t border-slate-100 pt-2">
            <button className="text-sm text-slate-500 hover:underline" onClick={() => setMostraFatti((v) => !v)}>
              {mostraFatti ? 'Nascondi' : 'Mostra'} completati ({fatti.length})
            </button>
            {mostraFatti && (
              <ul className="mt-2 space-y-1 text-sm text-slate-500">
                {fatti.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <input type="checkbox" checked className="h-4 w-4" aria-label="Riapri" onChange={() => void completa(f)} />
                    <span className="line-through">{f.nota}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Scheda>
    </section>
  )
}

/** Fatture del cliente con quanto resta da incassare (solo admin) */
function FattureAzienda({ aziendaId }: { aziendaId: string }) {
  const { dati } = useDati(async () => {
    return oppureErrore(await supabase.from('fatture_stato').select('*').eq('azienda_id', aziendaId).order('data_emissione', { ascending: false })) as Fattura[]
  }, [aziendaId])
  if (!dati) return null
  const residuo = dati.filter((f) => f.stato !== 'annullata').reduce((s, f) => s + Number(f.residuo), 0)

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fatture</h2>
        <Link to={`/fatture/nuova?azienda=${aziendaId}`} className="text-sm font-medium text-brand-700">+ Nuova</Link>
      </div>
      {dati.length > 0 && <p className="mb-2 text-sm text-slate-500">Da incassare {formatEuro(residuo)}</p>}
      {dati.length === 0 ? (
        <Vuoto titolo="Nessuna fattura" />
      ) : (
        <ul className="space-y-2">
          {dati.map((f) => (
            <li key={f.id}>
              <Link to={`/fatture/${f.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:ring-slate-300">
                <div className="min-w-0">
                  <p className="truncate font-medium">N. {f.numero}/{f.anno} · {f.descrizione}</p>
                  <p className="text-sm text-slate-500">{formatData(f.data_emissione)} · {formatEuro(f.totale)}</p>
                </div>
                <BadgeFattura stato={f.stato} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
