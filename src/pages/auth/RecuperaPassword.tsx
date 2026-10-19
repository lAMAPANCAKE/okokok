import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Avviso, Bottone, Campo, Input } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { GuscioAuth } from './Login'

export default function RecuperaPassword() {
  const [email, setEmail] = useState('')
  const [inviata, setInviata] = useState(false)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function invia(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reimposta-password`,
    })
    setInvio(false)
    if (error) setErrore(messaggioErrore(error))
    else setInviata(true)
  }

  return (
    <GuscioAuth titolo="Recupera password" sottotitolo="Ti invieremo un link per impostarne una nuova">
      {inviata ? (
        <Avviso tipo="successo">Se l’indirizzo è registrato riceverai a breve un’email con il link.</Avviso>
      ) : (
        <form onSubmit={invia} className="space-y-4">
          {errore && <Avviso>{errore}</Avviso>}
          <Campo etichetta="Email">
            <Input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Bottone type="submit" caricamento={invio} className="w-full">
            Invia link
          </Bottone>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm text-slate-600 hover:underline">
        Torna all’accesso
      </Link>
    </GuscioAuth>
  )
}
