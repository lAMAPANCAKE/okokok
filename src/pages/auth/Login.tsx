import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avviso, Bottone, Campo, Input } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'

export function GuscioAuth({ titolo, sottotitolo, children }: { titolo: string; sottotitolo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <img src="/icon.svg" alt="" className="mb-6 h-12 w-12" />
        <h1 className="text-2xl font-semibold tracking-tight">{titolo}</h1>
        {sottotitolo && <p className="mt-1 text-slate-500">{sottotitolo}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  async function accedi(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setInvio(false)
    if (error) setErrore(messaggioErrore(error))
  }

  return (
    <GuscioAuth titolo="Gestionale Eventi" sottotitolo="Accedi con le credenziali ricevute via invito">
      <form onSubmit={accedi} className="space-y-4">
        {errore && <Avviso>{errore}</Avviso>}
        <Campo etichetta="Email">
          <Input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Campo>
        <Campo etichetta="Password">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Campo>
        <Bottone type="submit" caricamento={invio} className="w-full">
          Accedi
        </Bottone>
        <Link to="/recupera-password" className="block text-center text-sm text-slate-600 underline-offset-2 hover:underline">
          Password dimenticata?
        </Link>
      </form>
    </GuscioAuth>
  )
}
