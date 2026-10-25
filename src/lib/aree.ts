// Le aree dell'app in un posto solo: barra laterale, Home, menu "Tutte le aree" e barra
// del telefono leggono da qui icona, colore, gruppo e chi le vede.

export const TRACCIATI = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  turni: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4 9 2 2 4-4',
  eventi: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm3 7h3v3H8z',
  assenze: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm5 8 4 4m0-4-4 4',
  compensi: 'M4 7h16v10H4zM4 10h16M8 14h3',
  clienti: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4',
  altro: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  report: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  preventivi: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 12h6M9 16h4M14 16h1',
  sopralluoghi: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  rimborsi: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  fatture: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M14 11.5a2.5 2.5 0 1 0 0 4M9.5 13h3M9.5 14.5h3',
  documenti: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 13h6M9 17h6',
  utenti: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74',
  profilo: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  notifiche: 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  impostazioni: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  gruppo: 'M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M22 11h-6',
  ordine: 'M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 12h6M9 16h4',
  carico: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  sala3d: 'M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9',
  piu: 'M12 5v14M5 12h14',
  // Zone del sopralluogo, reparti della lista di carico e azioni
  calice: 'M7 3h10l-.5 5a4.5 4.5 0 0 1-9 0zM12 12.5V20M8 21h8',
  piatto: 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 4v5a1.5 1.5 0 0 0 3 0V4M4.5 9v11M20 4c-1.5 1-2 3-2 5h2v11',
  cloche: 'M4 17h16M12 7a8 8 0 0 0-8 8v2h16v-2a8 8 0 0 0-8-8zM12 5v2M3 20h18',
  cesto: 'M4 10h16l-1.5 9a1.5 1.5 0 0 1-1.5 1.3H7a1.5 1.5 0 0 1-1.5-1.3zM8 10l3-6M16 10l-3-6M9 14v3M12 14v3M15 14v3',
  porta: 'M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14.5 12h.01',
  cucina: 'M7 14h10v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM7 14a4 4 0 0 1-.6-7.96A5 5 0 0 1 16 5a4 4 0 0 1 1 9M10 17h4',
  stella: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  foglia: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  rotolo: 'M7 4h10a3 3 0 0 1 3 3v10H7M7 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h13v-3M7 4a3 3 0 0 1 3 3v13M7 9.5h.01',
  scintille: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  microfono: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6',
  fotocamera: 'M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  sole: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  luna: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  lucchetto: 'M6 11h12v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
} as const

export type NomeIcona = keyof typeof TRACCIATI

// Tinte tenui delle aree (classi complete: Tailwind le legge così come sono scritte).
// Riconoscono l'area senza competere con il bordeaux delle azioni (DESIGN.md, The Quiet Tint Rule).
export const COLORI = {
  vino: 'bg-brand-50 text-brand-700',
  emerald: 'bg-emerald-50 text-emerald-800',
  orange: 'bg-orange-50 text-orange-800',
  sky: 'bg-sky-50 text-sky-800',
  prugna: 'bg-purple-50 text-purple-800',
  teal: 'bg-teal-50 text-teal-800',
  green: 'bg-lime-50 text-lime-800',
  amber: 'bg-amber-50 text-amber-800',
  rose: 'bg-rose-50 text-rose-800',
  slate: 'bg-slate-100 text-slate-700',
} as const
export type Colore = keyof typeof COLORI

interface Ruoli {
  isStaff: boolean
  isAdmin: boolean
}

export interface Area {
  chiave: string
  to: string
  etichetta: string
  descrizione: string
  icona: NomeIcona
  colore: Colore
  gruppo: 'Operativo' | 'Commerciale' | 'Amministrazione' | 'Il mio lavoro' | 'Account'
  visibile: (r: Ruoli) => boolean
}

const staff = (r: Ruoli) => r.isStaff
const admin = (r: Ruoli) => r.isAdmin
const collaboratore = (r: Ruoli) => !r.isStaff
const tutti = () => true

export const AREE: Area[] = [
  { chiave: 'eventi', to: '/eventi', etichetta: 'Eventi', descrizione: 'Calendario, turni e squadra', icona: 'eventi', colore: 'vino', gruppo: 'Operativo', visibile: staff },
  { chiave: 'personale', to: '/disponibilita-personale', etichetta: 'Personale', descrizione: 'Chi è libero, impegnato o assente', icona: 'utenti', colore: 'emerald', gruppo: 'Operativo', visibile: staff },
  { chiave: 'sopralluoghi', to: '/sopralluoghi', etichetta: 'Sopralluoghi', descrizione: 'Foto, zone, sala 3D e rendering', icona: 'sopralluoghi', colore: 'orange', gruppo: 'Operativo', visibile: staff },
  { chiave: 'clienti', to: '/crm', etichetta: 'Clienti', descrizione: 'Aziende, trattative e richiami', icona: 'clienti', colore: 'sky', gruppo: 'Commerciale', visibile: staff },
  { chiave: 'preventivi', to: '/preventivi', etichetta: 'Preventivi', descrizione: 'Voci, margini e PDF', icona: 'preventivi', colore: 'prugna', gruppo: 'Commerciale', visibile: staff },
  { chiave: 'report', to: '/report', etichetta: 'Margini', descrizione: 'Ricavi e costi per evento', icona: 'report', colore: 'teal', gruppo: 'Commerciale', visibile: staff },
  { chiave: 'turni', to: '/turni', etichetta: 'Turni', descrizione: 'I tuoi turni da confermare e in programma', icona: 'turni', colore: 'vino', gruppo: 'Il mio lavoro', visibile: collaboratore },
  { chiave: 'disponibilita', to: '/disponibilita', etichetta: 'Disponibilità', descrizione: 'Segna i giorni in cui non ci sei', icona: 'assenze', colore: 'emerald', gruppo: 'Il mio lavoro', visibile: collaboratore },
  { chiave: 'compensi', to: '/compensi', etichetta: 'Compensi', descrizione: 'Ore lavorate e compensi', icona: 'compensi', colore: 'green', gruppo: 'Amministrazione', visibile: tutti },
  { chiave: 'rimborsi', to: '/rimborsi', etichetta: 'Rimborsi', descrizione: 'Trasferte e spese', icona: 'rimborsi', colore: 'amber', gruppo: 'Amministrazione', visibile: tutti },
  { chiave: 'fatture', to: '/fatture', etichetta: 'Fatture', descrizione: 'Emesse, scadenze e incassi', icona: 'fatture', colore: 'rose', gruppo: 'Amministrazione', visibile: admin },
  // I responsabili non accedono ai documenti personali (GDPR)
  { chiave: 'documenti', to: '/documenti', etichetta: 'Documenti', descrizione: 'Documenti con scadenza', icona: 'documenti', colore: 'slate', gruppo: 'Amministrazione', visibile: (r) => r.isAdmin || !r.isStaff },
  { chiave: 'utenti', to: '/admin/utenti', etichetta: 'Utenti', descrizione: 'Inviti, ruoli e tariffe', icona: 'utenti', colore: 'slate', gruppo: 'Amministrazione', visibile: admin },
  { chiave: 'impostazioni', to: '/admin/impostazioni', etichetta: 'Impostazioni', descrizione: 'Maggiorazioni, dati aziendali, registro', icona: 'impostazioni', colore: 'slate', gruppo: 'Amministrazione', visibile: admin },
  { chiave: 'notifiche', to: '/notifiche', etichetta: 'Notifiche', descrizione: 'Turni, scadenze, rimborsi', icona: 'notifiche', colore: 'slate', gruppo: 'Account', visibile: tutti },
  { chiave: 'profilo', to: '/profilo', etichetta: 'Profilo', descrizione: 'I tuoi dati', icona: 'profilo', colore: 'slate', gruppo: 'Account', visibile: tutti },
]

/** Aree visibili, raggruppate nell'ordine in cui compaiono */
export function areeVisibili(r: Ruoli) {
  const gruppi = new Map<Area['gruppo'], Area[]>()
  for (const a of AREE.filter((a) => a.visibile(r))) gruppi.set(a.gruppo, [...(gruppi.get(a.gruppo) ?? []), a])
  // Per i collaboratori compensi e rimborsi stanno con "Il mio lavoro"
  if (!r.isStaff) {
    const mio = [...(gruppi.get('Il mio lavoro') ?? []), ...(gruppi.get('Amministrazione') ?? [])]
    gruppi.delete('Amministrazione')
    gruppi.set('Il mio lavoro', mio)
  }
  return [...gruppi.entries()].map(([titolo, aree]) => ({ titolo, aree }))
}

/** Azioni "Nuovo …" del pulsante + (solo staff) */
export const AZIONI_NUOVO: { to: string; etichetta: string; descrizione: string; icona: NomeIcona; colore: Colore }[] = [
  { to: '/eventi/nuovo', etichetta: 'Nuovo evento', descrizione: 'Data, luogo e personale richiesto', icona: 'eventi', colore: 'vino' },
  { to: '/sopralluoghi/nuovo', etichetta: 'Nuovo sopralluogo', descrizione: 'Foto, zone e sala 3D in location', icona: 'sopralluoghi', colore: 'orange' },
  { to: '/preventivi/nuovo', etichetta: 'Nuovo preventivo', descrizione: 'Anche dal sopralluogo', icona: 'preventivi', colore: 'prugna' },
  { to: '/crm/nuova', etichetta: 'Nuovo cliente', descrizione: 'Azienda o privato', icona: 'clienti', colore: 'sky' },
]

/** Icona disegnata per ogni tipo di zona del sopralluogo */
export const ICONA_ZONA: Record<string, NomeIcona> = {
  bar: 'calice', sala: 'piatto', buffet: 'cloche', sbarazzo: 'cesto', back: 'porta', cucina: 'cucina', ingresso: 'stella', esterno: 'foglia', altro: 'pin',
}

/** Icona disegnata per ogni reparto della lista di carico */
export const ICONA_REPARTO: Record<string, NomeIcona> = {
  sala: 'piatto', bar: 'calice', cucina: 'cucina', allestimento: 'scintille', consumabili: 'rotolo',
}
