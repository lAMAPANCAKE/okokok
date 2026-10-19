import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

/** Campanella con il numero di notifiche non lette; si aggiorna a ogni cambio pagina e ogni minuto. */
export function Campanella({ className = '' }: { className?: string }) {
  const { profilo } = useAuth()
  const location = useLocation()
  const [nonLette, setNonLette] = useState(0)

  useEffect(() => {
    if (!profilo) return
    let attivo = true
    const conta = () =>
      supabase
        .from('notifiche')
        .select('id', { count: 'exact', head: true })
        .eq('utente_id', profilo.id)
        .is('letta_il', null)
        .then(({ count }) => attivo && setNonLette(count ?? 0))
    void conta()
    const timer = setInterval(conta, 60000)
    return () => {
      attivo = false
      clearInterval(timer)
    }
  }, [profilo, location.pathname])

  return (
    <Link
      to="/notifiche"
      aria-label={nonLette ? `Notifiche, ${nonLette} non lette` : 'Notifiche'}
      className={`relative inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {nonLette > 0 && (
        <span className="absolute top-1 right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
          {nonLette > 99 ? '99+' : nonLette}
        </span>
      )}
    </Link>
  )
}
