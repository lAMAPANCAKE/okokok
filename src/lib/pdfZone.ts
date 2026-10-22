// PDF da presentare al cliente: per ogni zona la foto della location allestita,
// accanto alla foto originale e a cosa è previsto. Le note operative restano interne.
import { formatData } from './format'
import { immagineRidotta } from './immagini'
import { tipoZona, type ZonaSopralluogo } from './zone'

export interface CoppiaZona {
  prima: string | null
  dopo: string
}

// I font standard del PDF non hanno apostrofi tipografici né emoji
const pulisci = (t: string) => t.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^\n\x20-\xff€]/g, '').trim()

export async function scaricaPdfZone(
  sopralluogo: { titolo: string; data: string; indirizzo: string | null },
  zone: { zona: ZonaSopralluogo; coppie: CoppiaZona[] }[],
) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const L = 297, H = 210, M = 12
  const titolo = pulisci(sopralluogo.titolo)

  const adatta = (img: { dataUrl: string; larghezza: number; altezza: number }, x: number, y: number, maxW: number, maxH: number) => {
    const k = Math.min(maxW / img.larghezza, maxH / img.altezza)
    doc.addImage(img.dataUrl, 'JPEG', x, y, img.larghezza * k, img.altezza * k)
    return img.altezza * k
  }

  // Copertina con l'elenco delle zone
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text(titolo, M, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(90)
  doc.text(`Proposta di allestimento · sopralluogo del ${formatData(sopralluogo.data, { day: 'numeric', month: 'long', year: 'numeric' })}`, M, 50)
  if (sopralluogo.indirizzo) doc.text(pulisci(sopralluogo.indirizzo), M, 57)
  doc.setTextColor(20)
  doc.setFontSize(13)
  let y = 78
  for (const { zona } of zone) {
    doc.text(`•  ${pulisci(zona.nome)}`, M, y)
    y += 8
  }
  const copertina = zone[0]?.coppie[0] && (await immagineRidotta(zone[0].coppie[0].dopo, 1400))
  if (copertina) adatta(copertina, 150, 30, L - 150 - M, H - 60)

  // Una pagina per ogni rendering scelto
  for (const { zona, coppie } of zone) {
    for (const [i, c] of coppie.entries()) {
      const [dopo, prima] = await Promise.all([immagineRidotta(c.dopo, 2000), c.prima ? immagineRidotta(c.prima, 900) : Promise.resolve(null)])
      if (!dopo) continue
      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(20)
      doc.text(`${pulisci(zona.nome)}${coppie.length > 1 ? ` (${i + 1}/${coppie.length})` : ''}`, M, 15)
      adatta(dopo, M, 21, 195, H - 34)

      // Colonna destra: com'era la location e cosa è previsto
      const x = M + 200, w = L - x - M
      let yy = 24
      if (prima) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(110)
        doc.text('La location oggi', x, yy)
        yy += adatta(prima, x, yy + 2, w, 50) + 9
      }
      doc.setTextColor(20)
      doc.setFontSize(9)
      const testo = [
        tipoZona(zona.tipo).nome,
        ...zona.voci.map((v) => `- ${v}`),
        zona.descrizione ? `\n${zona.descrizione}` : '',
        zona.stile.stile ? `\nStile: ${zona.stile.stile}` : '',
        zona.stile.colori ? `Colori: ${zona.stile.colori}` : '',
      ].filter(Boolean).map(pulisci).join('\n')
      doc.text(doc.splitTextToSize(testo, w) as string[], x, yy)

      doc.setFontSize(7)
      doc.setTextColor(140)
      doc.text('Immagine indicativa: la resa finale può differire nei dettagli.', M, H - 7)
      doc.text(titolo, L - M, H - 7, { align: 'right' })
    }
  }
  doc.save(`${titolo} - proposta allestimento.pdf`)
}
