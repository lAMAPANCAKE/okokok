// Zone del sopralluogo: cosa allestire in ogni parte della location e istruzione
// per trasformare la foto della zona vuota in una foto della zona allestita.

export type TipoZona = 'bar' | 'sbarazzo' | 'back' | 'cucina' | 'sala' | 'buffet' | 'ingresso' | 'esterno' | 'altro'

export interface StileZona {
  stile?: string
  momento?: 'giorno' | 'sera'
  colori?: string
}

export interface ZonaSopralluogo {
  id: string
  sopralluogo_id: string
  tipo: TipoZona
  nome: string
  voci: string[]
  stile: StileZona
  descrizione: string | null
  note_operative: string | null
  ordine: number
  created_at: string
}

export const TIPI_ZONA: { tipo: TipoZona; nome: string; icona: string; voci: string[] }[] = [
  {
    tipo: 'bar', nome: 'Bar', icona: '🍸',
    voci: ['Bancone bar operativo', 'Retrobanco con bottigliera', 'Frigoriferi a vetro', 'Macchina del ghiaccio', 'Lavabicchieri', 'Spillatore birra', 'Macchina del caffè', 'Sgabelli', 'Luce calda sul bancone'],
  },
  {
    tipo: 'sala', nome: 'Sala', icona: '🍽️',
    voci: ['Tavoli tondi apparecchiati', 'Tavolate imperiali', 'Sedie chiavarine', 'Tovagliato lungo fino a terra', 'Mise en place completa', 'Centrotavola floreali', 'Candele', 'Tavolo d’onore', 'Luci d’atmosfera'],
  },
  {
    tipo: 'buffet', nome: 'Buffet', icona: '🥗',
    voci: ['Tavoli buffet con tovaglia', 'Alzatine e taglieri', 'Chafing dish', 'Isola dei dolci', 'Coffee station', 'Composizioni di frutta', 'Cartellini dei piatti'],
  },
  {
    tipo: 'sbarazzo', nome: 'Sbarazzo', icona: '🧺',
    voci: ['Tavoli da sbarazzo coperti', 'Carrelli portavassoi', 'Rastrelliere per bicchieri', 'Contenitori per la raccolta differenziata', 'Zona vuoti e casse'],
  },
  {
    tipo: 'back', nome: 'Back / separé', icona: '🚪',
    voci: ['Separé / pannelli divisori', 'Tavoli d’appoggio in acciaio', 'Carrelli', 'Scaffalature', 'Frigoriferi di servizio', 'Stoccaggio bevande', 'Tende a coprire il back'],
  },
  {
    tipo: 'cucina', nome: 'Cucina', icona: '👨‍🍳',
    voci: ['Cucina da campo montata', 'Linea calda', 'Forni', 'Abbattitore', 'Piani di lavoro in acciaio', 'Lavaggio e lavastoviglie', 'Cappa aspirante', 'Pass per l’uscita dei piatti'],
  },
  {
    tipo: 'ingresso', nome: 'Ingresso', icona: '✨',
    voci: ['Welcome desk', 'Tableau de mariage', 'Composizione floreale', 'Guardaroba', 'Aperitivo di benvenuto', 'Tappeto d’ingresso'],
  },
  {
    tipo: 'esterno', nome: 'Esterno', icona: '🌿',
    voci: ['Tavoli cocktail', 'Gazebo', 'Area lounge', 'Luci a festone', 'Bar all’aperto', 'Ombrelloni', 'Lanterne lungo i vialetti'],
  },
  { tipo: 'altro', nome: 'Altra zona', icona: '📍', voci: [] },
]

export const tipoZona = (t: TipoZona) => TIPI_ZONA.find((z) => z.tipo === t) ?? TIPI_ZONA[TIPI_ZONA.length - 1]

export const STILI = ['Elegante', 'Rustico / country', 'Moderno minimal', 'Aziendale', 'Boho', 'Industriale', 'Classico']

/**
 * Istruzione per ChatGPT: modifica la foto reale della zona vuota mostrandola allestita,
 * senza cambiare l'architettura. Le note operative restano interne e non entrano nell'istruzione.
 */
export function istruzioneRendering(z: Pick<ZonaSopralluogo, 'nome' | 'tipo' | 'voci' | 'stile' | 'descrizione'>) {
  const righe = [
    'Modifica questa foto reale di una location per mostrarla allestita per un evento di catering, come una fotografia professionale scattata il giorno dell’evento.',
    // Il tipo si aggiunge solo se il nome non lo dice già (es. "Terrazza" → "Terrazza (bar)")
    `Zona: ${z.nome}${z.tipo !== 'altro' && !z.nome.toLowerCase().includes(tipoZona(z.tipo).nome.toLowerCase().split(' ')[0]) ? ` (${tipoZona(z.tipo).nome.toLowerCase()})` : ''}.`,
  ]
  if (z.voci.length) righe.push(`Inserisci: ${z.voci.join('; ')}.`)
  if (z.descrizione?.trim()) righe.push(`Dettagli richiesti: ${z.descrizione.trim()}`)
  const stile = [z.stile.stile && `stile ${z.stile.stile.toLowerCase()}`, z.stile.colori?.trim() && `colori e materiali: ${z.stile.colori.trim()}`, z.stile.momento && (z.stile.momento === 'sera' ? 'evento serale con luci calde accese' : 'luce naturale di giorno')].filter(Boolean)
  if (stile.length) righe.push(`Atmosfera: ${stile.join(', ')}.`)
  righe.push(
    'Regole: mantieni identici muri, finestre, porte, soffitto, pavimento, prospettiva e inquadratura della foto originale; aggiungi solo gli allestimenti richiesti con proporzioni realistiche rispetto allo spazio; nessuna persona, nessuna scritta o logo; risultato fotorealistico, stesso formato dell’immagine originale.',
  )
  return righe.join('\n')
}
