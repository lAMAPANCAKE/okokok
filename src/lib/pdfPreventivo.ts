import type { Azienda, Impostazioni, Preventivo, TotaliPreventivo, VocePreventivo } from './types'

import { euro } from './format'

const num = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 })
const data = (iso: string | null) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

/**
 * Genera il PDF da inviare al cliente. Contiene SOLO prezzi di vendita:
 * costi, margini e note interne non vengono mai stampati.
 */
export async function scaricaPdfPreventivo(p: Preventivo, voci: VocePreventivo[], totali: TotaliPreventivo, azienda: Azienda, imp: Impostazioni) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 18
  const R = 192
  let y = 20

  const testo = (t: string, x: number, yy: number, opz: { size?: number; bold?: boolean; align?: 'left' | 'right' | 'center'; colore?: number } = {}) => {
    doc.setFont('helvetica', opz.bold ? 'bold' : 'normal')
    doc.setFontSize(opz.size ?? 10)
    doc.setTextColor(opz.colore ?? 20)
    doc.text(t, x, yy, { align: opz.align ?? 'left' })
  }
  const aCapo = (t: string, larghezza: number) => doc.splitTextToSize(t, larghezza) as string[]
  const nuovaPaginaSe = (spazio: number) => {
    if (y + spazio > 275) {
      doc.addPage()
      y = 20
    }
  }

  // Intestazione: chi emette il preventivo
  testo(imp.ragione_sociale || 'Preventivo', L, y, { size: 16, bold: true })
  y += 6
  for (const riga of [imp.indirizzo_sede, imp.partita_iva && `P. IVA ${imp.partita_iva}`, [imp.email_commerciale, imp.telefono_commerciale].filter(Boolean).join(' · ')].filter(Boolean) as string[]) {
    testo(riga, L, y, { size: 9, colore: 90 })
    y += 4.5
  }

  // Numero e date
  testo(`Preventivo n. ${p.numero}`, R, 20, { size: 12, bold: true, align: 'right' })
  testo(`Data: ${data(p.data_invio ?? p.created_at.slice(0, 10))}`, R, 26, { size: 9, align: 'right', colore: 90 })
  if (p.valido_fino) testo(`Valido fino al: ${data(p.valido_fino)}`, R, 30.5, { size: 9, align: 'right', colore: 90 })

  y = Math.max(y, 36) + 6
  doc.setDrawColor(220)
  doc.line(L, y, R, y)
  y += 8

  // Cliente ed evento
  testo('Spett.le', L, y, { size: 9, colore: 90 })
  testo('Evento', 110, y, { size: 9, colore: 90 })
  y += 5
  testo(azienda.nome, L, y, { bold: true })
  testo(p.titolo, 110, y, { bold: true })
  y += 5
  const sinistra = [azienda.referente && `c.a. ${azienda.referente}`, azienda.indirizzo, azienda.partita_iva && `P. IVA ${azienda.partita_iva}`].filter(Boolean) as string[]
  const destra = [p.data_evento && `Data: ${data(p.data_evento)}`, p.luogo && `Luogo: ${p.luogo}`, p.ospiti && `Ospiti: ${p.ospiti}`].filter(Boolean) as string[]
  for (let i = 0; i < Math.max(sinistra.length, destra.length); i++) {
    if (sinistra[i]) testo(aCapo(sinistra[i], 85)[0], L, y, { size: 9 })
    if (destra[i]) testo(aCapo(destra[i], 82)[0], 110, y, { size: 9 })
    y += 4.5
  }
  y += 6

  // Tabella voci
  const colonne = { descrizione: L, quantita: 118, ore: 136, prezzo: 162, importo: R }
  doc.setFillColor(241, 245, 249)
  doc.rect(L - 2, y - 5, R - L + 4, 8, 'F')
  testo('Descrizione', colonne.descrizione, y, { size: 9, bold: true })
  testo('Q.tà', colonne.quantita, y, { size: 9, bold: true, align: 'right' })
  testo('Ore', colonne.ore, y, { size: 9, bold: true, align: 'right' })
  testo('Prezzo', colonne.prezzo, y, { size: 9, bold: true, align: 'right' })
  testo('Importo', colonne.importo, y, { size: 9, bold: true, align: 'right' })
  y += 8

  for (const v of voci) {
    const righe = aCapo(v.descrizione, 92)
    nuovaPaginaSe(righe.length * 4.5 + 3)
    righe.forEach((r, i) => testo(r, colonne.descrizione, y + i * 4.5, { size: 9 }))
    testo(num.format(v.quantita), colonne.quantita, y, { size: 9, align: 'right' })
    testo(v.ore ? num.format(v.ore) : '', colonne.ore, y, { size: 9, align: 'right' })
    testo(euro.format(v.prezzo_unitario) + (v.tipo === 'personale' ? '/h' : ''), colonne.prezzo, y, { size: 9, align: 'right' })
    testo(euro.format(v.importo), colonne.importo, y, { size: 9, align: 'right' })
    y += righe.length * 4.5 + 2.5
    doc.setDrawColor(235)
    doc.line(L, y - 1.5, R, y - 1.5)
  }

  // Totali
  y += 4
  nuovaPaginaSe(36)
  const rigaTotale = (etichetta: string, valore: number, grassetto = false) => {
    testo(etichetta, 150, y, { size: grassetto ? 11 : 9, bold: grassetto, align: 'right' })
    testo(euro.format(valore), R, y, { size: grassetto ? 11 : 9, bold: grassetto, align: 'right' })
    y += grassetto ? 7 : 5
  }
  if (Number(totali.sconto) > 0) {
    rigaTotale('Subtotale', Number(totali.subtotale))
    rigaTotale(`Sconto ${num.format(p.sconto_pct)}%`, -Number(totali.sconto))
  }
  rigaTotale('Imponibile', Number(totali.imponibile))
  rigaTotale(`IVA ${num.format(p.iva_pct)}%`, Number(totali.iva))
  doc.setDrawColor(200)
  doc.line(120, y - 3, R, y - 3)
  y += 2
  rigaTotale('Totale', Number(totali.totale), true)

  // Note per il cliente e condizioni
  for (const [titolo, contenuto] of [['Note', p.note_cliente], ['Condizioni', imp.condizioni_preventivo]] as const) {
    if (!contenuto) continue
    const righe = aCapo(contenuto, R - L)
    nuovaPaginaSe(righe.length * 4.2 + 10)
    y += 4
    testo(titolo, L, y, { size: 9, bold: true })
    y += 5
    righe.forEach((r) => {
      nuovaPaginaSe(5)
      testo(r, L, y, { size: 8.5, colore: 60 })
      y += 4.2
    })
  }

  // Spazio per l'accettazione
  nuovaPaginaSe(24)
  y += 10
  testo('Per accettazione (timbro e firma)', R, y, { size: 9, align: 'right', colore: 90 })
  doc.line(130, y + 12, R, y + 12)

  const pagine = doc.getNumberOfPages()
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i)
    testo(`Preventivo ${p.numero} · pagina ${i} di ${pagine}`, 105, 290, { size: 7.5, align: 'center', colore: 140 })
  }

  const nomeFile = `Preventivo-${p.numero}-${azienda.nome.replace(/[^\w-]+/g, '_')}.pdf`
  doc.save(nomeFile)
}
