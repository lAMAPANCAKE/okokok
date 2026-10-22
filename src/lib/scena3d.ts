// Motore 3D dell'allestimento: costruisce sala, pareti con foto, planimetria e arredi
// con three.js e gestisce selezione e trascinamento (mouse e touch).
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { estensione, segmentiPareti, voceCatalogo, type Allestimento, type Oggetto, type Pavimento, type Punto, type TipoArredo } from './allestimento'

export type Vista = '3d' | 'pianta'
export type Modo = 'sposta' | 'pareti' | 'calibra'

export interface EventiScena {
  onSeleziona: (id: string | null) => void
  onSposta: (id: string, x: number, z: number) => void
  /** Tocco sul pavimento nelle modalità pareti e calibra */
  onPunto: (x: number, z: number) => void
}

const SPESSORE_PARETE = 0.15
const PASSO_GRIGLIA = 0.25

// ---------------------------------------------------------------------------
// Materiali condivisi
// ---------------------------------------------------------------------------
type Materiale = 'tovaglia' | 'oro' | 'cuscino' | 'legno' | 'legnoScuro' | 'nero' | 'metallo' | 'piatto' | 'foglie' | 'vaso' | 'fiori' | 'intonaco' | 'torta' | 'tessuto' | 'pista' | 'palco'
  | 'prato' | 'ghiaia' | 'telo' | 'vetro' | 'candela' | 'corteccia' | 'siepe' | 'fioriBianchi'

const mat = (colore: string, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color: colore, roughness, metalness, ...extra })

function textureCanvas(dim: number, disegna: (c: CanvasRenderingContext2D, dim: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = dim
  disegna(canvas.getContext('2d')!, dim)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

const rumore = (c: CanvasRenderingContext2D, dim: number, quanti: number, colori: string[], dimMax = 2) => {
  for (let i = 0; i < quanti; i++) {
    c.fillStyle = colori[i % colori.length]
    c.fillRect(Math.random() * dim, Math.random() * dim, 1 + Math.random() * dimMax, 1 + Math.random() * dimMax)
  }
}

// Ogni texture del pavimento rappresenta 2 × 2 m
const DISEGNI_PAVIMENTO: Record<Pavimento, (c: CanvasRenderingContext2D, d: number) => void> = {
  parquet: (c, d) => {
    // Listoni da 12,5 cm, lunghi 0,8–1,6 m, con giunti sfalsati
    const righe = 16, h = d / righe
    for (let r = 0; r < righe; r++) {
      let x = -Math.random() * 200
      while (x < d) {
        const l = 100 + Math.random() * 100
        const tono = 150 + Math.random() * 35
        c.fillStyle = `rgb(${tono + 30}, ${tono - 5}, ${tono - 55})`
        c.fillRect(x, r * h, l, h)
        c.strokeStyle = 'rgba(70,45,20,.4)'
        c.lineWidth = 1
        c.strokeRect(x + 0.5, r * h + 0.5, l, h - 0.5)
        x += l
      }
    }
    for (let i = 0; i < 600; i++) {
      c.strokeStyle = `rgba(90,55,25,${Math.random() * 0.12})`
      const y = Math.random() * d
      c.beginPath()
      c.moveTo(Math.random() * d, y)
      c.lineTo(Math.random() * d, y + (Math.random() - 0.5) * 2)
      c.stroke()
    }
  },
  marmo: (c, d) => {
    c.fillStyle = '#ece9e4'
    c.fillRect(0, 0, d, d)
    for (let i = 0; i < 14; i++) {
      c.strokeStyle = `rgba(120,115,110,${0.08 + Math.random() * 0.15})`
      c.lineWidth = 0.5 + Math.random() * 1.5
      c.beginPath()
      let x = Math.random() * d, y = Math.random() * d
      c.moveTo(x, y)
      for (let k = 0; k < 8; k++) c.lineTo((x += (Math.random() - 0.3) * 60), (y += (Math.random() - 0.5) * 60))
      c.stroke()
    }
    c.strokeStyle = 'rgba(90,90,90,.35)'
    for (let i = 0; i <= 2; i++) {
      c.strokeRect(0, (i * d) / 2, d, 0.01)
      c.strokeRect((i * d) / 2, 0, 0.01, d)
    }
  },
  cotto: (c, d) => {
    const n = 6, l = d / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const r = 170 + Math.random() * 30
        c.fillStyle = `rgb(${r}, ${r * 0.5}, ${r * 0.33})`
        c.fillRect(i * l + 1.5, j * l + 1.5, l - 3, l - 3)
      }
    c.globalCompositeOperation = 'destination-over'
    c.fillStyle = '#d9cbb5'
    c.fillRect(0, 0, d, d)
    c.globalCompositeOperation = 'source-over'
    rumore(c, d, 3000, ['rgba(90,40,20,.15)', 'rgba(255,220,180,.1)'])
  },
  cemento: (c, d) => {
    c.fillStyle = '#b9b8b3'
    c.fillRect(0, 0, d, d)
    rumore(c, d, 12000, ['rgba(80,80,80,.12)', 'rgba(255,255,255,.12)'], 3)
  },
  moquette: (c, d) => {
    c.fillStyle = '#5a2430'
    c.fillRect(0, 0, d, d)
    c.strokeStyle = 'rgba(214,170,90,.35)'
    c.lineWidth = 2
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        c.beginPath()
        c.arc((i + 0.5) * (d / 4), (j + 0.5) * (d / 4), d / 12, 0, Math.PI * 2)
        c.stroke()
      }
    rumore(c, d, 9000, ['rgba(0,0,0,.15)', 'rgba(255,255,255,.05)'])
  },
  prato: (c, d) => {
    c.fillStyle = '#5d8a3a'
    c.fillRect(0, 0, d, d)
    rumore(c, d, 16000, ['#4f7a30', '#6e9c45', '#7aa84f', '#47702a'], 3)
  },
}

const disegnaGhiaia = (c: CanvasRenderingContext2D, d: number) => {
  c.fillStyle = '#cfc6b4'
  c.fillRect(0, 0, d, d)
  rumore(c, d, 14000, ['#b8ae9a', '#e2dbcc', '#a39883', '#d8cfbd'], 4)
}

// ---------------------------------------------------------------------------
// Geometrie degli arredi (unite per materiale e messe in cache)
// ---------------------------------------------------------------------------
type Parte = [THREE.BufferGeometry, Materiale]

const pezzo = (g: THREE.BufferGeometry, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)))
  return g.translate(x, y, z)
}
const scatola = (l: number, h: number, p: number, x = 0, y = 0, z = 0, ry = 0) => pezzo(new THREE.BoxGeometry(l, h, p), x, y, z, ry)
const cilindro = (rSu: number, rGiu: number, h: number, x = 0, y = 0, z = 0, seg = 24) => pezzo(new THREE.CylinderGeometry(rSu, rGiu, h, seg), x, y, z)

/** Unisce più geometrie (anche senza indice) in una sola per ridurre le chiamate di disegno. */
function unisci(geometrie: THREE.BufferGeometry[]) {
  const pulite = geometrie.map((g) => {
    const n = g.index ? g.toNonIndexed() : g
    if (!n.getAttribute('uv')) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((n.getAttribute('position').count) * 2), 2))
    return n
  })
  const g = mergeGeometries(pulite)!
  geometrie.forEach((x) => x.dispose())
  return g
}

/** Sedia chiavarina: seduta all'origine, schienale verso +Z (chi siede guarda verso −Z). */
function partiSedia(): Parte[] {
  const telaio: THREE.BufferGeometry[] = [scatola(0.42, 0.04, 0.4, 0, 0.45, 0)]
  for (const sx of [-0.18, 0.18]) {
    for (const sz of [-0.17, 0.17]) telaio.push(cilindro(0.014, 0.012, 0.45, sx, 0.225, sz, 8))
    telaio.push(cilindro(0.014, 0.014, 0.52, sx, 0.72, 0.19, 8))
  }
  for (const y of [0.66, 0.78, 0.92]) telaio.push(scatola(0.36, 0.025, 0.02, 0, y, 0.19))
  return [[unisci(telaio), 'oro'], [scatola(0.39, 0.04, 0.37, 0, 0.49, -0.01), 'cuscino']]
}

function partiSgabello(): Parte[] {
  return [
    [unisci([cilindro(0.2, 0.2, 0.02, 0, 0.01, 0), cilindro(0.025, 0.025, 0.72, 0, 0.37, 0, 10), pezzo(new THREE.TorusGeometry(0.17, 0.012, 6, 20), 0, 0.3, 0, 0, Math.PI / 2)]), 'metallo'],
    [cilindro(0.19, 0.17, 0.06, 0, 0.76, 0), 'cuscino'],
  ]
}

/** Posizioni delle sedie attorno a un tavolo (coordinate locali, centro del tavolo all'origine). */
function postiTavolo(tipo: TipoArredo, sedie: number, lunghezza: number): { x: number; z: number }[] {
  if (tipo === 'tondo_150' || tipo === 'tondo_180' || tipo === 'torta') {
    const r = (tipo === 'tondo_150' ? 0.75 : 0.9) + 0.32
    return Array.from({ length: sedie }, (_, i) => {
      const a = (i / sedie) * Math.PI * 2
      return { x: Math.sin(a) * r, z: Math.cos(a) * r }
    })
  }
  const [l, p] = dimensioniTavolo(tipo, lunghezza)
  const perLato = Math.max(1, Math.floor(l / 0.6))
  const testate = Math.min(2, Math.max(0, sedie - 2 * perLato))
  const restanti = sedie - testate
  const latoA = Math.ceil(restanti / 2), latoB = Math.floor(restanti / 2)
  const posti: { x: number; z: number }[] = []
  for (const [n, z] of [[latoA, p / 2 + 0.3], [latoB, -p / 2 - 0.3]] as const)
    for (let i = 0; i < n; i++) posti.push({ x: -l / 2 + ((i + 0.5) * l) / n, z })
  if (testate >= 1) posti.push({ x: l / 2 + 0.3, z: 0 })
  if (testate >= 2) posti.push({ x: -l / 2 - 0.3, z: 0 })
  return posti
}

function dimensioniTavolo(tipo: TipoArredo, lunghezza: number): [number, number] {
  if (tipo === 'rettangolare') return [1.8, 0.8]
  if (tipo === 'quadrato') return [0.8, 0.8]
  return [lunghezza, 1.2]
}

/** Coperto (piatto e bicchiere) sul piano del tavolo; (ux, uz) punta verso la sedia. */
function coperti(posti: { x: number; z: number; ux: number; uz: number }[], altezza: number) {
  const pezzi: THREE.BufferGeometry[] = []
  for (const { x, z, ux, uz } of posti) {
    pezzi.push(cilindro(0.13, 0.12, 0.015, x, altezza + 0.008, z, 20))
    pezzi.push(cilindro(0.035, 0.03, 0.12, x - ux * 0.12 - uz * 0.13, altezza + 0.06, z - uz * 0.12 + ux * 0.13, 10))
  }
  return pezzi
}

/** Sedie rivolte verso il tavolo; (ux, uz) è la direzione dal tavolo alla sedia (di default dal centro). */
function sedieAttorno(posti: { x: number; z: number; ux?: number; uz?: number }[]): Parte[] {
  if (!posti.length) return []
  const [telaio, cuscino] = partiSedia()
  const t: THREE.BufferGeometry[] = [], c: THREE.BufferGeometry[] = []
  for (const p of posti) {
    const m = new THREE.Matrix4().makeRotationY(Math.atan2(p.ux ?? p.x, p.uz ?? p.z)).setPosition(p.x, 0, p.z)
    t.push(telaio[0].clone().applyMatrix4(m))
    c.push(cuscino[0].clone().applyMatrix4(m))
  }
  telaio[0].dispose()
  cuscino[0].dispose()
  return [[unisci(t), 'oro'], [unisci(c), 'cuscino']]
}

function centrotavola(x = 0, z = 0): Parte[] {
  return [
    [cilindro(0.06, 0.05, 0.22, x, 0.87, z, 12), 'piatto'],
    [pezzo(new THREE.IcosahedronGeometry(0.13, 1), x, 1.02, z), 'fiori'],
  ]
}

function costruisciParti(o: Oggetto, altezzaPareti: number): Parte[] {
  const v = voceCatalogo(o.tipo)
  const sedie = v.sedie ? Math.min(o.sedie ?? v.sedie.iniziali, o.tipo === 'imperiale' ? 200 : v.sedie.max) : 0
  const lunghezza = o.lunghezza ?? v.lunghezza?.iniziale ?? 1
  switch (o.tipo) {
    case 'tondo_150':
    case 'tondo_180': {
      const r = o.tipo === 'tondo_150' ? 0.75 : 0.9
      const posti = postiTavolo(o.tipo, sedie, 0)
      return [
        [unisci([cilindro(r + 0.03, r + 0.1, 0.76, 0, 0.38, 0, 48)]), 'tovaglia'],
        ...(posti.length ? [[unisci(coperti(posti.map((p) => {
          const ux = p.x / (r + 0.32), uz = p.z / (r + 0.32)
          return { x: ux * (r - 0.22), z: uz * (r - 0.22), ux, uz }
        }), 0.765)), 'piatto'] as Parte] : []),
        ...centrotavola(),
        ...sedieAttorno(posti),
      ]
    }
    case 'rettangolare':
    case 'quadrato':
    case 'imperiale': {
      const [l, p] = dimensioniTavolo(o.tipo, lunghezza)
      const posti = postiTavolo(o.tipo, sedie, lunghezza)
      const bordo = posti.map((s) => {
        const testata = Math.abs(s.x) > l / 2
        const ux = testata ? Math.sign(s.x) : 0, uz = testata ? 0 : Math.sign(s.z)
        return { x: testata ? ux * (l / 2 - 0.2) : s.x, z: testata ? 0 : uz * (p / 2 - 0.2), ux, uz }
      })
      const fiori: Parte[] = []
      const n = Math.max(1, Math.round(l / 1.8))
      for (let i = 0; i < n; i++) fiori.push(...centrotavola(-l / 2 + ((i + 0.5) * l) / n, 0))
      return [
        [scatola(l + 0.06, 0.76, p + 0.06, 0, 0.38, 0), 'tovaglia'],
        ...(bordo.length ? [[unisci(coperti(bordo, 0.765)), 'piatto'] as Parte] : []),
        ...fiori,
        ...sedieAttorno(posti.map((sd, k) => ({ ...sd, ux: bordo[k].ux, uz: bordo[k].uz }))),
      ]
    }
    case 'cocktail': {
      const profilo = [[0.3, 0], [0.24, 0.05], [0.1, 0.55], [0.3, 1.07], [0.32, 1.1], [0, 1.1]].map(([x, y]) => new THREE.Vector2(x, y))
      return [[new THREE.LatheGeometry(profilo, 32), 'tovaglia'], ...centrotavola().map(([g, m]) => [g.translate(0, 0.25, 0), m] as Parte)]
    }
    case 'sedia':
      return partiSedia()
    case 'sgabello':
      return partiSgabello()
    case 'lounge':
      return [
        [unisci([scatola(2, 0.38, 0.8, 0, 0.19, 0), scatola(2, 0.45, 0.18, 0, 0.6, 0.31), scatola(0.16, 0.3, 0.8, -0.92, 0.53, 0), scatola(0.16, 0.3, 0.8, 0.92, 0.53, 0)]), 'tessuto'],
        [unisci([-0.56, 0, 0.56].map((x) => scatola(0.54, 0.12, 0.6, x, 0.44, -0.06))), 'cuscino'],
      ]
    case 'buffet': {
      const vassoi: THREE.BufferGeometry[] = []
      const n = Math.max(1, Math.floor(lunghezza / 0.6))
      for (let i = 0; i < n; i++) {
        const x = -lunghezza / 2 + ((i + 0.5) * lunghezza) / n
        vassoi.push(scatola(0.5, 0.08, 0.32, x, 0.82, -0.05), pezzo(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16, 1, false, 0, Math.PI), x, 0.86, -0.05, 0, 0, Math.PI / 2))
      }
      return [[scatola(lunghezza, 0.78, 0.8, 0, 0.39, 0), 'tovaglia'], [unisci(vassoi), 'metallo']]
    }
    case 'bar':
      return [
        [unisci([scatola(lunghezza, 1.05, 0.6, 0, 0.525, 0), scatola(lunghezza, 0.08, 0.5, 0, 0.04, 0.6)]), 'legno'],
        [scatola(lunghezza + 0.1, 0.05, 0.75, 0, 1.075, -0.05), 'legnoScuro'],
        [unisci(Array.from({ length: Math.floor(lunghezza / 0.25) }, (_, i) => cilindro(0.035, 0.035, 0.28, -lunghezza / 2 + 0.15 + i * 0.25, 1.24, 0.1, 10))), 'foglie'],
      ]
    case 'torta':
      return [
        [cilindro(0.42, 0.48, 0.76, 0, 0.38, 0, 32), 'tovaglia'],
        [unisci([cilindro(0.2, 0.2, 0.14, 0, 0.83, 0), cilindro(0.15, 0.15, 0.13, 0, 0.965, 0), cilindro(0.1, 0.1, 0.12, 0, 1.09, 0)]), 'torta'],
        [pezzo(new THREE.IcosahedronGeometry(0.05, 1), 0, 1.18, 0), 'fiori'],
      ]
    case 'palco': {
      const p = Math.max(2, lunghezza * 0.75)
      return [
        [scatola(lunghezza, 0.36, p, 0, 0.18, 0), 'nero'],
        [scatola(lunghezza, 0.04, p, 0, 0.38, 0), 'palco'],
        [scatola(1, 0.2, 0.4, 0, 0.1, -p / 2 - 0.2), 'nero'],
      ]
    }
    case 'pista': {
      const g = scatola(lunghezza, 0.03, lunghezza, 0, 0.015, 0)
      const uv = g.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * lunghezza * 2, uv.getY(i) * lunghezza * 2)
      return [[g, 'pista']]
    }
    case 'dj':
      return [
        [unisci([scatola(1.6, 0.9, 0.7, 0, 0.45, 0)]), 'nero'],
        [scatola(1.62, 0.5, 0.02, 0, 0.55, -0.36), 'piatto'],
        [unisci([scatola(0.35, 0.06, 0.3, -0.5, 0.93, 0.05), scatola(0.35, 0.06, 0.3, 0.5, 0.93, 0.05), scatola(0.45, 0.04, 0.32, 0, 0.92, 0.05)]), 'metallo'],
      ]
    case 'cassa': {
      const gambe = [0, 1, 2].map((i) => pezzo(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), Math.sin((i * 2 * Math.PI) / 3) * 0.2, 0.4, Math.cos((i * 2 * Math.PI) / 3) * 0.2, 0, Math.cos((i * 2 * Math.PI) / 3) * 0.45, -Math.sin((i * 2 * Math.PI) / 3) * 0.45))
      return [
        [unisci([...gambe, cilindro(0.018, 0.018, 1.2, 0, 1.05, 0, 8)]), 'metallo'],
        [scatola(0.38, 0.6, 0.35, 0, 1.8, 0), 'nero'],
      ]
    }
    case 'pianta':
      return [
        [cilindro(0.24, 0.17, 0.45, 0, 0.225, 0), 'vaso'],
        [unisci([pezzo(new THREE.IcosahedronGeometry(0.38, 1), 0, 0.85, 0), pezzo(new THREE.IcosahedronGeometry(0.3, 1), 0.12, 1.2, 0.05), pezzo(new THREE.IcosahedronGeometry(0.22, 1), -0.08, 1.45, -0.05)]), 'foglie'],
      ]
    case 'colonna':
      return [[scatola(0.4, altezzaPareti, 0.4, 0, altezzaPareti / 2, 0), 'intonaco']]
    case 'sposi': {
      // Sposi seduti sul lato −Z, rivolti verso gli invitati (+Z)
      const p = 0.8
      const posti = Array.from({ length: sedie }, (_, i) => ({ x: -lunghezza / 2 + ((i + 0.5) * lunghezza) / sedie, z: -p / 2 - 0.3 }))
      const ghirlanda: [number, number, number][] = []
      for (let x = -lunghezza / 2 + 0.1; x <= lunghezza / 2 - 0.1; x += 0.22) ghirlanda.push([x, 0.62 + Math.sin(x * 3) * 0.08, p / 2 + 0.06])
      return [
        [scatola(lunghezza + 0.06, 0.76, p + 0.06, 0, 0.38, 0), 'tovaglia'],
        ...(posti.length ? [[unisci(coperti(posti.map((s) => ({ x: s.x, z: -p / 2 + 0.2, ux: 0, uz: -1 })), 0.765)), 'piatto'] as Parte] : []),
        ...fioriSu(ghirlanda, 0.09),
        ...centrotavola(0, 0.1),
        ...sedieAttorno(posti.map((sd) => ({ ...sd, ux: 0, uz: -1 }))),
      ]
    }
    case 'fila':
      return sedieInFila(sedie)
    case 'arco': {
      const fiori: [number, number, number][] = []
      for (const a of [0.15, 0.35, 0.55, 0.8, 2.3, 2.55, 2.8, 3.0]) fiori.push([Math.cos(a) * 1.2, 2.4 + Math.sin(a) * 1.2, 0])
      for (const sx of [-1.2, 1.2]) for (const y of [0.15, 0.4, 0.7]) fiori.push([sx, y, 0.08])
      return [
        [unisci([cilindro(0.05, 0.05, 2.4, -1.2, 1.2, 0, 10), cilindro(0.05, 0.05, 2.4, 1.2, 1.2, 0, 10), pezzo(new THREE.TorusGeometry(1.2, 0.05, 8, 40, Math.PI), 0, 2.4, 0)]), 'piatto'],
        ...fioriSu(fiori, 0.16),
      ]
    }
    case 'tappeto': {
      const petali: [number, number, number][] = []
      for (let x = -lunghezza / 2 + 0.3; x < lunghezza / 2; x += 0.9) petali.push([x, 0.06, -0.68], [x + 0.45, 0.06, 0.68])
      return [[uvInMetri(scatola(lunghezza, 0.02, 1.2, 0, 0.025, 0), 1, 1), 'tovaglia'], ...fioriSu(petali, 0.06).slice(0, -1)]
    }
    case 'lanterna':
      return [
        [scatola(0.24, 0.36, 0.24, 0, 0.2, 0), 'vetro'],
        [unisci([scatola(0.28, 0.03, 0.28, 0, 0.015, 0), pezzo(new THREE.ConeGeometry(0.2, 0.14, 4), 0, 0.45, 0, Math.PI / 4), pezzo(new THREE.TorusGeometry(0.05, 0.01, 6, 12), 0, 0.56, 0)]), 'nero'],
        [cilindro(0.04, 0.04, 0.12, 0, 0.09, 0, 12), 'candela'],
      ]
    case 'tableau':
      return [
        [unisci([pezzo(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6), -0.35, 0.93, 0.1, 0, -0.12, 0), pezzo(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6), 0.35, 0.93, 0.1, 0, -0.12, 0), pezzo(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6), 0, 0.93, -0.25, 0, 0.25, 0)]), 'legno'],
        [pezzo(new THREE.BoxGeometry(1, 1.4, 0.04), 0, 1.25, 0.03, 0, -0.12, 0), 'piatto'],
        [pezzo(new THREE.BoxGeometry(1.06, 0.06, 0.05), 0, 1.93, -0.06, 0, -0.12, 0), 'oro'],
        ...fioriSu([[-0.45, 1.95, 0], [0.45, 1.95, 0], [0, 0.6, 0.15]], 0.1),
      ]
    case 'confettata': {
      const vasi: THREE.BufferGeometry[] = []
      for (let i = 0; i < 7; i++) vasi.push(cilindro(0.06, 0.06, 0.18 + (i % 3) * 0.06, Math.cos(i) * 0.38, 0.86 + (i % 3) * 0.03, Math.sin(i) * 0.38, 12))
      return [
        [cilindro(0.6, 0.66, 0.76, 0, 0.38, 0, 40), 'tovaglia'],
        [unisci(vasi), 'vetro'],
        [unisci(Array.from({ length: 7 }, (_, i) => cilindro(0.05, 0.05, 0.1, Math.cos(i) * 0.38, 0.82, Math.sin(i) * 0.38, 10))), 'fioriBianchi'],
        ...centrotavola(),
      ]
    }
    case 'photobooth': {
      const fiori: [number, number, number][] = []
      for (let i = 0; i < 36; i++) fiori.push([-1.05 + (i % 6) * 0.42 + ((i / 6) % 2 ? 0.2 : 0), 0.35 + Math.floor(i / 6) * 0.38, 0.1])
      return [
        [scatola(2.4, 2.4, 0.1, 0, 1.3, 0), 'siepe'],
        [scatola(2.6, 0.1, 0.6, 0, 0.05, 0.1), 'legno'],
        ...fioriSu(fiori, 0.1),
      ]
    }
    case 'porta':
      return [
        [unisci([scatola(0.12, 2.9, 0.26, -1.16, 1.45, 0), scatola(0.12, 2.9, 0.26, 1.16, 1.45, 0), scatola(2.44, 0.14, 0.26, 0, 2.93, 0), scatola(0.06, 2.8, 0.06, 0, 1.4, 0), scatola(2.2, 0.06, 0.06, 0, 2.1, 0)]), 'legnoScuro'],
        [scatola(2.2, 2.8, 0.03, 0, 1.4, 0), 'vetro'],
      ]
    case 'gazebo': {
      const m = lunghezza / 2
      const pali = [[-m, -m], [m, -m], [m, m], [-m, m]].map(([x, z]) => cilindro(0.06, 0.06, 2.6, x, 1.3, z, 10))
      return [
        [unisci(pali), 'piatto'],
        [unisci([
          pezzo(new THREE.ConeGeometry(m * Math.SQRT2 * 1.02, 1.5, 4, 1, true), 0, 3.35, 0, Math.PI / 4),
          scatola(lunghezza, 0.3, 0.02, 0, 2.45, -m), scatola(lunghezza, 0.3, 0.02, 0, 2.45, m),
          scatola(0.02, 0.3, lunghezza, -m, 2.45, 0), scatola(0.02, 0.3, lunghezza, m, 2.45, 0),
        ]), 'telo'],
      ]
    }
    case 'albero':
      return [
        [cilindro(0.14, 0.22, 2.4, 0, 1.2, 0, 10), 'corteccia'],
        [unisci([pezzo(new THREE.IcosahedronGeometry(1.6, 1), 0, 3.3, 0), pezzo(new THREE.IcosahedronGeometry(1.2, 1), 0.7, 4.1, 0.3), pezzo(new THREE.IcosahedronGeometry(1.1, 1), -0.7, 3.8, -0.4)]), 'foglie'],
      ]
    case 'siepe':
      return [[uvInMetri(scatola(lunghezza, 1.2, 0.8, 0, 0.6, 0), lunghezza / 2, 0.6), 'siepe']]
    case 'giardino': {
      const p = Math.round(lunghezza * 0.7 * 10) / 10
      return [[uvInMetri(scatola(lunghezza, 0.02, p, 0, 0.01, 0), lunghezza, p), 'prato']]
    }
    case 'vialetto':
      return [[uvInMetri(scatola(lunghezza, 0.03, 2, 0, 0.015, 0), lunghezza, 2), 'ghiaia']]
  }
}

/** Scala le coordinate UV perché la texture (2 × 2 m) si ripeta in proporzione alle dimensioni reali. */
function uvInMetri(g: THREE.BufferGeometry, l: number, p: number) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * l, uv.getY(i) * p)
  return g
}

/** Sedie in fila lungo X, rivolte verso −Z. */
function sedieInFila(n: number, passo = 0.55): Parte[] {
  const [telaio, cuscino] = partiSedia()
  const t: THREE.BufferGeometry[] = [], c: THREE.BufferGeometry[] = []
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * passo
    t.push(telaio[0].clone().translate(x, 0, 0))
    c.push(cuscino[0].clone().translate(x, 0, 0))
  }
  telaio[0].dispose()
  cuscino[0].dispose()
  return n ? [[unisci(t), 'oro'], [unisci(c), 'cuscino']] : []
}

/** Ciuffi di fiori (rosa e bianchi) e verde attorno ai punti indicati. */
function fioriSu(punti: [number, number, number][], r = 0.12): Parte[] {
  const rosa: THREE.BufferGeometry[] = [], bianchi: THREE.BufferGeometry[] = [], verde: THREE.BufferGeometry[] = []
  punti.forEach(([x, y, z], i) => {
    ;(i % 3 === 0 ? bianchi : rosa).push(pezzo(new THREE.IcosahedronGeometry(r, 1), x, y, z))
    verde.push(pezzo(new THREE.IcosahedronGeometry(r * 0.9, 0), x + r * 0.8, y - r * 0.3, z + (i % 2 ? r : -r) * 0.6))
  })
  return [
    ...(rosa.length ? [[unisci(rosa), 'fiori'] as Parte] : []),
    ...(bianchi.length ? [[unisci(bianchi), 'fioriBianchi'] as Parte] : []),
    [unisci(verde), 'foglie'],
  ]
}

const chiaveOggetto = (o: Oggetto, altezza: number) => `${o.tipo}|${o.sedie ?? ''}|${o.lunghezza ?? ''}|${o.tipo === 'colonna' ? altezza : ''}`

// ---------------------------------------------------------------------------
// Scena
// ---------------------------------------------------------------------------
export class Scena3D {
  private renderer: THREE.WebGLRenderer
  private scena = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500)
  private controlli: OrbitControls
  private sole = new THREE.DirectionalLight('#fff6e8', 2.2)
  private sala = new THREE.Group()
  private arredi = new THREE.Group()
  private aiuti = new THREE.Group()
  private griglia: THREE.GridHelper | null = null
  private evidenzia = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0ea5e9', transparent: true, opacity: 0.35, depthWrite: false }))
  private materiali: Record<Materiale, THREE.MeshStandardMaterial>
  private cacheParti = new Map<string, Parte[]>()
  private oggetti = new Map<string, { gruppo: THREE.Group; chiave: string }>()
  private textures = new Map<string, THREE.Texture>()
  private texturePavimento = new Map<Pavimento, THREE.Texture>()
  private caricatore = new THREE.TextureLoader()
  private raycaster = new THREE.Raycaster()
  private pianoTerra = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private osservatore: ResizeObserver
  private pareti: THREE.Mesh[] = []
  private firmaSala = ''
  private allestimento: Allestimento | null = null
  private selezionato: string | null = null
  private vista: Vista = '3d'
  private modo: Modo = 'sposta'
  private aggancio = true
  private numeri = true
  private etichette = new THREE.Group()
  private anteprima: THREE.Line
  private trascinamento: { id: string; dx: number; dz: number; pointerId: number } | null = null
  private inizioTocco: { x: number; y: number } | null = null
  private marcatoriExtra: Punto[] = []
  private renderRichiesto = false
  private distrutta = false

  private contenitore: HTMLElement
  private eventi: EventiScena

  constructor(contenitore: HTMLElement, eventi: EventiScena) {
    this.contenitore = contenitore
    this.eventi = eventi
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const tela = this.renderer.domElement
    tela.style.touchAction = 'none'
    tela.style.display = 'block'
    contenitore.appendChild(tela)

    // I gestori della scena vanno registrati prima di OrbitControls: così un tocco su un arredo
    // disattiva la rotazione della camera prima che i controlli lo ricevano.
    tela.addEventListener('pointerdown', this.giu)
    tela.addEventListener('pointermove', this.muovi)
    tela.addEventListener('pointerup', this.su)
    tela.addEventListener('pointercancel', this.su)
    this.controlli = new OrbitControls(this.camera, tela)
    this.controlli.addEventListener('change', this.richiedi)
    this.controlli.maxDistance = 150
    this.controlli.minDistance = 1

    this.caricatore.setCrossOrigin('anonymous')
    this.scena.background = new THREE.Color('#e8edf2')
    this.scena.fog = new THREE.Fog('#e8edf2', 60, 160)
    this.scena.add(new THREE.HemisphereLight('#ffffff', '#b8a68e', 1.4))
    this.sole.position.set(10, 22, 8)
    this.sole.castShadow = true
    this.sole.shadow.mapSize.set(4096, 4096)
    this.sole.shadow.bias = -0.0004
    this.sole.shadow.normalBias = 0.03
    this.scena.add(this.sole, this.sole.target)

    const terreno = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), mat('#d9dfe5', 1))
    terreno.position.y = -0.02
    terreno.receiveShadow = true
    this.scena.add(terreno, this.sala, this.arredi, this.aiuti, this.etichette)

    const tovaglia = mat('#fbfaf7', 0.95)
    this.materiali = {
      tovaglia,
      oro: mat('#c8a24f', 0.35, 0.7),
      cuscino: mat('#f1ece2', 0.9),
      legno: mat('#8a5a35', 0.6),
      legnoScuro: mat('#3b2a1e', 0.4),
      nero: mat('#1f2328', 0.6),
      metallo: mat('#c9ccd1', 0.25, 0.9),
      piatto: mat('#ffffff', 0.3),
      foglie: mat('#3f7a3a', 0.8, 0, { flatShading: true }),
      vaso: mat('#b5643c', 0.8),
      fiori: mat('#e8a3b5', 0.7, 0, { flatShading: true }),
      intonaco: mat('#ece7df', 0.95),
      torta: mat('#fff4ec', 0.6),
      tessuto: mat('#55606e', 0.95),
      pista: new THREE.MeshStandardMaterial({
        roughness: 0.25,
        metalness: 0.2,
        map: textureCanvas(128, (c, d) => {
          c.fillStyle = '#16181c'
          c.fillRect(0, 0, d, d)
          c.fillStyle = '#e9e5dc'
          c.fillRect(0, 0, d / 2, d / 2)
          c.fillRect(d / 2, d / 2, d / 2, d / 2)
        }),
      }),
      palco: mat('#2b2f36', 0.5),
      prato: new THREE.MeshStandardMaterial({ roughness: 1, map: textureCanvas(256, DISEGNI_PAVIMENTO.prato) }),
      ghiaia: new THREE.MeshStandardMaterial({ roughness: 1, map: textureCanvas(256, disegnaGhiaia) }),
      telo: mat('#fbfaf7', 0.9, 0, { side: THREE.DoubleSide, transparent: true, opacity: 0.88 }),
      vetro: mat('#b9d7e8', 0.1, 0.1, { transparent: true, opacity: 0.4 }),
      candela: mat('#fff2d0', 0.6, 0, { emissive: '#ffb347', emissiveIntensity: 1.6 }),
      corteccia: mat('#6b4a32', 0.9),
      siepe: mat('#2f5e2c', 1, 0, { map: textureCanvas(128, (c, d) => { c.fillStyle = '#2f5e2c'; c.fillRect(0, 0, d, d); rumore(c, d, 3000, ['#24501f', '#3f7a3a', '#4a8a42'], 4) }) }),
      fioriBianchi: mat('#fbf7f0', 0.7, 0, { flatShading: true }),
    }
    for (const m of [this.materiali.pista, this.materiali.prato, this.materiali.ghiaia, this.materiali.siepe]) m.map!.repeat.set(0.5, 0.5)
    this.materiali.siepe.color.set('#ffffff')

    this.evidenzia.position.y = 0.012
    this.evidenzia.renderOrder = 2
    this.evidenzia.visible = false

    this.anteprima = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#0ea5e9', depthTest: false }))
    this.anteprima.renderOrder = 5
    this.anteprima.visible = false
    this.scena.add(this.anteprima)

    this.osservatore = new ResizeObserver(() => this.ridimensiona())
    this.osservatore.observe(contenitore)
    this.ridimensiona()
    this.impostaVista('3d')
  }

  // ------------------------------------------------------------------ API

  aggiorna(a: Allestimento, urlFoto: Map<string, string>) {
    const prima = this.allestimento
    this.allestimento = a
    const firma = JSON.stringify([a.pareti, a.pavimento, a.planimetria, a.foto_pareti, [...urlFoto.keys()].sort()])
    if (firma !== this.firmaSala) {
      this.firmaSala = firma
      this.costruisciSala(a, urlFoto)
      if (!prima) this.inquadra()
    }
    this.costruisciArredi(a)
    this.adattaEstensione(a)
    this.aggiornaAiuti()
    this.richiedi()
  }

  seleziona(id: string | null) {
    this.selezionato = id
    this.posizionaEvidenzia()
    this.richiedi()
  }

  impostaVista(vista: Vista) {
    this.vista = vista
    const c = this.controlli
    if (vista === 'pianta') {
      c.enableRotate = false
      c.minPolarAngle = 0
      c.maxPolarAngle = 0
      c.mouseButtons.LEFT = THREE.MOUSE.PAN
      c.touches.ONE = THREE.TOUCH.PAN
      c.screenSpacePanning = true
    } else {
      c.enableRotate = true
      c.minPolarAngle = 0
      c.maxPolarAngle = Math.PI / 2 - 0.04
      c.mouseButtons.LEFT = THREE.MOUSE.ROTATE
      c.touches.ONE = THREE.TOUCH.ROTATE
      c.screenSpacePanning = false
    }
    this.inquadra()
  }

  impostaModo(modo: Modo) {
    this.modo = modo
    this.anteprima.visible = false
    this.aggiornaAiuti()
    this.richiedi()
  }

  impostaAggancio(attivo: boolean) {
    this.aggancio = attivo
    if (this.griglia) this.griglia.visible = attivo
    this.richiedi()
  }

  impostaNumeri(attivi: boolean) {
    this.numeri = attivi
    this.etichette.visible = attivi
    this.richiedi()
  }

  /** Punti provvisori da evidenziare (es. calibrazione della planimetria). */
  marcatori(punti: Punto[]) {
    this.marcatoriExtra = punti
    this.aggiornaAiuti()
    this.richiedi()
  }

  /** Punto del pavimento al centro della vista, dove aggiungere un nuovo arredo. */
  centro(): Punto {
    const t = this.controlli.target
    return [t.x, t.z]
  }

  inquadra() {
    const [x0, z0, x1, z1] = this.allestimento ? estensione(this.allestimento) : [-6, -5, 6, 5]
    const box = new THREE.Box2(new THREE.Vector2(x0, z0), new THREE.Vector2(x1, z1))
    const centro = box.getCenter(new THREE.Vector2())
    const dim = box.getSize(new THREE.Vector2())
    const aspetto = Math.max(this.camera.aspect, 0.3)
    const lato = Math.max(dim.y, dim.x / aspetto, 4)
    const distanza = (lato / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * (this.vista === 'pianta' ? 1.1 : 1.3)
    this.controlli.target.set(centro.x, 0, centro.y)
    if (this.vista === 'pianta') this.camera.position.set(centro.x, distanza, centro.y + 0.001)
    else this.camera.position.set(centro.x + distanza * 0.35, distanza * 0.75, centro.y + distanza * 0.75)
    this.controlli.update()
    this.richiedi()
  }

  /** Render ad alta risoluzione della vista corrente, senza gli aiuti di modifica. */
  async foto(): Promise<Blob> {
    const nascosti = [this.evidenzia, this.aiuti, this.anteprima, this.griglia].filter((o): o is NonNullable<typeof o> => !!o && o.visible)
    nascosti.forEach((o) => (o.visible = false))
    const rapporto = this.renderer.getPixelRatio()
    const larghezza = this.contenitore.clientWidth
    this.renderer.setPixelRatio(Math.min(4, Math.max(2, 2400 / Math.max(larghezza, 1))))
    this.disegna()
    const url = this.renderer.domElement.toDataURL('image/png')
    this.renderer.setPixelRatio(rapporto)
    nascosti.forEach((o) => (o.visible = true))
    this.richiedi()
    return (await fetch(url)).blob()
  }

  distruggi() {
    this.distrutta = true
    this.osservatore.disconnect()
    this.controlli.dispose()
    const tela = this.renderer.domElement
    tela.removeEventListener('pointerdown', this.giu)
    tela.removeEventListener('pointermove', this.muovi)
    tela.removeEventListener('pointerup', this.su)
    tela.removeEventListener('pointercancel', this.su)
    this.scena.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Sprite) {
        o.geometry?.dispose()
        const m = o.material as THREE.Material | THREE.Material[]
        ;(Array.isArray(m) ? m : [m]).forEach((x) => x.dispose())
      }
    })
    this.cacheParti.forEach((parti) => parti.forEach(([g]) => g.dispose()))
    Object.values(this.materiali).forEach((m) => m.dispose())
    this.textures.forEach((t) => t.dispose())
    this.texturePavimento.forEach((t) => t.dispose())
    this.renderer.dispose()
    tela.remove()
  }

  // ------------------------------------------------------------------ costruzione

  private costruisciSala(a: Allestimento, urlFoto: Map<string, string>) {
    for (const figlio of [...this.sala.children]) {
      this.sala.remove(figlio)
      figlio.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => m.dispose())
        }
      })
    }
    this.pareti = []
    const { punti, chiusa, altezza } = a.pareti

    // Pavimento: il poligono della stanza, oppure un'area di 30 × 30 m
    const texture = this.pavimento(a.pavimento)
    let geoPavimento: THREE.BufferGeometry
    if (chiusa && punti.length > 2) {
      const forma = new THREE.Shape(punti.map(([x, z]) => new THREE.Vector2(x, -z)))
      geoPavimento = new THREE.ShapeGeometry(forma).rotateX(-Math.PI / 2)
    } else {
      geoPavimento = new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2)
      const uv = geoPavimento.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 30, uv.getY(i) * 30)
    }
    const pavimento = new THREE.Mesh(geoPavimento, new THREE.MeshStandardMaterial({ map: texture, roughness: a.pavimento === 'marmo' ? 0.35 : 0.85 }))
    pavimento.receiveShadow = true
    this.sala.add(pavimento)

    // Planimetria appoggiata sul pavimento
    const pl = a.planimetria
    const urlPl = pl && urlFoto.get(pl.file_path)
    if (pl && urlPl) {
      const materiale = new THREE.MeshBasicMaterial({ transparent: true, opacity: pl.opacita, depthWrite: false, toneMapped: false })
      const piano = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), materiale)
      piano.position.set(pl.x, 0.004, pl.z)
      piano.renderOrder = 1
      piano.visible = false
      this.texture(urlPl, (t) => {
        const img = t.image as { width: number; height: number }
        piano.scale.set(pl.larghezza, 1, (pl.larghezza * img.height) / img.width)
        materiale.map = t
        materiale.needsUpdate = true
        piano.visible = true
        this.richiedi()
      })
      this.sala.add(piano)
    }

    // Pareti: un parallelepipedo per segmento, con l'eventuale foto sul lato interno
    const segmenti = segmentiPareti(a.pareti)
    let orientamento = 0
    for (let i = 0; i < punti.length; i++) {
      const [x1, z1] = punti[i], [x2, z2] = punti[(i + 1) % punti.length]
      orientamento += x1 * z2 - x2 * z1
    }
    const baricentro = punti.reduce((s, [x, z]) => [s[0] + x / punti.length, s[1] + z / punti.length], [0, 0])
    segmenti.forEach(([[x1, z1], [x2, z2]], i) => {
      const dx = x2 - x1, dz = z2 - z1
      const l = Math.hypot(dx, dz)
      if (l < 0.01) return
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2
      // Normale verso l'interno della stanza (lato sinistro se il poligono è in senso orario sullo schermo)
      let nx = -dz / l, nz = dx / l
      const segno = chiusa && punti.length > 2 ? Math.sign(orientamento) : Math.sign(nx * (baricentro[0] - mx) + nz * (baricentro[1] - mz)) || 1
      nx *= segno
      nz *= segno
      const intonaco = () => mat('#ece7df', 0.95, 0, { transparent: true })
      const cima = mat('#4b5563', 0.9, 0, { transparent: true })
      const interno = intonaco()
      // Ordine delle facce di BoxGeometry: +x, −x, +y, −y, +z, −z
      const facce = [intonaco(), intonaco(), cima, intonaco(), segno > 0 ? interno : intonaco(), segno > 0 ? intonaco() : interno]
      const foto = a.foto_pareti[String(i)]
      const url = foto && urlFoto.get(foto)
      if (url) {
        this.texture(url, (t) => {
          interno.map = t
          interno.color.set('#ffffff')
          interno.needsUpdate = true
          this.richiedi()
        })
      }
      const parete = new THREE.Mesh(new THREE.BoxGeometry(l + SPESSORE_PARETE, altezza, SPESSORE_PARETE), facce)
      parete.position.set(mx, altezza / 2, mz)
      parete.rotation.y = Math.atan2(-dz, dx)
      // Le pareti non fanno ombra: la luce simula l'illuminazione dall'alto di una sala coperta
      parete.receiveShadow = true
      parete.userData = { normale: new THREE.Vector3(nx, 0, nz), centro: new THREE.Vector3(mx, altezza / 2, mz) }
      this.pareti.push(parete)
      this.sala.add(parete)
    })

  }

  /** Griglia di aggancio (1 m) e ombre dimensionate su pareti e arredi. */
  private firmaEstensione = ''
  private adattaEstensione(a: Allestimento) {
    const [x0, z0, x1, z1] = estensione(a).map((v) => Math.round(v))
    const firma = [x0, z0, x1, z1].join()
    if (firma === this.firmaEstensione) return
    this.firmaEstensione = firma
    const centro = new THREE.Vector2((x0 + x1) / 2, (z0 + z1) / 2)
    const lato = Math.ceil(Math.max(x1 - x0, z1 - z0)) + 4
    if (this.griglia) {
      this.scena.remove(this.griglia)
      this.griglia.dispose()
    }
    this.griglia = new THREE.GridHelper(lato, lato, '#64748b', '#94a3b8')
    ;(this.griglia.material as THREE.Material).transparent = true
    ;(this.griglia.material as THREE.Material).opacity = 0.25
    ;(this.griglia.material as THREE.Material).depthWrite = false
    this.griglia.position.set(Math.round(centro.x), 0.006, Math.round(centro.y))
    this.griglia.visible = this.aggancio
    this.scena.add(this.griglia)

    const ombra = this.sole.shadow.camera
    const meta = lato / 2 + 2
    ombra.left = -meta
    ombra.right = meta
    ombra.top = meta
    ombra.bottom = -meta
    ombra.near = 1
    ombra.far = 120
    ombra.updateProjectionMatrix()
    this.sole.target.position.set(centro.x, 0, centro.y)
    this.sole.position.set(centro.x + 4, 30, centro.y + 3)
  }

  private costruisciArredi(a: Allestimento) {
    const presenti = new Set(a.oggetti.map((o) => o.id))
    for (const [id, { gruppo }] of this.oggetti) {
      if (!presenti.has(id)) {
        this.arredi.remove(gruppo)
        this.oggetti.delete(id)
      }
    }
    for (const o of a.oggetti) {
      const chiave = chiaveOggetto(o, a.pareti.altezza)
      let voce = this.oggetti.get(o.id)
      if (!voce || voce.chiave !== chiave) {
        if (voce) this.arredi.remove(voce.gruppo)
        let parti = this.cacheParti.get(chiave)
        if (!parti) {
          parti = costruisciParti(o, a.pareti.altezza)
          this.cacheParti.set(chiave, parti)
        }
        const gruppo = new THREE.Group()
        for (const [g, m] of parti) {
          const mesh = new THREE.Mesh(g, this.materiali[m])
          mesh.castShadow = !['pista', 'prato', 'ghiaia', 'vetro'].includes(m)
          mesh.receiveShadow = true
          gruppo.add(mesh)
        }
        // Impronta a terra per l'evidenziazione della selezione
        const box = new THREE.Box3().setFromObject(gruppo)
        gruppo.userData = { id: o.id, impronta: { cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, l: box.max.x - box.min.x, p: box.max.z - box.min.z }, altezza: box.max.y }
        voce = { gruppo, chiave }
        this.oggetti.set(o.id, voce)
        this.arredi.add(gruppo)
      }
      if (this.trascinamento?.id !== o.id) voce.gruppo.position.set(o.x, 0, o.z)
      voce.gruppo.rotation.y = THREE.MathUtils.degToRad(-o.rot)
    }
    this.costruisciEtichette(a)
    this.posizionaEvidenzia()
  }

  /** Numero dei tavoli (T1, T2…) sopra ciascun tavolo, nell'ordine di inserimento. */
  private costruisciEtichette(a: Allestimento) {
    for (const s of [...this.etichette.children] as THREE.Sprite[]) {
      this.etichette.remove(s)
      s.material.map?.dispose()
      s.material.dispose()
    }
    let n = 0
    for (const o of a.oggetti) {
      const v = voceCatalogo(o.tipo)
      if (!v.sedie || v.categoria !== 'Tavoli') continue
      const testo = o.tipo === 'sposi' ? 'Sposi' : `T${++n}`
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 64
      const c = canvas.getContext('2d')!
      c.fillStyle = 'rgba(15,23,42,.85)'
      c.beginPath()
      c.roundRect(4, 4, 120, 56, 28)
      c.fill()
      c.fillStyle = '#fff'
      c.font = 'bold 34px system-ui, sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.font = `bold ${testo.length > 3 ? 26 : 34}px system-ui, sans-serif`
      c.fillText(testo, 64, 34)
      const t = new THREE.CanvasTexture(canvas)
      t.colorSpace = THREE.SRGBColorSpace
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, toneMapped: false }))
      s.scale.set(0.7, 0.35, 1)
      s.position.set(o.x, 1.5, o.z)
      s.renderOrder = 10
      s.userData.id = o.id
      this.etichette.add(s)
    }
    this.etichette.visible = this.numeri
  }

  private posizionaEvidenzia() {
    const voce = this.selezionato ? this.oggetti.get(this.selezionato) : null
    if (!voce) {
      this.evidenzia.removeFromParent()
      this.evidenzia.visible = false
      return
    }
    const { cx, cz, l, p } = voce.gruppo.userData.impronta
    this.evidenzia.scale.set(l + 0.2, 1, p + 0.2)
    this.evidenzia.position.set(cx, 0.012, cz)
    this.evidenzia.visible = true
    voce.gruppo.add(this.evidenzia)
  }

  /** Vertici delle pareti (in modalità pareti) e marcatori di calibrazione. */
  private aggiornaAiuti() {
    for (const o of [...this.aiuti.children] as THREE.Mesh[]) {
      this.aiuti.remove(o)
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
    const punti: { p: Punto; colore: string }[] = this.marcatoriExtra.map((p) => ({ p, colore: '#f97316' }))
    if (this.modo === 'pareti' && this.allestimento)
      this.allestimento.pareti.punti.forEach((p, i) => punti.push({ p, colore: i === 0 ? '#16a34a' : '#0ea5e9' }))
    for (const { p, colore } of punti) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 20), new THREE.MeshBasicMaterial({ color: colore, depthTest: false }))
      m.position.set(p[0], 0.05, p[1])
      m.renderOrder = 6
      this.aiuti.add(m)
    }
  }

  private pavimento(tipo: Pavimento) {
    let t = this.texturePavimento.get(tipo)
    if (!t) {
      t = textureCanvas(512, DISEGNI_PAVIMENTO[tipo])
      t.repeat.set(0.5, 0.5)
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      this.texturePavimento.set(tipo, t)
    }
    return t
  }

  private texture(url: string, pronta: (t: THREE.Texture) => void) {
    const esistente = this.textures.get(url)
    if (esistente) return pronta(esistente)
    this.caricatore.load(url, (t) => {
      if (this.distrutta) return t.dispose()
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      this.textures.set(url, t)
      pronta(t)
    })
  }

  // ------------------------------------------------------------------ interazione

  private puntoPavimento(e: PointerEvent): THREE.Vector3 | null {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera)
    return this.raycaster.ray.intersectPlane(this.pianoTerra, new THREE.Vector3())
  }

  private oggettoSotto(e: PointerEvent): string | null {
    this.puntoPavimento(e)
    const colpi = this.raycaster.intersectObjects([...this.arredi.children, ...(this.numeri ? this.etichette.children : [])], true)
    for (const c of colpi) {
      let o: THREE.Object3D | null = c.object
      while (o && !o.userData.id) o = o.parent
      if (o) return o.userData.id as string
    }
    return null
  }

  /** Punto per le pareti: aggancio a 10 cm, agli assi rispetto al punto precedente e al primo punto. */
  private puntoParete(p: THREE.Vector3): Punto {
    const punti = this.allestimento?.pareti.punti ?? []
    let x = Math.round(p.x * 10) / 10, z = Math.round(p.z * 10) / 10
    const primo = punti[0], ultimo = punti[punti.length - 1]
    if (primo && punti.length > 2 && Math.hypot(x - primo[0], z - primo[1]) < 0.4) return primo
    if (ultimo) {
      if (Math.abs(z - ultimo[1]) < Math.abs(x - ultimo[0]) * 0.14) z = ultimo[1]
      else if (Math.abs(x - ultimo[0]) < Math.abs(z - ultimo[1]) * 0.14) x = ultimo[0]
    }
    return [x, z]
  }

  private giu = (e: PointerEvent) => {
    if (!e.isPrimary) return
    this.inizioTocco = { x: e.clientX, y: e.clientY }
    if (this.modo !== 'sposta') return
    const id = this.oggettoSotto(e)
    if (!id || this.allestimento?.oggetti.find((o) => o.id === id)?.bloccato) return
    const voce = this.oggetti.get(id)
    const p = this.puntoPavimento(e)
    if (!voce || !p) return
    this.controlli.enabled = false
    this.trascinamento = { id, dx: voce.gruppo.position.x - p.x, dz: voce.gruppo.position.z - p.z, pointerId: e.pointerId }
    this.renderer.domElement.setPointerCapture(e.pointerId)
    if (this.selezionato !== id) {
      this.seleziona(id)
      this.eventi.onSeleziona(id)
    }
  }

  private muovi = (e: PointerEvent) => {
    if (this.trascinamento && e.pointerId === this.trascinamento.pointerId) {
      const p = this.puntoPavimento(e)
      const voce = this.oggetti.get(this.trascinamento.id)
      if (!p || !voce) return
      let x = p.x + this.trascinamento.dx, z = p.z + this.trascinamento.dz
      if (this.aggancio) {
        x = Math.round(x / PASSO_GRIGLIA) * PASSO_GRIGLIA
        z = Math.round(z / PASSO_GRIGLIA) * PASSO_GRIGLIA
      }
      voce.gruppo.position.set(x, 0, z)
      const etichetta = this.etichette.children.find((s) => s.userData.id === this.trascinamento!.id)
      etichetta?.position.set(x, 1.5, z)
      this.richiedi()
      return
    }
    if (this.modo === 'pareti' && e.pointerType === 'mouse') {
      const punti = this.allestimento?.pareti.punti ?? []
      const ultimo = punti[punti.length - 1]
      const p = this.puntoPavimento(e)
      if (!ultimo || !p || this.allestimento?.pareti.chiusa) return
      const [x, z] = this.puntoParete(p)
      this.anteprima.geometry.setFromPoints([new THREE.Vector3(ultimo[0], 0.06, ultimo[1]), new THREE.Vector3(x, 0.06, z)])
      this.anteprima.visible = true
      this.richiedi()
    }
  }

  private su = (e: PointerEvent) => {
    if (!e.isPrimary) return
    const t = this.trascinamento
    if (t && e.pointerId === t.pointerId) {
      this.trascinamento = null
      this.inizioTocco = null
      this.controlli.enabled = true
      const voce = this.oggetti.get(t.id)
      if (voce) this.eventi.onSposta(t.id, Math.round(voce.gruppo.position.x * 100) / 100, Math.round(voce.gruppo.position.z * 100) / 100)
      return
    }
    const inizio = this.inizioTocco
    this.inizioTocco = null
    if (!inizio || Math.hypot(e.clientX - inizio.x, e.clientY - inizio.y) > 6 || e.type === 'pointercancel') return
    // Tocco senza trascinamento
    if (this.modo === 'sposta') {
      // Tocco su un arredo bloccato: si seleziona senza spostarlo
      const id = this.oggettoSotto(e)
      this.seleziona(id)
      this.eventi.onSeleziona(id)
      return
    }
    const p = this.puntoPavimento(e)
    if (!p) return
    const [x, z] = this.modo === 'pareti' ? this.puntoParete(p) : [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]
    this.anteprima.visible = false
    this.eventi.onPunto(x, z)
  }

  // ------------------------------------------------------------------ render

  private ridimensiona() {
    const l = this.contenitore.clientWidth, h = this.contenitore.clientHeight
    if (!l || !h) return
    this.renderer.setSize(l, h)
    this.camera.aspect = l / h
    this.camera.updateProjectionMatrix()
    this.richiedi()
  }

  private richiedi = () => {
    if (this.renderRichiesto || this.distrutta) return
    this.renderRichiesto = true
    requestAnimationFrame(() => {
      this.renderRichiesto = false
      if (!this.distrutta) this.disegna()
    })
  }

  private disegna() {
    // Nebbia solo all'orizzonte, qualunque sia lo zoom
    const nebbia = this.scena.fog as THREE.Fog
    const distanza = this.camera.position.distanceTo(this.controlli.target)
    nebbia.near = distanza * 1.6
    nebbia.far = distanza * 4 + 40
    // Le pareti tra la camera e la sala diventano trasparenti, come in una casa delle bambole
    const cam = this.camera.position
    for (const p of this.pareti) {
      const { normale, centro } = p.userData as { normale: THREE.Vector3; centro: THREE.Vector3 }
      const fuori = this.vista === '3d' && cam.clone().sub(centro).dot(normale) < 0
      for (const m of p.material as THREE.MeshStandardMaterial[]) {
        m.opacity = fuori ? 0.12 : 1
        m.depthWrite = !fuori
      }
    }
    this.renderer.render(this.scena, this.camera)
  }
}
