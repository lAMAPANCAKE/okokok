import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePermessi } from '../../auth/AuthProvider'
import { BadgePreventivo } from '../../components/commerciale'
import { PropostaDaSopralluogo } from '../../components/PropostaDaSopralluogo'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select } from '../../components/ui'
import { formatData, formatEuro, formatPercentuale } from '../../lib/format'
import { scaricaPdfPreventivo } from '../../lib/pdfPreventivo'
import { camerieri, REGOLE_PREDEFINITE } from '../../lib/personale'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { Azienda, Impostazioni, Preventivo, Sopralluogo, StatoPreventivo, TipoVoce, TotaliPreventivo, VocePreventivo } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

const numero = (v: string) => Number(String(v).replace(',', '.')) || 0

// ---------------------------------------------------------------------------
// Nuovo preventivo: dati essenziali, poi si passa all'editor delle voci
// ---------------------------------------------------------------------------
export function NuovoPreventivo() {
  const navigate = useNavigate()
  const [parametri] = useSearchParams()
  const [aziendaId, setAziendaId] = useState(parametri.get('azienda') ?? '')
  const [sopralluogoId, setSopralluogoId] = useState(parametri.get('sopralluogo') ?? '')
  const [titolo, setTitolo] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [luogo, setLuogo] = useState('')
  const [ospiti, setOspiti] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  const { dati } = useDati(async () => {
    const [aziende, sopralluoghi, imp] = await Promise.all([
      supabase.from('aziende').select('id, nome').order('nome'),
      supabase.from('sopralluoghi').select('id, titolo, data, azienda_id, indirizzo').order('data', { ascending: false }).limit(200),
      supabase.from('impostazioni').select('iva_predefinita').single(),
    ])
    return {
      aziende: oppureErrore(aziende) as Pick<Azienda, 'id' | 'nome'>[],
      sopralluoghi: oppureErrore(sopralluoghi) as Pick<Sopralluogo, 'id' | 'titolo' | 'data' | 'azienda_id' | 'indirizzo'>[],
      iva: Number((oppureErrore(imp) as { iva_predefinita: number }).iva_predefinita),
    }
  }, [])

  // Il sopralluogo scelto precompila cliente, titolo e luogo
  useEffect(() => {
    const s = dati?.sopralluoghi.find((x) => x.id === sopralluogoId)
    if (!s) return
    if (s.azienda_id) setAziendaId(s.azienda_id)
    setTitolo((t) => t || s.titolo)
    setLuogo((l) => l || s.indirizzo || '')
  }, [sopralluogoId, dati])

  async function crea(e: FormEvent) {
    e.preventDefault()
    if (!aziendaId) return setErrore('Scegli il cliente (puoi crearlo prima nel CRM)')
    setErrore('')
    setInvio(true)
    const { data, error } = await supabase
      .from('preventivi')
      .insert({
        azienda_id: aziendaId,
        sopralluogo_id: sopralluogoId || null,
        titolo: titolo.trim(),
        data_evento: dataEvento || null,
        luogo: luogo.trim() || null,
        ospiti: ospiti ? Math.max(0, parseInt(ospiti, 10)) : null,
        iva_pct: dati?.iva ?? 22,
      })
      .select('id')
      .single()
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    navigate(`/preventivi/${data.id}${sopralluogoId ? '?proposta=1' : ''}`, { replace: true })
  }

  const sopralluoghiCliente = (dati?.sopralluoghi ?? []).filter((s) => !aziendaId || !s.azienda_id || s.azienda_id === aziendaId)

  return (
    <>
      <Intestazione titolo="Nuovo preventivo" indietro={aziendaId ? `/crm/${aziendaId}` : '/preventivi'} />
      <form onSubmit={crea} className="space-y-4">
        <Campo etichetta="Cliente">
          <Select required value={aziendaId} onChange={(e) => setAziendaId(e.target.value)}>
            <option value="">Scegli…</option>
            {dati?.aziende.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Campo>
        <Campo etichetta="Da sopralluogo" aiuto="Facoltativo: usa i dati raccolti in loco">
          <Select value={sopralluogoId} onChange={(e) => setSopralluogoId(e.target.value)}>
            <option value="">Nessuno</option>
            {sopralluoghiCliente.map((s) => <option key={s.id} value={s.id}>{formatData(s.data)} · {s.titolo}</option>)}
          </Select>
        </Campo>
        <Campo etichetta="Titolo">
          <Input required value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="es. Cena di gala 120 ospiti" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Data evento">
            <Input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} />
          </Campo>
          <Campo etichetta="Ospiti">
            <Input type="number" inputMode="numeric" min={0} value={ospiti} onChange={(e) => setOspiti(e.target.value)} />
          </Campo>
        </div>
        <Campo etichetta="Luogo">
          <Input value={luogo} onChange={(e) => setLuogo(e.target.value)} />
        </Campo>
        {errore && <Avviso>{errore}</Avviso>}
        <Bottone type="submit" caricamento={invio}>Crea bozza</Bottone>
      </form>
    </>
  )
}

// ---------------------------------------------------------------------------
// Editor del preventivo
// ---------------------------------------------------------------------------
interface RigaVoce {
  chiave: string
  id?: string
  tipo: TipoVoce
  descrizione: string
  quantita: string
  ore: string
  prezzo: string
  costo: string
}

const daVoce = (v: VocePreventivo): RigaVoce => ({
  chiave: v.id,
  id: v.id,
  tipo: v.tipo,
  descrizione: v.descrizione,
  quantita: String(v.quantita),
  ore: v.ore === null ? '' : String(v.ore),
  prezzo: String(v.prezzo_unitario),
  costo: String(v.costo_unitario),
})

const importoRiga = (r: RigaVoce, campo: 'prezzo' | 'costo') =>
  Math.round(numero(r.quantita) * (r.tipo === 'personale' ? numero(r.ore) || 0 : 1) * numero(r[campo]) * 100) / 100

export default function PreventivoDettaglio() {
  const { id } = useParams() as { id: string }
  const navigate = useNavigate()
  const [parametri] = useSearchParams()
  const { isAdmin } = usePermessi()
  const [testata, setTestata] = useState({ titolo: '', data_evento: '', luogo: '', ospiti: '', valido_fino: '', sconto_pct: '0', iva_pct: '22', note_cliente: '', note_interne: '' })
  const [righe, setRighe] = useState<RigaVoce[]>([])
  const [modificato, setModificato] = useState(false)
  const [esito, setEsito] = useState<{ stato: StatoPreventivo; motivo: string } | null>(null)
  const [errore, setErrore] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)

  const { dati, errore: erroreCaricamento, caricamento, ricarica } = useDati(async () => {
    const p = oppureErrore(await supabase.from('preventivi').select('*').eq('id', id).single()) as Preventivo
    const [voci, totali, azienda, imp, sopralluogo] = await Promise.all([
      supabase.from('preventivo_voci').select('*').eq('preventivo_id', id).order('ordine'),
      supabase.from('preventivi_totali').select('*').eq('preventivo_id', id).single(),
      supabase.from('aziende').select('*').eq('id', p.azienda_id).single(),
      supabase.from('impostazioni').select('*').single(),
      p.sopralluogo_id ? supabase.from('sopralluoghi').select('*').eq('id', p.sopralluogo_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ])
    return {
      p,
      voci: oppureErrore(voci) as VocePreventivo[],
      totali: oppureErrore(totali) as TotaliPreventivo,
      azienda: oppureErrore(azienda) as Azienda,
      imp: oppureErrore(imp) as Impostazioni,
      sopralluogo: oppureErrore(sopralluogo) as Sopralluogo | null,
    }
  }, [id])

  useEffect(() => {
    if (!dati) return
    const { p } = dati
    setTestata({
      titolo: p.titolo,
      data_evento: p.data_evento ?? '',
      luogo: p.luogo ?? '',
      ospiti: p.ospiti === null ? '' : String(p.ospiti),
      valido_fino: p.valido_fino ?? '',
      sconto_pct: String(p.sconto_pct),
      iva_pct: String(p.iva_pct),
      note_cliente: p.note_cliente ?? '',
      note_interne: p.note_interne ?? '',
    })
    setRighe(dati.voci.map(daVoce))
    setModificato(false)
  }, [dati])

  // Anteprima dei totali mentre si modifica (il database resta la fonte di verità)
  const anteprima = useMemo(() => {
    const subtotale = righe.reduce((s, r) => s + importoRiga(r, 'prezzo'), 0)
    const costo = righe.reduce((s, r) => s + importoRiga(r, 'costo'), 0)
    const sconto = Math.round(subtotale * numero(testata.sconto_pct)) / 100
    const imponibile = subtotale - sconto
    const iva = Math.round(imponibile * numero(testata.iva_pct)) / 100
    const margine = imponibile - costo
    return { subtotale, sconto, imponibile, iva, totale: imponibile + iva, costo, margine, margine_pct: imponibile > 0 ? Math.round((margine / imponibile) * 1000) / 10 : null }
  }, [righe, testata.sconto_pct, testata.iva_pct])

  if (caricamento) return <Caricamento />
  if (!dati) return <Avviso>{erroreCaricamento || 'Preventivo non trovato'}</Avviso>
  const { p } = dati
  const bozza = p.stato === 'bozza'

  const impostaTestata = (campo: keyof typeof testata) => (v: string) => {
    setTestata((t) => ({ ...t, [campo]: v }))
    setModificato(true)
  }
  const impostaRiga = (chiave: string, campo: keyof RigaVoce, v: string) => {
    setRighe((rr) => rr.map((r) => (r.chiave === chiave ? { ...r, [campo]: v } : r)))
    setModificato(true)
  }
  const regole = { copertiMin: dati.imp.coperti_per_cameriere_min ?? REGOLE_PREDEFINITE.copertiMin, copertiMax: dati.imp.coperti_per_cameriere_max ?? REGOLE_PREDEFINITE.copertiMax }
  const aggiungiRiga = (tipo: TipoVoce) => {
    setRighe((rr) => [
      ...rr,
      {
        chiave: crypto.randomUUID(),
        tipo,
        descrizione: tipo === 'personale' ? '' : '',
        // Personale: camerieri secondo la regola dell'azienda (1 ogni 10–12 coperti)
        quantita: tipo === 'personale' ? String(Math.max(1, camerieri(Number(testata.ospiti) || 0, regole).proposti)) : '1',
        ore: tipo === 'personale' ? '6' : '',
        prezzo: '',
        costo: '',
      },
    ])
    setModificato(true)
  }
  const rimuoviRiga = (chiave: string) => {
    setRighe((rr) => rr.filter((r) => r.chiave !== chiave))
    setModificato(true)
  }

  async function salva() {
    setErrore('')
    if (righe.some((r) => !r.descrizione.trim())) return setErrore('Ogni voce deve avere una descrizione')
    if (righe.some((r) => numero(r.quantita) <= 0 || (r.tipo === 'personale' && numero(r.ore) <= 0))) return setErrore('Quantità e ore devono essere maggiori di zero')
    setSalvataggio(true)
    try {
      const testataDb = bozza
        ? {
            titolo: testata.titolo.trim(),
            data_evento: testata.data_evento || null,
            luogo: testata.luogo.trim() || null,
            ospiti: testata.ospiti ? Math.max(0, parseInt(testata.ospiti, 10)) : null,
            valido_fino: testata.valido_fino || null,
            sconto_pct: Math.min(100, Math.max(0, numero(testata.sconto_pct))),
            iva_pct: Math.max(0, numero(testata.iva_pct)),
            note_cliente: testata.note_cliente.trim() || null,
            note_interne: testata.note_interne.trim() || null,
          }
        : { note_interne: testata.note_interne.trim() || null }
      const r1 = await supabase.from('preventivi').update(testataDb).eq('id', id)
      if (r1.error) throw r1.error

      if (bozza) {
        const rimaste = new Set(righe.filter((r) => r.id).map((r) => r.id))
        const daEliminare = dati!.voci.filter((v) => !rimaste.has(v.id)).map((v) => v.id)
        if (daEliminare.length) {
          const r2 = await supabase.from('preventivo_voci').delete().in('id', daEliminare)
          if (r2.error) throw r2.error
        }
        const record = (r: RigaVoce, i: number) => ({
          preventivo_id: id,
          ordine: i,
          tipo: r.tipo,
          descrizione: r.descrizione.trim(),
          quantita: numero(r.quantita),
          ore: r.tipo === 'personale' ? numero(r.ore) : null,
          prezzo_unitario: numero(r.prezzo),
          costo_unitario: numero(r.costo),
        })
        const esistenti = righe.map((r, i) => ({ r, i })).filter(({ r }) => r.id)
        for (const { r, i } of esistenti) {
          const r3 = await supabase.from('preventivo_voci').update(record(r, i)).eq('id', r.id!)
          if (r3.error) throw r3.error
        }
        const nuove = righe.map((r, i) => ({ r, i })).filter(({ r }) => !r.id).map(({ r, i }) => record(r, i))
        if (nuove.length) {
          const r4 = await supabase.from('preventivo_voci').insert(nuove)
          if (r4.error) throw r4.error
        }
      }
      await ricarica()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setSalvataggio(false)
    }
  }

  async function cambiaStato(stato: StatoPreventivo, motivo?: string) {
    setErrore('')
    if (stato === 'inviato' && dati!.voci.length === 0) return setErrore('Aggiungi almeno una voce prima di inviare')
    const { error } = await supabase.from('preventivi').update({ stato, motivo_esito: motivo?.trim() || null }).eq('id', id)
    if (error) return setErrore(messaggioErrore(error))
    setEsito(null)
    await ricarica()
  }

  async function pdf() {
    setErrore('')
    try {
      await scaricaPdfPreventivo(p, dati!.voci, dati!.totali, dati!.azienda, dati!.imp)
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  async function creaEvento() {
    if (!p.data_evento) return setErrore('Indica la data dell’evento nel preventivo (riportalo in bozza) prima di creare l’evento')
    setErrore('')
    const { data, error } = await supabase
      .from('eventi')
      .insert({
        nome: p.titolo,
        cliente: dati!.azienda.nome,
        azienda_id: p.azienda_id,
        data: p.data_evento,
        luogo: p.luogo,
        personale_richiesto: Math.round(Number(dati!.totali.persone) || 0),
        note: `Da preventivo ${p.numero}`,
      })
      .select('id')
      .single()
    if (error) return setErrore(messaggioErrore(error))
    await supabase.from('preventivi').update({ evento_id: data.id }).eq('id', id)
    navigate(`/eventi/${data.id}`)
  }

  async function duplica() {
    setErrore('')
    const { data, error } = await supabase
      .from('preventivi')
      .insert({
        azienda_id: p.azienda_id, sopralluogo_id: p.sopralluogo_id, titolo: `${p.titolo} (copia)`, data_evento: p.data_evento, luogo: p.luogo,
        ospiti: p.ospiti, sconto_pct: p.sconto_pct, iva_pct: p.iva_pct, note_cliente: p.note_cliente, note_interne: p.note_interne,
      })
      .select('id')
      .single()
    if (error) return setErrore(messaggioErrore(error))
    if (dati!.voci.length) {
      await supabase.from('preventivo_voci').insert(dati!.voci.map((v) => ({
        preventivo_id: data.id, ordine: v.ordine, tipo: v.tipo, descrizione: v.descrizione, quantita: v.quantita, ore: v.ore,
        prezzo_unitario: v.prezzo_unitario, costo_unitario: v.costo_unitario,
      })))
    }
    navigate(`/preventivi/${data.id}`)
  }

  async function elimina() {
    if (!confirm('Eliminare il preventivo?')) return
    const { error } = await supabase.from('preventivi').delete().eq('id', id)
    if (error) return setErrore(messaggioErrore(error))
    navigate(`/crm/${p.azienda_id}`, { replace: true })
  }

  const t = modificato ? anteprima : dati.totali
  const problemiSopralluogo = dati.sopralluogo?.checklist?.filter((c) => c.stato === 'problema') ?? []

  return (
    <>
      <Intestazione
        titolo={`Preventivo ${p.numero}`}
        sottotitolo={dati.azienda.nome}
        indietro={`/crm/${p.azienda_id}`}
        azione={<BadgePreventivo stato={p.stato} />}
      />

      {!bozza && (
        <div className="mb-4">
          <Avviso tipo="info">
            {p.stato === 'inviato' && `Inviato il ${formatData(p.data_invio!)}. `}
            {(p.stato === 'accettato' || p.stato === 'rifiutato' || p.stato === 'perso') && `Esito del ${formatData(p.data_esito!)}${p.motivo_esito ? `: ${p.motivo_esito}` : ''}. `}
            Per modificare voci e prezzi riportalo in bozza.
          </Avviso>
        </div>
      )}
      {errore && <div className="mb-4"><Avviso>{errore}</Avviso></div>}

      {/* Azioni principali */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => void pdf()} disabled={modificato}>Scarica PDF</Bottone>
        {bozza && <Bottone className="min-h-10 text-sm" disabled={modificato} onClick={() => void cambiaStato('inviato')}>Segna come inviato</Bottone>}
        {p.stato === 'inviato' && !esito && (
          <>
            <Bottone className="min-h-10 text-sm" onClick={() => void cambiaStato('accettato')}>Accettato</Bottone>
            <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => setEsito({ stato: 'rifiutato', motivo: '' })}>Rifiutato</Bottone>
            <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => setEsito({ stato: 'perso', motivo: '' })}>Perso</Bottone>
          </>
        )}
        {p.stato === 'accettato' && !p.evento_id && <Bottone className="min-h-10 text-sm" onClick={() => void creaEvento()}>Crea evento</Bottone>}
        {p.evento_id && <Link to={`/eventi/${p.evento_id}`} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-brand-700 ring-1 ring-brand-100">Vai all’evento →</Link>}
        {p.stato === 'accettato' && isAdmin && <Link to={`/fatture/nuova?preventivo=${p.id}`} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-brand-700 ring-1 ring-brand-100">Registra fattura</Link>}
        {!bozza && <Bottone variante="fantasma" className="min-h-10 text-sm" onClick={() => confirm('Riportare in bozza? Andrà re-inviato al cliente dopo le modifiche.') && void cambiaStato('bozza')}>Riporta in bozza</Bottone>}
        <Bottone variante="fantasma" className="min-h-10 text-sm" onClick={() => void duplica()}>Duplica</Bottone>
        {(bozza || isAdmin) && <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => void elimina()}>Elimina</Bottone>}
      </div>
      {modificato && <p className="-mt-2 mb-4 text-xs text-amber-700">Salva le modifiche per scaricare il PDF o cambiare stato.</p>}

      {esito && (
        <Scheda className="mb-4 space-y-3">
          <p className="font-medium">{esito.stato === 'rifiutato' ? 'Preventivo rifiutato' : 'Trattativa persa'}</p>
          <AreaTesto rows={2} placeholder="Motivo (es. prezzo, data non disponibile, scelto un concorrente)" value={esito.motivo} onChange={(e) => setEsito({ ...esito, motivo: e.target.value })} />
          <div className="flex gap-2">
            <Bottone className="min-h-10 text-sm" onClick={() => void cambiaStato(esito.stato, esito.motivo)}>Conferma</Bottone>
            <Bottone variante="fantasma" className="min-h-10 text-sm" onClick={() => setEsito(null)}>Annulla</Bottone>
          </div>
        </Scheda>
      )}

      {dati.sopralluogo && (
        <Scheda className="mb-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Dal sopralluogo del {formatData(dati.sopralluogo.data)}</p>
            <Link to={`/sopralluoghi/${dati.sopralluogo.id}`} className="text-brand-700 hover:underline">Apri</Link>
          </div>
          {problemiSopralluogo.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {problemiSopralluogo.map((c) => <li key={c.chiave} className="text-amber-800">⚠ {c.etichetta}{c.nota && `: ${c.nota}`}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-slate-500">Nessun problema segnalato in checklist.</p>
          )}
          {dati.sopralluogo.misure && <p className="mt-2 whitespace-pre-line text-slate-600"><span className="font-medium">Misure:</span> {dati.sopralluogo.misure}</p>}
        </Scheda>
      )}

      {/* Testata */}
      <Scheda className="mb-4 space-y-4">
        <Campo etichetta="Titolo">
          <Input disabled={!bozza} value={testata.titolo} onChange={(e) => impostaTestata('titolo')(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo etichetta="Data evento">
            <Input type="date" disabled={!bozza} value={testata.data_evento} onChange={(e) => impostaTestata('data_evento')(e.target.value)} />
          </Campo>
          <Campo etichetta="Ospiti">
            <Input type="number" inputMode="numeric" min={0} disabled={!bozza} value={testata.ospiti} onChange={(e) => impostaTestata('ospiti')(e.target.value)} />
          </Campo>
          <Campo etichetta="Valido fino al">
            <Input type="date" disabled={!bozza} value={testata.valido_fino} onChange={(e) => impostaTestata('valido_fino')(e.target.value)} />
          </Campo>
          <Campo etichetta="Luogo">
            <Input disabled={!bozza} value={testata.luogo} onChange={(e) => impostaTestata('luogo')(e.target.value)} />
          </Campo>
        </div>
      </Scheda>

      {bozza && p.sopralluogo_id && (
        <PropostaDaSopralluogo
          sopralluogoId={p.sopralluogo_id}
          ospiti={Number(testata.ospiti) || null}
          regole={regole}
          giaPresenti={righe.map((x) => x.descrizione)}
          apertaIniziale={parametri.get('proposta') === '1' && righe.length === 0}
          onAggiungi={(voci) => {
            setRighe((rr) => [
              ...rr,
              ...voci.map((v) => ({
                chiave: crypto.randomUUID(), tipo: v.tipo, descrizione: v.descrizione, quantita: String(v.quantita),
                ore: v.ore ? String(v.ore) : '', prezzo: v.prezzo !== null ? String(v.prezzo) : '', costo: v.costo !== null ? String(v.costo) : '',
              })),
            ])
            setModificato(true)
          }}
        />
      )}

      {/* Voci */}
      <section className="mb-4">
        <h2 className="mb-2 text-lg font-semibold">Voci</h2>
        {righe.length === 0 && <p className="mb-2 text-sm text-slate-500">Aggiungi il personale (persone × ore × €/ora) e gli eventuali servizi extra.</p>}
        <ul className="space-y-2">
          {righe.map((r) => (
            <li key={r.chiave}>
              <Scheda className="space-y-3">
                <div className="flex items-start gap-2">
                  <Select disabled={!bozza} className="w-36 shrink-0" value={r.tipo} onChange={(e) => impostaRiga(r.chiave, 'tipo', e.target.value)} aria-label="Tipo di voce">
                    <option value="personale">Personale</option>
                    <option value="servizio">Servizio</option>
                    <option value="altro">Altro</option>
                  </Select>
                  <Input disabled={!bozza} value={r.descrizione} onChange={(e) => impostaRiga(r.chiave, 'descrizione', e.target.value)} placeholder={r.tipo === 'personale' ? 'es. Camerieri di sala' : 'es. Guardaroba, noleggio divise'} aria-label="Descrizione" />
                </div>
                <div className={`grid gap-2 ${r.tipo === 'personale' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <Campo etichetta={r.tipo === 'personale' ? 'Persone' : 'Quantità'}>
                    <Input inputMode="decimal" disabled={!bozza} value={r.quantita} onChange={(e) => impostaRiga(r.chiave, 'quantita', e.target.value)} />
                  </Campo>
                  {r.tipo === 'personale' && (
                    <Campo etichetta="Ore">
                      <Input inputMode="decimal" disabled={!bozza} value={r.ore} onChange={(e) => impostaRiga(r.chiave, 'ore', e.target.value)} />
                    </Campo>
                  )}
                  <Campo etichetta={r.tipo === 'personale' ? '€/ora' : 'Prezzo €'}>
                    <Input inputMode="decimal" disabled={!bozza} value={r.prezzo} onChange={(e) => impostaRiga(r.chiave, 'prezzo', e.target.value)} />
                  </Campo>
                  <Campo etichetta="Costo € (int.)">
                    <Input inputMode="decimal" disabled={!bozza} value={r.costo} onChange={(e) => impostaRiga(r.chiave, 'costo', e.target.value)} className="bg-amber-50/50" />
                  </Campo>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Importo <span className="font-semibold text-slate-900 tabular-nums">{formatEuro(importoRiga(r, 'prezzo'))}</span>
                    {' · '}costo {formatEuro(importoRiga(r, 'costo'))}
                  </span>
                  {bozza && <button className="min-h-9 rounded-lg px-2 text-red-700 hover:bg-red-50" onClick={() => rimuoviRiga(r.chiave)}>Rimuovi</button>}
                </div>
              </Scheda>
            </li>
          ))}
        </ul>
        {bozza && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => aggiungiRiga('personale')}>+ Personale</Bottone>
            <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => aggiungiRiga('servizio')}>+ Servizio extra</Bottone>
          </div>
        )}
      </section>

      {/* Totali */}
      <Scheda className="mb-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotale</dt><dd className="tabular-nums">{formatEuro(t.subtotale)}</dd></div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Sconto %</dt>
            <dd className="flex items-center gap-2">
              <input inputMode="decimal" disabled={!bozza} value={testata.sconto_pct} onChange={(e) => impostaTestata('sconto_pct')(e.target.value)} className="h-9 w-16 rounded-lg px-2 text-right ring-1 ring-slate-300 disabled:bg-slate-100" aria-label="Sconto in percentuale" />
              <span className="w-24 text-right tabular-nums">−{formatEuro(t.sconto)}</span>
            </dd>
          </div>
          <div className="flex justify-between"><dt className="text-slate-500">Imponibile</dt><dd className="tabular-nums">{formatEuro(t.imponibile)}</dd></div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">IVA %</dt>
            <dd className="flex items-center gap-2">
              <input inputMode="decimal" disabled={!bozza} value={testata.iva_pct} onChange={(e) => impostaTestata('iva_pct')(e.target.value)} className="h-9 w-16 rounded-lg px-2 text-right ring-1 ring-slate-300 disabled:bg-slate-100" aria-label="IVA in percentuale" />
              <span className="w-24 text-right tabular-nums">{formatEuro(t.iva)}</span>
            </dd>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold"><dt>Totale</dt><dd className="tabular-nums">{formatEuro(t.totale)}</dd></div>
        </dl>
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          <p className="mb-1 text-xs font-medium tracking-wide text-amber-800 uppercase">Solo uso interno · non compare nel PDF</p>
          <div className="flex justify-between"><span>Costo stimato</span><span className="tabular-nums">{formatEuro(t.costo)}</span></div>
          <div className="flex justify-between font-semibold">
            <span>Margine</span>
            <span className={`tabular-nums ${Number(t.margine) < 0 ? 'text-red-700' : ''}`}>{formatEuro(t.margine)}{t.margine_pct !== null && ` (${formatPercentuale(t.margine_pct)})`}</span>
          </div>
        </div>
      </Scheda>

      <Scheda className="mb-4 space-y-4">
        <Campo etichetta="Note per il cliente" aiuto="Stampate sul PDF (es. cosa è incluso, modalità di pagamento)">
          <AreaTesto disabled={!bozza} value={testata.note_cliente} onChange={(e) => impostaTestata('note_cliente')(e.target.value)} />
        </Campo>
        <Campo etichetta="Note interne" aiuto="Mai sul PDF">
          <AreaTesto value={testata.note_interne} onChange={(e) => impostaTestata('note_interne')(e.target.value)} className="bg-amber-50/50" />
        </Campo>
      </Scheda>

      {modificato && (
        <div className="pb-safe sticky bottom-20 z-10 md:bottom-4">
          <Bottone className="w-full shadow-lg" caricamento={salvataggio} onClick={() => void salva()}>Salva modifiche</Bottone>
        </div>
      )}
    </>
  )
}
