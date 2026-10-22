// Modello dell'allestimento 3D di un sopralluogo (colonna sopralluoghi.allestimento).
// Unità: metri. Il pavimento è il piano XZ; Z cresce verso il basso della planimetria.

export type Punto = [number, number]

export type TipoArredo =
  | 'tondo_150' | 'tondo_180' | 'rettangolare' | 'quadrato' | 'imperiale' | 'cocktail'
  | 'sedia' | 'sgabello' | 'lounge'
  | 'buffet' | 'bar' | 'torta'
  | 'palco' | 'pista' | 'dj' | 'cassa'
  | 'pianta' | 'colonna'
  | 'sposi' | 'fila' | 'arco' | 'tappeto' | 'tableau' | 'confettata' | 'photobooth' | 'lanterna'
  | 'gazebo' | 'albero' | 'siepe' | 'giardino' | 'vialetto' | 'porta'
  | 'palloncini' | 'arco_palloncini' | 'regali' | 'coffee' | 'pianoforte' | 'schermo' | 'leggio' | 'rollup'

export type Pavimento = 'parquet' | 'marmo' | 'cotto' | 'cemento' | 'moquette' | 'prato'

export interface Oggetto {
  id: string
  tipo: TipoArredo
  x: number
  z: number
  /** Rotazione in gradi */
  rot: number
  /** Sedie attorno al tavolo */
  sedie?: number
  /** Lunghezza per tavolate e buffet (m) */
  lunghezza?: number
  /** Bloccato: non si trascina per sbaglio (prati, vialetti, navata); un tocco lo seleziona */
  bloccato?: boolean
}

export interface Planimetria {
  file_path: string
  /** Larghezza reale dell'immagine sul pavimento (m) */
  larghezza: number
  x: number
  z: number
  opacita: number
}

export interface Allestimento {
  versione: 1
  pareti: { punti: Punto[]; chiusa: boolean; altezza: number }
  pavimento: Pavimento
  planimetria: Planimetria | null
  /** Indice della parete → foto del sopralluogo applicata sul lato interno */
  foto_pareti: Record<string, string>
  oggetti: Oggetto[]
}

export type CategoriaArredo = 'Tavoli' | 'Sedute' | 'Cerimonia' | 'Servizio' | 'Intrattenimento' | 'Aziendale' | 'Decoro' | 'Esterno'

export interface VoceCatalogo {
  tipo: TipoArredo
  nome: string
  categoria: CategoriaArredo
  dettaglio: string
  sedie?: { iniziali: number; max: number }
  lunghezza?: { iniziale: number; min: number; max: number }
  /** Posti a sedere offerti dall'oggetto stesso (sedia, sgabello, divanetto) */
  posti?: number
}

export const CATALOGO: VoceCatalogo[] = [
  { tipo: 'tondo_150', nome: 'Tavolo tondo Ø150', categoria: 'Tavoli', dettaglio: 'fino a 10 posti', sedie: { iniziali: 8, max: 10 } },
  { tipo: 'tondo_180', nome: 'Tavolo tondo Ø180', categoria: 'Tavoli', dettaglio: 'fino a 12 posti', sedie: { iniziali: 10, max: 12 } },
  { tipo: 'rettangolare', nome: 'Tavolo 180×80', categoria: 'Tavoli', dettaglio: 'fino a 8 posti', sedie: { iniziali: 6, max: 8 } },
  { tipo: 'quadrato', nome: 'Tavolo 80×80', categoria: 'Tavoli', dettaglio: 'fino a 4 posti', sedie: { iniziali: 4, max: 4 } },
  { tipo: 'imperiale', nome: 'Tavolata imperiale', categoria: 'Tavoli', dettaglio: 'larga 120 cm, lunghezza a scelta', sedie: { iniziali: 16, max: 60 }, lunghezza: { iniziale: 4.8, min: 1.8, max: 30 } },
  { tipo: 'sposi', nome: 'Tavolo sposi', categoria: 'Tavoli', dettaglio: 'posti su un lato, ghirlanda di fiori', sedie: { iniziali: 2, max: 10 }, lunghezza: { iniziale: 3, min: 1.2, max: 8 } },
  { tipo: 'cocktail', nome: 'Tavolo cocktail', categoria: 'Tavoli', dettaglio: 'alto Ø60, in piedi' },
  { tipo: 'sedia', nome: 'Sedia', categoria: 'Sedute', dettaglio: 'chiavarina', posti: 1 },
  { tipo: 'sgabello', nome: 'Sgabello', categoria: 'Sedute', dettaglio: 'da bar', posti: 1 },
  { tipo: 'lounge', nome: 'Divanetto lounge', categoria: 'Sedute', dettaglio: '3 posti, 200×80', posti: 3 },
  { tipo: 'fila', nome: 'Fila di sedie', categoria: 'Cerimonia', dettaglio: 'per cerimonia o platea', sedie: { iniziali: 6, max: 16 } },
  { tipo: 'arco', nome: 'Arco floreale', categoria: 'Cerimonia', dettaglio: '240×260, fiori e verde' },
  { tipo: 'tappeto', nome: 'Navata / tappeto', categoria: 'Cerimonia', dettaglio: 'larga 120 cm, lunghezza a scelta', lunghezza: { iniziale: 10, min: 2, max: 40 } },
  { tipo: 'lanterna', nome: 'Lanterna', categoria: 'Cerimonia', dettaglio: 'con candela, a terra' },
  { tipo: 'buffet', nome: 'Buffet', categoria: 'Servizio', dettaglio: 'profondo 80 cm, lunghezza a scelta', lunghezza: { iniziale: 2.4, min: 1.2, max: 20 } },
  { tipo: 'bar', nome: 'Bancone bar', categoria: 'Servizio', dettaglio: '300×70, alto 110', lunghezza: { iniziale: 3, min: 1.5, max: 12 } },
  { tipo: 'torta', nome: 'Tavolo torta', categoria: 'Servizio', dettaglio: 'Ø80 con torta' },
  { tipo: 'confettata', nome: 'Confettata', categoria: 'Servizio', dettaglio: 'tavolo Ø120 con vasi di confetti' },
  { tipo: 'tableau', nome: 'Tableau de mariage', categoria: 'Servizio', dettaglio: 'pannello su cavalletto' },
  { tipo: 'coffee', nome: 'Coffee station', categoria: 'Servizio', dettaglio: 'thermos, tazze e pasticceria', lunghezza: { iniziale: 2.4, min: 1.2, max: 10 } },
  { tipo: 'regali', nome: 'Tavolo regali', categoria: 'Servizio', dettaglio: '120×60 con pacchi' },
  { tipo: 'palco', nome: 'Palco / pedana', categoria: 'Intrattenimento', dettaglio: '400×300, alto 40', lunghezza: { iniziale: 4, min: 2, max: 16 } },
  { tipo: 'pista', nome: 'Pista da ballo', categoria: 'Intrattenimento', dettaglio: '500×500', lunghezza: { iniziale: 5, min: 2, max: 16 } },
  { tipo: 'dj', nome: 'Consolle DJ', categoria: 'Intrattenimento', dettaglio: '160×70' },
  { tipo: 'cassa', nome: 'Cassa audio', categoria: 'Intrattenimento', dettaglio: 'su stativo' },
  { tipo: 'pianoforte', nome: 'Pianoforte a coda', categoria: 'Intrattenimento', dettaglio: 'con panchetta' },
  { tipo: 'schermo', nome: 'Schermo proiezione', categoria: 'Aziendale', dettaglio: '16:9 su treppiede, base a scelta', lunghezza: { iniziale: 3, min: 1.5, max: 8 } },
  { tipo: 'leggio', nome: 'Leggio / podio', categoria: 'Aziendale', dettaglio: 'con microfono' },
  { tipo: 'rollup', nome: 'Roll-up', categoria: 'Aziendale', dettaglio: 'banner 85×200 con il logo' },
  { tipo: 'photobooth', nome: 'Photo booth', categoria: 'Intrattenimento', dettaglio: 'parete fiorita 240×240' },
  { tipo: 'pianta', nome: 'Pianta in vaso', categoria: 'Decoro', dettaglio: 'in vaso, alta 160' },
  { tipo: 'colonna', nome: 'Colonna / pilastro', categoria: 'Decoro', dettaglio: '40×40, alta come le pareti' },
  { tipo: 'palloncini', nome: 'Palloncini', categoria: 'Decoro', dettaglio: 'composizione da 7, con peso' },
  { tipo: 'arco_palloncini', nome: 'Arco di palloncini', categoria: 'Decoro', dettaglio: 'per ingresso o torta, larghezza a scelta', lunghezza: { iniziale: 3, min: 1.5, max: 8 } },
  { tipo: 'porta', nome: 'Portone / vetrata', categoria: 'Decoro', dettaglio: '220×280, da appoggiare alla parete' },
  { tipo: 'gazebo', nome: 'Gazebo', categoria: 'Esterno', dettaglio: 'telo bianco, lato a scelta', lunghezza: { iniziale: 6, min: 3, max: 12 } },
  { tipo: 'giardino', nome: 'Prato', categoria: 'Esterno', dettaglio: 'area verde, larghezza a scelta', lunghezza: { iniziale: 20, min: 4, max: 80 } },
  { tipo: 'vialetto', nome: 'Vialetto', categoria: 'Esterno', dettaglio: 'ghiaia, largo 2 m', lunghezza: { iniziale: 8, min: 2, max: 40 } },
  { tipo: 'albero', nome: 'Albero', categoria: 'Esterno', dettaglio: 'alto circa 5 m' },
  { tipo: 'siepe', nome: 'Siepe', categoria: 'Esterno', dettaglio: 'alta 120 cm, lunghezza a scelta', lunghezza: { iniziale: 6, min: 1, max: 40 } },
]

export const voceCatalogo = (tipo: TipoArredo) => CATALOGO.find((c) => c.tipo === tipo)!

export const PAVIMENTI: { valore: Pavimento; etichetta: string }[] = [
  { valore: 'parquet', etichetta: 'Parquet' },
  { valore: 'marmo', etichetta: 'Marmo' },
  { valore: 'cotto', etichetta: 'Cotto' },
  { valore: 'cemento', etichetta: 'Cemento / resina' },
  { valore: 'moquette', etichetta: 'Moquette' },
  { valore: 'prato', etichetta: 'Prato (esterno)' },
]

export const stanzaRettangolare = (larghezza: number, profondita: number): Punto[] => {
  const x = larghezza / 2, z = profondita / 2
  return [[-x, -z], [x, -z], [x, z], [-x, z]]
}

/** Ricava larghezza, profondità e altezza dal campo "misure" (es. "sala 18×12 m, altezza 4 m"). */
export function misureDaTesto(testo: string | null) {
  const t = (testo ?? '').replace(/,(\d)/g, '.$1')
  const sala = t.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i)
  const altezza = t.match(/alt[a-z]*\s*(?:di\s*)?(\d+(?:\.\d+)?)/i)
  const n = (s?: string) => (s ? Number(s) : NaN)
  const ok = (v: number, min: number, max: number) => (v >= min && v <= max ? v : null)
  return {
    larghezza: ok(n(sala?.[1]), 2, 200),
    profondita: ok(n(sala?.[2]), 2, 200),
    altezza: ok(n(altezza?.[1]), 2, 20),
  }
}

export function allestimentoIniziale(misure: string | null): Allestimento {
  const m = misureDaTesto(misure)
  return {
    versione: 1,
    pareti: { punti: stanzaRettangolare(m.larghezza ?? 14, m.profondita ?? 10), chiusa: true, altezza: m.altezza ?? 3.5 },
    pavimento: 'parquet',
    planimetria: null,
    foto_pareti: {},
    oggetti: [],
  }
}

/** Completa un allestimento salvato con eventuali campi mancanti. */
export function normalizzaAllestimento(a: Partial<Allestimento> | null, misure: string | null): Allestimento {
  const base = allestimentoIniziale(misure)
  if (!a) return base
  return {
    ...base,
    ...a,
    pareti: { ...base.pareti, ...a.pareti },
    foto_pareti: a.foto_pareti ?? {},
    oggetti: (a.oggetti ?? []).filter((o) => CATALOGO.some((c) => c.tipo === o.tipo)),
  }
}

/** Segmenti delle pareti come coppie di punti (con la chiusura se la stanza è chiusa). */
export function segmentiPareti(pareti: Allestimento['pareti']): [Punto, Punto][] {
  const p = pareti.punti
  const s: [Punto, Punto][] = []
  for (let i = 0; i < p.length - 1; i++) s.push([p[i], p[i + 1]])
  if (pareti.chiusa && p.length > 2) s.push([p[p.length - 1], p[0]])
  return s
}

export const lunghezzaSegmento = ([a, b]: [Punto, Punto]) => Math.hypot(b[0] - a[0], b[1] - a[1])

/** Area del poligono (formula dell'area di Gauss), 0 se la stanza non è chiusa. */
export function areaStanza(pareti: Allestimento['pareti']) {
  const p = pareti.punti
  if (!pareti.chiusa || p.length < 3) return 0
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, z1] = p[i], [x2, z2] = p[(i + 1) % p.length]
    s += x1 * z2 - x2 * z1
  }
  return Math.abs(s) / 2
}

export function postiOggetto(o: Oggetto) {
  const v = voceCatalogo(o.tipo)
  return v.sedie ? (o.sedie ?? v.sedie.iniziali) : (v.posti ?? 0)
}

/** Sedie massime di una tavolata in base alla lunghezza (60 cm a coperto, due lati e capotavola). */
export const sedieMaxImperiale = (lunghezza: number) => 2 * Math.floor(lunghezza / 0.6) + 2

export function riepilogo(a: Allestimento) {
  const perTipo = new Map<TipoArredo, number>()
  let coperti = 0, sedie = 0, cerimonia = 0, appoggio = 0
  for (const o of a.oggetti) {
    perTipo.set(o.tipo, (perTipo.get(o.tipo) ?? 0) + 1)
    const v = voceCatalogo(o.tipo)
    const p = postiOggetto(o)
    // Coperti = posti a tavola; le sedie della cerimonia sono degli stessi ospiti, lounge e sgabelli sono posti di appoggio
    if (v.categoria === 'Cerimonia') cerimonia += p
    else if (v.categoria === 'Tavoli' || o.tipo === 'sedia') coperti += p
    else appoggio += p
    if (v.sedie || o.tipo === 'sedia') sedie += p
  }
  const area = areaStanza(a.pareti)
  return {
    righe: CATALOGO.filter((c) => perTipo.has(c.tipo)).map((c) => ({ voce: c, quantita: perTipo.get(c.tipo)! })),
    coperti,
    cerimonia,
    appoggio,
    sedie,
    area,
    tavoli: a.oggetti.filter((o) => voceCatalogo(o.tipo).categoria === 'Tavoli' && o.tipo !== 'cocktail').length,
  }
}

/** Raggio approssimato dell'ingombro a terra, sedie comprese (m). */
export function raggioIngombro(o: Pick<Oggetto, 'tipo' | 'lunghezza' | 'sedie'>) {
  const l = o.lunghezza ?? voceCatalogo(o.tipo).lunghezza?.iniziale ?? 1
  const fissi: Partial<Record<TipoArredo, number>> = {
    tondo_150: 1.45, tondo_180: 1.6, rettangolare: 1.35, quadrato: 0.95, cocktail: 0.45, sedia: 0.35, sgabello: 0.3,
    lounge: 1.1, torta: 0.55, dj: 0.95, cassa: 0.4, pianta: 0.45, colonna: 0.3,
  }
  if (o.tipo === 'imperiale') return l / 2 + 0.7
  if (o.tipo === 'fila') return (o.sedie ?? 6) * 0.28 + 0.2
  if (o.tipo === 'giardino') return l * 0.6
  if (o.tipo === 'gazebo') return l * 0.7
  if (o.tipo === 'arco' || o.tipo === 'photobooth') return 1.3
  if (o.tipo === 'albero') return 1.6
  if (o.tipo === 'porta') return 1.2
  if (o.tipo === 'lanterna' || o.tipo === 'rollup') return 0.35
  if (o.tipo === 'pianoforte') return 1.3
  if (o.tipo === 'leggio' || o.tipo === 'palloncini') return 0.45
  if (o.tipo === 'regali') return 0.75
  if (o.tipo === 'palco' || o.tipo === 'pista') return l * 0.65
  return fissi[o.tipo] ?? l / 2 + 0.2
}

/** Primo punto libero vicino a (x, z), cercando a spirale su una griglia di 50 cm. */
export function postoLibero(oggetti: Oggetto[], nuovo: Pick<Oggetto, 'tipo' | 'lunghezza' | 'sedie'>, x: number, z: number): Punto {
  const r = raggioIngombro(nuovo)
  const libero = (px: number, pz: number) => oggetti.every((o) => A_TERRA.has(o.tipo) || Math.hypot(o.x - px, o.z - pz) >= r + raggioIngombro(o) - 0.3)
  const x0 = Math.round(x * 2) / 2, z0 = Math.round(z * 2) / 2
  for (let anello = 0; anello <= 40; anello++) {
    for (let i = -anello; i <= anello; i++) {
      for (const [dx, dz] of [[i, -anello], [i, anello], [-anello, i], [anello, i]]) {
        const px = x0 + dx * 0.5, pz = z0 + dz * 0.5
        if (libero(px, pz)) return [px, pz]
      }
    }
  }
  return [x0, z0]
}

/** Superfici calpestabili: gli altri arredi si appoggiano sopra. */
export const A_TERRA = new Set<TipoArredo>(['giardino', 'vialetto', 'tappeto', 'pista'])

/** Rettangolo che contiene pareti e arredi: [minX, minZ, maxX, maxZ]. */
export function estensione(a: Allestimento): [number, number, number, number] {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
  const aggiungi = (x: number, z: number, r = 0) => {
    x0 = Math.min(x0, x - r); z0 = Math.min(z0, z - r); x1 = Math.max(x1, x + r); z1 = Math.max(z1, z + r)
  }
  for (const [x, z] of a.pareti.punti) aggiungi(x, z)
  for (const o of a.oggetti) aggiungi(o.x, o.z, o.tipo === 'giardino' ? (o.lunghezza ?? 20) / 2 : raggioIngombro(o))
  return x0 === Infinity ? [-6, -5, 6, 5] : [x0, z0, x1, z1]
}
