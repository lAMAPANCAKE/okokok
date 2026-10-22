import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth, usePermessi } from '../auth/AuthProvider'
import { avviaCoda } from '../lib/coda'
import { nomeCompleto } from '../lib/format'
import { AZIONI_NUOVO, areeVisibili, type Colore, type NomeIcona } from '../lib/aree'
import { ChipIcona, Icona } from './aree'
import { Campanella } from './Notifiche'

interface VoceBarra {
  to: string
  etichetta: string
  icona: NomeIcona
}

export function Layout() {
  const { profilo } = useAuth()
  const { isStaff, isAdmin } = usePermessi()
  const [nuovoAperto, setNuovoAperto] = useState(false)
  const location = useLocation()
  // Invia foto e zone salvate senza rete appena c'è connessione
  useEffect(() => (isStaff ? avviaCoda() : undefined), [isStaff])
  // Cambiando pagina il foglio "Nuovo" si chiude
  useEffect(() => setNuovoAperto(false), [location.pathname])

  const gruppi = areeVisibili({ isStaff, isAdmin })

  // Barra del telefono: le 4 sezioni più usate; per lo staff il + al centro crea al volo
  const barra: (VoceBarra | 'nuovo')[] = isStaff
    ? [
        { to: '/', etichetta: 'Home', icona: 'home' },
        { to: '/eventi', etichetta: 'Eventi', icona: 'eventi' },
        'nuovo',
        { to: '/disponibilita-personale', etichetta: 'Personale', icona: 'utenti' },
        { to: '/menu', etichetta: 'Tutto', icona: 'altro' },
      ]
    : [
        { to: '/', etichetta: 'Home', icona: 'home' },
        { to: '/turni', etichetta: 'Turni', icona: 'turni' },
        { to: '/compensi', etichetta: 'Compensi', icona: 'compensi' },
        { to: '/documenti', etichetta: 'Documenti', icona: 'documenti' },
        { to: '/menu', etichetta: 'Tutto', icona: 'altro' },
      ]

  return (
    <div className="min-h-dvh md:flex">
      {/* Navigazione laterale su schermi larghi */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white md:flex md:flex-col print:hidden">
        <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-3">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <Icona nome="eventi" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate leading-tight font-semibold">Gestionale Eventi</span>
              <span className="block truncate text-xs text-slate-500">{nomeCompleto(profilo)}</span>
            </span>
          </Link>
          <Campanella className="-mt-1 -mr-2" />
        </div>
        {isStaff && (
          <div className="px-3 pb-2">
            <button
              type="button"
              onClick={() => setNuovoAperto(true)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Icona nome="piu" className="h-5 w-5" /> Nuovo
            </button>
          </div>
        )}
        <nav className="flex flex-col gap-4 px-3 pt-2 pb-6">
          <VoceLaterale to="/" etichetta="Home" icona="home" colore="slate" />
          {gruppi.map((g) => (
            <div key={g.titolo}>
              <p className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{g.titolo}</p>
              <div className="flex flex-col gap-0.5">
                {g.aree.map((a) => <VoceLaterale key={a.to} to={a.to} etichetta={a.etichetta} icona={a.icona} colore={a.colore} />)}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Barra superiore su telefono */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-1.5 backdrop-blur md:hidden print:hidden">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
              <Icona nome="eventi" className="h-4 w-4" />
            </span>
            Gestionale Eventi
          </Link>
          <Campanella />
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Barra inferiore su telefono: raggiungibile col pollice */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden print:hidden" aria-label="Navigazione principale">
        <ul className="mx-auto flex max-w-lg items-end justify-around">
          {barra.map((v) =>
            v === 'nuovo' ? (
              <li key="nuovo" className="flex flex-1 justify-center">
                <button
                  type="button"
                  onClick={() => setNuovoAperto(true)}
                  aria-label="Crea nuovo"
                  className="-mt-5 mb-1 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 active:scale-95"
                >
                  <Icona nome="piu" className="h-7 w-7" />
                </button>
              </li>
            ) : (
              <li key={v.to} className="flex-1">
                <NavLink
                  to={v.to}
                  end={v.to === '/'}
                  className={({ isActive }) => `flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}
                >
                  {({ isActive }) => (
                    <>
                      <span className={`inline-flex h-7 w-12 items-center justify-center rounded-full ${isActive ? 'bg-indigo-100' : ''}`}>
                        <Icona nome={v.icona} />
                      </span>
                      {v.etichetta}
                    </>
                  )}
                </NavLink>
              </li>
            ),
          )}
        </ul>
      </nav>

      {nuovoAperto && <FoglioNuovo onChiudi={() => setNuovoAperto(false)} />}
    </div>
  )
}

function VoceLaterale({ to, etichetta, icona, colore }: VoceBarra & { colore: Colore }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
    >
      <ChipIcona icona={icona} colore={colore} piccola />
      {etichetta}
    </NavLink>
  )
}

/** Foglio "Nuovo": dal basso sul telefono, al centro su schermi larghi */
function FoglioNuovo({ onChiudi }: { onChiudi: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onChiudi])
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm md:items-center print:hidden" onClick={onChiudi}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crea nuovo"
        className="pb-safe w-full max-w-md rounded-t-3xl bg-white p-4 shadow-xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden" />
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="font-semibold">Crea nuovo</p>
          <button type="button" onClick={onChiudi} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Chiudi">✕</button>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {AZIONI_NUOVO.map((a) => (
            <li key={a.to}>
              <Link to={a.to} className="flex h-full flex-col gap-2 rounded-2xl p-3 ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100">
                <ChipIcona icona={a.icona} colore={a.colore} />
                <span>
                  <span className="block text-sm font-semibold">{a.etichetta}</span>
                  <span className="block text-xs text-slate-500">{a.descrizione}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
