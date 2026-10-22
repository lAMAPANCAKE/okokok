import { useAuth, usePermessi } from '../auth/AuthProvider'
import { Tessera } from '../components/aree'
import { areeVisibili } from '../lib/aree'
import { Bottone, Intestazione } from '../components/ui'
import { nomeCompleto } from '../lib/format'

/** Tutte le aree dell'app, a riquadri, raggruppate */
export default function Menu() {
  const { profilo, esci } = useAuth()
  const { isStaff, isAdmin } = usePermessi()

  return (
    <>
      <Intestazione titolo="Tutte le aree" sottotitolo={nomeCompleto(profilo)} />
      <div className="space-y-6">
        {areeVisibili({ isStaff, isAdmin }).map((g) => (
          <section key={g.titolo}>
            <h2 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">{g.titolo}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {g.aree.map((a) => <Tessera key={a.to} {...a} />)}
            </div>
          </section>
        ))}
        <Bottone variante="secondario" className="w-full" onClick={() => void esci()}>Esci</Bottone>
      </div>
    </>
  )
}
