import { useEffect, useState, type FormEvent } from 'react'
import { AreaTesto, Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda } from '../../components/ui'
import { messaggioErrore, supabase } from '../../lib/supabase'
import { ETICHETTA_DOCUMENTO, type Impostazioni as TipoImpostazioni, type Profilo, type TipoDocumento } from '../../lib/types'
import { nomeCompleto } from '../../lib/format'
import { oppureErrore, useDati } from '../../lib/useDati'

interface VoceAudit {
  id: number
  tabella: string
  record_id: string | null
  azione: string
  utente_id: string | null
  vecchio: Record<string, unknown> | null
  nuovo: Record<string, unknown> | null
  creato_il: string
}

const CAMPI_RILEVANTI = ['stato', 'ore_totali', 'ore_notturne', 'ore_festive', 'ore_straordinarie', 'tariffa_oraria', 'compenso_lordo', 'ruolo', 'attivo', 'magg_notturno', 'magg_festivo', 'magg_straordinario', 'documenti_obbligatori', 'stato_verifica', 'importo', 'tipo', 'metodo']

function differenze(v: VoceAudit) {
  if (v.azione === 'INSERT') return 'creato'
  if (v.azione === 'DELETE') return 'eliminato'
  return CAMPI_RILEVANTI.filter((c) => JSON.stringify(v.vecchio?.[c]) !== JSON.stringify(v.nuovo?.[c]))
    .map((c) => `${c}: ${v.vecchio?.[c] ?? '—'} → ${v.nuovo?.[c] ?? '—'}`)
    .join(', ')
}

/** Intestazione e condizioni stampate sui preventivi PDF */
function DatiAziendali({ impostazioni, onSalvato }: { impostazioni: TipoImpostazioni; onSalvato: () => void }) {
  const [valori, setValori] = useState({
    ragione_sociale: impostazioni.ragione_sociale ?? '',
    indirizzo_sede: impostazioni.indirizzo_sede ?? '',
    partita_iva: impostazioni.partita_iva ?? '',
    email_commerciale: impostazioni.email_commerciale ?? '',
    telefono_commerciale: impostazioni.telefono_commerciale ?? '',
    condizioni_preventivo: impostazioni.condizioni_preventivo ?? '',
    iva_predefinita: String(impostazioni.iva_predefinita),
    validita_preventivo_giorni: String(impostazioni.validita_preventivo_giorni),
  })
  const [esito, setEsito] = useState<{ tipo: 'errore' | 'successo'; testo: string } | null>(null)
  const [invio, setInvio] = useState(false)
  const imposta = (campo: keyof typeof valori) => (v: string) => setValori((x) => ({ ...x, [campo]: v }))

  async function salva(e: FormEvent) {
    e.preventDefault()
    setEsito(null)
    setInvio(true)
    const testo = (v: string) => v.trim() || null
    const { error } = await supabase
      .from('impostazioni')
      .update({
        ragione_sociale: testo(valori.ragione_sociale),
        indirizzo_sede: testo(valori.indirizzo_sede),
        partita_iva: testo(valori.partita_iva),
        email_commerciale: testo(valori.email_commerciale),
        telefono_commerciale: testo(valori.telefono_commerciale),
        condizioni_preventivo: testo(valori.condizioni_preventivo),
        iva_predefinita: Math.max(0, Number(valori.iva_predefinita.replace(',', '.')) || 0),
        validita_preventivo_giorni: Math.max(1, parseInt(valori.validita_preventivo_giorni, 10) || 30),
      })
      .eq('id', true)
    setInvio(false)
    if (error) return setEsito({ tipo: 'errore', testo: messaggioErrore(error) })
    setEsito({ tipo: 'successo', testo: 'Dati aziendali salvati' })
    onSalvato()
  }

  return (
    <Scheda className="mb-6">
      <form onSubmit={salva} className="space-y-4">
        <h2 className="font-semibold">Dati aziendali per i preventivi</h2>
        <p className="text-sm text-slate-500">Compaiono nell’intestazione del PDF inviato ai clienti.</p>
        <Campo etichetta="Ragione sociale">
          <Input value={valori.ragione_sociale} onChange={(e) => imposta('ragione_sociale')(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo etichetta="Sede">
            <Input value={valori.indirizzo_sede} onChange={(e) => imposta('indirizzo_sede')(e.target.value)} />
          </Campo>
          <Campo etichetta="Partita IVA">
            <Input value={valori.partita_iva} onChange={(e) => imposta('partita_iva')(e.target.value)} />
          </Campo>
          <Campo etichetta="Email commerciale">
            <Input type="email" value={valori.email_commerciale} onChange={(e) => imposta('email_commerciale')(e.target.value)} />
          </Campo>
          <Campo etichetta="Telefono">
            <Input type="tel" value={valori.telefono_commerciale} onChange={(e) => imposta('telefono_commerciale')(e.target.value)} />
          </Campo>
          <Campo etichetta="IVA predefinita %">
            <Input inputMode="decimal" value={valori.iva_predefinita} onChange={(e) => imposta('iva_predefinita')(e.target.value)} />
          </Campo>
          <Campo etichetta="Validità preventivo (giorni)">
            <Input type="number" inputMode="numeric" min={1} value={valori.validita_preventivo_giorni} onChange={(e) => imposta('validita_preventivo_giorni')(e.target.value)} />
          </Campo>
        </div>
        <Campo etichetta="Condizioni generali" aiuto="Stampate in fondo a ogni preventivo (pagamenti, cancellazioni, cosa è escluso…)">
          <AreaTesto rows={4} value={valori.condizioni_preventivo} onChange={(e) => imposta('condizioni_preventivo')(e.target.value)} />
        </Campo>
        {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
        <Bottone type="submit" caricamento={invio}>Salva dati aziendali</Bottone>
      </form>
    </Scheda>
  )
}

export default function Impostazioni() {
  const [valori, setValori] = useState({ magg_notturno: '', magg_festivo: '', magg_straordinario: '' })
  const [obbligatori, setObbligatori] = useState<TipoDocumento[]>([])
  const [esito, setEsito] = useState<{ tipo: 'errore' | 'successo'; testo: string } | null>(null)
  const [invio, setInvio] = useState(false)

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const [imp, audit, profili] = await Promise.all([
      supabase.from('impostazioni').select('*').single(),
      supabase.from('audit_log').select('*').order('creato_il', { ascending: false }).limit(50),
      supabase.from('profiles').select('id, nome, cognome, email'),
    ])
    return {
      impostazioni: oppureErrore(imp) as TipoImpostazioni,
      audit: oppureErrore(audit) as VoceAudit[],
      profili: new Map((oppureErrore(profili) as Pick<Profilo, 'id' | 'nome' | 'cognome' | 'email'>[]).map((p) => [p.id, p])),
    }
  }, [])

  useEffect(() => {
    if (dati) {
      setValori({
        magg_notturno: String(dati.impostazioni.magg_notturno),
        magg_festivo: String(dati.impostazioni.magg_festivo),
        magg_straordinario: String(dati.impostazioni.magg_straordinario),
      })
      setObbligatori(dati.impostazioni.documenti_obbligatori ?? [])
    }
  }, [dati])

  async function salva(e: FormEvent) {
    e.preventDefault()
    setEsito(null)
    setInvio(true)
    const n = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0)
    const { error } = await supabase
      .from('impostazioni')
      .update({
        magg_notturno: n(valori.magg_notturno),
        magg_festivo: n(valori.magg_festivo),
        magg_straordinario: n(valori.magg_straordinario),
        documenti_obbligatori: obbligatori,
      })
      .eq('id', true)
    setInvio(false)
    if (error) return setEsito({ tipo: 'errore', testo: messaggioErrore(error) })
    setEsito({ tipo: 'successo', testo: 'Maggiorazioni salvate. Valgono per le ore registrate da ora in poi.' })
    await ricarica()
  }

  if (caricamento) return <Caricamento />

  return (
    <>
      <Intestazione titolo="Impostazioni" indietro="/admin/utenti" />
      {errore && <Avviso>{errore}</Avviso>}

      <Scheda className="mb-6">
        <form onSubmit={salva} className="space-y-4">
          <h2 className="font-semibold">Maggiorazioni (%)</h2>
          <p className="text-sm text-slate-500">Percentuale aggiunta alla tariffa oraria per le ore notturne, festive e straordinarie. Le ore già registrate non cambiano.</p>
          <div className="grid grid-cols-3 gap-3">
            <Campo etichetta="Notturno">
              <Input inputMode="decimal" value={valori.magg_notturno} onChange={(e) => setValori((v) => ({ ...v, magg_notturno: e.target.value }))} />
            </Campo>
            <Campo etichetta="Festivo">
              <Input inputMode="decimal" value={valori.magg_festivo} onChange={(e) => setValori((v) => ({ ...v, magg_festivo: e.target.value }))} />
            </Campo>
            <Campo etichetta="Straordinario">
              <Input inputMode="decimal" value={valori.magg_straordinario} onChange={(e) => setValori((v) => ({ ...v, magg_straordinario: e.target.value }))} />
            </Campo>
          </div>
          <h2 className="pt-2 font-semibold">Documenti obbligatori</h2>
          <p className="text-sm text-slate-500">Quelli che ogni collaboratore deve avere validi: chi non li ha compare tra i “mancanti”.</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ETICHETTA_DOCUMENTO) as TipoDocumento[])
              .filter((t) => t !== 'altro')
              .map((t) => {
                const attivo = obbligatori.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={attivo}
                    onClick={() => setObbligatori((o) => (attivo ? o.filter((x) => x !== t) : [...o, t]))}
                    className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${attivo ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
                  >
                    {ETICHETTA_DOCUMENTO[t]}
                  </button>
                )
              })}
          </div>
          {esito && <Avviso tipo={esito.tipo}>{esito.testo}</Avviso>}
          <Bottone type="submit" caricamento={invio}>Salva</Bottone>
        </form>
      </Scheda>

      {dati && <DatiAziendali impostazioni={dati.impostazioni} onSalvato={() => void ricarica()} />}

      <h2 className="mb-2 font-semibold">Registro modifiche (ultime 50)</h2>
      <Scheda className="p-0">
        <ul className="divide-y divide-slate-100 text-sm">
          {dati?.audit.length === 0 && <li className="p-4 text-slate-500">Nessuna modifica registrata</li>}
          {dati?.audit.map((v) => (
            <li key={v.id} className="p-3">
              <p className="text-xs text-slate-500">
                {new Date(v.creato_il).toLocaleString('it-IT')} · {v.utente_id ? nomeCompleto(dati.profili.get(v.utente_id)) || 'utente' : 'sistema'} · {v.tabella}
              </p>
              <p className="break-words">{differenze(v) || 'modifica'}</p>
            </li>
          ))}
        </ul>
      </Scheda>
    </>
  )
}
