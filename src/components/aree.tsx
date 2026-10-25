import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { COLORI, TRACCIATI, type Colore, type NomeIcona } from '../lib/aree'

export function Icona({ nome, className = 'h-6 w-6' }: { nome: NomeIcona; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRACCIATI[nome]} />
    </svg>
  )
}

export function ChipIcona({ icona, colore, piccola }: { icona: NomeIcona; colore: Colore; piccola?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${piccola ? 'h-8 w-8 rounded-lg' : 'h-11 w-11 rounded-xl'} ${COLORI[colore]}`}>
      <Icona nome={icona} className={piccola ? 'h-[18px] w-[18px]' : 'h-6 w-6'} />
    </span>
  )
}

/** Riquadro grande con icona colorata: Home, menu "Altro", strumenti dell'evento */
export function Tessera({ to, icona, colore, etichetta, descrizione, badge, allerta }: {
  to: string
  icona: NomeIcona
  colore: Colore
  etichetta: string
  descrizione?: string
  badge?: ReactNode
  allerta?: boolean
}) {
  return (
    <Link
      to={to}
      className="group relative flex min-h-24 flex-col justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200 transition-colors hover:ring-slate-300 active:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-2">
        <ChipIcona icona={icona} colore={colore} />
        {badge !== undefined && badge !== null && badge !== '' && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${allerta ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{badge}</span>
        )}
      </div>
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-semibold">{etichetta}</span>
        {descrizione && <span className="mt-0.5 block text-xs leading-snug text-slate-500">{descrizione}</span>}
      </span>
    </Link>
  )
}

