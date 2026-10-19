import { NavLink } from 'react-router-dom'
import { ETICHETTA_PIPELINE, ETICHETTA_PREVENTIVO, type StatoPipeline, type StatoPreventivo } from '../lib/types'

/** Sotto-navigazione dell'area commerciale */
export function SchedeCommerciale() {
  const voci = [
    { to: '/crm', etichetta: 'Clienti' },
    { to: '/preventivi', etichetta: 'Preventivi' },
    { to: '/sopralluoghi', etichetta: 'Sopralluoghi' },
  ]
  return (
    <nav className="mb-4 grid grid-cols-3 rounded-xl bg-slate-200/70 p-1 text-sm font-medium" aria-label="Area commerciale">
      {voci.map((v) => (
        <NavLink key={v.to} to={v.to} className={({ isActive }) => `flex min-h-10 items-center justify-center rounded-lg ${isActive ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
          {v.etichetta}
        </NavLink>
      ))}
    </nav>
  )
}

const coloriPipeline: Record<StatoPipeline, string> = {
  da_contattare: 'bg-slate-100 text-slate-700',
  contattato: 'bg-brand-100 text-brand-700',
  in_trattativa: 'bg-amber-100 text-amber-800',
  cliente_attivo: 'bg-emerald-100 text-emerald-800',
  perso: 'bg-red-100 text-red-800',
}

export function BadgePipeline({ stato }: { stato: StatoPipeline }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${coloriPipeline[stato]}`}>{ETICHETTA_PIPELINE[stato]}</span>
}

const coloriPreventivo: Record<StatoPreventivo, string> = {
  bozza: 'bg-slate-100 text-slate-700',
  inviato: 'bg-brand-100 text-brand-700',
  accettato: 'bg-emerald-100 text-emerald-800',
  rifiutato: 'bg-red-100 text-red-800',
  perso: 'bg-slate-200 text-slate-600',
}

export function BadgePreventivo({ stato }: { stato: StatoPreventivo }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${coloriPreventivo[stato]}`}>{ETICHETTA_PREVENTIVO[stato]}</span>
}

/** Tasso di conversione: accettati sui preventivi con esito (accettati + rifiutati + persi) */
export function tassoConversione(stati: StatoPreventivo[]) {
  const accettati = stati.filter((s) => s === 'accettato').length
  const chiusi = stati.filter((s) => s === 'accettato' || s === 'rifiutato' || s === 'perso').length
  return chiusi ? Math.round((accettati / chiusi) * 100) : null
}
