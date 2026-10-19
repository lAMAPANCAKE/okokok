import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { attivaPush, disattivaPush, iscrizioneAttuale, pushSupportato, serveInstallazioneIos } from '../lib/push'
import { messaggioErrore } from '../lib/supabase'
import { Avviso, Bottone, Scheda } from './ui'

/** Attiva/disattiva le notifiche push su questo dispositivo. */
export function ImpostazioniPush() {
  const { profilo } = useAuth()
  const [attive, setAttive] = useState<boolean | null>(null)
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    iscrizioneAttuale().then((s) => setAttive(Boolean(s))).catch(() => setAttive(false))
  }, [])

  async function cambia() {
    setErrore('')
    setInvio(true)
    try {
      if (attive) await disattivaPush()
      else await attivaPush(profilo!.id)
      setAttive(!attive)
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setInvio(false)
    }
  }

  return (
    <Scheda className="mb-6 space-y-3">
      <div>
        <h2 className="font-semibold">Notifiche push</h2>
        <p className="text-sm text-slate-500">Avvisi sul telefono anche ad app chiusa: turni proposti, scadenze, rimborsi, pagamenti.</p>
      </div>
      {!pushSupportato() ? (
        <Avviso tipo="info">Questo browser non supporta le notifiche push, oppure non sono ancora configurate.</Avviso>
      ) : serveInstallazioneIos() ? (
        <Avviso tipo="info">Su iPhone: tocca Condividi → “Aggiungi alla schermata Home”, apri l’app da lì e torna in questa pagina.</Avviso>
      ) : (
        <>
          <p className="text-sm">Su questo dispositivo: <strong>{attive === null ? '…' : attive ? 'attive' : 'disattivate'}</strong></p>
          {errore && <Avviso>{errore}</Avviso>}
          <Bottone variante={attive ? 'secondario' : 'primario'} className="w-full sm:w-auto" caricamento={invio} disabled={attive === null} onClick={() => void cambia()}>
            {attive ? 'Disattiva su questo dispositivo' : 'Attiva le notifiche push'}
          </Bottone>
        </>
      )}
    </Scheda>
  )
}
