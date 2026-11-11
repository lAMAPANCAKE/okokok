import { formatEuro } from '../lib/format'
import { useConteggio } from '../lib/animazioni'

const intero = (n: number) => String(Math.round(n))

/** Importo in euro che scorre fino al nuovo valore quando cambia (e da zero all'apertura, se richiesto). */
export function ConteggioEuro({ valore, className, daZero }: { valore: number; className?: string; daZero?: boolean }) {
  const { ref, iniziale } = useConteggio(Number(valore) || 0, formatEuro, daZero)
  return <span ref={ref} className={className}>{iniziale}</span>
}

/** Numero intero che sale da zero all'apertura e scorre quando cambia. */
export function Conteggio({ valore, className }: { valore: number; className?: string }) {
  const { ref, iniziale } = useConteggio(valore, intero, true)
  return <span ref={ref} className={className}>{iniziale}</span>
}
