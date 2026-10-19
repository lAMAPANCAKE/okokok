import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgeFattura } from '../../components/commerciale'
import { Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select } from '../../components/ui'
import { formatData, formatEuro, oggiIso } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { ETICHETTA_METODO, type Fattura, type Incasso, type MetodoPagamento } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

export default function FatturaDettaglio() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [errore, setErrore] = useState('')

  const { dati, errore: erroreCaricamento, caricamento, ricarica } = useDati(async () => {
    const f = oppureErrore(await supabase.from('fatture_stato').select('*').eq('id', id!).single()) as Fattura
    const [incassi, azienda, evento, preventivo] = await Promise.all([
      supabase.from('incassi').select('*').eq('fattura_id', id!).order('data', { ascending: false }),
      supabase.from('aziende').select('nome').eq('id', f.azienda_id).single(),
      f.evento_id ? supabase.from('eventi').select('nome, data').eq('id', f.evento_id).single() : Promise.resolve({ data: null }),
      f.preventivo_id ? supabase.from('preventivi').select('numero').eq('id', f.preventivo_id).single() : Promise.resolve({ data: null }),
    ])
    return {
      f,
      incassi: oppureErrore(incassi) as Incasso[],
      azienda: (azienda.data as { nome: string } | null)?.nome ?? '',
      evento: evento.data as { nome: string; data: string } | null,
      preventivo: (preventivo.data as { numero: string } | null)?.numero ?? null,
    }
  }, [id])

  if (caricamento) return <Caricamento />
  if (!dati) return <Avviso>{erroreCaricamento || 'Fattura non trovata'}</Avviso>
  const { f } = dati

  async function annulla(annullata: boolean) {
    if (annullata && !confirm('Segnare la fattura come annullata? (es. sostituita da una nota di credito)')) return
    setErrore('')
    const { error } = await supabase.from('fatture').update({ annullata }).eq('id', f.id)
    if (error) return setErrore(messaggioErrore(error))
    await ricarica()
  }

  async function elimina() {
    if (!confirm('Eliminare definitivamente la fattura dal registro?')) return
    const { error } = await supabase.from('fatture').delete().eq('id', f.id)
    if (error) return setErrore(/foreign key|violates/i.test(error.message) ? 'La fattura ha incassi registrati: eliminali prima.' : messaggioErrore(error))
    navigate('/fatture', { replace: true })
  }

  async function eliminaIncasso(idIncasso: string) {
    if (!confirm('Eliminare questo incasso? La modifica resta nel registro modifiche.')) return
    setErrore('')
    const { error } = await supabase.from('incassi').delete().eq('id', idIncasso)
    if (error) return setErrore(messaggioErrore(error))
    await ricarica()
  }

  return (
    <>
      <Intestazione
        titolo={`Fattura ${f.numero}/${f.anno}`}
        sottotitolo={dati.azienda}
        indietro="/fatture"
        azione={!f.annullata && <Link to={`/fatture/${f.id}/modifica`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium ring-1 ring-slate-300">Modifica</Link>}
      />
      {(errore || erroreCaricamento) && <div className="mb-4"><Avviso>{errore || erroreCaricamento}</Avviso></div>}

      <Scheda className="mb-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="font-semibold">{f.descrizione}</p>
          <BadgeFattura stato={f.stato} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><dt className="text-slate-500">Data fattura</dt><dd>{formatData(f.data_emissione, { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
          <div>
            <dt className="text-slate-500">Scadenza</dt>
            <dd className={f.stato === 'scaduta' ? 'font-medium text-red-700' : ''}>{formatData(f.data_scadenza, { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
          </div>
          {dati.evento && (
            <div><dt className="text-slate-500">Evento</dt><dd><Link to={`/eventi/${f.evento_id}`} className="text-brand-700">{dati.evento.nome}</Link></dd></div>
          )}
          {dati.preventivo && (
            <div><dt className="text-slate-500">Preventivo</dt><dd><Link to={`/preventivi/${f.preventivo_id}`} className="text-brand-700">{dati.preventivo}</Link></dd></div>
          )}
          <div><dt className="text-slate-500">Cliente</dt><dd><Link to={`/crm/${f.azienda_id}`} className="text-brand-700">{dati.azienda}</Link></dd></div>
        </dl>
        {f.note && <p className="mt-3 text-sm whitespace-pre-line text-slate-600">{f.note}</p>}
        <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Imponibile</span><span className="tabular-nums">{formatEuro(f.imponibile)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">IVA {String(f.iva_pct).replace('.', ',')}%</span><span className="tabular-nums">{formatEuro(f.iva)}</span></div>
          <div className="flex justify-between font-semibold"><span>Totale</span><span className="tabular-nums">{formatEuro(f.totale)}</span></div>
          <div className="flex justify-between text-emerald-700"><span>Incassato</span><span className="tabular-nums">{formatEuro(f.incassato)}</span></div>
          {!f.annullata && Number(f.residuo) > 0 && (
            <div className="flex justify-between font-semibold text-amber-700"><span>Da incassare</span><span className="tabular-nums">{formatEuro(f.residuo)}</span></div>
          )}
        </div>
      </Scheda>

      {!f.annullata && Number(f.residuo) > 0 && <NuovoIncasso key={f.residuo} fattura={f} onRegistrato={ricarica} />}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Incassi</h2>
        {dati.incassi.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun incasso registrato</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {dati.incassi.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{formatData(i.data, { day: 'numeric', month: 'short', year: 'numeric' })} · {ETICHETTA_METODO[i.metodo]}</p>
                  {i.note && <p className="truncate text-slate-500">{i.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-medium text-emerald-700 tabular-nums">{formatEuro(i.importo)}</span>
                  <button className="min-h-9 rounded-lg px-2 text-xs text-red-700 hover:bg-red-50" onClick={() => void eliminaIncasso(i.id)} aria-label="Elimina incasso">
                    Elimina
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        {f.annullata ? (
          <Bottone variante="secondario" onClick={() => void annulla(false)}>Ripristina fattura</Bottone>
        ) : (
          dati.incassi.length === 0 && <Bottone variante="secondario" onClick={() => void annulla(true)}>Segna come annullata</Bottone>
        )}
        {dati.incassi.length === 0 && <Bottone variante="fantasma" className="text-red-700" onClick={() => void elimina()}>Elimina fattura</Bottone>}
      </div>
    </>
  )
}

function NuovoIncasso({ fattura, onRegistrato }: { fattura: Fattura; onRegistrato: () => Promise<void> }) {
  const [importo, setImporto] = useState(Number(fattura.residuo).toFixed(2).replace('.', ','))
  const [data, setData] = useState(oggiIso())
  const [metodo, setMetodo] = useState<MetodoPagamento>('bonifico')
  const [note, setNote] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function registra(e: FormEvent) {
    e.preventDefault()
    const testo = importo.trim()
    const valore = Math.round(Number(testo.includes(',') ? testo.replace(/\./g, '').replace(',', '.') : testo) * 100) / 100
    if (!(valore > 0)) return setErrore('Importo non valido')
    setErrore('')
    setInvio(true)
    const { error } = await supabase.from('incassi').insert({ fattura_id: fattura.id, importo: valore, data, metodo, note: note.trim() || null })
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    setNote('')
    await onRegistrato()
  }

  return (
    <Scheda className="mb-6">
      <form onSubmit={registra} className="space-y-3">
        <h2 className="font-semibold">Registra incasso</h2>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Importo €">
            <Input inputMode="decimal" required value={importo} onChange={(e) => setImporto(e.target.value)} />
          </Campo>
          <Campo etichetta="Data">
            <Input type="date" required max={oggiIso()} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo etichetta="Metodo">
            <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPagamento)}>
              {Object.entries(ETICHETTA_METODO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Campo>
          <Campo etichetta="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. CRO del bonifico" />
          </Campo>
        </div>
        {errore && <Avviso>{errore}</Avviso>}
        <Bottone type="submit" caricamento={invio}>Registra incasso</Bottone>
      </form>
    </Scheda>
  )
}
