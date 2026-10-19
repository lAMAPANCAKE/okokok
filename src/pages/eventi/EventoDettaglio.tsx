import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FotoProfilo } from '../../components/ModuloProfilo'
import { Avviso, BadgeEvento, BadgeTurno, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select, Vuoto } from '../../components/ui'
import { durataOre, formatData, formatEuro, formatOra, formatOre, intervalloOre, nomeCompleto } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { COMPETENZE, type Copertura, type Evento, type MediaValutazioni, type Profilo, type ReportEvento, type Turno, type Valutazione } from '../../lib/types'
import { EconomiaEvento } from '../Report'
import { ValutazioniEvento } from './ValutazioniEvento'
import { oppureErrore, useDati } from '../../lib/useDati'
import { IndicatoreCopertura } from './Eventi'

interface DatiEvento {
  evento: Evento
  copertura: Copertura | undefined
  turni: Turno[]
  roster: Profilo[]
  /** collaboratori già impegnati in altri eventi nella stessa data */
  impegnati: Set<string>
  /** collaboratori che si sono segnati non disponibili nella data (con eventuale motivo) */
  indisponibili: Map<string, string | null>
  medie: Map<string, MediaValutazioni>
  valutazioni: Map<string, Valutazione>
  report: ReportEvento | null
}

export default function EventoDettaglio() {
  const { id } = useParams() as { id: string }
  const [assegna, setAssegna] = useState(false)
  const [oreAperte, setOreAperte] = useState<string | null>(null)
  const [errore, setErrore] = useState('')

  const { dati, errore: erroreCaricamento, caricamento, ricarica } = useDati<DatiEvento>(async () => {
    const evento = oppureErrore(await supabase.from('eventi').select('*').eq('id', id).single()) as Evento
    const [cop, turni, roster, altri, indisponibili, medie, valutazioni, report] = await Promise.all([
      supabase.from('eventi_copertura').select('*').eq('evento_id', id).maybeSingle(),
      supabase.from('turni').select('*').eq('evento_id', id).order('ora_inizio'),
      supabase.from('profiles').select('*').eq('attivo', true).order('cognome').order('nome'),
      supabase.from('turni').select('collaboratore_id').eq('data', evento.data).neq('evento_id', id).in('stato', ['proposto', 'confermato']),
      supabase.from('indisponibilita').select('collaboratore_id, nota').eq('data', evento.data),
      supabase.from('valutazioni_medie').select('*'),
      supabase.from('valutazioni').select('*').eq('evento_id', id),
      supabase.from('report_eventi').select('*').eq('evento_id', id).maybeSingle(),
    ])
    return {
      evento,
      copertura: oppureErrore(cop) as Copertura | undefined,
      turni: oppureErrore(turni) as Turno[],
      roster: oppureErrore(roster) as Profilo[],
      impegnati: new Set((oppureErrore(altri) as { collaboratore_id: string }[]).map((t) => t.collaboratore_id)),
      indisponibili: new Map((oppureErrore(indisponibili) as { collaboratore_id: string; nota: string | null }[]).map((i) => [i.collaboratore_id, i.nota])),
      medie: new Map((oppureErrore(medie) as MediaValutazioni[]).map((m) => [m.collaboratore_id, m])),
      valutazioni: new Map((oppureErrore(valutazioni) as Valutazione[]).map((v) => [v.collaboratore_id, v])),
      report: oppureErrore(report) as ReportEvento | null,
    }
  }, [id])

  const perId = useMemo(() => new Map((dati?.roster ?? []).map((p) => [p.id, p])), [dati?.roster])

  async function aggiornaTurno(turnoId: string, modifiche: Partial<Turno>) {
    setErrore('')
    const { error } = await supabase.from('turni').update(modifiche).eq('id', turnoId)
    if (error) setErrore(messaggioErrore(error))
    await ricarica()
  }

  async function eliminaTurno(turnoId: string) {
    if (!confirm('Eliminare questo turno?')) return
    setErrore('')
    const { error } = await supabase.from('turni').delete().eq('id', turnoId)
    if (error) setErrore(messaggioErrore(error))
    await ricarica()
  }

  if (caricamento) return <Caricamento />
  if (!dati) return <Avviso>{erroreCaricamento || 'Evento non trovato'}</Avviso>
  const { evento, turni } = dati

  return (
    <>
      <Intestazione
        titolo={evento.nome}
        sottotitolo={`${formatData(evento.data, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ${intervalloOre(evento.ora_inizio, evento.ora_fine) && '· ' + intervalloOre(evento.ora_inizio, evento.ora_fine)}`}
        indietro="/eventi"
        azione={
          <Link to={`/eventi/${id}/modifica`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300">
            Modifica
          </Link>
        }
      />

      <Scheda className="mb-4 space-y-1 text-sm">
        {evento.stato !== 'pianificato' && <BadgeEvento stato={evento.stato} />}
        {evento.cliente && <p><span className="text-slate-500">Cliente:</span> {evento.cliente}</p>}
        {evento.luogo && <p><span className="text-slate-500">Luogo:</span> {evento.luogo}</p>}
        {evento.note && <p className="whitespace-pre-line"><span className="text-slate-500">Note:</span> {evento.note}</p>}
        <IndicatoreCopertura c={dati.copertura} />
      </Scheda>

      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Turni ({turni.length})</h2>
        {evento.stato === 'pianificato' && !assegna && (
          <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => setAssegna(true)}>
            + Assegna
          </Bottone>
        )}
      </div>

      {assegna && (
        <ModuloAssegnazione
          evento={evento}
          roster={dati.roster}
          giaAssegnati={new Set(turni.filter((t) => t.stato !== 'rifiutato' && t.stato !== 'annullato').map((t) => t.collaboratore_id))}
          impegnati={dati.impegnati}
          indisponibili={dati.indisponibili}
          medie={dati.medie}
          onChiudi={() => setAssegna(false)}
          onSalvato={async () => {
            setAssegna(false)
            await ricarica()
          }}
        />
      )}

      {turni.length === 0 ? (
        <Vuoto titolo="Nessun turno assegnato" testo="Assegna il personale: riceverà il turno da confermare nell’app." />
      ) : (
        <ul className="space-y-3">
          {turni.map((t) => {
            const p = perId.get(t.collaboratore_id)
            return (
              <li key={t.id}>
                <Scheda>
                  <div className="flex items-start gap-3">
                    {p && <FotoProfilo profilo={p} dimensione="h-10 w-10" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {p ? (
                          <Link to={`/personale/${p.id}`} className="font-medium hover:underline">{nomeCompleto(p)}</Link>
                        ) : (
                          <p className="font-medium">Utente non attivo</p>
                        )}
                        <BadgeTurno stato={t.stato} />
                      </div>
                      {dati.indisponibili.has(t.collaboratore_id) && (t.stato === 'proposto' || t.stato === 'confermato') && (
                        <p className="mt-1 text-sm font-medium text-red-700">
                          Si è segnato non disponibile in questa data{dati.indisponibili.get(t.collaboratore_id) && `: ${dati.indisponibili.get(t.collaboratore_id)}`}
                        </p>
                      )}
                      <p className="text-sm text-slate-500">
                        {t.mansione} · {formatOra(t.ora_inizio)}–{formatOra(t.ora_fine)} · {formatEuro(t.tariffa_oraria)}/h
                      </p>
                      {t.motivo_rifiuto && <p className="mt-1 text-sm text-red-700">Motivo: {t.motivo_rifiuto}</p>}
                      {t.stato === 'completato' && (
                        <p className="mt-1 text-sm">
                          {formatOre(t.ore_totali)} registrate · <span className="font-medium">{formatEuro(t.compenso_lordo)}</span>
                        </p>
                      )}
                      {p?.telefono && (
                        <a href={`tel:${p.telefono}`} className="mt-1 inline-block text-sm text-brand-700 underline-offset-2 hover:underline">
                          {p.telefono}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(t.stato === 'confermato' || t.stato === 'completato') && (
                      <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => setOreAperte(oreAperte === t.id ? null : t.id)}>
                        {t.stato === 'completato' ? 'Correggi ore' : 'Registra ore'}
                      </Bottone>
                    )}
                    {t.stato === 'rifiutato' && (
                      <Bottone variante="fantasma" className="min-h-10 text-sm" onClick={() => void aggiornaTurno(t.id, { stato: 'proposto', motivo_rifiuto: null })}>
                        Riproponi
                      </Bottone>
                    )}
                    {(t.stato === 'proposto' || t.stato === 'confermato') && (
                      <Bottone variante="fantasma" className="min-h-10 text-sm" onClick={() => confirm('Annullare il turno? Il collaboratore lo vedrà come annullato.') && void aggiornaTurno(t.id, { stato: 'annullato' })}>
                        Annulla
                      </Bottone>
                    )}
                    {t.stato !== 'completato' && t.stato !== 'confermato' && (
                      <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => void eliminaTurno(t.id)}>
                        Elimina
                      </Bottone>
                    )}
                  </div>

                  {oreAperte === t.id && (
                    <ModuloOre
                      turno={t}
                      onChiudi={() => setOreAperte(null)}
                      onSalvato={async () => {
                        setOreAperte(null)
                        await ricarica()
                      }}
                    />
                  )}
                </Scheda>
              </li>
            )
          })}
        </ul>
      )}

      <ValutazioniEvento
        evento={evento}
        lavoratori={[...new Set(turni.filter((t) => t.stato === 'confermato' || t.stato === 'completato').map((t) => t.collaboratore_id))]
          .map((cid) => perId.get(cid))
          .filter((p): p is Profilo => Boolean(p))}
        valutazioni={dati.valutazioni}
        onSalvato={() => void ricarica()}
      />

      {dati.report && <EconomiaEvento r={dati.report} />}
    </>
  )
}

function ModuloAssegnazione({
  evento,
  roster,
  giaAssegnati,
  impegnati,
  indisponibili,
  medie,
  onChiudi,
  onSalvato,
}: {
  evento: Evento
  roster: Profilo[]
  giaAssegnati: Set<string>
  impegnati: Set<string>
  indisponibili: Map<string, string | null>
  medie: Map<string, MediaValutazioni>
  onChiudi: () => void
  onSalvato: () => Promise<void>
}) {
  const [filtro, setFiltro] = useState('')
  const [collaboratoreId, setCollaboratoreId] = useState('')
  const [mansione, setMansione] = useState('')
  const [inizio, setInizio] = useState(formatOra(evento.ora_inizio) || '')
  const [fine, setFine] = useState(formatOra(evento.ora_fine) || '')
  const [tariffa, setTariffa] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  const [mostraIndisponibili, setMostraIndisponibili] = useState(false)
  // Prima i disponibili, poi i migliori per valutazione media
  const candidati = roster
    .filter((p) => p.profilo_completo && !giaAssegnati.has(p.id) && (!filtro || p.competenze.includes(filtro)))
    .filter((p) => mostraIndisponibili || !indisponibili.has(p.id))
    .sort((a, b) => Number(indisponibili.has(a.id)) - Number(indisponibili.has(b.id)) || (medie.get(b.id)?.media ?? 0) - (medie.get(a.id)?.media ?? 0))
  const nascosti = roster.filter((p) => p.profilo_completo && !giaAssegnati.has(p.id) && indisponibili.has(p.id)).length

  function scegli(idScelto: string) {
    setCollaboratoreId(idScelto)
    const p = roster.find((x) => x.id === idScelto)
    if (p) setTariffa(String(p.tariffa_oraria))
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    if (!collaboratoreId) return setErrore('Scegli un collaboratore')
    if (!inizio || !fine) return setErrore('Indica orario di inizio e fine')
    setInvio(true)
    const { error } = await supabase.from('turni').insert({
      evento_id: evento.id,
      collaboratore_id: collaboratoreId,
      data: evento.data,
      ora_inizio: inizio,
      ora_fine: fine,
      mansione: mansione.trim(),
      tariffa_oraria: Number(tariffa) || 0,
    })
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    await onSalvato()
  }

  return (
    <Scheda className="mb-4">
      <form onSubmit={salva} className="space-y-4">
        <h3 className="font-semibold">Assegna un turno</h3>
        <Campo etichetta="Filtra per competenza">
          <Select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Tutte</option>
            {COMPETENZE.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Campo>
        <Campo etichetta="Collaboratore" aiuto="⚠ = già impegnato quel giorno · ★ = media valutazioni · 🚫 = non disponibile">
          <Select required value={collaboratoreId} onChange={(e) => scegli(e.target.value)}>
            <option value="">Scegli…</option>
            {[
              { etichetta: 'Collaboratori', persone: candidati.filter((p) => p.ruolo === 'collaboratore') },
              { etichetta: 'Responsabili e admin', persone: candidati.filter((p) => p.ruolo !== 'collaboratore') },
            ]
              .filter((g) => g.persone.length > 0)
              .map((g) => (
                <optgroup key={g.etichetta} label={g.etichetta}>
                  {g.persone.map((p) => (
                    <option key={p.id} value={p.id}>
                      {indisponibili.has(p.id) ? '🚫 ' : impegnati.has(p.id) ? '⚠ ' : ''}
                      {nomeCompleto(p)}
                      {medie.get(p.id) ? ` ★${String(medie.get(p.id)!.media).replace('.', ',')}` : ''}
                      {p.competenze.length ? ` — ${p.competenze.join(', ')}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
          </Select>
        </Campo>
        {nascosti > 0 && (
          <label className="flex min-h-10 items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-5 w-5" checked={mostraIndisponibili} onChange={(e) => setMostraIndisponibili(e.target.checked)} />
            Mostra anche chi non è disponibile ({nascosti})
          </label>
        )}
        {collaboratoreId && indisponibili.has(collaboratoreId) && (
          <Avviso>
            Questa persona si è segnata NON disponibile in questa data{indisponibili.get(collaboratoreId) ? `: ${indisponibili.get(collaboratoreId)}` : ''}. Proponile il turno solo se ne avete parlato.
          </Avviso>
        )}
        {collaboratoreId && impegnati.has(collaboratoreId) && <Avviso tipo="info">Questa persona ha già un turno in un altro evento in questa data.</Avviso>}
        <Campo etichetta="Mansione">
          <Input required list="mansioni" value={mansione} onChange={(e) => setMansione(e.target.value)} placeholder="es. cameriere di sala" />
          <datalist id="mansioni">
            {['cameriere di sala', 'bartender', 'hostess', 'capo sala', 'guardaroba', 'runner'].map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Campo>
        <div className="grid grid-cols-3 gap-3">
          <Campo etichetta="Inizio">
            <Input type="time" required value={inizio} onChange={(e) => setInizio(e.target.value)} />
          </Campo>
          <Campo etichetta="Fine">
            <Input type="time" required value={fine} onChange={(e) => setFine(e.target.value)} />
          </Campo>
          <Campo etichetta="€/ora">
            <Input type="number" inputMode="decimal" min={0} step="0.5" required value={tariffa} onChange={(e) => setTariffa(e.target.value)} />
          </Campo>
        </div>
        {errore && <Avviso>{errore}</Avviso>}
        <div className="flex gap-2">
          <Bottone type="submit" caricamento={invio}>Proponi turno</Bottone>
          <Bottone type="button" variante="fantasma" onClick={onChiudi}>Annulla</Bottone>
        </div>
      </form>
    </Scheda>
  )
}

function ModuloOre({ turno, onChiudi, onSalvato }: { turno: Turno; onChiudi: () => void; onSalvato: () => Promise<void> }) {
  const [ore, setOre] = useState({
    totali: String(turno.ore_totali ?? durataOre(turno.ora_inizio, turno.ora_fine)),
    notturne: String(turno.ore_notturne || 0),
    festive: String(turno.ore_festive || 0),
    straordinarie: String(turno.ore_straordinarie || 0),
  })
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const imposta = (campo: keyof typeof ore) => (v: string) => setOre((o) => ({ ...o, [campo]: v }))

  async function salva(e: FormEvent) {
    e.preventDefault()
    const n = (v: string) => Number(v.replace(',', '.')) || 0
    const totali = n(ore.totali)
    if (totali <= 0 || totali > 24) return setErrore('Le ore totali devono essere tra 0 e 24')
    if ([ore.notturne, ore.festive, ore.straordinarie].some((v) => n(v) > totali)) return setErrore('Le ore con maggiorazione non possono superare le ore totali')
    setErrore('')
    setInvio(true)
    const { error } = await supabase
      .from('turni')
      .update({ ore_totali: totali, ore_notturne: n(ore.notturne), ore_festive: n(ore.festive), ore_straordinarie: n(ore.straordinarie) })
      .eq('id', turno.id)
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    await onSalvato()
  }

  return (
    <form onSubmit={salva} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <p className="text-sm text-slate-600">Ore effettive. Le ore notturne, festive e straordinarie sono la parte delle ore totali a cui si applica la maggiorazione.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Campo etichetta="Totali">
          <Input inputMode="decimal" required value={ore.totali} onChange={(e) => imposta('totali')(e.target.value)} />
        </Campo>
        <Campo etichetta="Di cui notturne">
          <Input inputMode="decimal" value={ore.notturne} onChange={(e) => imposta('notturne')(e.target.value)} />
        </Campo>
        <Campo etichetta="Di cui festive">
          <Input inputMode="decimal" value={ore.festive} onChange={(e) => imposta('festive')(e.target.value)} />
        </Campo>
        <Campo etichetta="Di cui straord.">
          <Input inputMode="decimal" value={ore.straordinarie} onChange={(e) => imposta('straordinarie')(e.target.value)} />
        </Campo>
      </div>
      {errore && <Avviso>{errore}</Avviso>}
      <div className="flex gap-2">
        <Bottone type="submit" caricamento={invio}>Salva ore</Bottone>
        <Bottone type="button" variante="fantasma" onClick={onChiudi}>Chiudi</Bottone>
      </div>
    </form>
  )
}
