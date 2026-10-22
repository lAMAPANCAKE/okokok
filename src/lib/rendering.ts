// Pianificazione delle inquadrature del rendering finale: vista d'insieme, pianta,
// viste ad altezza d'occhio dall'ingresso e dal fondo, poi una per ogni zona della location.
import { PerspectiveCamera, Vector3 } from 'three'
import { estensione, raggioIngombro, segmentiPareti, type Allestimento, type Oggetto, type Punto, type TipoArredo } from './allestimento'

export interface Scatto {
  titolo: string
  posizione: [number, number, number]
  obiettivo: [number, number, number]
  fov: number
  /** La camera è dentro la sala: si vedono soffitto e luci */
  interno: boolean
  /** Vista dall'alto con le pareti verso la camera trasparenti */
  casaDiBambola: boolean
}

export const RAPPORTO_RENDER = 16 / 9
// Altezza del fotografo: un po' sopra gli occhi, così sedie e tavoli in primo piano non coprono la scena
const OCCHIO = 1.9

// Zone notevoli: il primo arredo trovato di ogni gruppo diventa un'inquadratura
const ZONE: { tipi: TipoArredo[]; titolo: string; altezzaObiettivo: number }[] = [
  { tipi: ['sposi'], titolo: 'Tavolo degli sposi', altezzaObiettivo: 1.1 },
  { tipi: ['palco', 'schermo'], titolo: 'Palco e schermo', altezzaObiettivo: 1.3 },
  { tipi: ['arco'], titolo: 'Cerimonia', altezzaObiettivo: 1.4 },
  { tipi: ['pista', 'dj'], titolo: 'Pista da ballo', altezzaObiettivo: 0.6 },
  { tipi: ['torta'], titolo: 'Torta', altezzaObiettivo: 0.9 },
  { tipi: ['buffet'], titolo: 'Buffet', altezzaObiettivo: 0.9 },
  { tipi: ['coffee'], titolo: 'Coffee break', altezzaObiettivo: 0.9 },
  { tipi: ['bar'], titolo: 'Bar', altezzaObiettivo: 1.1 },
  { tipi: ['gazebo'], titolo: 'Gazebo', altezzaObiettivo: 1.4 },
  { tipi: ['pianoforte'], titolo: 'Pianoforte', altezzaObiettivo: 0.9 },
  { tipi: ['photobooth'], titolo: 'Photo booth', altezzaObiettivo: 1.3 },
  { tipi: ['lounge'], titolo: 'Area lounge', altezzaObiettivo: 0.6 },
  { tipi: ['confettata', 'tableau', 'regali'], titolo: 'Confettata e tableau', altezzaObiettivo: 1.0 },
]
const TAVOLI: TipoArredo[] = ['tondo_150', 'tondo_180', 'rettangolare', 'quadrato', 'imperiale']
const SEDUTE: TipoArredo[] = [...TAVOLI, 'sposi', 'fila', 'sedia']

// ---------------------------------------------------------------------------
// Geometria del poligono della sala
// ---------------------------------------------------------------------------
export function dentroPoligono([x, z]: Punto, p: Punto[]) {
  let dentro = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentro = !dentro
  }
  return dentro
}

function distanzaSegmento([x, z]: Punto, [[x1, z1], [x2, z2]]: [Punto, Punto]) {
  const dx = x2 - x1, dz = z2 - z1
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(x - (x1 + t * dx), z - (z1 + t * dz))
}

const baricentro = (punti: Punto[]): Punto =>
  punti.length ? [punti.reduce((s, p) => s + p[0], 0) / punti.length, punti.reduce((s, p) => s + p[1], 0) / punti.length] : [0, 0]

const normalizza = ([x, z]: Punto): Punto => {
  const l = Math.hypot(x, z)
  return l < 1e-6 ? [0.45, 0.89] : [x / l, z / l]
}

// ---------------------------------------------------------------------------
// Pianificazione
// ---------------------------------------------------------------------------
export function pianificaScatti(a: Allestimento): Scatto[] {
  const chiusa = a.pareti.chiusa && a.pareti.punti.length > 2
  const poligono = a.pareti.punti
  const segmenti = segmentiPareti(a.pareti)
  const h = a.pareti.altezza
  const dentro = (p: Punto) => chiusa && dentroPoligono(p, poligono)
  // Un punto è "comodo" per la camera se sta dalla stessa parte delle pareti dell'obiettivo, lontano dai muri
  const comodo = (p: Punto, interno: boolean) =>
    !chiusa || (dentro(p) === interno && segmenti.every((s) => distanzaSegmento(p, s) > 0.45))

  const [x0, z0, x1, z1] = estensione(a)
  const centroGlobale: Punto = [(x0 + x1) / 2, (z0 + z1) / 2]
  const centroSala: Punto = chiusa ? baricentro(poligono) : centroGlobale
  const scatti: Scatto[] = []

  // 1–2. Vista d'insieme a volo d'uccello e pianta, inquadrate in modo che la location riempia l'immagine
  const altezzaMax = chiusa ? h : 3
  const angoli = [x0, x1].flatMap((x) => [z0, z1].flatMap((z) => [0, altezzaMax].map((y) => new Vector3(x, y, z))))
  const inquadra = (direzione: Vector3, fov: number) => {
    const obiettivo = new Vector3(centroGlobale[0], 0, centroGlobale[1])
    const cam = new PerspectiveCamera(fov, RAPPORTO_RENDER, 0.1, 1000)
    const ingombro = (d: number) => {
      cam.position.copy(obiettivo).addScaledVector(direzione, d)
      cam.lookAt(obiettivo)
      cam.updateMatrixWorld()
      return Math.max(...angoli.map((v) => {
        const p = v.clone().project(cam)
        return Math.max(Math.abs(p.x), Math.abs(p.y))
      }))
    }
    // Ricerca binaria della distanza che porta l'ingombro al 92% del fotogramma
    let [min, max] = [2, 400]
    for (let i = 0; i < 30; i++) {
      const d = (min + max) / 2
      if (ingombro(d) > 0.92) min = d
      else max = d
    }
    const pos = obiettivo.clone().addScaledVector(direzione, max)
    return { posizione: [pos.x, pos.y, pos.z] as [number, number, number], obiettivo: [obiettivo.x, 0, obiettivo.z] as [number, number, number] }
  }
  scatti.push({ titolo: 'Vista d’insieme', ...inquadra(new Vector3(0.38, 0.68, 0.78).normalize(), 40), fov: 40, interno: false, casaDiBambola: true })
  scatti.push({ titolo: 'Pianta dall’alto', ...inquadra(new Vector3(0, 1, 0.00001).normalize(), 40), fov: 40, interno: false, casaDiBambola: false })

  // 3–4. Dall'ingresso e dal fondo, ad altezza d'occhio dentro la sala
  if (chiusa) {
    const porta = a.oggetti.find((o) => o.tipo === 'porta')
    let ingresso: Punto
    if (porta) {
      const d = normalizza([centroSala[0] - porta.x, centroSala[1] - porta.z])
      ingresso = [porta.x + d[0] * 1.2, porta.z + d[1] * 1.2]
    } else {
      // Centro della parete più a sud, un metro all'interno
      const sud = segmenti.reduce((m, s) => ((s[0][1] + s[1][1]) / 2 > (m[0][1] + m[1][1]) / 2 ? s : m))
      ingresso = [(sud[0][0] + sud[1][0]) / 2, (sud[0][1] + sud[1][1]) / 2 - 1]
    }
    const avanti = (da: Punto, verso: Punto, max: number) => {
      // Si allontana da "da" nella direzione di "verso" finché resta dentro la sala
      const d = normalizza([verso[0] - da[0], verso[1] - da[1]])
      let ultimo = da
      for (let t = 0.5; t < max; t += 0.25) {
        const p: Punto = [da[0] + d[0] * t, da[1] + d[1] * t]
        if (!comodo(p, true)) break
        ultimo = p
      }
      return ultimo
    }
    const camIngresso = comodo(ingresso, true) ? ingresso : avanti(centroSala, ingresso, 60)
    // Camera rialzata (2,4 m): gli arredi in primo piano non coprono la sala
    scatti.push(occhio('Dall’ingresso', camIngresso, [centroSala[0], 0.6, centroSala[1]], 62, true, 2.4))
    const fondo = avanti(centroSala, [2 * centroSala[0] - camIngresso[0], 2 * centroSala[1] - camIngresso[1]], 60)
    scatti.push(occhio('Verso l’ingresso', fondo, [centroSala[0], 0.6, centroSala[1]], 62, true, 2.4))
  }

  // 5. Una vista per zona, presa dal lato degli ospiti
  const sedute = a.oggetti.filter((o) => SEDUTE.includes(o.tipo))
  const spettatori = sedute.length ? baricentro(sedute.map((o) => [o.x, o.z] as Punto)) : centroSala
  const usati = new Set<string>()
  for (const zona of ZONE) {
    const fuoco = a.oggetti.find((o) => zona.tipi.includes(o.tipo) && !usati.has(o.id))
    if (!fuoco) continue
    usati.add(fuoco.id)
    // La cerimonia si guarda dalle file di sedie, il resto dal baricentro degli ospiti
    const fila = zona.tipi.includes('arco') ? a.oggetti.filter((o) => o.tipo === 'fila') : []
    const daQui = fila.length ? baricentro(fila.map((o) => [o.x, o.z] as Punto)) : spettatori
    const s = vistaSu(fuoco, daQui, zona.titolo, zona.altezzaObiettivo)
    // Salta le zone già inquadrate da vicino (es. torta davanti al tavolo sposi)
    if (s && !scatti.some((v) => !v.casaDiBambola && Math.hypot(v.obiettivo[0] - s.obiettivo[0], v.obiettivo[2] - s.obiettivo[2]) < 2.5)) scatti.push(s)
  }

  // 6. Dettaglio della mise en place sul primo tavolo
  const tavolo = a.oggetti.find((o) => TAVOLI.includes(o.tipo))
  if (tavolo) {
    const d = normalizza([centroSala[0] - tavolo.x, centroSala[1] - tavolo.z])
    const r = raggioIngombro(tavolo)
    scatti.push({
      titolo: 'Dettaglio tavolo',
      posizione: [tavolo.x + d[0] * (r + 0.6), 1.75, tavolo.z + d[1] * (r + 0.6)],
      obiettivo: [tavolo.x, 0.7, tavolo.z],
      fov: 50,
      interno: dentro([tavolo.x, tavolo.z]),
      casaDiBambola: false,
    })
  }

  // 7. Area aperitivo con i tavoli alti e giardino visto dall'alto
  const cocktail = a.oggetti.filter((o) => o.tipo === 'cocktail')
  if (cocktail.length >= 3) {
    const c = baricentro(cocktail.map((o) => [o.x, o.z] as Punto))
    // Vista dal lato della sala verso l'esterno, con il giardino sullo sfondo
    const s = vistaSu({ x: c[0], z: c[1], tipo: 'cocktail' } as Oggetto, dentro(c) ? centroGlobale : centroSala, 'Area aperitivo', 1.1, 5)
    if (s) scatti.push(s)
  }
  const giardino = a.oggetti.find((o) => o.tipo === 'giardino')
  if (giardino && !dentro([giardino.x, giardino.z])) {
    const l = giardino.lunghezza ?? 20
    scatti.push({
      titolo: 'Giardino',
      posizione: [giardino.x - l * 0.45, l * 0.42, giardino.z + l * 0.55],
      obiettivo: [giardino.x, 0, giardino.z],
      fov: 50,
      interno: false,
      casaDiBambola: true,
    })
  }
  return scatti

  function occhio(titolo: string, p: Punto, obiettivo: [number, number, number], fov: number, interno: boolean, altezza = OCCHIO): Scatto {
    return { titolo, posizione: [p[0], Math.min(altezza, chiusa ? h - 0.4 : altezza), p[1]], obiettivo, fov, interno, casaDiBambola: false }
  }

  /** Camera ad altezza d'occhio davanti all'arredo, sul lato di "da", senza uscire dalla sua zona. */
  function vistaSu(o: Oggetto, da: Punto, titolo: string, altezzaObiettivo: number, distanzaMin = 3.5): Scatto | null {
    const interno = dentro([o.x, o.z])
    const lontano = Math.hypot(da[0] - o.x, da[1] - o.z) < 1.5
    const dir = normalizza(lontano ? [centroGlobale[0] - o.x + 0.6, centroGlobale[1] - o.z + 1] : [da[0] - o.x, da[1] - o.z])
    const ideale = Math.min(12, Math.max(distanzaMin, raggioIngombro(o) * 1.8 + 2.5))
    // Prova la distanza ideale, poi ruota leggermente e accorcia finché la camera è in una posizione libera
    for (const angolo of [0, 0.35, -0.35, 0.7, -0.7, Math.PI]) {
      const c = Math.cos(angolo), s = Math.sin(angolo)
      const d: Punto = [dir[0] * c - dir[1] * s, dir[0] * s + dir[1] * c]
      for (let t = ideale; t >= 2; t -= 0.25) {
        const p: Punto = [o.x + d[0] * t, o.z + d[1] * t]
        if (comodo(p, interno)) return occhio(titolo, p, [o.x, altezzaObiettivo, o.z], 55, interno)
      }
    }
    return null
  }
}
