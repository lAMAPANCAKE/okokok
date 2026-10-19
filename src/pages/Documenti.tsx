import { useMemo, useState, type FormEvent } from 'react'
import { useAuth, usePermessi } from '../auth/AuthProvider'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select, Vuoto } from '../components/ui'
import { apriFile, caricaFile, eliminaFile, TIPI_FILE_ACCETTATI } from '../lib/file'
import { formatData, nomeCompleto } from '../lib/format'
import { messaggioErrore, supabase } from '../lib/supabase'
import { ETICHETTA_DOCUMENTO, type Documento, type Profilo, type TipoDocumento } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'

function BadgeDocumento({ d }: { d: Documento }) {
  const chip = (testo: string, stile: string) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${stile}`}>{testo}</span>
  if (d.stato_verifica === 'rifiutato') return chip('Rifiutato', 'bg-red-100 text-red-800')
  const scadenza =
    d.validita === 'scaduto' ? chip('Scaduto', 'bg-red-100 text-red-800')
    : d.validita === 'in_scadenza' ? chip(`Scade tra ${d.giorni_alla_scadenza} gg`, 'bg-amber-100 text-amber-800')
    : null
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {d.stato_verifica === 'in_verifica' ? chip('In verifica', 'bg-brand-100 text-brand-700') : !scadenza && chip('Valido', 'bg-emerald-100 text-emerald-800')}
      {scadenza}
    </span>
  )
}

function RigaDocumento({ d, titolo, azioni }: { d: Documento; titolo?: string; azioni?: React.ReactNode }) {
  const [errore, setErrore] = useState('')
  return (
    <Scheda className={d.piu_recente ? '' : 'opacity-60'}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {titolo && <p className="text-sm text-slate-500">{titolo}</p>}
          <p className="font-medium">{ETICHETTA_DOCUMENTO[d.tipo]}{d.descrizione && ` · ${d.descrizione}`}</p>
          <p className="text-sm text-slate-500">
            {d.scadenza ? `Scadenza ${formatData(d.scadenza, { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Senza scadenza'}
            {' · caricato '}{formatData(d.created_at.slice(0, 10), { day: 'numeric', month: 'short' })}
            {!d.piu_recente && ' · sostituito'}
          </p>
          {d.stato_verifica === 'rifiutato' && d.note_verifica && <p className="mt-1 text-sm text-red-700">Motivo: {d.note_verifica}</p>}
        </div>
        <BadgeDocumento d={d} />
      </div>
      {errore && <div className="mt-2"><Avviso>{errore}</Avviso></div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => apriFile('documenti', d.file_path).catch((e) => setErrore(messaggioErrore(e)))}>
          Apri file
        </Bottone>
        {azioni}
      </div>
    </Scheda>
  )
}

export default function Documenti() {
  const { isAdmin } = usePermessi()
  return isAdmin ? <DocumentiAdmin /> : <DocumentiPersonali />
}

function DocumentiPersonali() {
  const { profilo } = useAuth()
  const [carica, setCarica] = useState(false)

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const [docs, mancanti] = await Promise.all([
      supabase.from('documenti_validita').select('*').eq('collaboratore_id', profilo!.id).order('created_at', { ascending: false }),
      supabase.from('documenti_mancanti').select('tipo').eq('collaboratore_id', profilo!.id),
    ])
    return { docs: oppureErrore(docs) as Documento[], mancanti: (oppureErrore(mancanti) as { tipo: TipoDocumento }[]).map((m) => m.tipo) }
  }, [profilo?.id])

  async function elimina(d: Documento) {
    if (!confirm('Eliminare questo documento?')) return
    const { error } = await supabase.from('documenti').delete().eq('id', d.id)
    if (!error) await eliminaFile('documenti', d.file_path)
    await ricarica()
  }

  return (
    <>
      <Intestazione titolo="Documenti" sottotitolo="Visibili solo a te e all’amministrazione" />
      {errore && <Avviso>{errore}</Avviso>}
      {caricamento || !dati ? (
        <Caricamento />
      ) : (
        <div className="space-y-4">
          {dati.mancanti.length > 0 && (
            <Avviso tipo="info">
              Da caricare: <strong>{dati.mancanti.map((t) => ETICHETTA_DOCUMENTO[t]).join(', ')}</strong>
            </Avviso>
          )}
          {carica ? (
            <ModuloDocumento
              suggerito={dati.mancanti[0]}
              onChiudi={() => setCarica(false)}
              onSalvato={async () => {
                setCarica(false)
                await ricarica()
              }}
            />
          ) : (
            <Bottone className="w-full sm:w-auto" onClick={() => setCarica(true)}>+ Carica documento</Bottone>
          )}
          {dati.docs.length === 0 ? (
            <Vuoto titolo="Nessun documento caricato" testo="Puoi fotografarlo direttamente dal telefono." />
          ) : (
            <ul className="space-y-3">
              {dati.docs.map((d) => (
                <li key={d.id}>
                  <RigaDocumento
                    d={d}
                    azioni={
                      d.stato_verifica !== 'approvato' && (
                        <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => void elimina(d)}>Elimina</Bottone>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

function ModuloDocumento({ suggerito, onChiudi, onSalvato }: { suggerito?: TipoDocumento; onChiudi: () => void; onSalvato: () => Promise<void> }) {
  const { profilo } = useAuth()
  const [tipo, setTipo] = useState<TipoDocumento>(suggerito ?? 'carta_identita')
  const [descrizione, setDescrizione] = useState('')
  const [scadenza, setScadenza] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!file) return setErrore('Scegli o fotografa il file')
    setErrore('')
    setInvio(true)
    let percorso: string | null = null
    try {
      percorso = await caricaFile('documenti', profilo!.id, file)
      const { error } = await supabase.from('documenti').insert({
        collaboratore_id: profilo!.id,
        tipo,
        descrizione: descrizione.trim() || null,
        scadenza: scadenza || null,
        file_path: percorso,
        file_nome: file.name,
      })
      if (error) throw error
      await onSalvato()
    } catch (err) {
      if (percorso) await eliminaFile('documenti', percorso)
      setErrore(messaggioErrore(err))
    } finally {
      setInvio(false)
    }
  }

  return (
    <Scheda>
      <form onSubmit={salva} className="space-y-4">
        <h2 className="font-semibold">Carica documento</h2>
        <Campo etichetta="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
            {Object.entries(ETICHETTA_DOCUMENTO).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Campo>
        {tipo === 'altro' && (
          <Campo etichetta="Descrizione">
            <Input required value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
          </Campo>
        )}
        <Campo etichetta="Data di scadenza" aiuto="Lascia vuoto se il documento non scade (es. codice fiscale)">
          <Input type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} />
        </Campo>
        <Campo etichetta="File" aiuto="Foto o PDF, massimo 10 MB">
          <input
            type="file"
            accept={TIPI_FILE_ACCETTATI}
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-medium"
          />
        </Campo>
        {errore && <Avviso>{errore}</Avviso>}
        <div className="flex gap-2">
          <Bottone type="submit" caricamento={invio}>Carica</Bottone>
          <Bottone type="button" variante="fantasma" onClick={onChiudi}>Annulla</Bottone>
        </div>
      </form>
    </Scheda>
  )
}

type Vista = 'verifica' | 'scadenze' | 'mancanti' | 'tutti'

function DocumentiAdmin() {
  const [vista, setVista] = useState<Vista>('verifica')
  const [cerca, setCerca] = useState('')
  const [rifiuto, setRifiuto] = useState<{ id: string; nota: string } | null>(null)
  const [errore, setErrore] = useState('')

  const { dati, errore: erroreCaricamento, caricamento, ricarica } = useDati(async () => {
    const [docs, mancanti, profili] = await Promise.all([
      supabase.from('documenti_validita').select('*').order('created_at', { ascending: false }),
      supabase.from('documenti_mancanti').select('*'),
      supabase.from('profiles').select('*'),
    ])
    return {
      docs: oppureErrore(docs) as Documento[],
      mancanti: oppureErrore(mancanti) as { collaboratore_id: string; tipo: TipoDocumento }[],
      profili: new Map((oppureErrore(profili) as Profilo[]).map((p) => [p.id, p])),
    }
  }, [])

  const filtrati = useMemo(() => {
    if (!dati) return []
    const q = cerca.trim().toLowerCase()
    const perVista = dati.docs.filter((d) => {
      if (vista === 'verifica') return d.stato_verifica === 'in_verifica'
      if (vista === 'scadenze') return d.piu_recente && d.stato_verifica !== 'rifiutato' && (d.validita === 'in_scadenza' || d.validita === 'scaduto')
      return true
    })
    const ordinati = vista === 'scadenze' ? [...perVista].sort((a, b) => (a.giorni_alla_scadenza ?? 0) - (b.giorni_alla_scadenza ?? 0)) : perVista
    return ordinati.filter((d) => !q || nomeCompleto(dati.profili.get(d.collaboratore_id)).toLowerCase().includes(q))
  }, [dati, vista, cerca])

  const mancantiPerPersona = useMemo(() => {
    const m = new Map<string, TipoDocumento[]>()
    for (const r of dati?.mancanti ?? []) m.set(r.collaboratore_id, [...(m.get(r.collaboratore_id) ?? []), r.tipo])
    return [...m.entries()].sort((a, b) => nomeCompleto(dati?.profili.get(a[0])).localeCompare(nomeCompleto(dati?.profili.get(b[0])), 'it'))
  }, [dati])

  async function verifica(id: string, stato: 'approvato' | 'rifiutato', nota?: string) {
    setErrore('')
    const { error } = await supabase.from('documenti').update({ stato_verifica: stato, note_verifica: nota?.trim() || null }).eq('id', id)
    if (error) setErrore(messaggioErrore(error))
    setRifiuto(null)
    await ricarica()
  }

  const conteggi = dati && {
    verifica: dati.docs.filter((d) => d.stato_verifica === 'in_verifica').length,
    scadenze: dati.docs.filter((d) => d.piu_recente && d.stato_verifica !== 'rifiutato' && (d.validita === 'in_scadenza' || d.validita === 'scaduto')).length,
    mancanti: mancantiPerPersona.length,
  }

  const schede: { id: Vista; etichetta: string }[] = [
    { id: 'verifica', etichetta: `Da verificare${conteggi?.verifica ? ` (${conteggi.verifica})` : ''}` },
    { id: 'scadenze', etichetta: `Scadenze${conteggi?.scadenze ? ` (${conteggi.scadenze})` : ''}` },
    { id: 'mancanti', etichetta: `Mancanti${conteggi?.mancanti ? ` (${conteggi.mancanti})` : ''}` },
    { id: 'tutti', etichetta: 'Tutti' },
  ]

  return (
    <>
      <Intestazione titolo="Documenti" sottotitolo="Verifica, scadenze e documenti mancanti del roster" />
      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2" role="tablist">
          {schede.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={vista === s.id}
              onClick={() => setVista(s.id)}
              className={`min-h-10 rounded-full px-4 text-sm font-medium whitespace-nowrap ring-1 ${vista === s.id ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
            >
              {s.etichetta}
            </button>
          ))}
        </div>
      </div>
      {vista !== 'mancanti' && <Input className="mb-3" type="search" placeholder="Cerca collaboratore" value={cerca} onChange={(e) => setCerca(e.target.value)} />}
      {(errore || erroreCaricamento) && <div className="mb-3"><Avviso>{errore || erroreCaricamento}</Avviso></div>}

      {caricamento || !dati ? (
        <Caricamento />
      ) : vista === 'mancanti' ? (
        mancantiPerPersona.length === 0 ? (
          <Vuoto titolo="Nessun documento obbligatorio mancante" />
        ) : (
          <ul className="space-y-2">
            {mancantiPerPersona.map(([id, tipi]) => (
              <li key={id}>
                <Scheda>
                  <p className="font-medium">{nomeCompleto(dati.profili.get(id))}</p>
                  <p className="text-sm text-slate-500">{tipi.map((t) => ETICHETTA_DOCUMENTO[t]).join(', ')}</p>
                </Scheda>
              </li>
            ))}
          </ul>
        )
      ) : filtrati.length === 0 ? (
        <Vuoto titolo={vista === 'verifica' ? 'Nessun documento da verificare' : vista === 'scadenze' ? 'Nessun documento in scadenza nei prossimi 30 giorni' : 'Nessun documento'} />
      ) : (
        <ul className="space-y-3">
          {filtrati.map((d) => (
            <li key={d.id}>
              <RigaDocumento
                d={d}
                titolo={nomeCompleto(dati.profili.get(d.collaboratore_id))}
                azioni={
                  d.stato_verifica === 'in_verifica' && rifiuto?.id !== d.id && (
                    <>
                      <Bottone className="min-h-10 text-sm" onClick={() => void verifica(d.id, 'approvato')}>Approva</Bottone>
                      <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => setRifiuto({ id: d.id, nota: '' })}>Rifiuta</Bottone>
                    </>
                  )
                }
              />
              {rifiuto?.id === d.id && (
                <Scheda className="mt-2 space-y-3">
                  <AreaTesto placeholder="Motivo del rifiuto (es. foto illeggibile)" value={rifiuto.nota} onChange={(e) => setRifiuto({ id: d.id, nota: e.target.value })} rows={2} />
                  <div className="flex gap-2">
                    <Bottone variante="pericolo" className="min-h-10 text-sm" onClick={() => void verifica(d.id, 'rifiutato', rifiuto.nota)}>Conferma rifiuto</Bottone>
                    <Bottone variante="fantasma" className="min-h-10 text-sm" onClick={() => setRifiuto(null)}>Annulla</Bottone>
                  </div>
                </Scheda>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
