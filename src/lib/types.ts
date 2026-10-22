export type Ruolo = 'collaboratore' | 'responsabile' | 'admin'
export type StatoEvento = 'pianificato' | 'concluso' | 'annullato'
export type StatoTurno = 'proposto' | 'confermato' | 'rifiutato' | 'completato' | 'annullato'

export interface Profilo {
  id: string
  email: string
  nome: string
  cognome: string
  telefono: string | null
  ruolo: Ruolo
  competenze: string[]
  taglia_giacca: string | null
  taglia_pantalone: string | null
  numero_scarpe: string | null
  foto_path: string | null
  tariffa_oraria: number
  attivo: boolean
  profilo_completo: boolean
}

export interface ProfiloPrivato {
  id: string
  codice_fiscale: string | null
  data_nascita: string | null
  indirizzo: string | null
  iban: string | null
}

export interface Evento {
  id: string
  nome: string
  cliente: string | null
  data: string
  luogo: string | null
  ora_inizio: string | null
  ora_fine: string | null
  note: string | null
  personale_richiesto: number
  stato: StatoEvento
  azienda_id?: string | null
  /** Gruppo di lavoro: dove e quando si ritrova lo staff, divisa e referente in loco */
  punto_ritrovo?: string | null
  ora_ritrovo?: string | null
  divisa?: string | null
  referente?: string | null
}

export interface Copertura {
  evento_id: string
  richiesti: number
  confermati: number
  in_attesa: number
  rifiutati: number
  mancanti: number
}

export interface Turno {
  id: string
  evento_id: string
  collaboratore_id: string
  data: string
  ora_inizio: string
  ora_fine: string
  mansione: string
  tariffa_oraria: number
  stato: StatoTurno
  motivo_rifiuto: string | null
  ore_totali: number | null
  ore_notturne: number
  ore_festive: number
  ore_straordinarie: number
  compenso_lordo: number | null
  note: string | null
}

export interface Impostazioni {
  magg_notturno: number
  magg_festivo: number
  magg_straordinario: number
  documenti_obbligatori: TipoDocumento[]
  ragione_sociale: string | null
  indirizzo_sede: string | null
  partita_iva: string | null
  email_commerciale: string | null
  telefono_commerciale: string | null
  condizioni_preventivo: string | null
  iva_predefinita: number
  validita_preventivo_giorni: number
  /** Regola dei camerieri: 1 ogni min–max coperti */
  coperti_per_cameriere_min: number
  coperti_per_cameriere_max: number
}

export interface RiepilogoMensile {
  collaboratore_id: string
  mese: string
  giorni_lavorati: number
  turni: number
  ore_totali: number
  compenso_lordo: number
}

export interface Invito {
  id: string
  email: string
  ruolo: Ruolo
  tariffa_oraria: number
  creato_il: string
  accettato_il: string | null
}

export type TipoDocumento = 'carta_identita' | 'codice_fiscale' | 'patente' | 'contratto' | 'permesso_soggiorno' | 'attestato_haccp' | 'altro'
export type VerificaDocumento = 'in_verifica' | 'approvato' | 'rifiutato'
export type Validita = 'valido' | 'in_scadenza' | 'scaduto' | 'rifiutato'

export const ETICHETTA_DOCUMENTO: Record<TipoDocumento, string> = {
  carta_identita: 'Carta d’identità',
  codice_fiscale: 'Codice fiscale',
  patente: 'Patente',
  contratto: 'Contratto firmato',
  permesso_soggiorno: 'Permesso di soggiorno',
  attestato_haccp: 'Attestato HACCP',
  altro: 'Altro',
}

export interface Documento {
  id: string
  collaboratore_id: string
  tipo: TipoDocumento
  descrizione: string | null
  file_path: string
  file_nome: string | null
  scadenza: string | null
  stato_verifica: VerificaDocumento
  note_verifica: string | null
  verificato_il: string | null
  created_at: string
  validita: Validita
  giorni_alla_scadenza: number | null
  piu_recente: boolean
}

export type TipoRimborso = 'viaggio' | 'hotel' | 'pasti' | 'altro'
export type StatoRimborso = 'richiesto' | 'approvato' | 'rifiutato' | 'rimborsato'

export const ETICHETTA_RIMBORSO: Record<TipoRimborso, string> = { viaggio: 'Viaggio', hotel: 'Hotel', pasti: 'Pasti', altro: 'Altro' }

export interface Rimborso {
  id: string
  collaboratore_id: string
  evento_id: string | null
  tipo: TipoRimborso
  data_spesa: string
  importo: number
  descrizione: string | null
  ricevuta_path: string | null
  stato: StatoRimborso
  motivo_rifiuto: string | null
  gestito_il: string | null
  created_at: string
}

export type TipoPagamento = 'acconto' | 'saldo' | 'rimborso'
export type MetodoPagamento = 'bonifico' | 'contanti' | 'altro'

export interface Pagamento {
  id: string
  collaboratore_id: string
  data: string
  importo: number
  tipo: TipoPagamento
  metodo: MetodoPagamento
  mese_riferimento: string | null
  note: string | null
}

export interface Saldo {
  collaboratore_id: string
  compensi: number
  rimborsi: number
  pagato: number
  saldo: number
}

export interface Movimento {
  collaboratore_id: string
  data: string
  tipo: 'compenso' | 'rimborso' | 'pagamento'
  importo: number
  descrizione: string
  riferimento: string
}

export interface Notifica {
  id: number
  tipo: string
  titolo: string
  testo: string | null
  link: string | null
  letta_il: string | null
  creato_il: string
}

export type StatoPipeline = 'da_contattare' | 'contattato' | 'in_trattativa' | 'cliente_attivo' | 'perso'
export const ETICHETTA_PIPELINE: Record<StatoPipeline, string> = {
  da_contattare: 'Da contattare',
  contattato: 'Contattato',
  in_trattativa: 'In trattativa',
  cliente_attivo: 'Cliente attivo',
  perso: 'Perso',
}

export interface Azienda {
  id: string
  nome: string
  settore: string | null
  referente: string | null
  ruolo_referente: string | null
  email: string | null
  telefono: string | null
  indirizzo: string | null
  partita_iva: string | null
  note: string | null
  stato_pipeline: StatoPipeline
  responsabile_id: string | null
  created_at: string
  updated_at: string
}

export interface FollowUp {
  id: string
  azienda_id: string
  data: string
  nota: string
  assegnato_a: string | null
  completato_il: string | null
}

export type StatoPreventivo = 'bozza' | 'inviato' | 'accettato' | 'rifiutato' | 'perso'
export const ETICHETTA_PREVENTIVO: Record<StatoPreventivo, string> = {
  bozza: 'Bozza',
  inviato: 'Inviato',
  accettato: 'Accettato',
  rifiutato: 'Rifiutato',
  perso: 'Perso',
}

export interface Preventivo {
  id: string
  numero: string
  azienda_id: string
  sopralluogo_id: string | null
  evento_id: string | null
  titolo: string
  data_evento: string | null
  luogo: string | null
  ospiti: number | null
  stato: StatoPreventivo
  data_invio: string | null
  valido_fino: string | null
  data_esito: string | null
  motivo_esito: string | null
  sconto_pct: number
  iva_pct: number
  note_cliente: string | null
  note_interne: string | null
  created_at: string
}

export type TipoVoce = 'personale' | 'servizio' | 'altro'

export interface VocePreventivo {
  id: string
  preventivo_id: string
  ordine: number
  tipo: TipoVoce
  descrizione: string
  quantita: number
  ore: number | null
  prezzo_unitario: number
  costo_unitario: number
  importo: number
  costo: number
}

export interface TotaliPreventivo {
  preventivo_id: string
  voci: number
  persone: number
  subtotale: number
  sconto: number
  imponibile: number
  iva: number
  totale: number
  costo: number
  margine: number
  margine_pct: number | null
}

export type EsitoVoceChecklist = 'ok' | 'problema' | 'na' | null
export interface VoceChecklist {
  chiave: string
  etichetta: string
  stato: EsitoVoceChecklist
  nota: string
}

/** Checklist standard da compilare in loco */
export const CHECKLIST_SOPRALLUOGO: { chiave: string; etichetta: string; aiuto: string }[] = [
  { chiave: 'accessi', etichetta: 'Accessi', aiuto: 'Carico/scarico, ascensori, scale, orari di accesso' },
  { chiave: 'spazi', etichetta: 'Spazi', aiuto: 'Sale, metrature, disposizione tavoli, zone bar' },
  { chiave: 'cucina', etichetta: 'Cucina e office', aiuto: 'Attrezzature, lavaggio, acqua, zona di appoggio' },
  { chiave: 'bagni', etichetta: 'Bagni', aiuto: 'Per ospiti e per il personale' },
  { chiave: 'spogliatoio', etichetta: 'Spogliatoio personale', aiuto: 'Dove lo staff si cambia e lascia le proprie cose' },
  { chiave: 'parcheggio', etichetta: 'Parcheggio', aiuto: 'Per personale e fornitori, distanza dall’ingresso' },
  { chiave: 'vincoli', etichetta: 'Vincoli', aiuto: 'Orari, rumore, permessi, regole della location' },
]

export interface Sopralluogo {
  id: string
  azienda_id: string | null
  evento_id: string | null
  titolo: string
  data: string
  indirizzo: string | null
  referente_luogo: string | null
  checklist: VoceChecklist[]
  misure: string | null
  note: string | null
  created_at: string
}

export interface FileSopralluogo {
  id: string
  sopralluogo_id: string
  file_path: string
  tipo: 'foto' | 'planimetria' | 'rendering'
  didascalia: string | null
  /** Zona del sopralluogo a cui appartiene (null = foto generale) */
  zona_id: string | null
  /** Per i rendering: la foto originale della location vuota */
  origine_id: string | null
  /** Rendering scelto da mostrare al cliente */
  scelto: boolean
  created_at: string
}

export interface Indisponibilita {
  id: string
  collaboratore_id: string
  data: string
  nota: string | null
}

export interface Valutazione {
  id: string
  evento_id: string
  collaboratore_id: string
  punteggio: number
  note: string | null
  valutato_da: string | null
  created_at: string
}

export interface MediaValutazioni {
  collaboratore_id: string
  media: number
  valutazioni: number
  ultima: string
}

export interface ReportEvento {
  evento_id: string
  nome: string
  data: string
  stato: StatoEvento
  azienda_id: string | null
  preventivo_id: string | null
  preventivo_numero: string | null
  ricavo: number
  costo_preventivato: number
  costo_personale: number
  ore_lavorate: number
  costo_rimborsi: number
  turni_senza_ore: number
}

export const COMPETENZE = ['sala', 'bar', 'hostess', 'cucina', 'guardaroba', 'inglese', 'francese', 'tedesco', 'patente B', 'sommelier'] as const

export const ETICHETTA_RUOLO: Record<Ruolo, string> = {
  collaboratore: 'Collaboratore',
  responsabile: 'Responsabile',
  admin: 'Admin',
}

export type StatoFattura = 'da_incassare' | 'parziale' | 'scaduta' | 'pagata' | 'annullata'
export const ETICHETTA_FATTURA: Record<StatoFattura, string> = {
  da_incassare: 'Da incassare',
  parziale: 'Incassata in parte',
  scaduta: 'Scaduta',
  pagata: 'Pagata',
  annullata: 'Annullata',
}

export const ETICHETTA_METODO: Record<MetodoPagamento, string> = {
  bonifico: 'Bonifico',
  contanti: 'Contanti',
  altro: 'Altro',
}

/** Riga della vista fatture_stato: la fattura con incassato, residuo e stato calcolati */
export interface Fattura {
  id: string
  anno: number
  numero: string
  azienda_id: string
  preventivo_id: string | null
  evento_id: string | null
  data_emissione: string
  data_scadenza: string
  descrizione: string
  imponibile: number
  iva_pct: number
  iva: number
  totale: number
  annullata: boolean
  note: string | null
  created_at: string
  incassato: number
  residuo: number
  ultimo_incasso: string | null
  stato: StatoFattura
}

export interface Incasso {
  id: string
  fattura_id: string
  data: string
  importo: number
  metodo: MetodoPagamento
  note: string | null
  created_at: string
}
