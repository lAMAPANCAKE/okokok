import { formatEuro } from '../lib/format'
import { useConteggio } from '../lib/animazioni'

/** Importo in euro che scorre fino al nuovo valore quando cambia. */
export function ConteggioEuro({ valore, className }: { valore: number; className?: string }) {
  const { ref, iniziale } = useConteggio(Number(valore) || 0, formatEuro)
  return <span ref={ref} className={className}>{iniziale}</span>
}
