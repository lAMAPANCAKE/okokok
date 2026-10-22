import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Dettatura } from '../../components/Dettatura'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select } from '../../components/ui'
import { eseguiOAccoda, erroreDiRete, scartaOperazione, useCoda, type Operazione } from '../../lib/coda'
import { linkFirmati } from '../../lib/file'
import { comprimiImmagine } from '../../lib/immagini'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { FileSopralluogo, Sopralluogo } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'
import { STILI, TIPI_ZONA, istruzioneRendering, tipoZona, type StileZona, type TipoZona, type ZonaSopralluogo } from '../../lib/zone'

type Modulo = Pick<ZonaSopralluogo, 'nome' | 'tipo' | 'voci' | 'stile'> & { descrizione: string; note_operative: string }
type OpFoto = Extract<Operazione, { tipo: 'foto' }>

const aggiungiTesto = (attuale: string, nuovo: string) => (attuale.trim() ? `${attuale.trimEnd()} ${nuovo}` : nuovo)

/**
 * Zona del sopralluogo: foto della location vuota, cosa allestire (voci guidate,
 * stile, descrizione dettata), note operative e rendering ottenuti con ChatGPT.
 */
export default function ZonaDettaglio() {
  const { id, zonaId } = useParams() as { id: string; zonaId: string }
  const navigate = useNavigate()
  const coda = useCoda()
  const [form, setForm] = useState<Modulo | null>(null)
  const [modificato, setModificato] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const [caricamentoFoto, setCaricamentoFoto] = useState(false)
  const [messaggio, setMessaggio] = useState<{ tipo: 'errore' | 'successo' | 'info'; testo: string } | null>(null)
  const [nuovaVoce, setNuovaVoce] = useState('')
  const [generazione, setGenerazione] = useState<FileSopralluogo | null>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    try {
      const [s, z, f] = await Promise.all([
        supabase.from('sopralluoghi').select('id, titolo').eq('id', id).single(),
        supabase.from('sopralluogo_zone').select('*').eq('id', zonaId).maybeSingle(),
        supabase.from('sopralluogo_file').select('*').eq('zona_id', zonaId).order('created_at'),
      ])
      const file = oppureErrore(f) as FileSopralluogo[]
      return {
        sopralluogo: oppureErrore(s) as Pick<Sopralluogo, 'id' | 'titolo'>,
        zona: oppureErrore(z) as ZonaSopralluogo | null,
        file,
        url: await linkFirmati('sopralluoghi', file.map((x) => x.file_path)),
        offline: false,
      }
    } catch (e) {
      // Senza rete si lavora sulla copia salvata sul telefono
      if (!erroreDiRete(e)) throw e
      return { sopralluogo: null, zona: null, file: [] as FileSopralluogo[], url: new Map<string, string>(), offline: true }
    }
  }, [id, zonaId])

  // La zona può esistere solo in coda (creata senza rete)
  const zonaInCoda = coda.find((o) => o.tipo === 'zona' && o.riga.id === zonaId) as Extract<Operazione, { tipo: 'zona' }> | undefined
  const zona = dati?.zona ?? (zonaInCoda ? ({ ...zonaInCoda.riga, ordine: 0, created_at: '' } as ZonaSopralluogo) : null)

  useEffect(() => {
    if (!zona || (form && modificato)) return
    setForm({ nome: zona.nome, tipo: zona.tipo, voci: zona.voci ?? [], stile: zona.stile ?? {}, descrizione: zona.descrizione ?? '', note_operative: zona.note_operative ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona?.id, dati])

  // Foto in attesa di invio per questa zona, con anteprima locale
  const fotoInCoda = useMemo(() => coda.filter((o): o is OpFoto => o.tipo === 'foto' && o.riga.zona_id === zonaId), [coda, zonaId])
  const anteprimeCoda = useMemo(() => new Map(fotoInCoda.map((o) => [o.id, URL.createObjectURL(o.blob)])), [fotoInCoda])
  useEffect(() => () => anteprimeCoda.forEach((u) => URL.revokeObjectURL(u)), [anteprimeCoda])

  if (caricamento && !dati) return <Caricamento />
  if (!dati) return <Avviso>{errore || 'Zona non trovata'}</Avviso>
  if (!zona || !form) return <Avviso>{dati.offline ? 'Sei senza rete e questa zona non è salvata sul telefono.' : 'Zona non trovata'}</Avviso>

  const originali = dati.file.filter((f) => f.tipo === 'foto')
  const rendering = dati.file.filter((f) => f.tipo === 'rendering')
  const info = tipoZona(form.tipo)
  const tutteLeVoci = [...info.voci, ...form.voci.filter((v) => !info.voci.includes(v))]

  const imposta = (campi: Partial<Modulo>) => {
    setForm((f) => (f ? { ...f, ...campi } : f))
    setModificato(true)
  }
  const impostaStile = (campi: Partial<StileZona>) => imposta({ stile: { ...form.stile, ...campi } })

  async function salva() {
    if (!form) return
    setSalvataggio(true)
    setMessaggio(null)
    try {
      const inviato = await eseguiOAccoda({
        id: `zona-${zonaId}`,
        tipo: 'zona',
        riga: {
          id: zonaId, sopralluogo_id: id, nome: form.nome.trim() || info.nome, tipo: form.tipo, voci: form.voci, stile: form.stile,
          descrizione: form.descrizione.trim() || null, note_operative: form.note_operative.trim() || null,
        },
      })
      setModificato(false)
      setMessaggio(inviato ? { tipo: 'successo', testo: 'Zona salvata.' } : { tipo: 'info', testo: 'Salvata sul telefono: verrà inviata appena torna la rete.' })
      if (inviato) await ricarica()
    } catch (e) {
      setMessaggio({ tipo: 'errore', testo: messaggioErrore(e) })
    } finally {
      setSalvataggio(false)
    }
  }

  /** Carica foto (originali o rendering), compresse, in diretta o in coda se manca la rete. */
  async function caricaFoto(files: FileList | File[] | null, ruolo: { tipo: 'foto' | 'rendering'; origine?: FileSopralluogo }) {
    if (!files?.length) return
    setCaricamentoFoto(true)
    setMessaggio(null)
    let inCoda = 0
    try {
      // Il primo rendering di una foto diventa quello da mostrare al cliente
      const primo = ruolo.tipo === 'rendering' && !rendering.some((r) => r.origine_id === ruolo.origine?.id && r.scelto)
      for (const [i, f] of Array.from(files).entries()) {
        const compressa = await comprimiImmagine(f, f.name || 'foto.jpg')
        const idFoto = crypto.randomUUID()
        const inviato = await eseguiOAccoda({
          id: idFoto,
          tipo: 'foto',
          riga: {
            id: idFoto, sopralluogo_id: id, zona_id: zonaId, origine_id: ruolo.origine?.id ?? null, tipo: ruolo.tipo,
            didascalia: ruolo.tipo === 'rendering' ? `Rendering · ${form?.nome ?? ''}` : null, scelto: primo && i === 0,
          },
          blob: compressa,
          nome: compressa.name,
        })
        if (!inviato) inCoda++
      }
      if (inCoda) setMessaggio({ tipo: 'info', testo: `${inCoda} foto salvate sul telefono: verranno inviate appena torna la rete.` })
      await ricarica()
    } catch (e) {
      setMessaggio({ tipo: 'errore', testo: messaggioErrore(e) })
    } finally {
      setCaricamentoFoto(false)
      if (inputFoto.current) inputFoto.current.value = ''
    }
  }

  async function eliminaFoto(f: FileSopralluogo) {
    const collegati = rendering.filter((r) => r.origine_id === f.id).length
    if (!confirm(f.tipo === 'rendering' ? 'Eliminare questo rendering?' : `Eliminare la foto${collegati ? ` (i suoi ${collegati} rendering restano)` : ''}?`)) return
    const { error } = await supabase.from('sopralluogo_file').delete().eq('id', f.id)
    if (error) return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    await supabase.storage.from('sopralluoghi').remove([f.file_path])
    await ricarica()
  }

  async function scegliPerCliente(r: FileSopralluogo) {
    // Un solo rendering scelto per ogni foto originale
    const altri = rendering.filter((x) => x.origine_id === r.origine_id && x.id !== r.id && x.scelto).map((x) => x.id)
    if (altri.length) await supabase.from('sopralluogo_file').update({ scelto: false }).in('id', altri)
    const { error } = await supabase.from('sopralluogo_file').update({ scelto: !r.scelto }).eq('id', r.id)
    if (error) return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    await ricarica()
  }

  async function eliminaZona() {
    if (!confirm(`Eliminare la zona “${form?.nome}” con le sue foto e i rendering?`)) return
    const percorsi = dati!.file.map((f) => f.file_path)
    const { error } = await supabase.from('sopralluogo_zone').delete().eq('id', zonaId)
    if (error) return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    if (percorsi.length) await supabase.storage.from('sopralluoghi').remove(percorsi)
    if (zonaInCoda) await scartaOperazione(zonaInCoda.id)
    navigate(`/sopralluoghi/${id}`, { replace: true })
  }

  const istruzione = istruzioneRendering({ ...form, nome: form.nome || info.nome })

  return (
    <>
      <Intestazione titolo={`${info.icona} ${form.nome || info.nome}`} sottotitolo={dati.sopralluogo?.titolo ?? 'Zona del sopralluogo'} indietro={`/sopralluoghi/${id}`} />
      {dati.offline && <div className="mb-3"><Avviso tipo="info">Sei senza rete: foto e modifiche si salvano sul telefono e partono appena torna il segnale.</Avviso></div>}
      {messaggio && <div className="mb-3" onClick={() => setMessaggio(null)}><Avviso tipo={messaggio.tipo}>{messaggio.testo}</Avviso></div>}

      <Scheda className="mb-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etichetta="Nome della zona">
            <Input value={form.nome} onChange={(e) => imposta({ nome: e.target.value })} placeholder={info.nome} />
          </Campo>
          <Campo etichetta="Tipo">
            <Select value={form.tipo} onChange={(e) => imposta({ tipo: e.target.value as TipoZona })}>
              {TIPI_ZONA.map((t) => <option key={t.tipo} value={t.tipo}>{t.icona} {t.nome}</option>)}
            </Select>
          </Campo>
        </div>
      </Scheda>

      {/* Foto della location vuota */}
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Foto della location ({originali.length + fotoInCoda.filter((o) => o.riga.tipo === 'foto').length})</h2>
          <Bottone variante="secondario" className="min-h-10 text-sm" caricamento={caricamentoFoto} onClick={() => inputFoto.current?.click()}>📷 Scatta o carica</Bottone>
          <input ref={inputFoto} type="file" accept="image/*" multiple hidden onChange={(e) => void caricaFoto(e.target.files, { tipo: 'foto' })} />
        </div>
        {originali.length === 0 && fotoInCoda.length === 0 ? (
          <p className="text-sm text-slate-500">Fotografa la zona com’è adesso, anche vuota: inquadra tutta l’area da allestire, in orizzontale, dall’altezza degli occhi.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {originali.map((f) => {
              const suoi = rendering.filter((r) => r.origine_id === f.id)
              return (
                <li key={f.id}>
                  <Scheda className="space-y-2 p-2">
                    <a href={dati.url.get(f.file_path)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-slate-100">
                      <img src={dati.url.get(f.file_path)} alt="Foto della zona" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                    </a>
                    <div className="flex flex-wrap items-center gap-2">
                      <Bottone className="min-h-10 flex-1 text-sm" onClick={() => setGenerazione(f)}>✨ Genera con ChatGPT</Bottone>
                      <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => void eliminaFoto(f)} aria-label="Elimina foto">Elimina</Bottone>
                    </div>
                    {suoi.length > 0 && <p className="text-xs text-slate-500">{suoi.length} rendering · vedi sotto</p>}
                  </Scheda>
                </li>
              )
            })}
            {fotoInCoda.map((o) => (
              <li key={o.id}>
                <Scheda className="space-y-2 p-2">
                  <img src={anteprimeCoda.get(o.id)} alt="" className="aspect-[4/3] w-full rounded-xl object-cover opacity-70" />
                  <p className={`text-xs ${o.errore ? 'text-red-700' : 'text-amber-700'}`}>
                    {o.riga.tipo === 'rendering' ? 'Rendering' : 'Foto'} {o.errore ? `non inviata: ${o.errore}` : 'in attesa di rete…'}
                  </p>
                  {o.errore && <button className="text-xs text-red-700 underline" onClick={() => void scartaOperazione(o.id)}>Scarta</button>}
                </Scheda>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cosa allestire */}
      <Scheda className="mb-4 space-y-4">
        <h2 className="text-lg font-semibold">Cosa allestire</h2>
        {tutteLeVoci.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tutteLeVoci.map((v) => {
              const attiva = form.voci.includes(v)
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={attiva}
                  onClick={() => imposta({ voci: attiva ? form.voci.filter((x) => x !== v) : [...form.voci, v] })}
                  className={`min-h-10 rounded-full px-3 text-sm ring-1 ${attiva ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
                >
                  {attiva ? '✓ ' : ''}{v}
                </button>
              )
            })}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = nuovaVoce.trim()
            if (v && !form.voci.includes(v)) imposta({ voci: [...form.voci, v] })
            setNuovaVoce('')
          }}
        >
          <Input className="min-h-10" value={nuovaVoce} onChange={(e) => setNuovaVoce(e.target.value)} placeholder="Aggiungi una voce (es. 2 banconi da 3 m)" />
          <Bottone type="submit" variante="secondario" className="min-h-10 text-sm" disabled={!nuovaVoce.trim()}>Aggiungi</Bottone>
        </form>

        <div>
          <Campo etichetta="Descrizione" aiuto="Detta o scrivi cosa vuoi vedere in foto: posizioni, quantità, materiali.">
            <AreaTesto rows={4} value={form.descrizione} onChange={(e) => imposta({ descrizione: e.target.value })} placeholder="es. bancone lungo la parete di destra, retrobanco illuminato, due frigo a vetro ai lati" />
          </Campo>
          <Dettatura className="mt-2" onTesto={(t) => imposta({ descrizione: aggiungiTesto(form.descrizione, t) })} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo etichetta="Stile">
            <Select value={form.stile.stile ?? ''} onChange={(e) => impostaStile({ stile: e.target.value || undefined })}>
              <option value="">Non indicato</option>
              {STILI.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Campo>
          <Campo etichetta="Momento">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Momento">
              {(['giorno', 'sera'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={form.stile.momento === m}
                  onClick={() => impostaStile({ momento: form.stile.momento === m ? undefined : m })}
                  className={`min-h-12 rounded-xl text-sm font-medium ring-1 ${form.stile.momento === m ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
                >
                  {m === 'giorno' ? '☀️ Giorno' : '🌙 Sera'}
                </button>
              ))}
            </div>
          </Campo>
          <Campo etichetta="Colori e materiali">
            <Input value={form.stile.colori ?? ''} onChange={(e) => impostaStile({ colori: e.target.value })} placeholder="es. bianco e oro, legno" />
          </Campo>
        </div>
      </Scheda>

      <Scheda className="mb-4">
        <Campo etichetta="Note operative (interne, non vanno al cliente)" aiuto="Prese elettriche, acqua, scarichi, misure, accessi, orari.">
          <AreaTesto rows={3} value={form.note_operative} onChange={(e) => imposta({ note_operative: e.target.value })} />
        </Campo>
        <Dettatura className="mt-2" onTesto={(t) => imposta({ note_operative: aggiungiTesto(form.note_operative, t) })} />
      </Scheda>

      {/* Rendering */}
      <section className="mb-4">
        <h2 className="mb-2 text-lg font-semibold">Rendering ({rendering.length})</h2>
        {rendering.length === 0 ? (
          <p className="text-sm text-slate-500">Tocca “✨ Genera con ChatGPT” su una foto: l’istruzione è già pronta. Poi carica qui l’immagine creata da ChatGPT.</p>
        ) : (
          <div className="space-y-4">
            {[...originali, null].map((o) => {
              const suoi = rendering.filter((r) => (o ? r.origine_id === o.id : !originali.some((x) => x.id === r.origine_id)))
              if (!suoi.length) return null
              return <GruppoRendering key={o?.id ?? 'altri'} originale={o} rendering={suoi} url={dati.url} onScegli={(r) => void scegliPerCliente(r)} onElimina={(r) => void eliminaFoto(r)} />
            })}
          </div>
        )}
      </section>

      <Bottone variante="fantasma" className="mb-4 min-h-10 text-sm text-red-700" onClick={() => void eliminaZona()}>Elimina zona</Bottone>

      {generazione && (
        <FinestraChatGpt
          foto={generazione}
          url={dati.url.get(generazione.file_path)}
          istruzioneIniziale={istruzione}
          caricamento={caricamentoFoto}
          onCarica={async (files) => {
            await caricaFoto(files, { tipo: 'rendering', origine: generazione })
            setGenerazione(null)
          }}
          onChiudi={() => setGenerazione(null)}
        />
      )}

      {modificato && (
        <div className="pb-safe sticky bottom-20 z-10 md:bottom-4">
          <Bottone className="w-full shadow-lg" caricamento={salvataggio} onClick={() => void salva()}>Salva zona</Bottone>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Passaggio a ChatGPT: condivide foto e istruzione, poi si carica il risultato
// ---------------------------------------------------------------------------
function FinestraChatGpt({ foto, url, istruzioneIniziale, caricamento, onCarica, onChiudi }: {
  foto: FileSopralluogo
  url: string | undefined
  istruzioneIniziale: string
  caricamento: boolean
  onCarica: (files: FileList) => Promise<void>
  onChiudi: () => void
}) {
  const [istruzione, setIstruzione] = useState(istruzioneIniziale)
  const [file, setFile] = useState<File | null>(null)
  const [stato, setStato] = useState('')
  const [manuale, setManuale] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // La foto si prepara subito: la condivisione deve partire dal tocco, senza attese
  useEffect(() => {
    if (!url) return
    let annullato = false
    void fetch(url)
      .then((r) => r.blob())
      .then((b) => !annullato && setFile(new File([b], 'location.jpg', { type: b.type || 'image/jpeg' })))
      .catch(() => !annullato && setManuale(true))
    return () => {
      annullato = true
    }
  }, [url])

  const urlLocale = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (urlLocale) URL.revokeObjectURL(urlLocale) }, [urlLocale])

  async function copia() {
    try {
      await navigator.clipboard.writeText(istruzione)
      setStato('Istruzione copiata: incollala in ChatGPT insieme alla foto.')
    } catch {
      setStato('Copia non riuscita: seleziona il testo e copialo a mano.')
    }
  }

  async function condividi() {
    await copia()
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: istruzione })
        setStato('Scegli ChatGPT dall’elenco. Se il testo non compare, incollalo: è già copiato.')
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    setManuale(true)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Genera con ChatGPT">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">✨ Genera con ChatGPT</h2>
          <button className="text-slate-500" onClick={onChiudi} aria-label="Chiudi">✕</button>
        </div>
        <ol className="space-y-4">
          <li>
            <p className="mb-2 text-sm font-medium">1. Controlla l’istruzione (puoi modificarla)</p>
            <AreaTesto rows={7} className="text-sm" value={istruzione} onChange={(e) => setIstruzione(e.target.value)} />
          </li>
          <li>
            <p className="mb-2 text-sm font-medium">2. Manda foto e istruzione a ChatGPT</p>
            <Bottone className="w-full" disabled={!file && !manuale} onClick={() => void condividi()}>Condividi con ChatGPT</Bottone>
            {manuale && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => void copia()}>Copia istruzione</Bottone>
                {urlLocale && <a href={urlLocale} download="location.jpg" className="inline-flex min-h-10 items-center justify-center rounded-xl text-sm font-medium ring-1 ring-slate-300">Scarica la foto</a>}
                <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-xl text-sm font-medium ring-1 ring-slate-300">Apri ChatGPT</a>
              </div>
            )}
            {stato && <p className="mt-2 text-xs text-slate-600">{stato}</p>}
          </li>
          <li>
            <p className="mb-2 text-sm font-medium">3. Salva l’immagine creata da ChatGPT e caricala qui</p>
            <Bottone variante="secondario" className="w-full" caricamento={caricamento} onClick={() => input.current?.click()}>Carica il risultato</Bottone>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.length && void onCarica(e.target.files)} />
            <p className="mt-2 text-xs text-slate-500">Per correggere qualcosa chiedilo direttamente a ChatGPT (es. “sposta il bancone a sinistra”) e carica anche la nuova versione: restano tutte salvate.</p>
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-400">Foto originale del {new Date(foto.created_at).toLocaleDateString('it-IT')}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prima/dopo con cursore e scelta del rendering per il cliente
// ---------------------------------------------------------------------------
function GruppoRendering({ originale, rendering, url, onScegli, onElimina }: {
  originale: FileSopralluogo | null
  rendering: FileSopralluogo[]
  url: Map<string, string>
  onScegli: (r: FileSopralluogo) => void
  onElimina: (r: FileSopralluogo) => void
}) {
  const [attivo, setAttivo] = useState(() => (rendering.find((r) => r.scelto) ?? rendering[rendering.length - 1]).id)
  const corrente = rendering.find((r) => r.id === attivo) ?? rendering[0]
  return (
    <Scheda className="space-y-3 p-2">
      {originale ? (
        <Confronto prima={url.get(originale.file_path)} dopo={url.get(corrente.file_path)} />
      ) : (
        <img src={url.get(corrente.file_path)} alt="Rendering" className="w-full rounded-xl" />
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rendering.map((r, i) => (
          <button key={r.id} onClick={() => setAttivo(r.id)} className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 ${r.id === corrente.id ? 'ring-slate-900' : 'ring-transparent'}`} aria-label={`Versione ${i + 1}`}>
            <img src={url.get(r.file_path)} alt="" className="h-full w-full object-cover" />
            {r.scelto && <span className="absolute top-0.5 left-0.5 rounded bg-amber-400 px-1 text-[10px] font-bold">★</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Bottone variante={corrente.scelto ? 'primario' : 'secondario'} className="min-h-10 text-sm" onClick={() => onScegli(corrente)}>
          {corrente.scelto ? '★ Scelto per il cliente' : '☆ Scegli per il cliente'}
        </Bottone>
        <a href={url.get(corrente.file_path)} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium ring-1 ring-slate-300">Apri</a>
        <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => onElimina(corrente)}>Elimina</Bottone>
      </div>
    </Scheda>
  )
}

function Confronto({ prima, dopo }: { prima?: string; dopo?: string }) {
  const [p, setP] = useState(50)
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100 select-none">
      <img src={dopo} alt="Dopo: zona allestita" className="absolute inset-0 h-full w-full object-cover" />
      <img src={prima} alt="Prima: location vuota" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - p}% 0 0)` }} />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${p}%` }}>
        <span className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs shadow">⇆</span>
      </div>
      <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Prima</span>
      <span className="absolute top-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Dopo</span>
      <input type="range" min={0} max={100} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="Confronto prima e dopo" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
    </div>
  )
}
