import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select } from '../../components/ui'
import { eseguiOAccoda, useCoda } from '../../lib/coda'
import { caricaFile, eliminaFile, linkFirmati } from '../../lib/file'
import { scaricaPdfZone } from '../../lib/pdfZone'
import { TIPI_ZONA, tipoZona, type TipoZona, type ZonaSopralluogo } from '../../lib/zone'
import { formatData, oggiIso } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { CHECKLIST_SOPRALLUOGO, type Azienda, type EsitoVoceChecklist, type Evento, type FileSopralluogo, type Sopralluogo, type VoceChecklist } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'
import { Icona } from '../../components/aree'
import { ICONA_ZONA } from '../../lib/aree'

const MAX_FILE = 15 * 1024 * 1024

const checklistIniziale = (): VoceChecklist[] => CHECKLIST_SOPRALLUOGO.map((c) => ({ chiave: c.chiave, etichetta: c.etichetta, stato: null, nota: '' }))

function useOpzioni() {
  return useDati(async () => {
    const [aziende, eventi] = await Promise.all([
      supabase.from('aziende').select('id, nome').order('nome'),
      supabase.from('eventi').select('id, nome, data, azienda_id').gte('data', oggiIso()).order('data').limit(100),
    ])
    return {
      aziende: oppureErrore(aziende) as Pick<Azienda, 'id' | 'nome'>[],
      eventi: oppureErrore(eventi) as Pick<Evento, 'id' | 'nome' | 'data' | 'azienda_id'>[],
    }
  }, [])
}

// ---------------------------------------------------------------------------
// Nuovo sopralluogo
// ---------------------------------------------------------------------------
export function NuovoSopralluogo() {
  const navigate = useNavigate()
  const [parametri] = useSearchParams()
  const { dati: opzioni } = useOpzioni()
  const [aziendaId, setAziendaId] = useState(parametri.get('azienda') ?? '')
  const [titolo, setTitolo] = useState('')
  const [data, setData] = useState(oggiIso())
  const [indirizzo, setIndirizzo] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function crea(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    const { data: creato, error } = await supabase
      .from('sopralluoghi')
      .insert({ azienda_id: aziendaId || null, titolo: titolo.trim(), data, indirizzo: indirizzo.trim() || null, checklist: checklistIniziale() })
      .select('id')
      .single()
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    navigate(`/sopralluoghi/${creato.id}`, { replace: true })
  }

  return (
    <>
      <Intestazione titolo="Nuovo sopralluogo" indietro={aziendaId ? `/crm/${aziendaId}` : '/sopralluoghi'} />
      <form onSubmit={crea} className="space-y-4">
        <Campo etichetta="Location">
          <Input required value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="es. Villa Reale – sala degli specchi" />
        </Campo>
        <Campo etichetta="Cliente">
          <Select value={aziendaId} onChange={(e) => setAziendaId(e.target.value)}>
            <option value="">Nessuno / da definire</option>
            {opzioni?.aziende.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etichetta="Data">
            <Input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo etichetta="Indirizzo">
            <Input value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} />
          </Campo>
        </div>
        {errore && <Avviso>{errore}</Avviso>}
        <Bottone type="submit" caricamento={invio}>Inizia sopralluogo</Bottone>
      </form>
    </>
  )
}

// ---------------------------------------------------------------------------
// Scheda del sopralluogo: checklist, misure, foto e planimetria
// ---------------------------------------------------------------------------
export default function SopralluogoDettaglio() {
  const { id } = useParams() as { id: string }
  const navigate = useNavigate()
  const { dati: opzioni } = useOpzioni()
  const [form, setForm] = useState({ titolo: '', data: '', azienda_id: '', evento_id: '', indirizzo: '', referente_luogo: '', misure: '', note: '' })
  const [checklist, setChecklist] = useState<VoceChecklist[]>([])
  const [modificato, setModificato] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState('')
  const [caricamentoFile, setCaricamentoFile] = useState(false)
  const [anteprime, setAnteprime] = useState<Map<string, string>>(new Map())
  const [aperta, setAperta] = useState<string | null>(null)
  const inputFoto = useRef<HTMLInputElement>(null)
  const inputPlanimetria = useRef<HTMLInputElement>(null)
  const [sceltaZona, setSceltaZona] = useState(false)
  const [creazioneZona, setCreazioneZona] = useState(false)
  const [pdfZone, setPdfZone] = useState(false)
  const coda = useCoda()

  const { dati, errore: erroreCaricamento, caricamento, ricarica } = useDati(async () => {
    const [s, file, zone] = await Promise.all([
      supabase.from('sopralluoghi').select('*').eq('id', id).single(),
      supabase.from('sopralluogo_file').select('*').eq('sopralluogo_id', id).order('created_at'),
      supabase.from('sopralluogo_zone').select('*').eq('sopralluogo_id', id).order('ordine').order('created_at'),
    ])
    return { s: oppureErrore(s) as Sopralluogo, file: oppureErrore(file) as FileSopralluogo[], zone: oppureErrore(zone) as ZonaSopralluogo[] }
  }, [id])

  useEffect(() => {
    if (!dati) return
    const s = dati.s
    setForm({
      titolo: s.titolo, data: s.data, azienda_id: s.azienda_id ?? '', evento_id: s.evento_id ?? '', indirizzo: s.indirizzo ?? '',
      referente_luogo: s.referente_luogo ?? '', misure: s.misure ?? '', note: s.note ?? '',
    })
    // Completa la checklist con eventuali voci standard aggiunte dopo la creazione
    const esistenti = new Map(s.checklist.map((c) => [c.chiave, c]))
    setChecklist([...checklistIniziale().map((c) => esistenti.get(c.chiave) ?? c), ...s.checklist.filter((c) => !CHECKLIST_SOPRALLUOGO.some((x) => x.chiave === c.chiave))])
    setModificato(false)
    void linkFirmati('sopralluoghi', dati.file.map((f) => f.file_path)).then(setAnteprime)
  }, [dati])

  if (caricamento) return <Caricamento />
  if (!dati) return <Avviso>{erroreCaricamento || 'Sopralluogo non trovato'}</Avviso>

  const imposta = (campo: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [campo]: v }))
    setModificato(true)
  }
  const impostaVoce = (chiave: string, modifica: Partial<VoceChecklist>) => {
    setChecklist((cc) => cc.map((c) => (c.chiave === chiave ? { ...c, ...modifica } : c)))
    setModificato(true)
  }

  async function salva() {
    setErrore('')
    setSalvataggio(true)
    const { error } = await supabase
      .from('sopralluoghi')
      .update({
        titolo: form.titolo.trim(),
        data: form.data,
        azienda_id: form.azienda_id || null,
        evento_id: form.evento_id || null,
        indirizzo: form.indirizzo.trim() || null,
        referente_luogo: form.referente_luogo.trim() || null,
        misure: form.misure.trim() || null,
        note: form.note.trim() || null,
        checklist: checklist.map((c) => ({ ...c, nota: c.nota.trim() })),
      })
      .eq('id', id)
    setSalvataggio(false)
    if (error) return setErrore(messaggioErrore(error))
    await ricarica()
  }

  async function carica(files: FileList | null, tipo: 'foto' | 'planimetria') {
    if (!files?.length) return
    setErrore('')
    setCaricamentoFile(true)
    try {
      for (const file of Array.from(files)) {
        const percorso = await caricaFile('sopralluoghi', id, file, MAX_FILE)
        const { error } = await supabase.from('sopralluogo_file').insert({ sopralluogo_id: id, file_path: percorso, tipo })
        if (error) {
          await eliminaFile('sopralluoghi', percorso)
          throw error
        }
      }
      await ricarica()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setCaricamentoFile(false)
      if (inputFoto.current) inputFoto.current.value = ''
      if (inputPlanimetria.current) inputPlanimetria.current.value = ''
    }
  }

  async function rimuoviFile(f: FileSopralluogo) {
    if (!confirm('Eliminare questo file?')) return
    const { error } = await supabase.from('sopralluogo_file').delete().eq('id', f.id)
    if (error) return setErrore(messaggioErrore(error))
    await eliminaFile('sopralluoghi', f.file_path)
    setAperta(null)
    await ricarica()
  }

  async function elimina() {
    if (!confirm('Eliminare il sopralluogo con foto e checklist?')) return
    const percorsi = dati!.file.map((f) => f.file_path)
    const { error } = await supabase.from('sopralluoghi').delete().eq('id', id)
    if (error) return setErrore(messaggioErrore(error))
    if (percorsi.length) await supabase.storage.from('sopralluoghi').remove(percorsi)
    navigate(form.azienda_id ? `/crm/${form.azienda_id}` : '/sopralluoghi', { replace: true })
  }

  async function nuovaZona(tipo: TipoZona) {
    setCreazioneZona(true)
    setErrore('')
    const info = tipoZona(tipo)
    const esistenti = dati!.zone.filter((z) => z.tipo === tipo).length
    const zonaId = crypto.randomUUID()
    try {
      await eseguiOAccoda({
        id: `zona-${zonaId}`,
        tipo: 'zona',
        riga: { id: zonaId, sopralluogo_id: id, tipo, nome: esistenti ? `${info.nome} ${esistenti + 1}` : info.nome, voci: [], stile: {}, descrizione: null, note_operative: null, ordine: dati!.zone.length },
      })
      navigate(`/sopralluoghi/${id}/zone/${zonaId}`)
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setCreazioneZona(false)
    }
  }

  async function scaricaProposta() {
    setPdfZone(true)
    try {
      const daStampare = zoneConRendering.map((z) => ({
        zona: z,
        coppie: z.scelti.map((r) => ({ prima: (r.origine_id && anteprime.get(fotoZone.find((f) => f.id === r.origine_id)?.file_path ?? '')) || null, dopo: anteprime.get(r.file_path)! })).filter((c) => c.dopo),
      }))
      await scaricaPdfZone({ titolo: form.titolo, data: form.data, indirizzo: form.indirizzo || null }, daStampare)
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setPdfZone(false)
    }
  }

  // Zone: rendering scelti per il cliente (o, se nessuno è scelto, l'ultimo di ogni foto)
  const fotoZone = dati.file.filter((f) => f.zona_id)
  const zoneInCoda = coda.filter((o) => o.tipo === 'zona' && o.riga.sopralluogo_id === id && !dati.zone.some((z) => z.id === o.riga.id))
  const zoneConRendering = dati.zone.map((z) => {
    const rend = fotoZone.filter((f) => f.zona_id === z.id && f.tipo === 'rendering')
    const perOrigine = new Map<string, FileSopralluogo>()
    for (const r of rend) {
      const chiave = r.origine_id ?? r.id
      if (r.scelto || !perOrigine.get(chiave)?.scelto) perOrigine.set(chiave, r)
    }
    return { ...z, scelti: [...perOrigine.values()] }
  }).filter((z) => z.scelti.length)
  const fotoCoda = coda.filter((o) => o.tipo === 'foto' && o.riga.sopralluogo_id === id).length

  const compilate = checklist.filter((c) => c.stato).length
  const fileAperto = dati.file.find((f) => f.id === aperta)
  const fileGenerali = dati.file.filter((f) => !f.zona_id)
  const eventiCliente = (opzioni?.eventi ?? []).filter((e) => !form.azienda_id || !e.azienda_id || e.azienda_id === form.azienda_id)
  const esiti: { valore: EsitoVoceChecklist; etichetta: string; attivo: string }[] = [
    { valore: 'ok', etichetta: 'OK', attivo: 'bg-emerald-600 text-white ring-emerald-600' },
    { valore: 'problema', etichetta: 'Problema', attivo: 'bg-amber-500 text-white ring-amber-500' },
    { valore: 'na', etichetta: 'N/A', attivo: 'bg-slate-500 text-white ring-slate-500' },
  ]

  return (
    <>
      <Intestazione
        titolo={dati.s.titolo}
        sottotitolo={`Sopralluogo del ${formatData(dati.s.data, { day: 'numeric', month: 'long', year: 'numeric' })}`}
        indietro={dati.s.azienda_id ? `/crm/${dati.s.azienda_id}` : '/sopralluoghi'}
      />
      {errore && <div className="mb-3"><Avviso>{errore}</Avviso></div>}

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          to={`/preventivi/nuovo?sopralluogo=${id}${form.azienda_id ? `&azienda=${form.azienda_id}` : ''}`}
          className={`inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white ${modificato ? 'pointer-events-none opacity-50' : ''}`}
        >
          Crea preventivo
        </Link>
        <Link
          to={`/sopralluoghi/${id}/allestimento`}
          className={`inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ring-1 ring-slate-300 ${modificato ? 'pointer-events-none opacity-50' : ''}`}
        >
          Allestimento 3D
        </Link>
        {form.indirizzo && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(form.indirizzo)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ring-1 ring-slate-300">
            Mappa
          </a>
        )}
        <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => void elimina()}>Elimina</Bottone>
      </div>

      <Scheda className="mb-4 space-y-4">
        <Campo etichetta="Location">
          <Input value={form.titolo} onChange={(e) => imposta('titolo')(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etichetta="Cliente">
            <Select value={form.azienda_id} onChange={(e) => imposta('azienda_id')(e.target.value)}>
              <option value="">Nessuno / da definire</option>
              {opzioni?.aziende.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Campo>
          <Campo etichetta="Evento collegato">
            <Select value={form.evento_id} onChange={(e) => imposta('evento_id')(e.target.value)}>
              <option value="">Nessuno</option>
              {eventiCliente.map((e) => <option key={e.id} value={e.id}>{formatData(e.data)} · {e.nome}</option>)}
            </Select>
          </Campo>
          <Campo etichetta="Data">
            <Input type="date" value={form.data} onChange={(e) => imposta('data')(e.target.value)} />
          </Campo>
          <Campo etichetta="Referente della location">
            <Input value={form.referente_luogo} onChange={(e) => imposta('referente_luogo')(e.target.value)} placeholder="Nome e telefono" />
          </Campo>
        </div>
        <Campo etichetta="Indirizzo">
          <Input value={form.indirizzo} onChange={(e) => imposta('indirizzo')(e.target.value)} />
        </Campo>
      </Scheda>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Checklist</h2>
          <span className="text-sm text-slate-500">{compilate}/{checklist.length}</span>
        </div>
        <ul className="space-y-2">
          {checklist.map((c) => {
            const info = CHECKLIST_SOPRALLUOGO.find((x) => x.chiave === c.chiave)
            return (
              <li key={c.chiave}>
                <Scheda className={c.stato === 'problema' ? 'ring-2 ring-amber-300' : ''}>
                  <p className="font-medium">{c.etichetta}</p>
                  {info && <p className="text-xs text-slate-500">{info.aiuto}</p>}
                  <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={c.etichetta}>
                    {esiti.map((e) => (
                      <button
                        key={e.valore}
                        role="radio"
                        aria-checked={c.stato === e.valore}
                        onClick={() => impostaVoce(c.chiave, { stato: c.stato === e.valore ? null : e.valore })}
                        className={`min-h-11 rounded-xl text-sm font-medium ring-1 ${c.stato === e.valore ? e.attivo : 'bg-white text-slate-700 ring-slate-300'}`}
                      >
                        {e.etichetta}
                      </button>
                    ))}
                  </div>
                  {(c.stato === 'problema' || c.nota) && (
                    <AreaTesto rows={2} className="mt-2" placeholder={c.stato === 'problema' ? 'Cosa va gestito?' : 'Nota'} value={c.nota} onChange={(e) => impostaVoce(c.chiave, { nota: e.target.value })} />
                  )}
                  {c.stato !== 'problema' && !c.nota && (
                    <button className="mt-2 text-xs text-slate-500 hover:underline" onClick={() => impostaVoce(c.chiave, { nota: ' ' })}>+ Aggiungi nota</button>
                  )}
                </Scheda>
              </li>
            )
          })}
        </ul>
      </section>

      <Scheda className="mb-4 space-y-4">
        <Campo etichetta="Misure" aiuto="es. sala 18×12 m, altezza 4 m; ingresso di servizio 90 cm">
          <AreaTesto rows={3} value={form.misure} onChange={(e) => imposta('misure')(e.target.value)} />
        </Campo>
        <Campo etichetta="Note">
          <AreaTesto rows={3} value={form.note} onChange={(e) => imposta('note')(e.target.value)} />
        </Campo>
      </Scheda>

      <section className="mb-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Zone e rendering ({dati.zone.length})</h2>
          <div className="flex gap-2">
            {zoneConRendering.length > 0 && (
              <Bottone variante="secondario" className="min-h-10 text-sm" caricamento={pdfZone} disabled={modificato} onClick={() => void scaricaProposta()}>PDF per il cliente</Bottone>
            )}
            <Bottone className="min-h-10 text-sm" disabled={modificato} onClick={() => setSceltaZona((v) => !v)}>+ Zona</Bottone>
          </div>
        </div>
        {modificato && <p className="mb-2 text-xs text-slate-500">Salva il sopralluogo per aggiungere o aprire le zone.</p>}
        {sceltaZona && (
          <Scheda className="mb-3">
            <p className="mb-2 text-sm font-medium">Che zona vuoi aggiungere?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIPI_ZONA.map((t) => (
                <button key={t.tipo} disabled={creazioneZona} onClick={() => void nuovaZona(t.tipo)} className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-left text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
                  <Icona nome={ICONA_ZONA[t.tipo] ?? 'pin'} className="h-5 w-5 shrink-0 text-slate-600" />{t.nome}
                </button>
              ))}
            </div>
          </Scheda>
        )}
        {fotoCoda > 0 && <p className="mb-2 text-xs text-amber-700">{fotoCoda} foto salvate sul telefono, in attesa di rete.</p>}
        {dati.zone.length === 0 && zoneInCoda.length === 0 ? (
          <p className="text-sm text-slate-500">
            Dividi la location in zone (bar, sala, cucina, back…): per ognuna scatti la foto com’è adesso, detti cosa va allestito e ottieni con ChatGPT la foto della zona pronta da mostrare al cliente.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {dati.zone.map((z) => {
              const suoi = fotoZone.filter((f) => f.zona_id === z.id)
              const copertina = zoneConRendering.find((x) => x.id === z.id)?.scelti[0] ?? suoi.find((f) => f.tipo === 'foto')
              const nRend = suoi.filter((f) => f.tipo === 'rendering').length
              return (
                <li key={z.id}>
                  <Link to={modificato ? '#' : `/sopralluoghi/${id}/zone/${z.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300">
                    <span className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-2xl">
                      {copertina && anteprime.get(copertina.file_path) ? <img src={anteprime.get(copertina.file_path)} alt="" className="h-full w-full object-cover" /> : tipoZona(z.tipo).icona}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{z.nome}</span>
                      <span className="block text-xs text-slate-500">
                        {suoi.length - nRend} foto · {nRend} rendering{z.voci.length ? ` · ${z.voci.length} voci` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
            {zoneInCoda.map((o) => o.tipo === 'zona' && (
              <li key={o.id}>
                <Link to={`/sopralluoghi/${id}/zone/${o.riga.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-amber-300">
                  <span className="flex h-16 w-20 items-center justify-center rounded-xl bg-amber-50 text-amber-800"><Icona nome={ICONA_ZONA[o.riga.tipo] ?? 'pin'} className="h-7 w-7" /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{o.riga.nome}</span>
                    <span className="block text-xs text-amber-700">In attesa di rete</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Altre foto e planimetria ({fileGenerali.length})</h2>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <Bottone variante="secondario" className="min-h-10 text-sm" caricamento={caricamentoFile} onClick={() => inputFoto.current?.click()}>+ Foto</Bottone>
          <Bottone variante="secondario" className="min-h-10 text-sm" disabled={caricamentoFile} onClick={() => inputPlanimetria.current?.click()}>+ Planimetria</Bottone>
          <input ref={inputFoto} type="file" accept="image/*" multiple hidden onChange={(e) => void carica(e.target.files, 'foto')} />
          <input ref={inputPlanimetria} type="file" accept="image/*,application/pdf" hidden onChange={(e) => void carica(e.target.files, 'planimetria')} />
        </div>
        {fileGenerali.length === 0 ? (
          <p className="text-sm text-slate-500">Scatta le foto direttamente dal telefono: ingressi, sale, cucina, punti critici. Una foto frontale per parete si può applicare alle pareti dell’allestimento 3D.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fileGenerali.map((f) => {
              const url = anteprime.get(f.file_path)
              const pdf = f.file_path.endsWith('.pdf')
              return (
                <li key={f.id}>
                  <button className="relative block aspect-square w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" onClick={() => setAperta(f.id)} aria-label={f.tipo === 'planimetria' ? 'Apri planimetria' : 'Apri foto'}>
                    {url && !pdf ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-slate-500">{pdf ? 'PDF' : '…'}</span>}
                    {f.tipo === 'planimetria' && <span className="absolute bottom-1 left-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">Planimetria</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {fileAperto && (
        <div className="fixed inset-0 z-30 flex flex-col bg-slate-950/95 p-4" role="dialog" aria-modal="true" aria-label="Anteprima file">
          <div className="mb-3 flex justify-between gap-2">
            <Bottone variante="pericolo" className="min-h-10 text-sm" onClick={() => void rimuoviFile(fileAperto)}>Elimina</Bottone>
            <div className="flex gap-2">
              {anteprime.get(fileAperto.file_path) && (
                <a href={anteprime.get(fileAperto.file_path)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-medium">Apri originale</a>
              )}
              <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => setAperta(null)}>Chiudi</Bottone>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {fileAperto.file_path.endsWith('.pdf') ? (
              <p className="text-white">PDF: usa “Apri originale”.</p>
            ) : (
              <img src={anteprime.get(fileAperto.file_path)} alt="" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        </div>
      )}

      {modificato && (
        <div className="pb-safe sticky bottom-20 z-10 md:bottom-4">
          <Bottone className="w-full shadow-lg" caricamento={salvataggio} onClick={() => void salva()}>Salva sopralluogo</Bottone>
        </div>
      )}
    </>
  )
}
