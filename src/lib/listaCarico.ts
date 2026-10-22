// Lista di carico dell'evento: attrezzature e materiali divisi per reparto,
// calcolati da sala 3D (tavoli, sedie, coperti), menù dell'ordine di servizio e zone del sopralluogo.
import { normalizzaAllestimento, riepilogo, voceCatalogo, type Allestimento, type TipoArredo } from './allestimento'
import type { Piatto } from './ordineServizio'
import type { ZonaSopralluogo } from './zone'

export type Reparto = 'sala' | 'bar' | 'cucina' | 'allestimento' | 'consumabili'

export const REPARTI: { reparto: Reparto; nome: string; icona: string; descrizione: string }[] = [
  { reparto: 'sala', nome: 'Sala', icona: '🍽️', descrizione: 'food · tavoli, tovagliato, mise en place' },
  { reparto: 'bar', nome: 'Bar', icona: '🍸', descrizione: 'beverage · banconi, frigo, bicchieri' },
  { reparto: 'cucina', nome: 'Cucina', icona: '👨‍🍳', descrizione: 'food · attrezzature e contenitori' },
  { reparto: 'allestimento', nome: 'Allestimento', icona: '✨', descrizione: 'palco, luci, gazebo, decori' },
  { reparto: 'consumabili', nome: 'Consumabili', icona: '🧻', descrizione: 'ghiaccio, monouso, pulizia' },
]

export interface VoceCarico {
  chiave: string
  reparto: Reparto
  voce: string
  quantita: number
  unita?: string
  note?: string
  caricato: boolean
  /** Generata in automatico: si ricalcola con "Aggiorna"; le voci a mano restano */
  auto?: boolean
}

export interface ListaCarico {
  evento_id: string
  voci: VoceCarico[]
  coperti: number | null
  ospiti: number | null
  scorta_pct: number
}

const TAVOLI_SALA: TipoArredo[] = ['tondo_150', 'tondo_180', 'rettangolare', 'quadrato', 'imperiale', 'sposi']
const TAVOLI_SERVIZIO: TipoArredo[] = ['buffet', 'torta', 'confettata', 'regali', 'coffee']
// Arredi del 3D che vanno caricati come allestimento (non tavoli, sedute o strutture della location)
const ALLESTIMENTO: TipoArredo[] = ['palco', 'pista', 'dj', 'cassa', 'lounge', 'arco', 'arco_palloncini', 'palloncini', 'tappeto', 'lanterna', 'tableau', 'photobooth', 'gazebo', 'pianta', 'pianoforte', 'schermo', 'leggio', 'rollup']

// Voci delle zone che appartengono a un reparto diverso da quello della zona
const VOCI_ZONA_REPARTO: Partial<Record<ZonaSopralluogo['tipo'], Reparto>> = {
  bar: 'bar', cucina: 'cucina', buffet: 'cucina', sbarazzo: 'sala', back: 'allestimento', sala: 'sala', ingresso: 'allestimento', esterno: 'allestimento',
}
// Voci delle zone già coperte dal calcolo da sala e menù
const GIA_CALCOLATE = /tavoli|sedie|tovagli|mise en place|centrotavola/i

/** Giri di piatti, posate e bicchieri per portata (per coperto). */
function giri(menu: Piatto[]) {
  const portate = new Set(menu.map((m) => m.portata))
  // Senza menù: servizio classico con antipasto, primo, secondo e dolce
  const p = portate.size ? portate : new Set(['Antipasti', 'Primi', 'Secondi', 'Dessert'])
  const g = { piani: 0, fondi: 0, dessert: 0, forchette: 0, coltelli: 0, cucchiai: 0, posateDessert: 0, tazzine: 0, piattiniAperitivo: 0 }
  if (p.has('Antipasti')) { g.piani++; g.forchette++; g.coltelli++ }
  if (p.has('Primi')) { g.fondi++; g.forchette++; g.cucchiai++ }
  if (p.has('Secondi')) { g.piani++; g.forchette++; g.coltelli++ }
  if (p.has('Contorni')) g.piani++
  if (p.has('Dessert') || p.has('Torta')) { g.dessert++; g.posateDessert++ }
  if (p.has('Coffee break')) g.tazzine++
  if (p.has('Aperitivo')) g.piattiniAperitivo++
  return { g, brindisi: p.has('Torta') || p.has('Aperitivo') }
}

export function generaListaCarico(opz: {
  allestimento: Partial<Allestimento> | null
  zone: ZonaSopralluogo[]
  menu: Piatto[]
  coperti: number
  ospiti: number
  scortaPct: number
}): VoceCarico[] {
  const a = opz.allestimento ? normalizzaAllestimento(opz.allestimento, null) : null
  const r = a ? riepilogo(a) : null
  const conta = (tipi: TipoArredo[]) => a?.oggetti.filter((o) => tipi.includes(o.tipo)).length ?? 0
  const c = Math.max(0, opz.coperti), ospiti = Math.max(c, opz.ospiti)
  const scorta = (n: number) => Math.ceil(n * (1 + opz.scortaPct / 100))
  const voci: VoceCarico[] = []
  const aggiungi = (reparto: Reparto, voce: string, quantita: number, unita = 'pz', note?: string) => {
    if (quantita > 0) voci.push({ chiave: crypto.randomUUID(), reparto, voce, quantita: Math.ceil(quantita), unita, caricato: false, auto: true, ...(note ? { note } : {}) })
  }
  const notaScorta = opz.scortaPct ? `+${opz.scortaPct}% di scorta` : undefined

  // ---- Sala (food): tavoli dal 3D, tovagliato e mise en place per coperto
  for (const { voce, quantita } of r?.righe ?? []) {
    if (TAVOLI_SALA.includes(voce.tipo) || voce.tipo === 'cocktail' || TAVOLI_SERVIZIO.includes(voce.tipo)) aggiungi(voce.tipo === 'coffee' ? 'cucina' : 'sala', voce.nome, quantita)
  }
  if (r?.sedie) aggiungi('sala', 'Sedie', r.sedie)
  const sgabelli = conta(['sgabello'])
  if (sgabelli) aggiungi('sala', 'Sgabelli', sgabelli)
  const tavoliSala = conta(TAVOLI_SALA), tavoliServizio = conta(TAVOLI_SERVIZIO)
  if (tavoliSala + tavoliServizio) aggiungi('sala', 'Tovaglie', scorta(tavoliSala + tavoliServizio), 'pz', notaScorta)
  if (conta(['cocktail'])) aggiungi('sala', 'Coperture elastiche per tavoli cocktail', conta(['cocktail']))
  if (tavoliSala) {
    aggiungi('sala', 'Centrotavola', tavoliSala)
    aggiungi('sala', 'Caraffe per l’acqua', tavoliSala)
    aggiungi('sala', 'Numeri / segnatavolo', tavoliSala)
  }
  if (c > 0) {
    const { g, brindisi } = giri(opz.menu)
    aggiungi('sala', 'Tovaglioli', scorta(c), 'pz', notaScorta)
    aggiungi('sala', 'Sottopiatti', scorta(c), 'pz', notaScorta)
    aggiungi('sala', 'Piatti piani', scorta(c * g.piani), 'pz', notaScorta)
    aggiungi('sala', 'Piatti fondi', scorta(c * g.fondi), 'pz', notaScorta)
    aggiungi('sala', 'Piatti da dessert', scorta(c * g.dessert), 'pz', notaScorta)
    aggiungi('sala', 'Forchette', scorta(c * g.forchette), 'pz', notaScorta)
    aggiungi('sala', 'Coltelli', scorta(c * g.coltelli), 'pz', notaScorta)
    aggiungi('sala', 'Cucchiai', scorta(c * g.cucchiai), 'pz', notaScorta)
    aggiungi('sala', 'Posate da dessert', scorta(c * g.posateDessert), 'pz', notaScorta)
    aggiungi('sala', 'Tazzine e piattini da caffè', scorta(c * Math.max(1, g.tazzine)), 'pz', notaScorta)
    aggiungi('sala', 'Bicchieri acqua', scorta(c), 'pz', notaScorta)
    aggiungi('sala', 'Calici vino', scorta(c), 'pz', notaScorta)
    if (brindisi) aggiungi('sala', 'Flûte per il brindisi', scorta(c), 'pz', notaScorta)
    if (g.piattiniAperitivo) aggiungi('sala', 'Piattini per l’aperitivo', scorta(ospiti), 'pz', notaScorta)
    aggiungi('sala', 'Vassoi di servizio', Math.ceil(c / 10))
  }

  // ---- Bar (beverage)
  const banconi = Math.max(conta(['bar']), opz.zone.filter((z) => z.tipo === 'bar').length)
  if (banconi) {
    aggiungi('bar', 'Bancone bar', banconi)
    aggiungi('bar', 'Secchielli per il ghiaccio', banconi * 2)
    aggiungi('bar', 'Tumbler', scorta(ospiti * 2), 'pz', notaScorta)
    aggiungi('bar', 'Calici e coppe da cocktail', scorta(ospiti), 'pz', notaScorta)
    aggiungi('bar', 'Kit bar (shaker, jigger, pinze, apribottiglie, taglieri)', banconi)
    aggiungi('consumabili', 'Ghiaccio', ospiti, 'kg', '1 kg a ospite')
    aggiungi('consumabili', 'Tovagliolini cocktail', ospiti * 2)
  }

  // ---- Cucina (food)
  const buffet = conta(['buffet'])
  if (buffet) aggiungi('cucina', 'Chafing dish', buffet * 4, 'pz', '4 per buffet')
  if (conta(['coffee'])) aggiungi('cucina', 'Thermos caffè e acqua calda', conta(['coffee']) * 3)
  if (c > 0) {
    aggiungi('cucina', 'Teglie gastronorm 1/1', Math.ceil(c / 10))
    aggiungi('cucina', 'Contenitori isotermici', Math.ceil(c / 40))
    aggiungi('cucina', 'Kit attrezzi di cucina (pentole, mestoli, coltelli, taglieri)', 1)
  }

  // ---- Allestimento: arredi del 3D che non sono tavoli né sedute
  for (const { voce, quantita } of r?.righe ?? []) {
    if (ALLESTIMENTO.includes(voce.tipo)) aggiungi('allestimento', voceCatalogo(voce.tipo).nome, quantita)
  }

  // ---- Voci delle zone del sopralluogo, nel reparto giusto
  const presenti = new Set(voci.map((v) => v.voce.toLowerCase()))
  for (const z of opz.zone) {
    const reparto = VOCI_ZONA_REPARTO[z.tipo] ?? 'allestimento'
    for (const v of z.voci) {
      if (GIA_CALCOLATE.test(v) || presenti.has(v.toLowerCase()) || /^bancone bar/i.test(v)) continue
      presenti.add(v.toLowerCase())
      aggiungi(reparto, v, 1, 'pz', `zona ${z.nome}`)
    }
  }

  // ---- Consumabili
  if (ospiti > 0) {
    aggiungi('consumabili', 'Sacchi per la spazzatura', Math.ceil(ospiti / 25), 'pz', 'differenziata')
    aggiungi('consumabili', 'Pellicola e alluminio', 1, 'kit')
    aggiungi('consumabili', 'Kit pulizia (detersivi, spugne, panni)', 1, 'kit')
  }
  return voci
}

/** Unisce la lista rigenerata con quella esistente: restano le voci a mano e quelle già spuntate. */
export function aggiornaLista(esistenti: VoceCarico[], nuove: VoceCarico[]): VoceCarico[] {
  const k = (v: VoceCarico) => `${v.reparto}|${v.voce}`.toLowerCase()
  const tenute = new Map(esistenti.filter((v) => !v.auto || v.caricato).map((v) => [k(v), v]))
  // Nell'ordine della lista nuova, una voce già spuntata o scritta a mano prende il posto di quella ricalcolata
  const risultato = nuove.map((v) => tenute.get(k(v)) ?? v)
  const usate = new Set(risultato.map(k))
  return [...risultato, ...[...tenute.values()].filter((v) => !usate.has(k(v)))]
}
