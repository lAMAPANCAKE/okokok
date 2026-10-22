// Disponibilità del personale giorno per giorno: libero, impegnato in un evento
// (turno proposto o confermato) oppure non disponibile (segnato dal collaboratore).
import { supabase } from './supabase'
import type { Indisponibilita, Profilo, StatoTurno } from './types'
import { oppureErrore } from './useDati'

export type StatoGiorno =
  | { tipo: 'libero' }
  | { tipo: 'impegnato'; evento: string; eventoId: string; stato: StatoTurno; orario: string }
  | { tipo: 'non_disponibile'; nota: string | null }

export type PersonaDisponibilita = Pick<Profilo, 'id' | 'nome' | 'cognome' | 'email' | 'competenze' | 'tariffa_oraria' | 'ruolo'>

export interface Disponibilita {
  persone: PersonaDisponibilita[]
  /** collaboratore → giorno ISO → stato */
  stati: Map<string, Map<string, StatoGiorno>>
}

/** Carica persone attive e i loro impegni tra due date (estremi inclusi). */
export async function caricaDisponibilita(dal: string, al: string): Promise<Disponibilita> {
  const [pe, tu, ind] = await Promise.all([
    supabase.from('profiles').select('id, nome, cognome, email, competenze, tariffa_oraria, ruolo').eq('attivo', true).eq('ruolo', 'collaboratore').order('cognome').order('nome'),
    supabase.from('turni').select('collaboratore_id, data, stato, ora_inizio, ora_fine, evento_id, eventi(nome)').gte('data', dal).lte('data', al).in('stato', ['proposto', 'confermato', 'completato']),
    supabase.from('indisponibilita').select('*').gte('data', dal).lte('data', al),
  ])
  const stati = new Map<string, Map<string, StatoGiorno>>()
  const metti = (persona: string, giorno: string, s: StatoGiorno) => {
    if (!stati.has(persona)) stati.set(persona, new Map())
    stati.get(persona)!.set(giorno, s)
  }
  for (const i of oppureErrore(ind) as Indisponibilita[]) metti(i.collaboratore_id, i.data, { tipo: 'non_disponibile', nota: i.nota })
  // Un turno vince sull'indisponibilità: va gestito il conflitto, quindi si mostra l'impegno
  for (const t of oppureErrore(tu) as unknown as { collaboratore_id: string; data: string; stato: StatoTurno; ora_inizio: string; ora_fine: string; evento_id: string; eventi: { nome: string } | null }[]) {
    metti(t.collaboratore_id, t.data, { tipo: 'impegnato', evento: t.eventi?.nome ?? 'Evento', eventoId: t.evento_id, stato: t.stato, orario: `${t.ora_inizio.slice(0, 5)}–${t.ora_fine.slice(0, 5)}` })
  }
  return { persone: oppureErrore(pe) as PersonaDisponibilita[], stati }
}

export const statoDi = (d: Disponibilita, persona: string, giorno: string): StatoGiorno => d.stati.get(persona)?.get(giorno) ?? { tipo: 'libero' }
