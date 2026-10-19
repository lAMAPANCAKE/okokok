import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { Avviso, Bottone, Campo, Caricamento, Input } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { GuscioAuth } from './Login'

export function CampiNuovaPassword({ password, conferma, onPassword, onConferma }: { password: string; conferma: string; onPassword: (v: string) => void; onConferma: (v: string) => void }) {
  return (
    <>
      <Campo etichetta="Nuova password" aiuto="Almeno 8 caratteri">
        <Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => onPassword(e.target.value)} />
      </Campo>
      <Campo etichetta="Ripeti password" errore={conferma && conferma !== password ? 'Le password non coincidono' : undefined}>
        <Input type="password" autoComplete="new-password" required value={conferma} onChange={(e) => onConferma(e.target.value)} />
      </Campo>
    </>
  )
}

export default function ReimpostaPassword() {
  const { session, caricamento, fineRecupero } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (password !== conferma) return setErrore('Le password non coincidono')
    setErrore('')
    setInvio(true)
    const { error } = await supabase.auth.updateUser({ password })
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    fineRecupero()
    navigate('/', { replace: true })
  }

  if (caricamento) return <Caricamento />
  if (!session) {
    return (
      <GuscioAuth titolo="Link non valido">
        <Avviso>Il link è scaduto o è già stato usato. Richiedine uno nuovo dalla pagina di accesso.</Avviso>
      </GuscioAuth>
    )
  }

  return (
    <GuscioAuth titolo="Imposta una nuova password">
      <form onSubmit={salva} className="space-y-4">
        {errore && <Avviso>{errore}</Avviso>}
        <CampiNuovaPassword password={password} conferma={conferma} onPassword={setPassword} onConferma={setConferma} />
        <Bottone type="submit" caricamento={invio} className="w-full">
          Salva password
        </Bottone>
      </form>
    </GuscioAuth>
  )
}
