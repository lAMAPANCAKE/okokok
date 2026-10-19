import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { FotoProfilo } from '../../components/ModuloProfilo'
import { Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select, Vuoto } from '../../components/ui'
import { formatData, formatEuro, nomeCompleto } from '../../lib/format'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { ETICHETTA_RUOLO, type Invito, type Profilo, type Ruolo } from '../../lib/types'
import { oppureErrore, useDati } from '../../lib/useDati'

export default function Utenti() {
  const [cerca, setCerca] = useState('')
  const [modifica, setModifica] = useState<string | null>(null)

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const [utenti, inviti] = await Promise.all([
      supabase.from('profiles').select('*').order('cognome').order('nome'),
      supabase.from('inviti').select('*').is('accettato_il', null).order('creato_il', { ascending: false }),
    ])
    return { utenti: oppureErrore(utenti) as Profilo[], inviti: oppureErrore(inviti) as Invito[] }
  }, [])

  const filtrati = (dati?.utenti ?? []).filter((u) => {
    const q = cerca.trim().toLowerCase()
    return !q || nomeCompleto(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.competenze.some((c) => c.includes(q))
  })

  async function revocaInvito(id: string) {
    if (!confirm('Revocare l’invito? Il link già inviato non assegnerà più ruolo e tariffa.')) return
    await supabase.from('inviti').delete().eq('id', id)
    await ricarica()
  }

  return (
    <>
      <Intestazione
        titolo="Utenti"
        sottotitolo={dati ? `${dati.utenti.filter((u) => u.attivo).length} attivi` : undefined}
        azione={<Link to="/admin/impostazioni" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300">Impostazioni</Link>}
      />

      <ModuloInvito onInviato={() => void ricarica()} />

      {errore && <Avviso>{errore}</Avviso>}
      {caricamento ? (
        <Caricamento />
      ) : (
        <>
          {dati && dati.inviti.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 font-semibold">Inviti in attesa ({dati.inviti.length})</h2>
              <ul className="space-y-2">
                {dati.inviti.map((i) => (
                  <li key={i.id}>
                    <Scheda className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium">{i.email}</p>
                        <p className="text-slate-500">{ETICHETTA_RUOLO[i.ruolo]} · {formatEuro(i.tariffa_oraria)}/h · inviato {formatData(i.creato_il.slice(0, 10))}</p>
                      </div>
                      <Bottone variante="fantasma" className="min-h-10 text-sm text-red-700" onClick={() => void revocaInvito(i.id)}>Revoca</Bottone>
                    </Scheda>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-semibold">Roster</h2>
            <Input className="mb-3" type="search" placeholder="Cerca per nome, email o competenza" value={cerca} onChange={(e) => setCerca(e.target.value)} />
            {filtrati.length === 0 ? (
              <Vuoto titolo="Nessun utente trovato" />
            ) : (
              <ul className="space-y-2">
                {filtrati.map((u) => (
                  <li key={u.id}>
                    <Scheda className={u.attivo ? '' : 'opacity-60'}>
                      <button className="flex w-full items-center gap-3 text-left" onClick={() => setModifica(modifica === u.id ? null : u.id)} aria-expanded={modifica === u.id}>
                        <FotoProfilo profilo={u} dimensione="h-10 w-10" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{nomeCompleto(u)}{!u.profilo_completo && <span className="ml-2 text-xs font-normal text-amber-700">profilo incompleto</span>}</p>
                          <p className="truncate text-sm text-slate-500">{ETICHETTA_RUOLO[u.ruolo]} · {formatEuro(u.tariffa_oraria)}/h{!u.attivo && ' · disattivato'}</p>
                        </div>
                      </button>
                      {modifica === u.id && <ModificaUtente utente={u} onSalvato={async () => { setModifica(null); await ricarica() }} />}
                    </Scheda>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  )
}

function ModuloInvito({ onInviato }: { onInviato: () => void }) {
  const [aperto, setAperto] = useState(false)
  const [email, setEmail] = useState('')
  const [ruolo, setRuolo] = useState<Ruolo>('collaboratore')
  const [tariffa, setTariffa] = useState('')
  const [esito, setEsito] = useState<{ tipo: 'errore' | 'successo'; testo: string } | null>(null)
  const [invio, setInvio] = useState(false)

  async function invita(e: FormEvent) {
    e.preventDefault()
    setEsito(null)
    setInvio(true)
    const { data, error } = await supabase.functions.invoke('invita-utente', {
      body: { email: email.trim(), ruolo, tariffa_oraria: Number(tariffa) || 0 },
    })
    setInvio(false)
    if (error) {
      // L'errore della funzione arriva nel corpo della risposta
      let testo = messaggioErrore(error)
      try {
        const corpo = await (error as { context?: Response }).context?.json()
        if (corpo?.errore) testo = corpo.errore
      } catch { /* risposta non JSON */ }
      return setEsito({ tipo: 'errore', testo })
    }
    if (data?.errore) return setEsito({ tipo: 'errore', testo: data.errore })
    setEsito({ tipo: 'successo', testo: `Invito inviato a ${email.trim()}` })
    setEmail('')
    setTariffa('')
    onInviato()
  }

  if (!aperto) {
    return (
      <Bottone className="mb-6 w-full sm:w-auto" onClick={() => setAperto(true)}>
        + Invita un utente
      </Bottone>
    )
  }

  return (
    <Scheda className="mb-6">
      <form onSubmit={invita} className="space-y-4">
        <h2 className="font-semibold">Invita un utente</h2>
        <p className="text-sm text-slate-500">Riceverà un’email con il link per scegliere la password e completare il profilo.</p>
        <Campo etichetta="Email">
          <Input type="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Ruolo">
            <Select value={ruolo} onChange={(e) => setRuolo(e.target.value as Ruolo)}>
              <option value="collaboratore">Collaboratore</option>
              <option value="responsabile">Responsabile</option>
              <option value="admin">Admin</option>
            </Select>
          </Campo>
          <Campo etichetta="Tariffa €/ora">
            <Input type="number" inputMode="decimal" min={0} step="0.5" value={tariffa} onChange={(e) => setTariffa(e.target.value)} />
          </Campo>
        </div>
        {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
        <div className="flex gap-2">
          <Bottone type="submit" caricamento={invio}>Invia invito</Bottone>
          <Bottone type="button" variante="fantasma" onClick={() => setAperto(false)}>Chiudi</Bottone>
        </div>
      </form>
    </Scheda>
  )
}

function ModificaUtente({ utente, onSalvato }: { utente: Profilo; onSalvato: () => Promise<void> }) {
  const { profilo: io } = useAuth()
  const [ruolo, setRuolo] = useState<Ruolo>(utente.ruolo)
  const [tariffa, setTariffa] = useState(String(utente.tariffa_oraria))
  const [attivo, setAttivo] = useState(utente.attivo)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const sonoIo = io?.id === utente.id

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    const { error } = await supabase.from('profiles').update({ ruolo, tariffa_oraria: Number(tariffa) || 0, attivo }).eq('id', utente.id)
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    await onSalvato()
  }

  return (
    <form onSubmit={salva} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      <div className="text-sm text-slate-600">
        <p>{utente.email}{utente.telefono && ` · ${utente.telefono}`}</p>
        {utente.competenze.length > 0 && <p>Competenze: {utente.competenze.join(', ')}</p>}
        <Link to={`/personale/${utente.id}`} className="mt-1 inline-block font-medium text-brand-700 hover:underline">Scheda, turni e valutazioni →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo etichetta="Ruolo">
          <Select value={ruolo} disabled={sonoIo} onChange={(e) => setRuolo(e.target.value as Ruolo)}>
            <option value="collaboratore">Collaboratore</option>
            <option value="responsabile">Responsabile</option>
            <option value="admin">Admin</option>
          </Select>
        </Campo>
        <Campo etichetta="Tariffa €/ora" aiuto="Vale per i nuovi turni">
          <Input type="number" inputMode="decimal" min={0} step="0.5" value={tariffa} onChange={(e) => setTariffa(e.target.value)} />
        </Campo>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={attivo} disabled={sonoIo} onChange={(e) => setAttivo(e.target.checked)} />
        Account attivo (se disattivato non può accedere)
      </label>
      {sonoIo && <p className="text-xs text-slate-500">Non puoi cambiare il tuo ruolo o disattivarti.</p>}
      {errore && <Avviso>{errore}</Avviso>}
      <Bottone type="submit" caricamento={invio}>Salva</Bottone>
    </form>
  )
}
