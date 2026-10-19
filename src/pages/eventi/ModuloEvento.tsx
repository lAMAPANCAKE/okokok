import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Select } from '../../components/ui'
import { formatOra } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import type { Evento, StatoEvento } from '../../lib/types'

const vuoto = { nome: '', cliente: '', azienda_id: '', data: '', luogo: '', ora_inizio: '', ora_fine: '', note: '', personale_richiesto: '0', stato: 'pianificato' as StatoEvento }

export default function ModuloEvento() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [dati, setDati] = useState(vuoto)
  const [caricamento, setCaricamento] = useState(Boolean(id))
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const [aziende, setAziende] = useState<{ id: string; nome: string }[]>([])

  useEffect(() => {
    supabase.from('aziende').select('id, nome').order('nome').then(({ data }) => setAziende(data ?? []))
  }, [])

  useEffect(() => {
    if (!id) return
    supabase
      .from('eventi')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setErrore(messaggioErrore(error))
        const e = data as Evento | null
        if (e) {
          setDati({
            nome: e.nome,
            cliente: e.cliente ?? '',
            azienda_id: e.azienda_id ?? '',
            data: e.data,
            luogo: e.luogo ?? '',
            ora_inizio: formatOra(e.ora_inizio),
            ora_fine: formatOra(e.ora_fine),
            note: e.note ?? '',
            personale_richiesto: String(e.personale_richiesto),
            stato: e.stato,
          })
        }
        setCaricamento(false)
      })
  }, [id])

  const imposta = (campo: keyof typeof vuoto) => (v: string) => setDati((d) => ({ ...d, [campo]: v }))

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    const record = {
      nome: dati.nome.trim(),
      cliente: dati.cliente.trim() || null,
      azienda_id: dati.azienda_id || null,
      data: dati.data,
      luogo: dati.luogo.trim() || null,
      ora_inizio: dati.ora_inizio || null,
      ora_fine: dati.ora_fine || null,
      note: dati.note.trim() || null,
      personale_richiesto: Math.max(0, parseInt(dati.personale_richiesto, 10) || 0),
      stato: dati.stato,
    }
    const r = id
      ? await supabase.from('eventi').update(record).eq('id', id).select('id').single()
      : await supabase.from('eventi').insert(record).select('id').single()
    setInvio(false)
    if (r.error) return setErrore(messaggioErrore(r.error))
    navigate(`/eventi/${r.data.id}`, { replace: true })
  }

  async function elimina() {
    if (!id || !confirm('Eliminare l’evento e tutti i suoi turni? L’operazione non si può annullare.')) return
    const { error } = await supabase.from('eventi').delete().eq('id', id)
    if (error) return setErrore(messaggioErrore(error))
    navigate('/eventi', { replace: true })
  }

  if (caricamento) return <Caricamento />

  return (
    <>
      <Intestazione titolo={id ? 'Modifica evento' : 'Nuovo evento'} indietro={id ? `/eventi/${id}` : '/eventi'} />
      <form onSubmit={salva} className="space-y-4">
        <Campo etichetta="Nome evento">
          <Input required value={dati.nome} onChange={(e) => imposta('nome')(e.target.value)} placeholder="es. Cena di gala" />
        </Campo>
        <Campo etichetta="Cliente" aiuto="Scegli un’azienda del CRM per collegare l’evento alla sua scheda">
          <Select
            value={dati.azienda_id}
            onChange={(e) => {
              const scelta = aziende.find((a) => a.id === e.target.value)
              setDati((d) => ({ ...d, azienda_id: e.target.value, cliente: scelta ? scelta.nome : d.cliente }))
            }}
          >
            <option value="">Nessuna azienda del CRM</option>
            {aziende.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Campo>
        {!dati.azienda_id && (
          <Campo etichetta="Nome cliente (testo libero)">
            <Input value={dati.cliente} onChange={(e) => imposta('cliente')(e.target.value)} />
          </Campo>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo etichetta="Data">
            <Input type="date" required value={dati.data} onChange={(e) => imposta('data')(e.target.value)} />
          </Campo>
          <Campo etichetta="Inizio">
            <Input type="time" value={dati.ora_inizio} onChange={(e) => imposta('ora_inizio')(e.target.value)} />
          </Campo>
          <Campo etichetta="Fine" aiuto="Se è prima dell’inizio, finisce il giorno dopo">
            <Input type="time" value={dati.ora_fine} onChange={(e) => imposta('ora_fine')(e.target.value)} />
          </Campo>
        </div>
        <Campo etichetta="Luogo">
          <Input value={dati.luogo} onChange={(e) => imposta('luogo')(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo etichetta="Persone necessarie">
            <Input type="number" inputMode="numeric" min={0} value={dati.personale_richiesto} onChange={(e) => imposta('personale_richiesto')(e.target.value)} />
          </Campo>
          <Campo etichetta="Stato">
            <Select value={dati.stato} onChange={(e) => imposta('stato')(e.target.value)}>
              <option value="pianificato">Pianificato</option>
              <option value="concluso">Concluso</option>
              <option value="annullato">Annullato</option>
            </Select>
          </Campo>
        </div>
        <Campo etichetta="Note operative" aiuto="Visibili al personale assegnato (divisa, ritrovo, referente in loco…)">
          <AreaTesto value={dati.note} onChange={(e) => imposta('note')(e.target.value)} />
        </Campo>
        {errore && <Avviso>{errore}</Avviso>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bottone type="submit" caricamento={invio}>
            {id ? 'Salva modifiche' : 'Crea evento'}
          </Bottone>
          {id && (
            <Bottone type="button" variante="fantasma" className="text-red-700" onClick={() => void elimina()}>
              Elimina evento
            </Bottone>
          )}
        </div>
      </form>
    </>
  )
}
