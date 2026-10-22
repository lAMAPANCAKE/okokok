// Calcolo del personale per un evento a partire da coperti e zone.
// Camerieri secondo la regola dell'azienda (predefinita 1 ogni 10–12 coperti, in Impostazioni);
// gli altri ruoli seguono rapporti standard del catering, sempre modificabili nel preventivo.
import type { TipoZona } from './zone'

export interface RegolePersonale {
  copertiMin: number
  copertiMax: number
}

export interface RigaPersonale {
  ruolo: string
  quantita: number
  ore: number
  /** Perché questo numero, da mostrare accanto alla proposta */
  motivo: string
}

export interface DatiPersonale {
  coperti: number
  zone: TipoZona[]
  /** Arredi contati nell'allestimento 3D */
  banconiBar: number
  postazioniBuffet: number
}

export const REGOLE_PREDEFINITE: RegolePersonale = { copertiMin: 10, copertiMax: 12 }

/** Camerieri: intervallo tra la regola larga e quella stretta, proposta a metà. */
export function camerieri(coperti: number, r: RegolePersonale) {
  if (coperti <= 0) return { min: 0, max: 0, proposti: 0 }
  const min = Math.ceil(coperti / r.copertiMax)
  const max = Math.ceil(coperti / r.copertiMin)
  return { min, max, proposti: Math.ceil(coperti / ((r.copertiMin + r.copertiMax) / 2)) }
}

export function calcolaPersonale(d: DatiPersonale, r: RegolePersonale = REGOLE_PREDEFINITE): RigaPersonale[] {
  const c = Math.max(0, Math.round(d.coperti))
  const conta = (t: TipoZona) => d.zone.filter((z) => z === t).length
  const righe: RigaPersonale[] = []
  const cam = camerieri(c, r)
  if (c > 0) {
    righe.push({
      ruolo: 'Camerieri',
      quantita: cam.proposti,
      ore: 6,
      motivo: cam.min === cam.max ? `${c} coperti, 1 ogni ${r.copertiMin}–${r.copertiMax}` : `${c} coperti, 1 ogni ${r.copertiMin}–${r.copertiMax}: da ${cam.min} a ${cam.max}`,
    })
    righe.push({ ruolo: 'Responsabile di sala', quantita: c > 150 ? 2 : 1, ore: 7, motivo: c > 150 ? 'oltre 150 coperti: due responsabili' : 'uno per evento' })
  }
  const bar = Math.max(d.banconiBar, conta('bar'))
  if (bar > 0) righe.push({ ruolo: 'Baristi', quantita: bar * 2, ore: 6, motivo: `2 per bancone · ${bar} ${bar === 1 ? 'bar' : 'bar'}` })
  const buffet = Math.max(d.postazioniBuffet, conta('buffet'))
  if (buffet > 0) righe.push({ ruolo: 'Addetti buffet', quantita: buffet, ore: 6, motivo: `1 per postazione · ${buffet}` })
  if (c > 0 || conta('cucina') > 0) {
    righe.push({ ruolo: 'Cuochi', quantita: Math.max(1, Math.ceil(c / 50)), ore: 8, motivo: c > 0 ? `1 ogni 50 coperti` : 'zona cucina' })
    righe.push({ ruolo: 'Lavapiatti', quantita: Math.max(1, Math.ceil(c / 100)), ore: 8, motivo: '1 ogni 100 coperti' })
  }
  if (conta('sbarazzo') > 0 && c > 0) righe.push({ ruolo: 'Addetti sbarazzo', quantita: Math.max(1, Math.ceil(c / 80)), ore: 6, motivo: '1 ogni 80 coperti' })
  return righe
}
