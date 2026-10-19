import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePermessi } from '../../auth/AuthProvider'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Select } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { ETICHETTA_PIPELINE, type Azienda, type StatoPipeline } from '../../lib/types'

const vuota = {
  nome: '', settore: '', referente: '', ruolo_referente: '', email: '', telefono: '', indirizzo: '', partita_iva: '', note: '',
  stato_pipeline: 'da_contattare' as StatoPipeline,
}

export default function ModuloAzienda() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = usePermessi()
  const [dati, setDati] = useState(vuota)
  const [caricamento, setCaricamento] = useState(Boolean(id))
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('aziende').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) setErrore(messaggioErrore(error))
      const a = data as Azienda | null
      if (a) {
        setDati({
          nome: a.nome, settore: a.settore ?? '', referente: a.referente ?? '', ruolo_referente: a.ruolo_referente ?? '',
          email: a.email ?? '', telefono: a.telefono ?? '', indirizzo: a.indirizzo ?? '', partita_iva: a.partita_iva ?? '',
          note: a.note ?? '', stato_pipeline: a.stato_pipeline,
        })
      }
      setCaricamento(false)
    })
  }, [id])

  const imposta = (campo: keyof typeof vuota) => (v: string) => setDati((d) => ({ ...d, [campo]: v }))

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    const record = Object.fromEntries(Object.entries(dati).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
    record.nome = dati.nome.trim()
    record.stato_pipeline = dati.stato_pipeline
    const r = id
      ? await supabase.from('aziende').update(record).eq('id', id).select('id').single()
      : await supabase.from('aziende').insert(record).select('id').single()
    setInvio(false)
    if (r.error) return setErrore(messaggioErrore(r.error))
    navigate(`/crm/${r.data.id}`, { replace: true })
  }

  async function elimina() {
    if (!id || !confirm('Eliminare l’azienda con follow-up e collegamenti? I preventivi esistenti impediscono l’eliminazione.')) return
    const { error } = await supabase.from('aziende').delete().eq('id', id)
    if (error) return setErrore(/foreign key|violates/i.test(error.message) ? 'L’azienda ha dei preventivi: non può essere eliminata. Segnala come “Perso” se non è più attiva.' : messaggioErrore(error))
    navigate('/crm', { replace: true })
  }

  if (caricamento) return <Caricamento />

  return (
    <>
      <Intestazione titolo={id ? 'Modifica azienda' : 'Nuova azienda'} indietro={id ? `/crm/${id}` : '/crm'} />
      <form onSubmit={salva} className="space-y-4">
        <Campo etichetta="Nome azienda">
          <Input required value={dati.nome} onChange={(e) => imposta('nome')(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etichetta="Settore">
            <Input value={dati.settore} onChange={(e) => imposta('settore')(e.target.value)} placeholder="es. moda, farmaceutico, wedding planner" />
          </Campo>
          <Campo etichetta="Stato della trattativa">
            <Select value={dati.stato_pipeline} onChange={(e) => imposta('stato_pipeline')(e.target.value)}>
              {Object.entries(ETICHETTA_PIPELINE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Campo>
          <Campo etichetta="Referente">
            <Input autoComplete="off" value={dati.referente} onChange={(e) => imposta('referente')(e.target.value)} />
          </Campo>
          <Campo etichetta="Ruolo del referente">
            <Input value={dati.ruolo_referente} onChange={(e) => imposta('ruolo_referente')(e.target.value)} placeholder="es. responsabile eventi" />
          </Campo>
          <Campo etichetta="Email">
            <Input type="email" inputMode="email" autoComplete="off" value={dati.email} onChange={(e) => imposta('email')(e.target.value)} />
          </Campo>
          <Campo etichetta="Telefono">
            <Input type="tel" inputMode="tel" autoComplete="off" value={dati.telefono} onChange={(e) => imposta('telefono')(e.target.value)} />
          </Campo>
          <Campo etichetta="Indirizzo">
            <Input value={dati.indirizzo} onChange={(e) => imposta('indirizzo')(e.target.value)} />
          </Campo>
          <Campo etichetta="Partita IVA">
            <Input inputMode="numeric" value={dati.partita_iva} onChange={(e) => imposta('partita_iva')(e.target.value)} />
          </Campo>
        </div>
        <Campo etichetta="Note">
          <AreaTesto value={dati.note} onChange={(e) => imposta('note')(e.target.value)} />
        </Campo>
        {errore && <Avviso>{errore}</Avviso>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Bottone type="submit" caricamento={invio}>{id ? 'Salva modifiche' : 'Crea azienda'}</Bottone>
          {id && isAdmin && <Bottone type="button" variante="fantasma" className="text-red-700" onClick={() => void elimina()}>Elimina azienda</Bottone>}
        </div>
      </form>
    </>
  )
}
