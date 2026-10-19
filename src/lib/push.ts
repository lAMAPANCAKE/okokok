import { supabase } from './supabase'

const chiavePubblica = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushSupportato = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(chiavePubblica)

/** iPhone/iPad: i push funzionano solo con l'app aggiunta alla schermata Home (iOS 16.4+). */
export const serveInstallazioneIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches

function base64UrlInUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Service worker registrato (assente in sviluppo con `npm run dev`: i push si provano con build/anteprima o online). */
async function registrazione() {
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function iscrizioneAttuale() {
  if (!pushSupportato()) return null
  const reg = await registrazione()
  return reg ? reg.pushManager.getSubscription() : null
}

/** Chiede il permesso, iscrive questo dispositivo e salva l'iscrizione. */
export async function attivaPush(utenteId: string) {
  if (!pushSupportato()) throw new Error('Notifiche push non supportate su questo browser')
  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') throw new Error('Permesso negato: abilitalo dalle impostazioni del browser per questo sito')
  const reg = await registrazione()
  if (!reg) throw new Error('Service worker non attivo: i push funzionano nell’app pubblicata (o con npm run build && npm run preview)')
  const iscrizione =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlInUint8(chiavePubblica!) }))
  const json = iscrizione.toJSON()
  const { error } = await supabase.from('push_iscrizioni').upsert(
    { utente_id: utenteId, endpoint: iscrizione.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '', dispositivo: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function disattivaPush() {
  const iscrizione = await iscrizioneAttuale()
  if (!iscrizione) return
  await supabase.from('push_iscrizioni').delete().eq('endpoint', iscrizione.endpoint)
  await iscrizione.unsubscribe()
}
