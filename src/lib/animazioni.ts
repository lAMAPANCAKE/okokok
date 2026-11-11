// Animazioni dell'interfaccia (GSAP): brevi, e spente per chi ha chiesto meno movimento.
import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

const menoMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * I figli diretti dell'elemento (o quelli indicati da `selettore`) entrano uno dopo l'altro,
 * con dissolvenza e piccolo scorrimento, quando `pronto` diventa vero.
 * Alla fine gli stili vengono tolti: sticky e focus restano intatti.
 */
export function useEntrata<T extends HTMLElement>(pronto = true, selettore?: string) {
  const ref = useRef<T>(null)
  useGSAP(() => {
    if (!pronto || !ref.current || menoMovimento()) return
    gsap.from(selettore ? ref.current.querySelectorAll(selettore) : ref.current.children, { opacity: 0, y: 14, duration: 0.4, ease: 'power2.out', stagger: { amount: 0.35 }, clearProps: 'opacity,transform' })
  }, { dependencies: [pronto], scope: ref })
  return ref
}

/** Da usare come `ref`: l'elemento compare con una leggera crescita appena viene montato. */
export function compare(el: HTMLElement | null) {
  if (!el || menoMovimento()) return
  gsap.from(el, { opacity: 0, scale: 0.96, y: 10, duration: 0.45, ease: 'power2.out', clearProps: 'opacity,transform' })
}

/** Da usare come `ref`: una sezione arrivata dopo (dati caricati più tardi) sale al suo posto. */
export function sale(el: HTMLElement | null) {
  if (!el || menoMovimento()) return
  gsap.from(el, { opacity: 0, y: 14, duration: 0.4, ease: 'power2.out', clearProps: 'opacity,transform' })
}

/** Da usare come `ref` su finestre a tutto schermo e sfondi scuri: semplice dissolvenza. */
export function sfuma(el: HTMLElement | null) {
  if (!el || menoMovimento()) return
  gsap.from(el, { opacity: 0, duration: 0.2, ease: 'power1.out', clearProps: 'opacity' })
}

/** Da usare come `ref` su un foglio: sale dal basso sul telefono, cresce dal centro su schermi larghi. */
export function apreFoglio(el: HTMLElement | null) {
  if (!el || menoMovimento()) return
  if (window.matchMedia('(min-width: 768px)').matches) gsap.from(el, { opacity: 0, scale: 0.95, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,transform' })
  else gsap.from(el, { yPercent: 100, duration: 0.3, ease: 'power3.out', clearProps: 'transform' })
}

/** Chiude un foglio aperto con `apreFoglio` (e sfuma lo sfondo), poi chiama `fatto`. */
export function chiudeFoglio(foglio: HTMLElement | null, sfondo: HTMLElement | null, fatto: () => void) {
  if (!foglio || menoMovimento()) return fatto()
  const largo = window.matchMedia('(min-width: 768px)').matches
  gsap.to(foglio, { ...(largo ? { opacity: 0, scale: 0.95 } : { yPercent: 100 }), duration: 0.2, ease: 'power2.in', onComplete: fatto })
  if (sfondo) gsap.to(sfondo, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.2 })
}

/**
 * Cambio di schermata: a ogni nuova `chiave` (il percorso) il contenuto entra con una dissolvenza
 * e un piccolo scorrimento. Non alla prima apertura: lì ogni pagina ha già la sua entrata.
 */
export function useCambioPagina<T extends HTMLElement>(chiave: string) {
  const ref = useRef<T>(null)
  const prima = useRef(chiave)
  useGSAP(() => {
    if (prima.current === chiave || !ref.current || menoMovimento()) return
    prima.current = chiave
    gsap.fromTo(ref.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,transform' })
  }, { dependencies: [chiave] })
  return ref
}

/** Da usare come `ref` su un numero in evidenza: piccolo rimbalzo quando compare o cambia. */
export function rimbalza(el: HTMLElement | null) {
  if (!el || menoMovimento()) return
  gsap.from(el, { scale: 0.5, opacity: 0, duration: 0.4, delay: 0.25, ease: 'back.out(2.5)', clearProps: 'opacity,transform' })
}

/** Da usare come `ref` su un'immagine a tutto schermo: dissolvenza con zoom in apertura e a ogni cambio. */
export function ingrandisce(el: HTMLElement | null) {
  if (!el || menoMovimento()) return
  gsap.from(el, { opacity: 0, scale: 0.94, duration: 0.3, ease: 'power2.out', clearProps: 'opacity,transform' })
}

/**
 * Porta il numero mostrato da quello precedente al nuovo; `scrivi` riceve ogni valore intermedio.
 * Il testo iniziale va messo nell'elemento una volta sola: dopo lo aggiorna l'animazione.
 */
export function useConteggio(valore: number, scrivi: (n: number) => string, daZero = false) {
  const ref = useRef<HTMLSpanElement>(null)
  const parteDaZero = daZero && !menoMovimento()
  const [iniziale] = useState(() => scrivi(parteDaZero ? 0 : valore))
  const corrente = useRef({ n: parteDaZero ? 0 : valore })
  useGSAP(() => {
    const el = ref.current
    if (!el || corrente.current.n === valore) return
    if (menoMovimento()) {
      corrente.current.n = valore
      el.textContent = scrivi(valore)
      return
    }
    gsap.to(corrente.current, { n: valore, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: () => (el.textContent = scrivi(corrente.current.n)) })
  }, { dependencies: [valore] })
  return { ref, iniziale }
}
