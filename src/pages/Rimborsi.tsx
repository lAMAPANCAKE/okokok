import { useMemo, useState, type FormEvent } from 'react'
import { useAuth, usePermessi } from '../auth/AuthProvider'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select, Vuoto } from '../components/ui'
import { apriFile, caricaFile, eliminaFile, TIPI_FILE_ACCETTATI } from '../lib/file'
import { formatData, formatEuro, isoGiorno, nomeCompleto, oggiIso } from '../lib/format'
import { messaggioErrore, supabase } from '../lib/supabase'
import { ETICHETTA_RIMBORSO, type Evento, type Profilo, type Rimborso, type StatoRimborso, type TipoRimborso } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'

const STILE_STATO: Record<StatoRimborso, [string, string]> = {
  richiesto: ['Da approvare', 'bg-amber-100 text-amber-800'],
  approvato: ['Approvato · da pagare', 'bg-brand-100 text-brand-700'],
  rifiutato: ['Rifiutato', 'bg-red-100 text-red-800'],
  rimborsato: ['Pagato', 'bg-emerald-100 text-emerald-800'],
}

function BadgeRimborso({ stato }: { stato: StatoRimborso }) {
  const [testo, stile] = STILE_STATO[stato]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${stile}`}>{testo}</span>
}

type Vista = 'mie' | 'da_approvare' | 'da_pagare' | 'storico'

export default function Rimborsi() {
  const { profilo } = useAuth()
  const { isStaff, isAdmin } = usePermessi()
  const [vista, setVista] = useState<Vista>(isStaff ? 'da_approvare' : 'mie')
  const [nuova, setNuova] = useState(false)
  const [rifiuto, setRifiuto] = useState<{ id: string; motivo: string } | null>(null)
  const [errore, setErrore] = useState('')

  const { dati, errore: erroreCaricamento, caricamento, ricarica } = useDati(async () => {
    const [rimborsi, eventi, profili] = await Promise.all([
      supabase.from('rimborsi').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('eventi').select('id, nome, data').gte('data', isoGiorno(new Date(Date.now() - 90 * 86400000))).order('data', { ascending: false }),
      supabase.from('profiles').select('id, nome, cognome, email'),
    ])
    return {
      rimborsi: oppureErrore(rimborsi) as Rimborso[],
      eventi: oppureErrore(eventi) as Pick<Evento, 'id' | 'nome' | 'data'>[],
      profili: new Map((oppureErrore(profili) as Pick<Profilo, 'id' | 'nome' | 'cognome' | 'email'>[]).map((p) => [p.id, p])),
    }
  }, [])

  const elenco = useMemo(() => {
    const r = dati?.rimborsi ?? []
    if (vista === 'mie') return r.filter((x) => x.collaboratore_id === profilo?.id)
    if (vista === 'da_approvare') return r.filter((x) => x.stato === 'richiesto' && (isAdmin || x.collaboratore_id !== profilo?.id))
    if (vista === 'da_pagare') return r.filter((x) => x.stato === 'approvato')
    return r.filter((x) => x.stato === 'rimborsato' || x.stato === 'rifiutato')
  }, [dati, vista, profilo?.id, isAdmin])

  const nomeEvento = (id: string | null) => dati?.eventi.find((e) => e.id === id)?.nome

  async function cambiaStato(r: Rimborso, stato: StatoRimborso, motivo?: string) {
    setErrore('')
    if (stato === 'rimborsato' && !confirm(`Confermi di aver pagato ${formatEuro(r.importo)}? Verrà registrato nel registro pagamenti.`)) return
    const { error } = await supabase.from('rimborsi').update({ stato, motivo_rifiuto: motivo?.trim() || null }).eq('id', r.id)
    if (error) setErrore(messaggioErrore(error))
    setRifiuto(null)
    await ricarica()
  }

  async function elimina(r: Rimborso) {
    if (!confirm('Eliminare la richiesta?')) return
    const { error } = await supabase.from('rimborsi').delete().eq('id', r.id)
    if (error) return setErrore(messaggioErrore(error))
    if (r.ricevuta_path) await eliminaFile('ricevute', r.ricevuta_path)
    await ricarica()
  }

  const schede: { id: Vista; etichetta: string }[] = isStaff
    ? [
        { id: 'da_approvare', etichetta: 'Da approvare' },
        { id: 'da_pagare', etichetta: 'Da pagare' },
        { id: 'storico', etichetta: 'Storico' },
        { id: 'mie', etichetta: 'Le mie' },
      ]
    : []

  return (
    <>
      <Intestazione titolo="Trasferte e rimborsi" sottotitolo={isStaff ? 'Approva le richieste e registra i pagamenti' : 'Gli importi approvati si sommano al tuo saldo'} />

      {schede.length > 0 && (
        <div className="-mx-4 mb-4 overflow-x-auto px-4">
          <div className="flex w-max gap-2" role="tablist">
            {schede.map((s) => {
              const n = s.id === 'da_approvare' ? dati?.rimborsi.filter((x) => x.stato === 'richiesto' && (isAdmin || x.collaboratore_id !== profilo?.id)).length : s.id === 'da_pagare' ? dati?.rimborsi.filter((x) => x.stato === 'approvato').length : 0
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={vista === s.id}
                  onClick={() => setVista(s.id)}
                  className={`min-h-10 rounded-full px-4 text-sm font-medium whitespace-nowrap ring-1 ${vista === s.id ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
                >
                  {s.etichetta}{n ? ` (${n})` : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {vista === 'mie' &&
        (nuova ? (
          <ModuloRimborso
            eventi={dati?.eventi ?? []}
            onChiudi={() => setNuova(false)}
            onSalvato={async () => {
              setNuova(false)
              await ricarica()
            }}
          />
        ) : (
          <Bottone className="mb-4 w-full sm:w-auto" onClick={() => setNuova(true)}>+ Nuova richiesta</Bottone>
        ))}

      {(errore || erroreCaricamento) && <div className="mb-3"><Avviso>{errore || erroreCaricamento}</Avviso></div>}

      {caricamento || !dati ? (
        <Caricamento />
      ) : elenco.length === 0 ? (
        <Vuoto titolo={vista === 'mie' ? 'Nessuna richiesta di rimborso' : vista === 'da_approvare' ? 'Nessuna richiesta da approvare' : vista === 'da_pagare' ? 'Nessun rimborso da pagare' : 'Nessun rimborso nello storico'} />
      ) : (
        <ul className="space-y-3">
          {elenco.map((r) => {
            const mio = r.collaboratore_id === profilo?.id
            const puoGestire = isStaff && (isAdmin || !mio)
            return (
              <li key={r.id}>
                <Scheda>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {!mio && <p className="text-sm text-slate-500">{nomeCompleto(dati.profili.get(r.collaboratore_id))}</p>}
                      <p className="font-medium">
                        {ETICHETTA_RIMBORSO[r.tipo]} · <span className="tabular-nums">{formatEuro(r.importo)}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatData(r.data_spesa)}
                        {nomeEvento(r.evento_id) && ` · ${nomeEvento(r.evento_id)}`}
                      </p>
                      {r.descrizione && <p className="mt-1 text-sm">{r.descrizione}</p>}
                      {r.stato === 'rifiutato' && r.motivo_rifiuto && <p className="mt-1 text-sm text-red-700">Motivo: {r.motivo_rifiuto}</p>}
                    </div>
                    <BadgeRimborso stato={r.stato} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.ricevuta_path && (
                      <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => apriFile('ricevute', r.ricevuta_path!).catch((e) => setErrore(messaggioErrore(e)))}>
                        Ricevuta
                      </Bottone>
                    )}
                    {puoGestire && (r.stato === 'richiesto' || r.stato === 'rifiutato') && rifiuto?.id !== r.id && (
                      <Bottone className="min-h-10 text-sm" onClick={() => void cambiaStato(r, 'approvato')}>Approva</Bottone>
                    )}
                    {puoGestire && (r.stato === 'richiesto' || r.stato === 'approvato') && rifiuto?.id !== r.id && (
                      <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => setRifiuto({ id: r.id, motivo: '' })}>Rifiuta</Bottone>
                    )}
                    {puoGestire && r.stato === 'approvato' && (
                      <Bottone className="min-h-10 text-sm" onClick={() => void cambiaStato(r, 'rimborsato')}>Segna come pagato</Bottone>
                    )}
                    {mio && (r.stato === 'richiesto' || r.stato === 'rifiutato') && (
                      <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => void elimina(r)}>Elimina</Bottone>
                    )}
                  </div>
                  {rifiuto?.id === r.id && (
                    <div className="mt-3 space-y-3">
                      <AreaTesto placeholder="Motivo del rifiuto" value={rifiuto.motivo} onChange={(e) => setRifiuto({ id: r.id, motivo: e.target.value })} rows={2} />
                      <div className="flex gap-2">
                        <Bottone variante="pericolo" className="min-h-10 text-sm" onClick={() => void cambiaStato(r, 'rifiutato', rifiuto.motivo)}>Conferma rifiuto</Bottone>
                        <Bottone variante="fantasma" className="min-h-10 text-sm" onClick={() => setRifiuto(null)}>Annulla</Bottone>
                      </div>
                    </div>
                  )}
                </Scheda>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function ModuloRimborso({ eventi, onChiudi, onSalvato }: { eventi: Pick<Evento, 'id' | 'nome' | 'data'>[]; onChiudi: () => void; onSalvato: () => Promise<void> }) {
  const { profilo } = useAuth()
  const [tipo, setTipo] = useState<TipoRimborso>('viaggio')
  const [data, setData] = useState(oggiIso())
  const [importo, setImporto] = useState('')
  const [eventoId, setEventoId] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [ricevuta, setRicevuta] = useState<File | null>(null)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function salva(e: FormEvent) {
    e.preventDefault()
    const valore = Number(importo.replace(',', '.'))
    if (!(valore > 0)) return setErrore('Inserisci un importo valido')
    if (!ricevuta) return setErrore('Allega la foto dello scontrino o della ricevuta')
    setErrore('')
    setInvio(true)
    let percorso: string | null = null
    try {
      percorso = await caricaFile('ricevute', profilo!.id, ricevuta)
      const { error } = await supabase.from('rimborsi').insert({
        collaboratore_id: profilo!.id,
        tipo,
        data_spesa: data,
        importo: Math.round(valore * 100) / 100,
        evento_id: eventoId || null,
        descrizione: descrizione.trim() || null,
        ricevuta_path: percorso,
      })
      if (error) throw error
      await onSalvato()
    } catch (err) {
      if (percorso) await eliminaFile('ricevute', percorso)
      setErrore(messaggioErrore(err))
    } finally {
      setInvio(false)
    }
  }

  return (
    <Scheda className="mb-4">
      <form onSubmit={salva} className="space-y-4">
        <h2 className="font-semibold">Nuova richiesta di rimborso</h2>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRimborso)}>
              {Object.entries(ETICHETTA_RIMBORSO).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Campo>
          <Campo etichetta="Importo €">
            <Input inputMode="decimal" required value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="0,00" />
          </Campo>
        </div>
        <Campo etichetta="Data della spesa">
          <Input type="date" required max={oggiIso()} value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo etichetta="Evento collegato">
          <Select value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
            <option value="">Nessuno</option>
            {eventi.map((ev) => (
              <option key={ev.id} value={ev.id}>{formatData(ev.data)} · {ev.nome}</option>
            ))}
          </Select>
        </Campo>
        <Campo etichetta="Descrizione">
          <AreaTesto rows={2} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="es. treno Milano–Bergamo andata e ritorno" />
        </Campo>
        <Campo etichetta="Scontrino o ricevuta" aiuto="Foto o PDF, massimo 10 MB">
          <input
            type="file"
            accept={TIPI_FILE_ACCETTATI}
            required
            onChange={(e) => setRicevuta(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:text-sm file:font-medium"
          />
        </Campo>
        {errore && <Avviso>{errore}</Avviso>}
        <div className="flex gap-2">
          <Bottone type="submit" caricamento={invio}>Invia richiesta</Bottone>
          <Bottone type="button" variante="fantasma" onClick={onChiudi}>Annulla</Bottone>
        </div>
      </form>
    </Scheda>
  )
}
