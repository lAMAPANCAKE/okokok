// PDF dell'ordine di servizio da stampare o condividere con lo staff:
// scaletta, personale, menù con allergeni, intolleranze, checklist e note.
import { formatData, intervalloOre } from './format'
import { ALLERGENI, PORTATE, type OrdineServizio } from './ordineServizio'
import type { Evento } from './types'

export interface PersonaTurno { nome: string; mansione: string; orario: string }

// I font standard del PDF non hanno apostrofi tipografici né emoji
const pulisci = (t: string | null | undefined) => (t ?? '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\n\x20-\xff€]/g, '').trim()

export async function scaricaPdfOrdineServizio(evento: Evento, o: OrdineServizio, personale: PersonaTurno[]) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 18, R = 192, W = R - L
  let y = 18

  const testo = (t: string, x: number, yy: number, opz: { size?: number; bold?: boolean; colore?: number; align?: 'left' | 'right' } = {}) => {
    doc.setFont('helvetica', opz.bold ? 'bold' : 'normal')
    doc.setFontSize(opz.size ?? 10)
    doc.setTextColor(opz.colore ?? 20)
    doc.text(pulisci(t), x, yy, { align: opz.align ?? 'left' })
  }
  const aCapo = (t: string, larghezza: number, size = 10) => {
    doc.setFontSize(size)
    return doc.splitTextToSize(pulisci(t), larghezza) as string[]
  }
  const spazio = (h: number) => {
    if (y + h > 282) {
      doc.addPage()
      y = 18
    }
  }
  const titolo = (t: string) => {
    spazio(14)
    y += 4
    testo(t.toUpperCase(), L, y, { size: 11, bold: true })
    doc.setDrawColor(200)
    doc.line(L, y + 1.5, R, y + 1.5)
    y += 7
  }

  // Intestazione
  testo('Ordine di servizio', L, y, { size: 9, colore: 110 })
  y += 7
  testo(evento.nome, L, y, { size: 18, bold: true })
  y += 7
  const orari = intervalloOre(evento.ora_inizio, evento.ora_fine)
  testo([formatData(evento.data, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), orari].filter(Boolean).join(' · '), L, y, { size: 11 })
  y += 5.5
  if (evento.luogo) { testo(evento.luogo, L, y, { size: 10, colore: 80 }); y += 5 }
  if (evento.cliente) { testo(`Cliente: ${evento.cliente}`, L, y, { size: 10, colore: 80 }); y += 5 }
  const coperti = o.intolleranze.reduce((s, i) => s + (i.numero || 0), 0)
  if (coperti) { testo(`Menù speciali: ${coperti}`, L, y, { size: 10, bold: true }); y += 5 }

  if (o.scaletta.length) {
    titolo('Scaletta')
    for (const r of o.scaletta) {
      const righe = aCapo([r.attivita, r.zona && `(${r.zona})`, r.note && `- ${r.note}`].filter(Boolean).join(' '), W - 22)
      spazio(righe.length * 5 + 1)
      testo(r.ora || '--:--', L, y, { bold: true })
      doc.setFont('helvetica', 'normal')
      doc.text(righe, L + 22, y)
      y += righe.length * 5 + 1
    }
  }

  if (personale.length) {
    titolo(`Personale (${personale.length})`)
    for (const p of personale) {
      spazio(5.5)
      testo(p.nome, L, y)
      testo(p.mansione, L + 70, y, { colore: 80 })
      testo(p.orario, R, y, { align: 'right', colore: 80 })
      y += 5.5
    }
  }

  if (o.menu.length) {
    titolo('Menù')
    const portate = [...PORTATE.filter((p) => o.menu.some((m) => m.portata === p)), ...new Set(o.menu.map((m) => m.portata).filter((p) => !PORTATE.includes(p)))]
    for (const portata of portate) {
      spazio(12)
      testo(portata || 'Altro', L, y, { bold: true, size: 10.5 })
      y += 5.5
      for (const m of o.menu.filter((x) => x.portata === portata)) {
        const allergeni = m.allergeni.length ? `Allergeni: ${[...m.allergeni].sort((a, b) => a - b).join(', ')}` : 'Nessun allergene'
        const righe = aCapo(m.piatto + (m.note ? ` - ${m.note}` : ''), W - 62)
        spazio(righe.length * 5 + 1)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(20)
        doc.text(righe, L + 4, y)
        testo(allergeni, R, y, { align: 'right', size: 9, colore: m.allergeni.length ? 150 : 110 })
        y += righe.length * 5 + 1
      }
      y += 1.5
    }
    // Legenda degli allergeni usati (Reg. UE 1169/2011)
    const usati = [...new Set(o.menu.flatMap((m) => m.allergeni))].sort((a, b) => a - b)
    if (usati.length) {
      const legenda = aCapo('Legenda allergeni (Reg. UE 1169/2011): ' + ALLERGENI.filter((a) => usati.includes(a.n)).map((a) => `${a.n} ${a.nome}`).join(' · '), W, 8.5)
      spazio(legenda.length * 4 + 2)
      doc.setFontSize(8.5)
      doc.setTextColor(90)
      doc.text(legenda, L, y)
      y += legenda.length * 4 + 2
    }
  }

  if (o.intolleranze.length) {
    titolo('Intolleranze e richieste degli ospiti')
    for (const i of o.intolleranze) {
      const righe = aCapo(`${i.tipo}${i.note ? ` - ${i.note}` : ''}`, W - 16)
      spazio(righe.length * 5 + 1)
      testo(String(i.numero || ''), L, y, { bold: true })
      doc.setFont('helvetica', 'normal')
      doc.text(righe, L + 12, y)
      y += righe.length * 5 + 1
    }
  }

  if (o.checklist.length) {
    titolo('Checklist di montaggio')
    for (const c of o.checklist) {
      spazio(5.5)
      doc.setDrawColor(120)
      doc.rect(L, y - 3.2, 3.6, 3.6)
      if (c.fatto) testo('x', L + 0.8, y - 0.2, { bold: true, size: 9 })
      testo(`${c.zona ? c.zona + ': ' : ''}${c.voce}`, L + 6, y)
      y += 5.5
    }
  }

  if (o.dress_code || o.note) {
    titolo('Dress code e note')
    for (const [etichetta, valore] of [['Dress code', o.dress_code], ['Note', o.note]] as const) {
      if (!valore) continue
      const righe = aCapo(valore, W - 26)
      spazio(righe.length * 5 + 1)
      testo(etichetta, L, y, { bold: true })
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(20)
      doc.text(righe, L + 26, y)
      y += righe.length * 5 + 2
    }
  }

  const pagine = doc.getNumberOfPages()
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i)
    testo(`${evento.nome} · ordine di servizio · ${i}/${pagine}`, R, 290, { align: 'right', size: 8, colore: 140 })
  }
  doc.save(`${pulisci(evento.nome)} - ordine di servizio.pdf`)
}
