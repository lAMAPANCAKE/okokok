import { Link } from 'react-router-dom'
import { useAuth, usePermessi } from '../auth/AuthProvider'
import { Bottone, Intestazione } from '../components/ui'
import { nomeCompleto } from '../lib/format'

/** Le sezioni che sul telefono non stanno nella barra inferiore */
export default function Menu() {
  const { profilo, esci } = useAuth()
  const { isAdmin } = usePermessi()

  const gruppi: { titolo: string; voci: { to: string; etichetta: string; descrizione: string }[] }[] = [
    {
      titolo: 'Commerciale',
      voci: [
        { to: '/crm', etichetta: 'Clienti', descrizione: 'CRM aziende, pipeline e follow-up' },
        { to: '/preventivi', etichetta: 'Preventivi', descrizione: 'Voci, margini, PDF e conversione' },
        { to: '/sopralluoghi', etichetta: 'Sopralluoghi', descrizione: 'Checklist, misure, foto e planimetrie' },
        { to: '/report', etichetta: 'Report margini', descrizione: 'Ricavi, costi reali e margine per evento' },
      ],
    },
    {
      titolo: 'Amministrazione',
      voci: [
        { to: '/rimborsi', etichetta: 'Trasferte e rimborsi', descrizione: 'Approvazioni e pagamenti delle spese' },
        ...(isAdmin
          ? [
              { to: '/fatture', etichetta: 'Fatture e incassi', descrizione: 'Fatture emesse, scadenze e pagamenti ricevuti' },
              { to: '/documenti', etichetta: 'Documenti', descrizione: 'Verifica, scadenze e mancanti' },
              { to: '/admin/utenti', etichetta: 'Utenti', descrizione: 'Inviti, ruoli e tariffe' },
              { to: '/admin/impostazioni', etichetta: 'Impostazioni', descrizione: 'Maggiorazioni, dati aziendali, registro modifiche' },
            ]
          : []),
      ],
    },
    {
      titolo: 'Account',
      voci: [
        { to: '/notifiche', etichetta: 'Notifiche', descrizione: 'Turni, scadenze, rimborsi, follow-up' },
        { to: '/profilo', etichetta: 'Profilo', descrizione: nomeCompleto(profilo) },
      ],
    },
  ]

  return (
    <>
      <Intestazione titolo="Altro" />
      <div className="space-y-5">
        {gruppi.map((g) => (
          <section key={g.titolo}>
            <h2 className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">{g.titolo}</h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {g.voci.map((v) => (
                <li key={v.to}>
                  <Link to={v.to} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block font-medium">{v.etichetta}</span>
                      <span className="block truncate text-sm text-slate-500">{v.descrizione}</span>
                    </span>
                    <span className="text-slate-400" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Bottone variante="secondario" className="w-full" onClick={() => void esci()}>Esci</Bottone>
      </div>
    </>
  )
}
