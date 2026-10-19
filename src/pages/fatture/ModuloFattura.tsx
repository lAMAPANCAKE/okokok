import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Select } from '../../components/ui'
import { dataLocale, formatData, formatEuro, isoGiorno, oggiIso } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { Azienda, Evento, Fattura, Preventivo, TotaliPreventivo } from '../../lib/types'

// Accetta sia 1.234,56 sia 1234.56
const numeroDa = (s: string) => Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.trim())
const testoDa = (n: number) => n.toFixed(2).replace('.', ',')
const piuGiorni = (iso: string, giorni: number) => {
  const d = dataLocale(iso)
  d.setDate(d.getDate() + giorni)
  return isoGiorno(d)
}

export default function ModuloFattura() {
  const { id } = useParams()
  const [parametri] = useSearchParams()
  const navigate = useNavigate()
  const [aziende, setAziende] = useState<Pick<Azienda, 'id' | 'nome'>[]>([])
  const [eventi, setEventi] = useState<Pick<Evento, 'id' | 'nome' | 'data' | 'azienda_id'>[]>([])
  const [dati, setDati] = useState({
    numero: '', azienda_id: parametri.get('azienda') ?? '', evento_id: '', preventivo_id: parametri.get('preventivo') ?? '',
    data_emissione: oggiIso(), data_scadenza: piuGiorni(oggiIso(), 30), descrizione: '', imponibile: '', iva_pct: '22', note: '',
  })
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [az, ev, imp] = await Promise.all([
          supabase.from('aziende').select('id, nome').order('nome'),
          supabase.from('eventi').select('id, nome, data, azienda_id').order('data', { ascending: false }).limit(300),
          supabase.from('impostazioni').select('iva_predefinita').single(),
        ])
        setAziende((az.data ?? []) as Pick<Azienda, 'id' | 'nome'>[])
        setEventi((ev.data ?? []) as Pick<Evento, 'id' | 'nome' | 'data' | 'azienda_id'>[])

        if (id) {
          const { data, error } = await supabase.from('fatture').select('*').eq('id', id).single()
          if (error) throw error
          const f = data as Fattura
          setDati({
            numero: f.numero, azienda_id: f.azienda_id, evento_id: f.evento_id ?? '', preventivo_id: f.preventivo_id ?? '',
            data_emissione: f.data_emissione, data_scadenza: f.data_scadenza, descrizione: f.descrizione,
            imponibile: testoDa(Number(f.imponibile)), iva_pct: String(f.iva_pct), note: f.note ?? '',
          })
          return
        }

        // Numero suggerito: il successivo tra quelli numerici dell'anno (modificabile)
        const anno = new Date().getFullYear()
        const { data: numeri } = await supabase.from('fatture').select('numero').eq('anno', anno)
        const max = Math.max(0, ...(numeri ?? []).map((r) => parseInt(r.numero, 10)).filter((n) => !Number.isNaN(n)))
        const base = { numero: String(max + 1), iva_pct: String(imp.data?.iva_predefinita ?? 22) }

        const idPrev = parametri.get('preventivo')
        if (idPrev) {
          const [p, t] = await Promise.all([
            supabase.from('preventivi').select('*').eq('id', idPrev).single(),
            supabase.from('preventivi_totali').select('*').eq('preventivo_id', idPrev).single(),
          ])
          if (p.error) throw p.error
          const prev = p.data as Preventivo
          const tot = t.data as TotaliPreventivo | null
          setDati((d) => ({
            ...d, ...base,
            azienda_id: prev.azienda_id,
            evento_id: prev.evento_id ?? '',
            descrizione: `${prev.titolo} — preventivo ${prev.numero}`,
            imponibile: testoDa(Number(tot?.imponibile ?? 0)),
            iva_pct: String(prev.iva_pct),
          }))
        } else {
          setDati((d) => ({ ...d, ...base }))
        }
      } catch (e) {
        setErrore(messaggioErrore(e))
      } finally {
        setCaricamento(false)
      }
    })()
  }, [id, parametri])

  const imposta = (campo: keyof typeof dati) => (v: string) => setDati((d) => ({ ...d, [campo]: v }))
  const imponibile = numeroDa(dati.imponibile)
  const ivaPct = numeroDa(dati.iva_pct)
  const iva = Number.isFinite(imponibile) && Number.isFinite(ivaPct) ? Math.round(imponibile * ivaPct) / 100 : 0
  const eventiCliente = eventi.filter((e) => !dati.azienda_id || e.azienda_id === dati.azienda_id || e.id === dati.evento_id)

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!(imponibile >= 0)) return setErrore('Imponibile non valido')
    if (!(ivaPct >= 0)) return setErrore('IVA non valida')
    if (dati.data_scadenza < dati.data_emissione) return setErrore('La scadenza non può essere prima della data della fattura')
    setErrore('')
    setInvio(true)
    const record = {
      numero: dati.numero.trim(),
      anno: dataLocale(dati.data_emissione).getFullYear(),
      azienda_id: dati.azienda_id,
      evento_id: dati.evento_id || null,
      preventivo_id: dati.preventivo_id || null,
      data_emissione: dati.data_emissione,
      data_scadenza: dati.data_scadenza,
      descrizione: dati.descrizione.trim(),
      imponibile: Math.round(imponibile * 100) / 100,
      iva_pct: ivaPct,
      note: dati.note.trim() || null,
    }
    const r = id
      ? await supabase.from('fatture').update(record).eq('id', id).select('id').single()
      : await supabase.from('fatture').insert(record).select('id').single()
    setInvio(false)
    if (r.error) {
      return setErrore(/fatture_anno_numero_key/.test(r.error.message) ? `Esiste già la fattura n. ${record.numero} del ${record.anno}` : messaggioErrore(r.error))
    }
    navigate(`/fatture/${r.data.id}`, { replace: true })
  }

  if (caricamento) return <Caricamento />

  return (
    <>
      <Intestazione titolo={id ? 'Modifica fattura' : 'Nuova fattura'} indietro={id ? `/fatture/${id}` : '/fatture'} />
      {!id && (
        <div className="mb-4">
          <Avviso tipo="info">Registra qui la fattura che hai emesso col tuo programma di fatturazione elettronica, con lo stesso numero.</Avviso>
        </div>
      )}
      <form onSubmit={salva} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etichetta="Cliente">
            <Select required value={dati.azienda_id} onChange={(e) => setDati((d) => ({ ...d, azienda_id: e.target.value, evento_id: '' }))}>
              <option value="">Scegli…</option>
              {aziende.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Campo>
          <Campo etichetta="Numero fattura" aiuto="Lo stesso della fattura elettronica">
            <Input required value={dati.numero} onChange={(e) => imposta('numero')(e.target.value)} />
          </Campo>
          <Campo etichetta="Data fattura">
            <Input type="date" required value={dati.data_emissione} onChange={(e) => imposta('data_emissione')(e.target.value)} />
          </Campo>
          <Campo etichetta="Scadenza pagamento">
            <Input type="date" required min={dati.data_emissione} value={dati.data_scadenza} onChange={(e) => imposta('data_scadenza')(e.target.value)} />
          </Campo>
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 30, 60, 90].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => imposta('data_scadenza')(piuGiorni(dati.data_emissione, g))}
              className="min-h-9 rounded-full bg-white px-3 text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              {g === 0 ? 'A vista' : `${g} giorni`}
            </button>
          ))}
        </div>
        <Campo etichetta="Descrizione">
          <Input required value={dati.descrizione} onChange={(e) => imposta('descrizione')(e.target.value)} placeholder="es. Servizio di personale per cena di gala" />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo etichetta="Imponibile €">
            <Input inputMode="decimal" required value={dati.imponibile} onChange={(e) => imposta('imponibile')(e.target.value)} placeholder="0,00" />
          </Campo>
          <Campo etichetta="IVA %">
            <Input inputMode="decimal" required value={dati.iva_pct} onChange={(e) => imposta('iva_pct')(e.target.value)} />
          </Campo>
        </div>
        <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-200">
          <div className="flex justify-between"><span className="text-slate-500">Imponibile</span><span className="tabular-nums">{formatEuro(Number.isFinite(imponibile) ? imponibile : 0)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">IVA</span><span className="tabular-nums">{formatEuro(iva)}</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-1 font-semibold"><span>Totale</span><span className="tabular-nums">{formatEuro((Number.isFinite(imponibile) ? imponibile : 0) + iva)}</span></div>
        </div>
        <Campo etichetta="Evento collegato (facoltativo)">
          <Select value={dati.evento_id} onChange={(e) => imposta('evento_id')(e.target.value)}>
            <option value="">Nessuno</option>
            {eventiCliente.map((ev) => <option key={ev.id} value={ev.id}>{formatData(ev.data, { day: 'numeric', month: 'short', year: 'numeric' })} · {ev.nome}</option>)}
          </Select>
        </Campo>
        <Campo etichetta="Note interne">
          <AreaTesto value={dati.note} onChange={(e) => imposta('note')(e.target.value)} />
        </Campo>
        {errore && <Avviso>{errore}</Avviso>}
        <Bottone type="submit" caricamento={invio}>{id ? 'Salva modifiche' : 'Registra fattura'}</Bottone>
      </form>
    </>
  )
}
