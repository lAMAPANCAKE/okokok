import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth, usePermessi } from '../auth/AuthProvider'
import { avviaCoda } from '../lib/coda'
import { nomeCompleto } from '../lib/format'
import { Campanella } from './Notifiche'

type Icona = 'home' | 'turni' | 'eventi' | 'clienti' | 'preventivi' | 'sopralluoghi' | 'compensi' | 'rimborsi' | 'documenti' | 'utenti' | 'profilo' | 'altro' | 'report' | 'fatture'

const tracciati: Record<Icona, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  turni: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 9 2 2 4-4',
  eventi: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 7h3v3H8z',
  compensi: 'M4 7h16v10H4zM4 10h16M8 14h3',
  clienti: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4',
  altro: 'M5 12h.01M12 12h.01M19 12h.01',
  report: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  preventivi: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 12h6M9 16h4M14 16h1',
  sopralluoghi: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  rimborsi: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  fatture: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M14 11.5a2.5 2.5 0 1 0 0 4M9.5 13h3M9.5 14.5h3',
  documenti: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 13h6M9 17h6',
  utenti: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74',
  profilo: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
}

function IconaNav({ nome }: { nome: Icona }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={tracciati[nome]} />
    </svg>
  )
}

interface Voce {
  to: string
  etichetta: string
  icona: Icona
  /** visibile anche nella barra inferiore del telefono (massimo 5 voci) */
  mobile: boolean
}

export function Layout() {
  const { profilo } = useAuth()
  const { isStaff, isAdmin } = usePermessi()
  // Invia foto e zone salvate senza rete appena c'è connessione
  useEffect(() => (isStaff ? avviaCoda() : undefined), [isStaff])

  // I responsabili non accedono ai documenti personali (GDPR).
  // Sul telefono lo staff ha 4 sezioni principali + "Altro" con il resto.
  const voci: Voce[] = isStaff
    ? [
        { to: '/', etichetta: 'Home', icona: 'home', mobile: true },
        { to: '/eventi', etichetta: 'Eventi', icona: 'eventi', mobile: true },
        { to: '/disponibilita-personale', etichetta: 'Disponibilità personale', icona: 'turni', mobile: false },
        { to: '/crm', etichetta: 'Clienti', icona: 'clienti', mobile: true },
        { to: '/preventivi', etichetta: 'Preventivi', icona: 'preventivi', mobile: false },
        { to: '/sopralluoghi', etichetta: 'Sopralluoghi', icona: 'sopralluoghi', mobile: false },
        { to: '/report', etichetta: 'Report margini', icona: 'report', mobile: false },
        { to: '/compensi', etichetta: 'Compensi', icona: 'compensi', mobile: true },
        { to: '/rimborsi', etichetta: 'Rimborsi', icona: 'rimborsi', mobile: false },
        ...(isAdmin
          ? [
              { to: '/fatture', etichetta: 'Fatture e incassi', icona: 'fatture', mobile: false } satisfies Voce,
              { to: '/documenti', etichetta: 'Documenti', icona: 'documenti', mobile: false } satisfies Voce,
              { to: '/admin/utenti', etichetta: 'Utenti', icona: 'utenti', mobile: false } satisfies Voce,
            ]
          : []),
        { to: '/profilo', etichetta: 'Profilo', icona: 'profilo', mobile: false },
        { to: '/menu', etichetta: 'Altro', icona: 'altro', mobile: true },
      ]
    : [
        { to: '/', etichetta: 'Home', icona: 'home', mobile: true },
        { to: '/turni', etichetta: 'Turni', icona: 'turni', mobile: true },
        { to: '/disponibilita', etichetta: 'Disponibilità', icona: 'eventi', mobile: false },
        { to: '/compensi', etichetta: 'Compensi', icona: 'compensi', mobile: true },
        { to: '/documenti', etichetta: 'Documenti', icona: 'documenti', mobile: true },
        { to: '/rimborsi', etichetta: 'Rimborsi', icona: 'rimborsi', mobile: false },
        { to: '/profilo', etichetta: 'Profilo', icona: 'profilo', mobile: true },
      ]

  return (
    <div className="min-h-dvh md:flex">
      {/* Navigazione laterale su schermi larghi */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col print:hidden">
        <div className="flex items-start justify-between gap-2 px-5 py-5">
          <div className="min-w-0">
            <p className="text-lg font-semibold">Gestionale Eventi</p>
            <p className="truncate text-sm text-slate-500">{nomeCompleto(profilo)}</p>
          </div>
          <Campanella className="-mt-2 -mr-2" />
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {voci.filter((v) => v.to !== '/menu').map((v) => (
            <NavLink
              key={v.to}
              to={v.to}
              end={v.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
              }
            >
              <IconaNav nome={v.icona} />
              {v.etichetta}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Barra superiore su telefono */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-1.5 backdrop-blur md:hidden print:hidden">
          <span className="font-semibold">Gestionale Eventi</span>
          <Campanella />
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Barra inferiore su telefono: raggiungibile col pollice */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden print:hidden" aria-label="Navigazione principale">
        <ul className="mx-auto flex max-w-lg justify-around">
          {voci
            .filter((v) => v.mobile)
            .map((v) => (
              <li key={v.to} className="flex-1">
                <NavLink
                  to={v.to}
                  end={v.to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-medium ${isActive ? 'text-slate-900' : 'text-slate-500'}`
                  }
                >
                  <IconaNav nome={v.icona} />
                  {v.etichetta}
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  )
}
