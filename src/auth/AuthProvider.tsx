import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profilo } from '../lib/types'

interface AuthState {
  session: Session | null
  profilo: Profilo | null
  caricamento: boolean
  /** true dopo un link di recupero password: va mostrata la schermata per impostarne una nuova */
  recuperoPassword: boolean
  ricaricaProfilo: () => Promise<void>
  esci: () => Promise<void>
  fineRecupero: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profilo, setProfilo] = useState<Profilo | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [recuperoPassword, setRecuperoPassword] = useState(false)

  // id dell'utente per cui il profilo è stato caricato (anche se assente)
  const [profiloPer, setProfiloPer] = useState<string | null>(null)

  const caricaProfilo = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfilo(null)
      setProfiloPer(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle()
    setProfilo((data as Profilo | null) ?? null)
    setProfiloPer(s.user.id)
  }, [])

  useEffect(() => {
    let attivo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!attivo) return
      setSession(data.session)
      await caricaProfilo(data.session)
      if (attivo) setCaricamento(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s)
      if (evento === 'PASSWORD_RECOVERY') setRecuperoPassword(true)
      if (evento === 'SIGNED_OUT') setRecuperoPassword(false)
      // Fuori dal callback: evita di bloccare il client Auth durante la query
      setTimeout(() => void caricaProfilo(s), 0)
    })
    return () => {
      attivo = false
      sub.subscription.unsubscribe()
    }
  }, [caricaProfilo])

  const valore: AuthState = {
    session,
    profilo,
    caricamento: caricamento || (session !== null && profiloPer !== session.user.id),
    recuperoPassword,
    ricaricaProfilo: () => caricaProfilo(session),
    esci: async () => {
      await supabase.auth.signOut()
    },
    fineRecupero: () => setRecuperoPassword(false),
  }

  return <AuthContext.Provider value={valore}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth va usato dentro AuthProvider')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePermessi() {
  const { profilo } = useAuth()
  const ruolo = profilo?.ruolo
  return {
    isAdmin: ruolo === 'admin',
    isStaff: ruolo === 'admin' || ruolo === 'responsabile',
    isCollaboratore: ruolo === 'collaboratore',
  }
}
