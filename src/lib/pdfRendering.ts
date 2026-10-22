// PDF del rendering finale da consegnare al cliente: copertina con i numeri principali
// e una pagina per ogni inquadratura.
import { formatData } from './format'

export interface FotoRender {
  titolo: string
  blob: Blob
}

const comeDataUrl = (b: Blob) =>
  new Promise<string>((ok, ko) => {
    const r = new FileReader()
    r.onload = () => ok(r.result as string)
    r.onerror = () => ko(r.error)
    r.readAsDataURL(b)
  })

export async function scaricaPdfRendering(location: string, data: string, righeRiepilogo: string[], foto: FotoRender[]) {
  // I font standard del PDF non hanno l'apostrofo tipografico
  const pulisci = (t: string) => t.replace(/[’‘]/g, "'")
  location = pulisci(location)
  foto = foto.map((f) => ({ ...f, titolo: pulisci(f.titolo) }))
  righeRiepilogo = righeRiepilogo.map(pulisci)
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const L = 297, H = 210, M = 12
  const immagini = await Promise.all(foto.map((f) => comeDataUrl(f.blob)))

  // Copertina: prima immagine a tutta larghezza e dati dell'evento
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(location, M, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(90)
  doc.text(`Progetto di allestimento · sopralluogo del ${formatData(data, { day: 'numeric', month: 'long', year: 'numeric' })}`, M, 27)
  // Le immagini mantengono le proporzioni originali dentro il riquadro disponibile
  const adatta = (url: string, x: number, y0: number, maxW: number, maxH: number) => {
    const { width, height } = doc.getImageProperties(url)
    const k = Math.min(maxW / width, maxH / height)
    doc.addImage(url, 'JPEG', x, y0, width * k, height * k)
  }
  if (immagini[0]) adatta(immagini[0], M, 34, 190, 160)
  doc.setTextColor(20)
  doc.setFontSize(10)
  let y = 40
  for (const riga of righeRiepilogo) {
    doc.text(riga, 210, y)
    y += 6
  }

  // Una pagina per inquadratura
  foto.forEach((f, i) => {
    if (i === 0) return
    doc.addPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(20)
    doc.text(f.titolo, M, 14)
    adatta(immagini[i], M, 19, L - 2 * M, H - 32)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`${location} · ${i + 1}/${foto.length}`, L - M, H - 6, { align: 'right' })
  })
  doc.save(`${location} - rendering.pdf`)
}
