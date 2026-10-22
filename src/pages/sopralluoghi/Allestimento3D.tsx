import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avviso, Bottone, Caricamento, Input, Select } from '../../components/ui'
import {
  CATALOGO, PAVIMENTI, allestimentoIniziale, lunghezzaSegmento, normalizzaAllestimento, postiOggetto, postoLibero, riepilogo, sedieMaxImperiale,
  segmentiPareti, stanzaRettangolare, voceCatalogo, type Allestimento, type CategoriaArredo, type Oggetto, type Punto,
} from '../../lib/allestimento'
import { caricaFile, linkFirmati } from '../../lib/file'
import { formatData } from '../../lib/format'
import { Scena3D, type Modo, type Vista } from '../../lib/scena3d'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { FileSopralluogo, Sopralluogo } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

type Pannello = 'arredi' | 'stanza' | 'riepilogo'
const CATEGORIE: CategoriaArredo[] = ['Tavoli', 'Sedute', 'Servizio', 'Intrattenimento', 'Decoro']
const MAX_STORIA = 60

const nuovoId = () => crypto.randomUUID().slice(0, 8)
const arrotonda = (n: number) => Math.round(n * 100) / 100
const immagine = (f: FileSopralluogo) => !f.file_path.endsWith('.pdf')

/**
 * Allestimento 3D del sopralluogo: la sala si ricava dalle misure o dalla planimetria
 * (calibrata sul pavimento), le foto scattate in loco si applicano alle pareti e si
 * dispongono tavoli, sedie e arredi. Il render si scarica o si salva tra le foto.
 */
export default function Allestimento3D() {
  const { id } = useParams() as { id: string }
  const { dati, errore: erroreCaricamento, caricamento, ricarica } = useDati(async () => {
    const [s, file] = await Promise.all([
      supabase.from('sopralluoghi').select('id, titolo, data, misure, allestimento').eq('id', id).single(),
      supabase.from('sopralluogo_file').select('*').eq('sopralluogo_id', id).order('created_at'),
    ])
    const sopralluogo = oppureErrore(s) as Pick<Sopralluogo, 'id' | 'titolo' | 'data' | 'misure'> & { allestimento: Partial<Allestimento> | null }
    const files = (oppureErrore(file) as FileSopralluogo[]).filter(immagine)
    return { s: sopralluogo, file: files, url: await linkFirmati('sopralluoghi', files.map((f) => f.file_path)) }
  }, [id])

  if (caricamento && !dati) return <Caricamento />
  if (!dati) return <Avviso>{erroreCaricamento || 'Sopralluogo non trovato'}</Avviso>
  return <EditorAllestimento key={dati.s.id} {...dati} ricarica={ricarica} />
}

function EditorAllestimento({ s, file, url, ricarica }: {
  s: Pick<Sopralluogo, 'id' | 'titolo' | 'data' | 'misure'> & { allestimento: Partial<Allestimento> | null }
  file: FileSopralluogo[]
  url: Map<string, string>
  ricarica: () => Promise<void>
}) {
  const [allestimento, setAllestimento] = useState<Allestimento>(() => normalizzaAllestimento(s.allestimento, s.misure))
  const [storia, setStoria] = useState<Allestimento[]>([])
  const [modificato, setModificato] = useState(false)
  const [selezionato, setSelezionato] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>('3d')
  const [modo, setModo] = useState<Modo>('sposta')
  const [aggancio, setAggancio] = useState(true)
  const [numeri, setNumeri] = useState(true)
  const [pannello, setPannello] = useState<Pannello>('arredi')
  const [pannelloAperto, setPannelloAperto] = useState(true)
  const [calibrazione, setCalibrazione] = useState<Punto[]>([])
  const [salvataggio, setSalvataggio] = useState(false)
  const [render, setRender] = useState<{ blob: Blob; url: string } | null>(null)
  const [salvataggioRender, setSalvataggioRender] = useState(false)
  const [messaggio, setMessaggio] = useState<{ tipo: 'errore' | 'successo' | 'info'; testo: string } | null>(null)
  const contenitore = useRef<HTMLDivElement>(null)
  const scena = useRef<Scena3D | null>(null)
  // I gestori della scena leggono sempre lo stato più recente
  const stato = useRef({ allestimento, modo, calibrazione, storia })
  stato.current = { allestimento, modo, calibrazione, storia }

  /** Applica una modifica registrandola nella cronologia per "Annulla". */
  const modifica = useCallback((cambia: (a: Allestimento) => Allestimento) => {
    const prima = stato.current.allestimento
    const dopo = cambia(prima)
    if (dopo === prima) return
    setStoria((h) => [...h.slice(-MAX_STORIA + 1), prima])
    setAllestimento(dopo)
    setModificato(true)
  }, [])

  const modificaOggetto = useCallback((oid: string, campi: Partial<Oggetto>) => {
    modifica((a) => ({ ...a, oggetti: a.oggetti.map((o) => (o.id === oid ? { ...o, ...campi } : o)) }))
  }, [modifica])

  const annulla = useCallback(() => {
    const h = stato.current.storia
    if (!h.length) return
    setAllestimento(h[h.length - 1])
    setStoria(h.slice(0, -1))
    setModificato(true)
  }, [])

  // Creazione della scena (una volta)
  useEffect(() => {
    const sc = new Scena3D(contenitore.current!, {
      onSeleziona: setSelezionato,
      onSposta: (oid, x, z) => {
        const o = stato.current.allestimento.oggetti.find((v) => v.id === oid)
        if (o && (o.x !== x || o.z !== z)) modificaOggetto(oid, { x, z })
      },
      onPunto: (x, z) => {
        const { modo: m, allestimento: a, calibrazione: c } = stato.current
        if (m === 'pareti') {
          const punti = a.pareti.punti
          if (a.pareti.chiusa) return
          if (punti.length > 2 && punti[0][0] === x && punti[0][1] === z) {
            modifica((v) => ({ ...v, pareti: { ...v.pareti, chiusa: true } }))
            setModo('sposta')
            setMessaggio({ tipo: 'successo', testo: 'Stanza chiusa. Ora puoi aggiungere gli arredi.' })
            return
          }
          modifica((v) => ({ ...v, pareti: { ...v.pareti, punti: [...v.pareti.punti, [x, z]] } }))
        } else if (m === 'calibra') {
          if (c.length === 0) return setCalibrazione([[x, z]])
          const misurata = Math.hypot(x - c[0][0], z - c[0][1])
          setCalibrazione([])
          setModo('sposta')
          const testo = prompt('Distanza reale tra i due punti, in metri (es. 12,5)')
          const reale = Number((testo ?? '').replace(',', '.'))
          if (!a.planimetria || !(reale > 0) || misurata < 0.05) return setMessaggio({ tipo: 'info', testo: 'Calibrazione annullata.' })
          const fattore = reale / misurata
          modifica((v) => v.planimetria ? {
            ...v,
            planimetria: {
              ...v.planimetria,
              larghezza: arrotonda(v.planimetria.larghezza * fattore),
              // La scala parte dal primo punto, che resta fermo
              x: arrotonda(c[0][0] + (v.planimetria.x - c[0][0]) * fattore),
              z: arrotonda(c[0][1] + (v.planimetria.z - c[0][1]) * fattore),
            },
          } : v)
          setMessaggio({ tipo: 'successo', testo: `Planimetria in scala: larghezza ${arrotonda(a.planimetria.larghezza * fattore)} m.` })
        }
      },
    })
    scena.current = sc
    return () => {
      sc.distruggi()
      scena.current = null
    }
  }, [modifica, modificaOggetto])

  useEffect(() => scena.current?.aggiorna(allestimento, url), [allestimento, url])
  useEffect(() => scena.current?.seleziona(selezionato), [selezionato])
  useEffect(() => scena.current?.impostaVista(vista), [vista])
  useEffect(() => scena.current?.impostaModo(modo), [modo])
  useEffect(() => scena.current?.impostaAggancio(aggancio), [aggancio])
  useEffect(() => scena.current?.impostaNumeri(numeri), [numeri])
  useEffect(() => scena.current?.marcatori(calibrazione), [calibrazione])

  // Avviso prima di chiudere la pagina con modifiche non salvate
  useEffect(() => {
    if (!modificato) return
    const avvisa = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [modificato])

  const oggetto = allestimento.oggetti.find((o) => o.id === selezionato) ?? null

  function aggiungi(tipo: Oggetto['tipo']) {
    const v = voceCatalogo(tipo)
    const [cx, cz] = scena.current?.centro() ?? [0, 0]
    const [x, z] = postoLibero(allestimento.oggetti, { tipo, lunghezza: v.lunghezza?.iniziale }, cx, cz)
    const nuovo: Oggetto = { id: nuovoId(), tipo, x, z, rot: 0 }
    if (v.sedie) nuovo.sedie = v.sedie.iniziali
    if (v.lunghezza) nuovo.lunghezza = v.lunghezza.iniziale
    modifica((a) => ({ ...a, oggetti: [...a.oggetti, nuovo] }))
    setSelezionato(nuovo.id)
    if (window.matchMedia('(max-width: 767px)').matches) setPannelloAperto(false)
  }

  function duplica() {
    if (!oggetto) return
    const [x, z] = postoLibero(allestimento.oggetti, oggetto, oggetto.x, oggetto.z)
    const copia = { ...oggetto, id: nuovoId(), x, z }
    modifica((a) => ({ ...a, oggetti: [...a.oggetti, copia] }))
    setSelezionato(copia.id)
  }

  const elimina = useCallback(() => {
    if (!selezionato) return
    modifica((a) => ({ ...a, oggetti: a.oggetti.filter((o) => o.id !== selezionato) }))
    setSelezionato(null)
  }, [modifica, selezionato])

  const ruota = useCallback((gradi: number) => {
    const o = stato.current.allestimento.oggetti.find((v) => v.id === selezionato)
    if (o) modificaOggetto(o.id, { rot: (((o.rot + gradi) % 360) + 360) % 360 })
  }, [modificaOggetto, selezionato])

  // Scorciatoie da tastiera: Canc elimina, R ruota, Ctrl+Z annulla
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        annulla()
      } else if (e.key === 'Delete' || e.key === 'Backspace') elimina()
      else if (e.key.toLowerCase() === 'r') ruota(e.shiftKey ? -15 : 15)
      else if (e.key === 'Escape') {
        setSelezionato(null)
        setModo('sposta')
        setCalibrazione([])
      }
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [annulla, elimina, ruota])

  async function salva() {
    setSalvataggio(true)
    setMessaggio(null)
    const { error } = await supabase.from('sopralluoghi').update({ allestimento }).eq('id', s.id)
    setSalvataggio(false)
    if (error) return setMessaggio({ tipo: 'errore', testo: messaggioErrore(error) })
    setModificato(false)
    setMessaggio({ tipo: 'successo', testo: 'Allestimento salvato.' })
  }

  async function scattaRender() {
    if (!scena.current) return
    setSelezionato(null)
    // Attende che la selezione sparisca dalla scena prima di scattare
    await new Promise((r) => requestAnimationFrame(r))
    const blob = await scena.current.foto()
    if (render) URL.revokeObjectURL(render.url)
    setRender({ blob, url: URL.createObjectURL(blob) })
  }

  async function salvaRender() {
    if (!render) return
    setSalvataggioRender(true)
    try {
      const nome = `render-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`
      const percorso = await caricaFile('sopralluoghi', s.id, new File([render.blob], nome, { type: 'image/png' }), 15 * 1024 * 1024)
      const { error } = await supabase.from('sopralluogo_file').insert({ sopralluogo_id: s.id, file_path: percorso, tipo: 'foto', didascalia: 'Render allestimento 3D' })
      if (error) throw error
      setMessaggio({ tipo: 'successo', testo: 'Render salvato tra le foto del sopralluogo.' })
      URL.revokeObjectURL(render.url)
      setRender(null)
      await ricarica()
    } catch (e) {
      setMessaggio({ tipo: 'errore', testo: messaggioErrore(e) })
    } finally {
      setSalvataggioRender(false)
    }
  }

  const r = useMemo(() => riepilogo(allestimento), [allestimento])
  const voce = oggetto ? voceCatalogo(oggetto.tipo) : null
  const sedieMax = oggetto && voce?.sedie ? (oggetto.tipo === 'imperiale' ? sedieMaxImperiale(oggetto.lunghezza ?? 4.8) : voce.sedie.max) : 0

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100 md:flex-row">
      <div className="relative min-h-0 flex-1">
        <div ref={contenitore} className="absolute inset-0" />

        {/* Barra superiore */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-sm ring-1 ring-slate-200 backdrop-blur">
            <Link
              to={`/sopralluoghi/${s.id}`}
              onClick={(e) => { if (modificato && !confirm('Uscire senza salvare le modifiche?')) e.preventDefault() }}
              className="text-sm text-slate-500 hover:text-slate-800"
              aria-label="Torna al sopralluogo"
            >
              ←
            </Link>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{s.titolo}</p>
              <p className="text-xs text-slate-500">Allestimento 3D · {formatData(s.data)}</p>
            </div>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <BottoneMappa onClick={annulla} disabled={!storia.length} etichetta="Annulla (Ctrl+Z)">↶</BottoneMappa>
            <Bottone className="min-h-10 px-3 text-sm shadow-sm" caricamento={salvataggio} disabled={!modificato} onClick={() => void salva()}>
              {modificato ? 'Salva' : 'Salvato'}
            </Bottone>
          </div>
        </div>

        {/* Vista e opzioni */}
        <div className="absolute top-20 left-3 flex flex-col gap-2">
          <div className="flex overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            {(['3d', 'pianta'] as Vista[]).map((v) => (
              <button key={v} onClick={() => setVista(v)} className={`min-h-10 px-3 text-sm font-medium ${vista === v ? 'bg-slate-900 text-white' : 'text-slate-700'}`}>
                {v === '3d' ? '3D' : 'Pianta'}
              </button>
            ))}
          </div>
          <BottoneMappa onClick={() => scena.current?.inquadra()} etichetta="Inquadra la sala">⤢</BottoneMappa>
          <BottoneMappa onClick={() => setAggancio((v) => !v)} attivo={aggancio} etichetta="Griglia e aggancio a 25 cm">#</BottoneMappa>
          <BottoneMappa onClick={() => setNumeri((v) => !v)} attivo={numeri} etichetta="Numeri dei tavoli">T1</BottoneMappa>
          <BottoneMappa onClick={() => void scattaRender()} etichetta="Scatta un render">📷</BottoneMappa>
        </div>

        {/* Messaggi e istruzioni */}
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center px-16">
          <div className="pointer-events-auto max-w-sm space-y-2">
            {modo === 'pareti' && (
              <Avviso tipo="info">
                Tocca il pavimento per aggiungere gli angoli della sala. Tocca il punto verde per chiuderla.{' '}
                <button className="font-semibold underline" onClick={() => setModo('sposta')}>Fine</button>
              </Avviso>
            )}
            {modo === 'calibra' && (
              <Avviso tipo="info">
                {calibrazione.length ? 'Ora tocca il secondo punto.' : 'Tocca due punti della planimetria di cui conosci la distanza (es. i due lati di una parete).'}{' '}
                <button className="font-semibold underline" onClick={() => { setModo('sposta'); setCalibrazione([]) }}>Annulla</button>
              </Avviso>
            )}
            {messaggio && (
              <div onClick={() => setMessaggio(null)}>
                <Avviso tipo={messaggio.tipo}>{messaggio.testo}</Avviso>
              </div>
            )}
          </div>
        </div>

        {/* Comandi dell'arredo selezionato */}
        {oggetto && voce && (
          <div className="absolute inset-x-3 bottom-3 mx-auto max-w-xl rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">
                {voce.nome}
                {voce.sedie && <span className="font-normal text-slate-500"> · {postiOggetto(oggetto)} posti</span>}
              </p>
              <button className="text-sm text-slate-500" onClick={() => setSelezionato(null)} aria-label="Deseleziona">✕</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BottonePiccolo onClick={() => ruota(-15)} etichetta="Ruota a sinistra">⟲ 15°</BottonePiccolo>
              <BottonePiccolo onClick={() => ruota(15)} etichetta="Ruota a destra">⟳ 15°</BottonePiccolo>
              <BottonePiccolo onClick={() => ruota(90)} etichetta="Ruota di 90°">90°</BottonePiccolo>
              {voce.sedie && (
                <Contatore
                  etichetta="Sedie"
                  valore={oggetto.sedie ?? voce.sedie.iniziali}
                  min={0}
                  max={sedieMax}
                  onChange={(n) => modificaOggetto(oggetto.id, { sedie: n })}
                />
              )}
              {voce.lunghezza && (
                <Contatore
                  etichetta="Lungh."
                  valore={oggetto.lunghezza ?? voce.lunghezza.iniziale}
                  min={voce.lunghezza.min}
                  max={voce.lunghezza.max}
                  passo={oggetto.tipo === 'imperiale' ? 0.6 : 0.5}
                  unita=" m"
                  onChange={(n) => {
                    const campi: Partial<Oggetto> = { lunghezza: arrotonda(n) }
                    // Una tavolata più lunga si riempie di sedie, una più corta le perde
                    if (oggetto.tipo === 'imperiale') campi.sedie = Math.min(sedieMaxImperiale(n), Math.max(0, (oggetto.sedie ?? 0) + Math.round((n - (oggetto.lunghezza ?? n)) / 0.6) * 2))
                    modificaOggetto(oggetto.id, campi)
                  }}
                />
              )}
              <div className="ml-auto flex gap-2">
                <BottonePiccolo onClick={duplica} etichetta="Duplica">Duplica</BottonePiccolo>
                <BottonePiccolo onClick={elimina} etichetta="Elimina" pericolo>Elimina</BottonePiccolo>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pannello laterale (in basso sul telefono) */}
      <aside className={`flex flex-col border-slate-200 bg-white md:h-full md:w-80 md:border-l ${pannelloAperto ? 'max-h-[45vh] md:max-h-none' : ''} border-t md:border-t-0`}>
        <div className="flex items-center border-b border-slate-200">
          {(['arredi', 'stanza', 'riepilogo'] as Pannello[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPannello(p); setPannelloAperto(true) }}
              className={`min-h-11 flex-1 text-sm font-medium capitalize ${pannello === p && pannelloAperto ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500'}`}
            >
              {p === 'riepilogo' ? `Riepilogo · ${r.coperti}` : p}
            </button>
          ))}
          <button className="min-h-11 px-3 text-slate-500 md:hidden" onClick={() => setPannelloAperto((v) => !v)} aria-label={pannelloAperto ? 'Chiudi pannello' : 'Apri pannello'}>
            {pannelloAperto ? '▾' : '▴'}
          </button>
        </div>
        {pannelloAperto && (
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {pannello === 'arredi' && <PannelloArredi onAggiungi={aggiungi} />}
            {pannello === 'stanza' && (
              <PannelloStanza
                allestimento={allestimento}
                file={file}
                url={url}
                misure={s.misure}
                modo={modo}
                modifica={modifica}
                onDisegna={() => {
                  modifica((a) => ({ ...a, pareti: { ...a.pareti, punti: [], chiusa: false }, foto_pareti: {} }))
                  setVista('pianta')
                  setModo('pareti')
                  setSelezionato(null)
                }}
                onContinua={() => { setVista('pianta'); setModo('pareti') }}
                onCalibra={() => { setVista('pianta'); setModo('calibra'); setCalibrazione([]); setSelezionato(null) }}
              />
            )}
            {pannello === 'riepilogo' && <PannelloRiepilogo r={r} />}
          </div>
        )}
      </aside>

      {render && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 p-4" role="dialog" aria-modal="true" aria-label="Render">
          <div className="mb-3 flex flex-wrap justify-end gap-2">
            <a href={render.url} download={`${s.titolo} - allestimento.png`} className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-medium">Scarica PNG</a>
            <Bottone variante="secondario" className="min-h-10 text-sm" caricamento={salvataggioRender} onClick={() => void salvaRender()}>Salva nel sopralluogo</Bottone>
            <Bottone variante="fantasma" className="min-h-10 text-sm text-white hover:bg-white/10" onClick={() => { URL.revokeObjectURL(render.url); setRender(null) }}>Chiudi</Bottone>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <img src={render.url} alt="Render dell'allestimento" className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pannelli
// ---------------------------------------------------------------------------
function PannelloArredi({ onAggiungi }: { onAggiungi: (tipo: Oggetto['tipo']) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Tocca un arredo per aggiungerlo al centro della vista, poi trascinalo nella sala.</p>
      {CATEGORIE.map((c) => (
        <section key={c}>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{c}</h3>
          <div className="grid grid-cols-2 gap-2">
            {CATALOGO.filter((v) => v.categoria === c).map((v) => (
              <button key={v.tipo} onClick={() => onAggiungi(v.tipo)} className="rounded-xl p-2 text-left ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100">
                <span className="block text-sm leading-tight font-medium">{v.nome}</span>
                <span className="block text-[11px] leading-tight text-slate-500">{v.dettaglio}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function PannelloStanza({ allestimento: a, file, url, misure, modo, modifica, onDisegna, onContinua, onCalibra }: {
  allestimento: Allestimento
  file: FileSopralluogo[]
  url: Map<string, string>
  misure: string | null
  modo: Modo
  modifica: (cambia: (a: Allestimento) => Allestimento) => void
  onDisegna: () => void
  onContinua: () => void
  onCalibra: () => void
}) {
  const xs = a.pareti.punti.map((p) => p[0]), zs = a.pareti.punti.map((p) => p[1])
  const [larghezza, setLarghezza] = useState(String(xs.length ? arrotonda(Math.max(...xs) - Math.min(...xs)) : allestimentoIniziale(misure).pareti.punti[1][0] * 2))
  const [profondita, setProfondita] = useState(String(zs.length ? arrotonda(Math.max(...zs) - Math.min(...zs)) : 10))
  const segmenti = segmentiPareti(a.pareti)
  const planimetrie = [...file].sort((x, y) => (x.tipo === 'planimetria' ? 0 : 1) - (y.tipo === 'planimetria' ? 0 : 1))
  const foto = file.filter((f) => f.tipo === 'foto')
  const numero = (v: string) => Number(v.replace(',', '.'))

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Pareti</h3>
        <div className="grid grid-cols-3 gap-2">
          <MiniCampo etichetta="Larghezza m"><Input inputMode="decimal" className="min-h-10" value={larghezza} onChange={(e) => setLarghezza(e.target.value)} /></MiniCampo>
          <MiniCampo etichetta="Profondità m"><Input inputMode="decimal" className="min-h-10" value={profondita} onChange={(e) => setProfondita(e.target.value)} /></MiniCampo>
          <MiniCampo etichetta="Altezza m">
            <Input
              inputMode="decimal"
              className="min-h-10"
              defaultValue={a.pareti.altezza}
              onBlur={(e) => {
                const h = numero(e.target.value)
                if (h >= 2 && h <= 20 && h !== a.pareti.altezza) modifica((v) => ({ ...v, pareti: { ...v.pareti, altezza: h } }))
              }}
            />
          </MiniCampo>
        </div>
        <Bottone
          variante="secondario"
          className="min-h-10 w-full text-sm"
          onClick={() => {
            const l = numero(larghezza), p = numero(profondita)
            if (!(l >= 1 && l <= 200 && p >= 1 && p <= 200)) return alert('Inserisci larghezza e profondità tra 1 e 200 m')
            modifica((v) => ({ ...v, pareti: { ...v.pareti, punti: stanzaRettangolare(l, p), chiusa: true }, foto_pareti: {} }))
          }}
        >
          Sala rettangolare {larghezza}×{profondita} m
        </Bottone>
        <div className="grid grid-cols-2 gap-2">
          <Bottone variante="secondario" className="min-h-10 text-sm" onClick={onDisegna}>Disegna a mano</Bottone>
          {!a.pareti.chiusa && a.pareti.punti.length > 0 && modo !== 'pareti' ? (
            <Bottone variante="secondario" className="min-h-10 text-sm" onClick={onContinua}>Continua</Bottone>
          ) : (
            <Bottone
              variante="secondario"
              className="min-h-10 text-sm"
              disabled={!a.pareti.punti.length}
              onClick={() => modifica((v) => ({ ...v, pareti: { ...v.pareti, punti: v.pareti.chiusa ? v.pareti.punti : v.pareti.punti.slice(0, -1), chiusa: false } }))}
            >
              {a.pareti.chiusa ? 'Apri un lato' : 'Togli ultimo punto'}
            </Bottone>
          )}
        </div>
        <p className="text-xs text-slate-500">Per sale non rettangolari usa “Disegna a mano” sopra la planimetria: gli angoli si agganciano ogni 10 cm e alle linee dritte.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Pavimento</h3>
        <Select className="min-h-10" value={a.pavimento} onChange={(e) => modifica((v) => ({ ...v, pavimento: e.target.value as Allestimento['pavimento'] }))}>
          {PAVIMENTI.map((p) => <option key={p.valore} value={p.valore}>{p.etichetta}</option>)}
        </Select>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Planimetria sul pavimento</h3>
        {file.length === 0 ? (
          <p className="text-xs text-slate-500">Carica la planimetria o una foto dall’alto nella scheda del sopralluogo.</p>
        ) : (
          <>
            <Select
              className="min-h-10"
              value={a.planimetria?.file_path ?? ''}
              onChange={(e) => {
                const percorso = e.target.value
                modifica((v) => ({
                  ...v,
                  planimetria: percorso ? { file_path: percorso, larghezza: v.planimetria?.larghezza ?? 20, x: v.planimetria?.x ?? 0, z: v.planimetria?.z ?? 0, opacita: v.planimetria?.opacita ?? 0.7 } : null,
                }))
              }}
            >
              <option value="">Nessuna</option>
              {planimetrie.map((f, i) => <option key={f.id} value={f.file_path}>{f.tipo === 'planimetria' ? 'Planimetria' : 'Foto'} {i + 1} · {formatData(f.created_at.slice(0, 10))}</option>)}
            </Select>
            {a.planimetria && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <CampoNumero etichetta="Larghezza m" valore={a.planimetria.larghezza} min={1} onChange={(n) => modifica((v) => v.planimetria ? { ...v, planimetria: { ...v.planimetria, larghezza: n } } : v)} />
                  <CampoNumero etichetta="Sposta X" valore={a.planimetria.x} onChange={(n) => modifica((v) => v.planimetria ? { ...v, planimetria: { ...v.planimetria, x: n } } : v)} />
                  <CampoNumero etichetta="Sposta Z" valore={a.planimetria.z} onChange={(n) => modifica((v) => v.planimetria ? { ...v, planimetria: { ...v.planimetria, z: n } } : v)} />
                </div>
                <label className="block text-xs text-slate-600">
                  Trasparenza
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={a.planimetria.opacita}
                    onChange={(e) => modifica((v) => v.planimetria ? { ...v, planimetria: { ...v.planimetria, opacita: Number(e.target.value) } } : v)}
                    className="block w-full"
                  />
                </label>
                <Bottone variante="secondario" className="min-h-10 w-full text-sm" onClick={onCalibra}>Metti in scala con due punti</Bottone>
              </>
            )}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Foto sulle pareti</h3>
        {foto.length === 0 ? (
          <p className="text-xs text-slate-500">Scatta una foto frontale di ogni parete durante il sopralluogo: qui la applichi al lato interno della parete corrispondente.</p>
        ) : segmenti.length === 0 ? (
          <p className="text-xs text-slate-500">Prima crea le pareti.</p>
        ) : (
          <ul className="space-y-2">
            {segmenti.map((seg, i) => {
              const scelta = a.foto_pareti[String(i)] ?? ''
              return (
                <li key={i} className="flex items-center gap-2">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                    {scelta && url.get(scelta) && <img src={url.get(scelta)} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <Select
                    className="min-h-10 text-sm"
                    aria-label={`Foto della parete ${i + 1}`}
                    value={scelta}
                    onChange={(e) => {
                      const percorso = e.target.value
                      modifica((v) => {
                        const fp = { ...v.foto_pareti }
                        if (percorso) fp[String(i)] = percorso
                        else delete fp[String(i)]
                        return { ...v, foto_pareti: fp }
                      })
                    }}
                  >
                    <option value="">Parete {i + 1} · {lunghezzaSegmento(seg).toFixed(1)} m · intonaco</option>
                    {foto.map((f, k) => <option key={f.id} value={f.file_path}>Parete {i + 1} · foto {k + 1}{f.didascalia ? ` (${f.didascalia})` : ''}</option>)}
                  </Select>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function PannelloRiepilogo({ r }: { r: ReturnType<typeof riepilogo> }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Dato valore={r.coperti} etichetta="coperti" />
        <Dato valore={r.tavoli} etichetta="tavoli" />
        <Dato valore={r.area ? `${Math.round(r.area)} m²` : '—'} etichetta="superficie" />
      </div>
      {r.area > 0 && r.coperti > 0 && (
        <p className="text-sm text-slate-600">
          {(r.area / r.coperti).toFixed(2)} m² per ospite seduto
          {r.area / r.coperti < 1.2 && <span className="text-amber-700"> · sala affollata (per una cena servita si consigliano 1,4–1,8 m²)</span>}
        </p>
      )}
      {r.righe.length === 0 ? (
        <p className="text-sm text-slate-500">Nessun arredo: aggiungili dalla scheda Arredi.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {r.righe.map(({ voce, quantita }) => (
              <tr key={voce.tipo} className="border-b border-slate-100">
                <td className="py-1.5">{voce.nome}</td>
                <td className="py-1.5 text-right font-medium tabular-nums">{quantita}</td>
              </tr>
            ))}
            {r.sedie > 0 && (
              <tr>
                <td className="py-1.5">Sedie totali</td>
                <td className="py-1.5 text-right font-medium tabular-nums">{r.sedie}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Piccoli componenti
// ---------------------------------------------------------------------------
function BottoneMappa({ children, onClick, attivo, disabled, etichetta }: { children: ReactNode; onClick: () => void; attivo?: boolean; disabled?: boolean; etichetta: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={etichetta}
      aria-label={etichetta}
      aria-pressed={attivo}
      className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-sm font-semibold shadow-sm ring-1 ring-slate-200 disabled:opacity-40 ${attivo ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}
    >
      {children}
    </button>
  )
}

function BottonePiccolo({ children, onClick, etichetta, pericolo }: { children: ReactNode; onClick: () => void; etichetta: string; pericolo?: boolean }) {
  return (
    <button onClick={onClick} aria-label={etichetta} className={`min-h-10 rounded-xl px-3 text-sm font-medium ring-1 ${pericolo ? 'text-red-700 ring-red-200' : 'text-slate-700 ring-slate-300'}`}>
      {children}
    </button>
  )
}

function Contatore({ etichetta, valore, min, max, passo = 1, unita = '', onChange }: { etichetta: string; valore: number; min: number; max: number; passo?: number; unita?: string; onChange: (n: number) => void }) {
  const cambia = (d: number) => onChange(Math.min(max, Math.max(min, arrotonda(valore + d))))
  return (
    <div className="flex items-center rounded-xl ring-1 ring-slate-300">
      <button className="min-h-10 px-3 text-lg disabled:opacity-30" disabled={valore <= min} onClick={() => cambia(-passo)} aria-label={`${etichetta}: meno`}>−</button>
      <span className="min-w-16 text-center text-xs text-slate-500">{etichetta}<br /><b className="text-sm text-slate-900">{passo < 1 ? valore.toFixed(1) : valore}{unita}</b></span>
      <button className="min-h-10 px-3 text-lg disabled:opacity-30" disabled={valore >= max} onClick={() => cambia(passo)} aria-label={`${etichetta}: più`}>+</button>
    </div>
  )
}

function MiniCampo({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-slate-500">{etichetta}</span>
      {children}
    </label>
  )
}

function CampoNumero({ etichetta, valore, min, onChange }: { etichetta: string; valore: number; min?: number; onChange: (n: number) => void }) {
  return (
    <MiniCampo etichetta={etichetta}>
      <Input
        key={valore}
        inputMode="decimal"
        className="min-h-10"
        defaultValue={valore}
        onBlur={(e) => {
          const n = Number(e.target.value.replace(',', '.'))
          if (Number.isFinite(n) && (min === undefined || n >= min) && n !== valore) onChange(arrotonda(n))
        }}
      />
    </MiniCampo>
  )
}

function Dato({ valore, etichetta }: { valore: string | number; etichetta: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
      <p className="text-lg font-semibold tabular-nums">{valore}</p>
      <p className="text-xs text-slate-500">{etichetta}</p>
    </div>
  )
}
