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
