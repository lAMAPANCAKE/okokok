// Location complete già allestite, da cui partire e poi adattare.
import { stanzaRettangolare, voceCatalogo, type Allestimento, type Oggetto, type TipoArredo } from './allestimento'

export interface Modello {
  chiave: string
  nome: string
  descrizione: string
  crea: () => Allestimento
}

/** Costruttore compatto: o('tondo_180', x, z, { rot: 90, sedie: 10 }). */
function o(tipo: TipoArredo, x: number, z: number, extra: Partial<Oggetto> = {}): Oggetto {
  const v = voceCatalogo(tipo)
  const nuovo: Oggetto = { id: crypto.randomUUID().slice(0, 8), tipo, x, z, rot: 0 }
  if (v.sedie) nuovo.sedie = v.sedie.iniziali
  if (v.lunghezza) nuovo.lunghezza = v.lunghezza.iniziale
  return { ...nuovo, ...extra }
}

const griglia = (xs: number[], zs: number[], crea: (x: number, z: number) => Oggetto) => zs.flatMap((z) => xs.map((x) => crea(x, z)))

/**
 * Matrimonio in villa: sala ricevimento 26 × 18 m a sud della quale c'è il giardino
 * con l'angolo aperitivo e la cerimonia all'aperto sotto l'arco.
 */
function matrimonio(): Allestimento {
  const sala: Oggetto[] = [
    // Tavolo degli sposi sul lato nord, torta e confettata
    o('sposi', 0, -7.4, { lunghezza: 3.6, sedie: 2 }),
    o('photobooth', 0, -8.75, { bloccato: true }),
    o('pianta', -2.8, -8.2), o('pianta', 2.8, -8.2),
    o('torta', 0, -5.2),
    // 12 tavoli tondi da 10 ai lati della pista
    ...griglia([-9.4, -4.6, 4.6, 9.4], [-3.6, 0.4, 4.4], (x, z) => o('tondo_180', x, z, { sedie: 10 })),
    o('pista', 0, 0.4, { lunghezza: 5 }),
    o('dj', 0, 4.4), o('cassa', -2.4, 4.4), o('cassa', 2.4, 4.4),
    // Servizio lungo le pareti
    o('buffet', -12.2, 0.4, { rot: 90, lunghezza: 4.8 }),
    o('bar', 11.6, 0.4, { rot: 270, lunghezza: 4 }),
    o('confettata', -10.6, 7.2),
    o('tableau', -3.8, 7.6),
    o('lounge', 9.8, 7.8), o('lounge', 10.4, -7.9, { rot: 180 }),
    o('pianta', -12.3, -8.3), o('pianta', 12.3, -8.3), o('pianta', -12.3, 8.3), o('pianta', 12.3, 8.3),
    o('porta', 0, 9),
  ]

  const giardino: Oggetto[] = [
    o('giardino', 0, 22.5, { lunghezza: 36, bloccato: true }),
    o('vialetto', 0, 13, { rot: 90, lunghezza: 8, bloccato: true }),
    // Aperitivo: gazebo con buffet, bar all'aperto e tavoli alti
    o('gazebo', -10.5, 14, { lunghezza: 6 }),
    o('buffet', -10.5, 14, { lunghezza: 3.6 }),
    o('bar', 10.5, 12.6, { lunghezza: 4 }),
    ...griglia([-5, 5], [12, 15], (x, z) => o('cocktail', x, z)),
    o('cocktail', -3.5, 18), o('cocktail', 3.5, 18),
    o('lounge', 12, 17, { rot: 270 }),
    o('photobooth', 15, 22, { rot: 90 }),
    // Cerimonia: navata con lanterne, file di sedie e arco floreale
    o('tappeto', 0, 26.3, { rot: 90, lunghezza: 10, bloccato: true }),
    ...[21.8, 23, 24.2, 25.4, 26.6, 27.8, 29].flatMap((z) => [o('fila', -2.9, z, { rot: 180, sedie: 7 }), o('fila', 2.9, z, { rot: 180, sedie: 7 })]),
    o('arco', 0, 31.8),
    o('pianta', -2, 32), o('pianta', 2, 32),
    ...[21.5, 24, 26.5, 29].flatMap((z) => [o('lanterna', -0.8, z), o('lanterna', 0.8, z)]),
    // Verde attorno
    o('albero', -16, 12), o('albero', 16, 11.5), o('albero', -16, 31), o('albero', 16, 31), o('albero', -8, 33.5), o('albero', 8, 33.5),
    o('siepe', -17.6, 22.5, { rot: 90, lunghezza: 20 }), o('siepe', 17.6, 22.5, { rot: 90, lunghezza: 20 }),
  ]

  return {
    versione: 1,
    pareti: { punti: stanzaRettangolare(26, 18), chiusa: true, altezza: 4.5 },
    pavimento: 'marmo',
    planimetria: null,
    foto_pareti: {},
    oggetti: [...sala, ...giardino],
  }
}

/** Cena di gala: sala 22 × 14 m con tavolo d'onore, palco e bar. */
function gala(): Allestimento {
  return {
    versione: 1,
    pareti: { punti: stanzaRettangolare(22, 14), chiusa: true, altezza: 5 },
    pavimento: 'moquette',
    planimetria: null,
    foto_pareti: {},
    oggetti: [
      o('palco', 0, -4.6, { rot: 180, lunghezza: 6 }),
      o('cassa', -3.6, -5.6), o('cassa', 3.6, -5.6),
      o('imperiale', 0, -0.8, { lunghezza: 6, sedie: 20 }),
      ...griglia([-7.6, -3.8, 3.8, 7.6], [1.6, 5], (x, z) => o('tondo_180', x, z, { sedie: 10 })),
      o('tondo_180', -7.6, -2.4, { sedie: 10 }), o('tondo_180', 7.6, -2.4, { sedie: 10 }), o('tondo_180', 0, 5, { sedie: 10 }),
      o('bar', 9.9, 0, { rot: 270, lunghezza: 4 }),
      o('buffet', -10.2, 0, { rot: 90, lunghezza: 4.8 }),
      o('pianta', -10.3, -6.3), o('pianta', 10.3, -6.3), o('pianta', -10.3, 6.3), o('pianta', 10.3, 6.3),
      o('porta', 0, 7),
    ],
  }
}

/** Festa o aperitivo in giardino, senza pareti. */
function festaGiardino(): Allestimento {
  return {
    versione: 1,
    pareti: { punti: [], chiusa: false, altezza: 3.5 },
    pavimento: 'prato',
    planimetria: null,
    foto_pareti: {},
    oggetti: [
      o('gazebo', -7, -4, { lunghezza: 6 }), o('buffet', -7, -4, { lunghezza: 3.6 }),
      o('gazebo', 7, -4, { lunghezza: 6 }), o('bar', 7, -4, { lunghezza: 4 }),
      o('pista', 0, 4, { lunghezza: 6 }), o('dj', 0, 7.8), o('cassa', -3.4, 7.6), o('cassa', 3.4, 7.6),
      ...griglia([-3, 0, 3], [-6, -3], (x, z) => o('cocktail', x, z)),
      o('lounge', -9, 4, { rot: 90 }), o('lounge', 9, 4, { rot: 270 }),
      o('photobooth', -11, 8, { rot: 225 }),
      ...[-9, -4.5, 0, 4.5, 9].map((x) => o('lanterna', x, 9.5)),
      o('albero', -13, -9), o('albero', 13, -9), o('albero', -13, 9), o('albero', 13, 9),
    ],
  }
}

export const MODELLI: Modello[] = [
  { chiave: 'matrimonio', nome: 'Matrimonio in villa', descrizione: 'Sala con 12 tavoli tondi e tavolo sposi, pista, buffet, bar, confettata e tableau; giardino con aperitivo sotto il gazebo e cerimonia all’aperto con arco, navata e 98 posti.', crea: matrimonio },
  { chiave: 'gala', nome: 'Cena di gala', descrizione: 'Sala 22×14 con palco, tavolo d’onore da 20, 11 tavoli tondi da 10, bar e buffet: 130 coperti.', crea: gala },
  { chiave: 'festa', nome: 'Festa in giardino', descrizione: 'Prato con due gazebo (buffet e bar), pista con DJ, tavoli alti, lounge e photo booth.', crea: festaGiardino },
]
