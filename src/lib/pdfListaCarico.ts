// PDF della lista di carico per magazzino e autista: una sezione per reparto con
// casella da spuntare, quantità, voce e note; in fondo le firme di chi carica e controlla.
import { formatData } from './format'
import { REPARTI, type ListaCarico } from './listaCarico'
import type { Evento } from './types'

const pulisci = (t: string | null | undefined) => (t ?? '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\n\x20-\xff€]/g, '').trim()

export async function scaricaPdfListaCarico(evento: Evento, lista: ListaCarico) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 16, R = 194
  let y = 18

  const testo = (t: string, x: number, yy: number, opz: { size?: number; bold?: boolean; colore?: number; align?: 'left' | 'right' } = {}) => {
    doc.setFont('helvetica', opz.bold ? 'bold' : 'normal')
    doc.setFontSize(opz.size ?? 10)
    doc.setTextColor(opz.colore ?? 20)
    doc.text(pulisci(t), x, yy, { align: opz.align ?? 'left' })
  }
  const spazio = (h: number) => {
    if (y + h > 280) {
      doc.addPage()
      y = 18
    }
  }

  testo('Lista di carico', L, y, { size: 9, colore: 110 })
  y += 7
  testo(evento.nome, L, y, { size: 18, bold: true })
  y += 7
  testo([formatData(evento.data, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), evento.luogo].filter(Boolean).join(' · '), L, y, { size: 10.5 })
  y += 5.5
  testo([lista.coperti ? `${lista.coperti} coperti` : '', lista.ospiti ? `${lista.ospiti} ospiti` : '', lista.scorta_pct ? `scorta ${lista.scorta_pct}% inclusa` : ''].filter(Boolean).join(' · '), L, y, { size: 10, colore: 80 })
  y += 4

  for (const { reparto, nome } of REPARTI) {
    const voci = lista.voci.filter((v) => v.reparto === reparto)
    if (!voci.length) continue
    spazio(18)
    y += 7
    testo(`${nome.toUpperCase()} (${voci.length})`, L, y, { size: 11, bold: true })
    doc.setDrawColor(190)
    doc.line(L, y + 1.5, R, y + 1.5)
    y += 7
    for (const v of voci) {
      const righe = doc.setFontSize(10).splitTextToSize(pulisci(v.voce + (v.note ? ` (${v.note})` : '')), 128) as string[]
      spazio(righe.length * 5 + 1.5)
      doc.setDrawColor(110)
      doc.rect(L, y - 3.4, 4, 4)
      if (v.caricato) testo('x', L + 1, y - 0.3, { bold: true, size: 9 })
      testo(`${v.quantita}`, L + 22, y, { bold: true, align: 'right' })
      testo(v.unita && v.unita !== 'pz' ? v.unita : '', L + 24, y, { size: 9, colore: 90 })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(20)
      doc.text(righe, L + 34, y)
      y += righe.length * 5 + 1.5
    }
  }

  spazio(24)
  y += 14
  doc.setDrawColor(150)
  doc.line(L, y, L + 70, y)
  doc.line(R - 70, y, R, y)
  testo('Caricato da', L, y + 4.5, { size: 9, colore: 100 })
  testo('Controllato da', R - 70, y + 4.5, { size: 9, colore: 100 })

  const pagine = doc.getNumberOfPages()
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i)
    testo(`${evento.nome} · lista di carico · ${i}/${pagine}`, R, 290, { align: 'right', size: 8, colore: 140 })
  }
  doc.save(`${pulisci(evento.nome)} - lista di carico.pdf`)
}
