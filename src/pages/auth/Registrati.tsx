import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Avviso, Bottone, Campo, Input } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { GuscioAuth } from './Login'
import { CampiNuovaPassword } from './ReimpostaPassword'

// Registrazione libera: il trigger gestisci_nuovo_utente crea un collaboratore NON attivo
// (salvo invito pendente), che un admin abilita da Utenti. Nessun dato è visibile prima.
export default function Registrati() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)
  const [inviata, setInviata] = useState(false)

  async function registra(e: FormEvent) {
    e.preventDefault()
    if (password !== conferma) return setErrore('Le password non coincidono')
    setErrore('')
    setInvio(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    })
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    // Con la conferma email attiva non c'è ancora una sessione; altrimenti l'utente è già dentro
    if (!data.session) setInviata(true)
  }

  if (inviata) {
    return (
      <GuscioAuth titolo="Controlla la tua email">
        <div className="space-y-4">
          <Avviso tipo="info">
            Ti abbiamo inviato un link a {email.trim()} per confermare l’indirizzo. Dopo la conferma l’amministrazione dovrà attivare il tuo account.
          </Avviso>
          <Link to="/login" className="block text-center text-sm text-slate-600 underline-offset-2 hover:underline">
            Torna all’accesso
          </Link>
        </div>
      </GuscioAuth>
    )
  }

  return (
    <GuscioAuth titolo="Crea account" sottotitolo="Dopo la registrazione l’amministrazione attiverà il tuo accesso">
      <form onSubmit={registra} className="space-y-4">
        {errore && <Avviso>{errore}</Avviso>}
        <Campo etichetta="Email">
          <Input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <CampiNuovaPassword password={password} conferma={conferma} onPassword={setPassword} onConferma={setConferma} />
        <Bottone type="submit" caricamento={invio} className="w-full">
          Crea account
        </Bottone>
        <Link to="/login" className="block text-center text-sm text-slate-600 underline-offset-2 hover:underline">
          Hai già un account? Accedi
        </Link>
      </form>
    </GuscioAuth>
  )
}
