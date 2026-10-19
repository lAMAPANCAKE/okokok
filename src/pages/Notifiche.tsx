import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Avviso, Bottone, Caricamento, Intestazione, Vuoto } from '../components/ui'
import { supabase } from '../lib/supabase'
import type { Notifica } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'

function quando(iso: string) {
  const d = new Date(iso)
  const minuti = Math.round((Date.now() - d.getTime()) / 60000)
  if (minuti < 1) return 'adesso'
  if (minuti < 60) return `${minuti} min fa`
  if (minuti < 24 * 60) return `${Math.round(minuti / 60)} h fa`
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

export default function Notifiche() {
  const { profilo } = useAuth()
  const navigate = useNavigate()

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    return oppureErrore(await supabase.from('notifiche').select('*').eq('utente_id', profilo!.id).order('creato_il', { ascending: false }).limit(100)) as Notifica[]
  }, [profilo?.id])

  const nonLette = dati?.filter((n) => !n.letta_il).length ?? 0

  async function segnaTutte() {
    await supabase.from('notifiche').update({ letta_il: new Date().toISOString() }).eq('utente_id', profilo!.id).is('letta_il', null)
    await ricarica()
  }

  async function apri(n: Notifica) {
    if (!n.letta_il) await supabase.from('notifiche').update({ letta_il: new Date().toISOString() }).eq('id', n.id)
    if (n.link) navigate(n.link)
    else await ricarica()
  }

  return (
    <>
      <Intestazione
        titolo="Notifiche"
        sottotitolo={nonLette ? `${nonLette} da leggere` : undefined}
        azione={nonLette > 0 && <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => void segnaTutte()}>Segna tutte lette</Bottone>}
      />
      {errore && <Avviso>{errore}</Avviso>}
      {caricamento ? (
        <Caricamento />
      ) : !dati?.length ? (
        <Vuoto titolo="Nessuna notifica" testo="Qui trovi turni proposti, scadenze dei documenti, rimborsi e pagamenti." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {dati.map((n) => (
            <li key={n.id}>
              <button onClick={() => void apri(n)} className={`flex w-full gap-3 p-4 text-left hover:bg-slate-50 ${n.letta_il ? '' : 'bg-brand-50/60'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.letta_il ? 'bg-transparent' : 'bg-brand-500'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`min-w-0 break-words ${n.letta_il ? '' : 'font-semibold'}`}>{n.titolo}</span>
                    <span className="shrink-0 text-xs text-slate-500">{quando(n.creato_il)}</span>
                  </span>
                  {n.testo && <span className="mt-0.5 block text-sm text-slate-600">{n.testo}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
