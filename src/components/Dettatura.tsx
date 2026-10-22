import { useEffect, useRef, useState } from 'react'

// Riconoscimento vocale del browser (Chrome Android lo supporta in italiano).
// Tipi minimi: l'API non è ancora nelle definizioni standard di TypeScript.
interface RisultatoVocale { isFinal: boolean; 0: { transcript: string } }
interface EventoVocale { resultIndex: number; results: ArrayLike<RisultatoVocale> }
interface Riconoscimento {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: EventoVocale) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  stop: () => void
}
type CostruttoreRiconoscimento = new () => Riconoscimento

const Costruttore = (window as unknown as { SpeechRecognition?: CostruttoreRiconoscimento; webkitSpeechRecognition?: CostruttoreRiconoscimento })
const RiconoscimentoVocale = Costruttore.SpeechRecognition ?? Costruttore.webkitSpeechRecognition

/**
 * Pulsante 🎤: detta e il testo riconosciuto viene aggiunto in fondo al campo.
 * Dove il browser non lo supporta suggerisce il microfono della tastiera.
 */
export function Dettatura({ onTesto, className = '' }: { onTesto: (testo: string) => void; className?: string }) {
  const [ascolto, setAscolto] = useState(false)
  const [parziale, setParziale] = useState('')
  const [errore, setErrore] = useState('')
  const riconoscimento = useRef<Riconoscimento | null>(null)
  const callback = useRef(onTesto)
  callback.current = onTesto

  useEffect(() => () => riconoscimento.current?.stop(), [])

  function avvia() {
    setErrore('')
    if (!RiconoscimentoVocale) {
      setErrore('Dettatura non disponibile in questo browser: usa il microfono della tastiera (es. Gboard).')
      return
    }
    const r = new RiconoscimentoVocale()
    r.lang = 'it-IT'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let provvisorio = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const testo = e.results[i][0].transcript
        if (e.results[i].isFinal) callback.current(testo.trim())
        else provvisorio += testo
      }
      setParziale(provvisorio)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setErrore('Consenti l’uso del microfono per dettare.')
      else if (e.error === 'network') setErrore('La dettatura richiede la connessione: usa il microfono della tastiera.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setErrore('Dettatura interrotta, riprova.')
    }
    r.onend = () => {
      setAscolto(false)
      setParziale('')
    }
    riconoscimento.current = r
    r.start()
    setAscolto(true)
  }

  function ferma() {
    riconoscimento.current?.stop()
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={ascolto ? ferma : avvia}
        aria-pressed={ascolto}
        className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium ring-1 ${ascolto ? 'bg-red-600 text-white ring-red-600' : 'bg-white text-slate-700 ring-slate-300'}`}
      >
        {ascolto ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> : '🎤'}
        {ascolto ? 'Sto ascoltando… tocca per fermare' : 'Detta'}
      </button>
      {parziale && <p className="mt-1 text-sm text-slate-500 italic">{parziale}</p>}
      {errore && <p className="mt-1 text-xs text-amber-700">{errore}</p>}
    </div>
  )
}
