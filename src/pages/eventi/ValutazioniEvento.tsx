import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Stelle } from '../../components/Stelle'
import { AreaTesto, Avviso, Bottone, Scheda } from '../../components/ui'
import { nomeCompleto, oggiIso } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { Evento, Profilo, Valutazione } from '../../lib/types'

/** Dopo l'evento il responsabile valuta il personale impiegato (uso interno). */
export function ValutazioniEvento({ evento, lavoratori, valutazioni, onSalvato }: { evento: Evento; lavoratori: Profilo[]; valutazioni: Map<string, Valutazione>; onSalvato: () => void }) {
  if (lavoratori.length === 0 || evento.data > oggiIso()) return null
  const mancanti = lavoratori.filter((p) => !valutazioni.has(p.id)).length

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Valutazioni</h2>
        {mancanti > 0 && <span className="text-sm text-amber-700">{mancanti} da valutare</span>}
      </div>
      <p className="mb-3 text-sm text-slate-500">Visibili solo a responsabili e admin: aiutano a scegliere chi chiamare per i prossimi eventi.</p>
      <ul className="space-y-2">
        {lavoratori.map((p) => (
          <li key={p.id}>
            <RigaValutazione eventoId={evento.id} persona={p} esistente={valutazioni.get(p.id)} onSalvato={onSalvato} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function RigaValutazione({ eventoId, persona, esistente, onSalvato }: { eventoId: string; persona: Profilo; esistente?: Valutazione; onSalvato: () => void }) {
  const [punteggio, setPunteggio] = useState(esistente?.punteggio ?? 0)
  const [note, setNote] = useState(esistente?.note ?? '')
  const [aperta, setAperta] = useState(!esistente)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function salva() {
    if (!punteggio) return setErrore('Scegli da 1 a 5 stelle')
    setErrore('')
    setInvio(true)
    const record = { evento_id: eventoId, collaboratore_id: persona.id, punteggio, note: note.trim() || null }
    const { error } = esistente
      ? await supabase.from('valutazioni').update(record).eq('id', esistente.id)
      : await supabase.from('valutazioni').insert(record)
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    setAperta(false)
    onSalvato()
  }

  return (
    <Scheda>
      <div className="flex items-center justify-between gap-2">
        <Link to={`/personale/${persona.id}`} className="font-medium hover:underline">{nomeCompleto(persona)}</Link>
        {!aperta && esistente && (
          <button className="flex items-center gap-2 text-sm text-slate-500 hover:underline" onClick={() => setAperta(true)}>
            <Stelle valore={esistente.punteggio} piccole /> Modifica
          </button>
        )}
      </div>
      {!aperta && esistente?.note && <p className="mt-1 text-sm text-slate-600">{esistente.note}</p>}
      {aperta && (
        <div className="mt-2 space-y-2">
          <Stelle valore={punteggio} onCambia={setPunteggio} etichetta={`Valutazione di ${nomeCompleto(persona)}`} />
          <AreaTesto rows={2} placeholder="Note (puntualità, presenza, rapporto con gli ospiti…)" value={note} onChange={(e) => setNote(e.target.value)} />
          {errore && <Avviso>{errore}</Avviso>}
          <div className="flex gap-2">
            <Bottone className="min-h-10 text-sm" caricamento={invio} onClick={() => void salva()}>Salva</Bottone>
            {esistente && <Bottone variante="fantasma" className="min-h-10 text-sm" onClick={() => setAperta(false)}>Annulla</Bottone>}
          </div>
        </div>
      )}
    </Scheda>
  )
}
