import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avviso, Bottone, Campo, Input } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'

export function GuscioAuth({ titolo, sottotitolo, children }: { titolo: string; sottotitolo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mb-6 h-12 w-12" />
        <h1 className="text-2xl font-semibold tracking-tight">{titolo}</h1>
        {sottotitolo && <p className="mt-1 text-slate-500">{sottotitolo}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

/** Gli account senza email (es. "admin") accedono con un nome utente: internamente diventa nomeutente@utenti.gestionale. */
const DOMINIO_NOMI_UTENTE = 'utenti.gestionale'
const emailDiAccesso = (v: string) => {
  const t = v.trim()
  return t.includes('@') ? t : `${t.toLowerCase()}@${DOMINIO_NOMI_UTENTE}`
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
    const { error } = await supabase.auth.signInWithPassword({ email: emailDiAccesso(email), password })
    setInvio(false)
    if (error) setErrore(messaggioErrore(error))
  }

  return (
    <GuscioAuth titolo="Gestionale Eventi" sottotitolo="Accedi al tuo account">
      <form onSubmit={accedi} className="space-y-4">
        {errore && <Avviso>{errore}</Avviso>}
        <Campo etichetta="Email o nome utente">
          <Input type="text" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
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
      <div className="mt-8 border-t border-slate-200 pt-6 text-center">
        <p className="text-sm text-slate-500">Non hai un account?</p>
        <Link to="/registrati" className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-base font-medium text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50">
          Crea account
        </Link>
      </div>
    </GuscioAuth>
  )
}
