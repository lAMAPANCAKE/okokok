// Utilità per le foto scattate col telefono: riduzione prima del caricamento e per i PDF.

/** Ridimensiona una foto a max px sul lato lungo e la ricomprime in JPEG (se il browser la sa leggere). */
export async function comprimiImmagine(file: File | Blob, nome = 'foto.jpg', max = 2560, qualita = 0.85): Promise<File> {
  const originale = file instanceof File ? file : new File([file], nome, { type: file.type || 'image/jpeg' })
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    // Già piccola e leggera: si tiene com'è
    if (k === 1 && file.size < 800 * 1024) {
      bmp.close()
      return originale
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * k)
    canvas.height = Math.round(bmp.height * k)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', qualita))
    if (!blob) return originale
    return new File([blob], originale.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    // Formati che il browser non decodifica (es. HEIC su Android): si carica l'originale
    return originale
  }
}

/** Scarica un'immagine e la restituisce come data URL JPEG ridotta, con le dimensioni (per i PDF). */
export async function immagineRidotta(url: string, max = 1600): Promise<{ dataUrl: string; larghezza: number; altezza: number } | null> {
  try {
    const blob = await (await fetch(url)).blob()
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * k)
    canvas.height = Math.round(bmp.height * k)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), larghezza: canvas.width, altezza: canvas.height }
  } catch {
    return null
  }
}
