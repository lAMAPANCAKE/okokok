// Ordine di servizio dell'evento: scaletta, menù con allergeni, intolleranze, checklist.

export interface RigaScaletta { ora: string; attivita: string; zona?: string; note?: string }
export interface Piatto { portata: string; piatto: string; allergeni: number[]; note?: string }
export interface Intolleranza { tipo: string; numero: number; note?: string }
export interface VoceChecklistMontaggio { zona: string; voce: string; fatto: boolean }

export interface OrdineServizio {
  evento_id: string
  scaletta: RigaScaletta[]
  menu: Piatto[]
  intolleranze: Intolleranza[]
  checklist: VoceChecklistMontaggio[]
  dress_code: string | null
  note: string | null
  updated_at?: string
}

/** I 14 allergeni del Reg. UE 1169/2011 (Allegato II), con il numero usato nei menù. */
export const ALLERGENI: { n: number; nome: string; breve: string }[] = [
  { n: 1, nome: 'Cereali con glutine', breve: 'Glutine' },
  { n: 2, nome: 'Crostacei', breve: 'Crostacei' },
  { n: 3, nome: 'Uova', breve: 'Uova' },
  { n: 4, nome: 'Pesce', breve: 'Pesce' },
  { n: 5, nome: 'Arachidi', breve: 'Arachidi' },
  { n: 6, nome: 'Soia', breve: 'Soia' },
  { n: 7, nome: 'Latte e lattosio', breve: 'Latte' },
  { n: 8, nome: 'Frutta a guscio', breve: 'Frutta guscio' },
  { n: 9, nome: 'Sedano', breve: 'Sedano' },
  { n: 10, nome: 'Senape', breve: 'Senape' },
  { n: 11, nome: 'Semi di sesamo', breve: 'Sesamo' },
  { n: 12, nome: 'Anidride solforosa e solfiti', breve: 'Solfiti' },
  { n: 13, nome: 'Lupini', breve: 'Lupini' },
  { n: 14, nome: 'Molluschi', breve: 'Molluschi' },
]

export const PORTATE = ['Aperitivo', 'Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dessert', 'Torta', 'Coffee break', 'Bevande', 'Open bar']

export const INTOLLERANZE_COMUNI = ['Celiachia', 'Intolleranza al lattosio', 'Vegetariano', 'Vegano', 'Allergia alla frutta a guscio', 'Allergia ai crostacei', 'Senza maiale', 'Menù bambini', 'Gravidanza']

// Scalette tipo: minuti rispetto all'inizio dell'evento
const SCALETTE: Record<string, [number, string][]> = {
  Matrimonio: [
    [-240, 'Montaggio e allestimento'], [-60, 'Briefing dello staff'], [0, 'Arrivo ospiti e aperitivo di benvenuto'], [90, 'Ospiti a tavola: antipasti'],
    [150, 'Primi'], [195, 'Secondi'], [255, 'Taglio della torta'], [270, 'Buffet dei dolci e open bar'], [360, 'Fine servizio'], [390, 'Smontaggio'],
  ],
  'Cena di gala': [
    [-180, 'Montaggio e allestimento'], [-60, 'Briefing dello staff'], [0, 'Accoglienza e welcome drink'], [45, 'Ospiti a tavola: antipasto'],
    [90, 'Interventi e saluti'], [105, 'Primo'], [135, 'Secondo'], [180, 'Dessert e caffè'], [240, 'Fine servizio'], [255, 'Smontaggio'],
  ],
  Aperitivo: [
    [-120, 'Montaggio e allestimento'], [-30, 'Briefing dello staff'], [0, 'Apertura bar e buffet'], [30, 'Passaggio finger food'],
    [90, 'Saluto / discorso'], [150, 'Chiusura bar'], [165, 'Smontaggio'],
  ],
  'Convention con coffee break': [
    [-90, 'Montaggio e allestimento'], [-15, 'Briefing dello staff'], [0, 'Welcome coffee'], [120, 'Coffee break'],
    [210, 'Pranzo a buffet'], [360, 'Coffee break pomeridiano'], [420, 'Smontaggio'],
  ],
}
export const SCALETTE_TIPO = Object.keys(SCALETTE)

const aOra = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function scalettaTipo(nome: string, oraInizio: string | null): RigaScaletta[] {
  const [h, m] = (oraInizio ?? '19:00').split(':').map(Number)
  const base = (h || 0) * 60 + (m || 0)
  return (SCALETTE[nome] ?? []).map(([delta, attivita]) => ({ ora: aOra(base + delta), attivita }))
}

export const ordinaScaletta = (s: RigaScaletta[]) => [...s].sort((a, b) => (a.ora || '99').localeCompare(b.ora || '99'))

export const ordineVuoto = (eventoId: string): OrdineServizio => ({ evento_id: eventoId, scaletta: [], menu: [], intolleranze: [], checklist: [], dress_code: null, note: null })
