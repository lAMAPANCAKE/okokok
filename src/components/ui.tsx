import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import type { StatoEvento, StatoTurno } from '../lib/types'

type Variante = 'primario' | 'secondario' | 'pericolo' | 'fantasma'

const stiliVariante: Record<Variante, string> = {
  primario: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300 disabled:text-slate-600',
  secondario: 'bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  pericolo: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  fantasma: 'text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
}

export function Bottone({
  variante = 'primario',
  caricamento,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; caricamento?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || caricamento}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${stiliVariante[variante]} ${className}`}
    >
      {caricamento && <Spinner piccolo />}
      {children}
    </button>
  )
}

export function Campo({ etichetta, aiuto, errore, children }: { etichetta: string; aiuto?: string; errore?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{etichetta}</span>
      {children}
      {aiuto && !errore && <span className="mt-1 block text-xs text-slate-500">{aiuto}</span>}
      {errore && <span className="mt-1 block text-xs text-red-600">{errore}</span>}
    </label>
  )
}

const stileInput =
  'block w-full min-h-12 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-slate-100'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${stileInput} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${stileInput} ${props.className ?? ''}`} />
}

export function AreaTesto(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${stileInput} ${props.className ?? ''}`} />
}

export function Scheda({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 ring-1 ring-slate-200 ${className}`}>{children}</div>
}

export function SchedaLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block rounded-2xl bg-white p-4 ring-1 ring-slate-200 transition-colors hover:ring-slate-300 active:bg-slate-50">
      {children}
    </Link>
  )
}

export function Spinner({ piccolo }: { piccolo?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Caricamento"
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${piccolo ? 'h-4 w-4' : 'h-8 w-8 text-slate-400'}`}
    />
  )
}

export function Caricamento() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  )
}

export function Vuoto({ titolo, testo, azione }: { titolo: string; testo?: string; azione?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center">
      <p className="font-medium text-slate-700">{titolo}</p>
      {testo && <p className="mt-1 text-sm text-slate-500">{testo}</p>}
      {azione && <div className="mt-4">{azione}</div>}
    </div>
  )
}

export function Avviso({ tipo = 'errore', children }: { tipo?: 'errore' | 'successo' | 'info'; children: ReactNode }) {
  const stile = {
    errore: 'bg-red-50 text-red-800 ring-red-200',
    successo: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    info: 'bg-brand-50 text-brand-700 ring-brand-100',
  }[tipo]
  return (
    <div role={tipo === 'errore' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm ring-1 ${stile}`}>
      {children}
    </div>
  )
}

export function Intestazione({ titolo, sottotitolo, azione, indietro }: { titolo: string; sottotitolo?: string; azione?: ReactNode; indietro?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {indietro && (
          <Link to={indietro} className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm text-slate-600 hover:text-slate-900">
            ← Indietro
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{titolo}</h1>
        {sottotitolo && <p className="mt-0.5 text-sm text-slate-500">{sottotitolo}</p>}
      </div>
      {azione && <div className="shrink-0">{azione}</div>}
    </div>
  )
}

const coloriTurno: Record<StatoTurno, string> = {
  proposto: 'bg-amber-100 text-amber-800',
  confermato: 'bg-emerald-100 text-emerald-800',
  rifiutato: 'bg-red-100 text-red-800',
  completato: 'bg-slate-200 text-slate-700',
  annullato: 'bg-slate-100 text-slate-500 line-through',
}
const etichetteTurno: Record<StatoTurno, string> = {
  proposto: 'Da confermare',
  confermato: 'Confermato',
  rifiutato: 'Rifiutato',
  completato: 'Completato',
  annullato: 'Annullato',
}

export function BadgeTurno({ stato }: { stato: StatoTurno }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${coloriTurno[stato]}`}>{etichetteTurno[stato]}</span>
}

const coloriEvento: Record<StatoEvento, string> = {
  pianificato: 'bg-brand-100 text-brand-700',
  concluso: 'bg-slate-200 text-slate-700',
  annullato: 'bg-slate-100 text-slate-500',
}

export function BadgeEvento({ stato }: { stato: StatoEvento }) {
  const testo = { pianificato: 'Pianificato', concluso: 'Concluso', annullato: 'Annullato' }[stato]
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${coloriEvento[stato]}`}>{testo}</span>
}

export function Statistica({ etichetta, valore, evidenzia }: { etichetta: string; valore: ReactNode; evidenzia?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${evidenzia ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-slate-200'}`}>
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{etichetta}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valore}</p>
    </div>
  )
}
