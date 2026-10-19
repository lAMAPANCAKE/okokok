/** Punteggio da 1 a 5 con stelle toccabili (o solo lettura). */
export function Stelle({ valore, onCambia, etichetta, piccole }: { valore: number; onCambia?: (v: number) => void; etichetta?: string; piccole?: boolean }) {
  const dimensione = piccole ? 'h-4 w-4' : 'h-8 w-8'
  return (
    <div className="flex items-center gap-0.5" role={onCambia ? 'radiogroup' : 'img'} aria-label={etichetta ?? `${valore} stelle su 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const piena = n <= Math.round(valore)
        const icona = (
          <svg viewBox="0 0 24 24" className={`${dimensione} ${piena ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-300'}`} stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
          </svg>
        )
        return onCambia ? (
          <button key={n} type="button" role="radio" aria-checked={n === valore} aria-label={`${n} su 5`} onClick={() => onCambia(n)} className="flex min-h-11 min-w-9 items-center justify-center">
            {icona}
          </button>
        ) : (
          <span key={n}>{icona}</span>
        )
      })}
    </div>
  )
}
