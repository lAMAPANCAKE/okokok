import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ModuloProfilo } from '../../components/ModuloProfilo'
import { Avviso, Caricamento } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { GuscioAuth } from './Login'
import { CampiNuovaPassword } from './ReimpostaPassword'

/** Primo accesso da invito: password + anagrafica completata dal collaboratore. */
export default function Benvenuto() {
  const { session, profilo, caricamento, ricaricaProfilo } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')

  if (caricamento) return <Caricamento />
  if (!session || !profilo) {
    return (
      <GuscioAuth titolo="Invito non valido">
        <Avviso>Il link di invito è scaduto o è già stato usato. Chiedi all’amministrazione un nuovo invito.</Avviso>
      </GuscioAuth>
    )
  }

  if (!profilo.attivo) {
    return (
      <GuscioAuth titolo="Account non attivo">
        <Avviso tipo="info">Il tuo account non è ancora stato abilitato. Contatta l’amministrazione.</Avviso>
      </GuscioAuth>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <img src="/icon.svg" alt="" className="mb-6 h-12 w-12" />
      <h1 className="text-2xl font-semibold tracking-tight">Benvenuto!</h1>
      <p className="mt-1 mb-6 text-slate-500">Scegli una password e completa il tuo profilo: servono per assegnarti i turni e pagarti.</p>
      <ModuloProfilo
        profilo={profilo}
        etichettaSalva="Completa registrazione"
        intestazione={
          <section className="space-y-4">
            <h2 className="font-semibold">Password di accesso</h2>
            <CampiNuovaPassword password={password} conferma={conferma} onPassword={setPassword} onConferma={setConferma} />
          </section>
        }
        validaExtra={() => {
          if (password.length < 8) return 'La password deve avere almeno 8 caratteri'
          if (password !== conferma) return 'Le password non coincidono'
          return null
        }}
        primaDiSalvare={async () => {
          const { error } = await supabase.auth.updateUser({ password })
          if (error) throw error
        }}
        dopoSalvataggio={async () => {
          await ricaricaProfilo()
          navigate('/', { replace: true })
        }}
      />
    </div>
  )
}
