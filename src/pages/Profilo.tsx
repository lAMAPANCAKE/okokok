import { useAuth } from '../auth/AuthProvider'
import { ImpostazioniPush } from '../components/ImpostazioniPush'
import { ModuloProfilo } from '../components/ModuloProfilo'
import { Bottone, Intestazione, Scheda } from '../components/ui'
import { formatEuro } from '../lib/format'
import { ETICHETTA_RUOLO } from '../lib/types'

export default function Profilo() {
  const { profilo, ricaricaProfilo, esci } = useAuth()
  if (!profilo) return null

  return (
    <>
      <Intestazione titolo="Profilo" sottotitolo={profilo.email} />
      <Scheda className="mb-6 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Ruolo</p>
          <p className="font-medium">{ETICHETTA_RUOLO[profilo.ruolo]}</p>
        </div>
        <div>
          <p className="text-slate-500">Tariffa oraria</p>
          <p className="font-medium">{formatEuro(profilo.tariffa_oraria)}</p>
        </div>
        <p className="col-span-2 text-xs text-slate-500">Ruolo e tariffa sono assegnati dall’amministrazione.</p>
      </Scheda>
      <ImpostazioniPush />
      <ModuloProfilo profilo={profilo} dopoSalvataggio={() => void ricaricaProfilo()} />
      <Bottone variante="secondario" className="mt-10 w-full" onClick={() => void esci()}>
        Esci
      </Bottone>
    </>
  )
}
