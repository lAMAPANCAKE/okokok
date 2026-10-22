// Voci di preventivo proposte a partire dal sopralluogo: personale calcolato dai coperti,
// arredi contati nell'allestimento 3D e quanto previsto nelle zone.
import { normalizzaAllestimento, riepilogo, type Allestimento, type TipoArredo } from './allestimento'
import { calcolaPersonale, type RegolePersonale } from './personale'
import type { TipoVoce } from './types'
import type { ZonaSopralluogo } from './zone'

export interface VoceProposta {
  chiave: string
  tipo: TipoVoce
  descrizione: string
  quantita: number
  ore: number | null
  prezzo: number | null
  costo: number | null
  motivo: string
  gruppo: 'Personale' | 'Allestimento 3D' | 'Zone'
}

// Elementi della location, non da noleggiare
const STRUTTURALI = new Set<TipoArredo>(['porta', 'colonna', 'giardino', 'vialetto', 'albero', 'siepe'])

export function proponiVoci(opz: {
  allestimento: Partial<Allestimento> | null
  zone: ZonaSopralluogo[]
  ospiti: number | null
  regole: RegolePersonale
  /** Ultimi prezzi usati per la stessa descrizione in altri preventivi */
  prezzi: Map<string, { prezzo: number; costo: number; ore: number | null }>
}): VoceProposta[] {
  const a = opz.allestimento ? normalizzaAllestimento(opz.allestimento, null) : null
  const r = a ? riepilogo(a) : null
  const coperti = r?.coperti || opz.ospiti || 0
  const conta = (tipi: TipoArredo[]) => a?.oggetti.filter((o) => tipi.includes(o.tipo)).length ?? 0
  const voci: VoceProposta[] = []
  const aggiungi = (v: Omit<VoceProposta, 'chiave' | 'prezzo' | 'costo'>) => {
    const p = opz.prezzi.get(v.descrizione.toLowerCase())
    voci.push({ ...v, chiave: crypto.randomUUID(), prezzo: p?.prezzo ?? null, costo: p?.costo ?? null, ore: v.tipo === 'personale' ? (p?.ore ?? v.ore) : null })
  }

  // Personale
  const origineCoperti = r?.coperti ? 'dall’allestimento 3D' : opz.ospiti ? 'dagli ospiti del preventivo' : ''
  for (const p of calcolaPersonale({ coperti, zone: opz.zone.map((z) => z.tipo), banconiBar: conta(['bar']), postazioniBuffet: conta(['buffet', 'coffee']) }, opz.regole)) {
    aggiungi({ tipo: 'personale', descrizione: p.ruolo, quantita: p.quantita, ore: p.ore, motivo: p.motivo + (p.ruolo === 'Camerieri' && origineCoperti ? ` (coperti ${origineCoperti})` : ''), gruppo: 'Personale' })
  }

  // Arredi dell'allestimento 3D
  if (r) {
    for (const { voce, quantita } of r.righe) {
      // Sedie singole e file di sedie confluiscono nella voce "Sedie"
      if (STRUTTURALI.has(voce.tipo) || voce.tipo === 'sedia' || voce.tipo === 'fila') continue
      aggiungi({ tipo: 'servizio', descrizione: voce.nome, quantita, ore: null, motivo: 'contati nell’allestimento 3D', gruppo: 'Allestimento 3D' })
    }
    if (r.sedie > 0) aggiungi({ tipo: 'servizio', descrizione: 'Sedie', quantita: r.sedie, ore: null, motivo: 'attorno ai tavoli e in platea', gruppo: 'Allestimento 3D' })
    if (r.coperti > 0) aggiungi({ tipo: 'servizio', descrizione: 'Tovagliato e mise en place', quantita: r.coperti, ore: null, motivo: 'per coperto', gruppo: 'Allestimento 3D' })
  }

  // Quanto previsto nelle zone
  for (const z of opz.zone) {
    for (const v of z.voci) aggiungi({ tipo: 'servizio', descrizione: `${z.nome}: ${v}`, quantita: 1, ore: null, motivo: 'dalla zona del sopralluogo', gruppo: 'Zone' })
  }
  return voci
}
