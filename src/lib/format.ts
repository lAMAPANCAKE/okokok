// "always": in italiano anche 4 cifre col punto delle migliaia (2.814,05 €)
const raggruppa = { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions
export const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', ...raggruppa })
const numero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, ...raggruppa })
const percentuale = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })

export const formatEuro = (n: number | null | undefined) => euro.format(Number(n ?? 0))
export const formatOre = (n: number | null | undefined) => `${numero.format(Number(n ?? 0))} h`
export const formatPercentuale = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${percentuale.format(Number(n))}%`)

/** 'YYYY-MM-DD' in data locale senza slittamenti di fuso orario. */
export function dataLocale(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isoGiorno(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const oggiIso = () => isoGiorno(new Date())

export function formatData(iso: string, opzioni: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return dataLocale(iso).toLocaleDateString('it-IT', opzioni)
}

export function formatMese(iso: string) {
  const s = dataLocale(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const formatOra = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

export function intervalloOre(inizio: string | null, fine: string | null) {
  if (!inizio && !fine) return ''
  return `${formatOra(inizio)}–${formatOra(fine)}`
}

/** Durata prevista in ore; se la fine è prima dell'inizio il turno passa la mezzanotte. */
export function durataOre(inizio: string, fine: string): number {
  const min = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  let diff = min(fine) - min(inizio)
  if (diff <= 0) diff += 24 * 60
  return Math.round((diff / 60) * 100) / 100
}

export function nomeCompleto(p: { nome: string; cognome: string; email?: string } | null | undefined) {
  if (!p) return ''
  const n = `${p.nome} ${p.cognome}`.trim()
  return n || p.email || ''
}

export function inizialiNome(p: { nome: string; cognome: string; email?: string }) {
  const n = `${p.nome?.[0] ?? ''}${p.cognome?.[0] ?? ''}`.toUpperCase()
  return n || (p.email?.[0] ?? '?').toUpperCase()
}
