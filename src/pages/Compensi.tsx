import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, usePermessi } from '../auth/AuthProvider'
import { Avviso, Bottone, Campo, Caricamento, Input, Intestazione, Scheda, Select, Statistica, Vuoto } from '../components/ui'
import { formatData, formatEuro, formatMese, formatOra, formatOre, isoGiorno, nomeCompleto, oggiIso } from '../lib/format'
import { messaggioErrore, supabase } from '../lib/supabase'
import type { MetodoPagamento, Movimento, Profilo, RiepilogoMensile, Saldo, TipoPagamento } from '../lib/types'
import { oppureErrore, useDati } from '../lib/useDati'
import type { TurnoConEvento } from './MieiTurni'

function primoDelMese(d = new Date()) {
  return isoGiorno(new Date(d.getFullYear(), d.getMonth(), 1))
}

function spostaMese(mese: string, delta: number) {
  const [y, m] = mese.split('-').map(Number)
  return isoGiorno(new Date(y, m - 1 + delta, 1))
}

/** CSV con separatore ";" e BOM: si apre correttamente in Excel con impostazioni italiane. */
function scaricaCsv(nomeFile: string, righe: (string | number)[][]) {
  const cella = (v: string | number) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const testo = '﻿' + righe.map((r) => r.map(cella).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([testo], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nomeFile })
  a.click()
  URL.revokeObjectURL(url)
}

function SelettoreMese({ mese, onCambia }: { mese: string; onCambia: (m: string) => void }) {
  const corrente = primoDelMese()
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-1 ring-1 ring-slate-200 print:hidden">
      <button className="min-h-11 min-w-11 rounded-lg text-xl hover:bg-slate-100" onClick={() => onCambia(spostaMese(mese, -1))} aria-label="Mese precedente">‹</button>
      <span className="font-medium">{formatMese(mese)}</span>
      <button className="min-h-11 min-w-11 rounded-lg text-xl hover:bg-slate-100 disabled:opacity-30" disabled={mese >= corrente} onClick={() => onCambia(spostaMese(mese, 1))} aria-label="Mese successivo">›</button>
    </div>
  )
}

function Schede<T extends string>({ valore, opzioni, onCambia }: { valore: T; opzioni: { id: T; etichetta: string }[]; onCambia: (v: T) => void }) {
  return (
    <div className="mb-4 grid rounded-xl bg-slate-200/70 p-1 text-sm font-medium print:hidden" style={{ gridTemplateColumns: `repeat(${opzioni.length}, 1fr)` }} role="tablist">
      {opzioni.map((o) => (
        <button key={o.id} role="tab" aria-selected={valore === o.id} onClick={() => onCambia(o.id)} className={`min-h-10 rounded-lg ${valore === o.id ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
          {o.etichetta}
        </button>
      ))}
    </div>
  )
}

export default function Compensi() {
  const { isStaff } = usePermessi()
  const [mese, setMese] = useState(primoDelMese())
  const [vista, setVista] = useState<'mese' | 'saldi'>('mese')
  return (
    <>
      <Intestazione
        titolo="Ore e compensi"
        sottotitolo={isStaff ? 'Riepiloghi, saldi e pagamenti del personale' : 'Il tuo riepilogo e il saldo da ricevere'}
        azione={
          <Link to="/rimborsi" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-700 ring-1 ring-slate-300 print:hidden">
            Rimborsi
          </Link>
        }
      />
      {isStaff ? (
        <>
          <Schede valore={vista} onCambia={setVista} opzioni={[{ id: 'mese', etichetta: 'Riepilogo mese' }, { id: 'saldi', etichetta: 'Saldi e pagamenti' }]} />
          {vista === 'mese' ? (
            <>
              <SelettoreMese mese={mese} onCambia={setMese} />
              <CompensiStaff mese={mese} />
            </>
          ) : (
            <SaldiStaff />
          )}
        </>
      ) : (
        <CompensiPersonali mese={mese} onCambiaMese={setMese} />
      )}
    </>
  )
}

function ElencoTurni({ turni }: { turni: TurnoConEvento[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {turni.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{t.eventi?.nome ?? 'Evento'}</p>
            <p className="text-slate-500">{formatData(t.data)} · {formatOra(t.ora_inizio)}–{formatOra(t.ora_fine)} · {t.mansione}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-medium tabular-nums">{formatEuro(t.compenso_lordo)}</p>
            <p className="text-slate-500 tabular-nums">{formatOre(t.ore_totali)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ElencoMovimenti({ movimenti }: { movimenti: Movimento[] }) {
  const etichetta = { compenso: 'Compenso', rimborso: 'Rimborso', pagamento: 'Pagamento ricevuto' }
  return (
    <ul className="divide-y divide-slate-100">
      {movimenti.map((m) => (
        <li key={`${m.tipo}-${m.riferimento}`} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{etichetta[m.tipo]}</p>
            <p className="truncate text-slate-500">{formatData(m.data)} · {m.descrizione}</p>
          </div>
          <p className={`shrink-0 font-medium tabular-nums ${m.importo < 0 ? 'text-emerald-700' : ''}`}>
            {m.importo < 0 ? '−' : '+'}{formatEuro(Math.abs(m.importo))}
          </p>
        </li>
      ))}
    </ul>
  )
}

function SchedaSaldo({ saldo }: { saldo: Saldo | undefined }) {
  if (!saldo) return null
  return (
    <Scheda className="mb-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Saldo da ricevere</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${Number(saldo.saldo) < 0 ? 'text-red-700' : ''}`}>{formatEuro(saldo.saldo)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-slate-500">Compensi</dt><dd className="tabular-nums">{formatEuro(saldo.compensi)}</dd></div>
        <div><dt className="text-slate-500">Rimborsi</dt><dd className="tabular-nums">{formatEuro(saldo.rimborsi)}</dd></div>
        <div><dt className="text-slate-500">Già pagato</dt><dd className="tabular-nums">{formatEuro(saldo.pagato)}</dd></div>
      </dl>
      {Number(saldo.saldo) < 0 && <p className="mt-2 text-xs text-red-700">Hai ricevuto acconti superiori al maturato.</p>}
    </Scheda>
  )
}

function CompensiPersonali({ mese, onCambiaMese }: { mese: string; onCambiaMese: (m: string) => void }) {
  const { profilo } = useAuth()
  const fine = spostaMese(mese, 1)
  const { dati, errore, caricamento } = useDati(async () => {
    const [turni, movimenti, saldo] = await Promise.all([
      supabase.from('turni').select('*, eventi(nome, luogo, note, cliente)').eq('collaboratore_id', profilo!.id).eq('stato', 'completato').gte('data', mese).lt('data', fine).order('data'),
      supabase.from('movimenti').select('*').eq('collaboratore_id', profilo!.id).neq('tipo', 'compenso').gte('data', mese).lt('data', fine).order('data'),
      supabase.from('saldi').select('*').eq('collaboratore_id', profilo!.id).maybeSingle(),
    ])
    return { turni: oppureErrore(turni) as TurnoConEvento[], movimenti: oppureErrore(movimenti) as Movimento[], saldo: (oppureErrore(saldo) as Saldo | null) ?? undefined }
  }, [mese, profilo?.id])

  if (caricamento) return <Caricamento />
  if (errore || !dati) return <Avviso>{errore}</Avviso>
  const { turni } = dati
  const giorni = new Set(turni.map((t) => t.data)).size
  const ore = turni.reduce((s, t) => s + Number(t.ore_totali ?? 0), 0)
  const compenso = turni.reduce((s, t) => s + Number(t.compenso_lordo ?? 0), 0)

  return (
    <>
      <SchedaSaldo saldo={dati.saldo} />
      <SelettoreMese mese={mese} onCambia={onCambiaMese} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Statistica etichetta="Giorni" valore={giorni} />
        <Statistica etichetta="Ore" valore={formatOre(ore)} />
        <Statistica etichetta="Lordo" valore={formatEuro(compenso)} />
      </div>
      {turni.length === 0 ? (
        <Vuoto titolo="Nessun turno completato in questo mese" testo="Le ore compaiono qui dopo che il responsabile le ha registrate." />
      ) : (
        <Scheda>
          <h2 className="mb-1 font-semibold">Turni</h2>
          <ElencoTurni turni={turni} />
        </Scheda>
      )}
      {dati.movimenti.length > 0 && (
        <Scheda className="mt-4">
          <h2 className="mb-1 font-semibold">Rimborsi e pagamenti del mese</h2>
          <ElencoMovimenti movimenti={dati.movimenti} />
        </Scheda>
      )}
      <p className="mt-4 text-xs text-slate-500">Importi lordi. Il saldo comprende i compensi maturati e i rimborsi approvati, meno i pagamenti già ricevuti.</p>
    </>
  )
}

function CompensiStaff({ mese }: { mese: string }) {
  const [aperto, setAperto] = useState<string | null>(null)
  const fine = spostaMese(mese, 1)

  const { dati, errore, caricamento } = useDati(async () => {
    const [riepilogo, profili, turni] = await Promise.all([
      supabase.from('riepilogo_mensile').select('*').eq('mese', mese),
      supabase.from('profiles').select('*'),
      supabase.from('turni').select('*, eventi(nome, luogo, note, cliente)').eq('stato', 'completato').gte('data', mese).lt('data', fine).order('data'),
    ])
    return {
      riepilogo: oppureErrore(riepilogo) as RiepilogoMensile[],
      profili: new Map((oppureErrore(profili) as Profilo[]).map((p) => [p.id, p])),
      turni: oppureErrore(turni) as TurnoConEvento[],
    }
  }, [mese])

  const righe = useMemo(() => {
    if (!dati) return []
    return dati.riepilogo
      .map((r) => ({ ...r, profilo: dati.profili.get(r.collaboratore_id) }))
      .sort((a, b) => nomeCompleto(a.profilo).localeCompare(nomeCompleto(b.profilo), 'it'))
  }, [dati])

  if (caricamento) return <Caricamento />
  if (errore) return <Avviso>{errore}</Avviso>

  const totOre = righe.reduce((s, r) => s + Number(r.ore_totali), 0)
  const totLordo = righe.reduce((s, r) => s + Number(r.compenso_lordo), 0)

  function esporta() {
    scaricaCsv(`compensi-${mese.slice(0, 7)}.csv`, [
      ['Collaboratore', 'Email', 'Giorni lavorati', 'Turni', 'Ore totali', 'Compenso lordo (€)'],
      ...righe.map((r) => [nomeCompleto(r.profilo), r.profilo?.email ?? '', r.giorni_lavorati, r.turni, Number(r.ore_totali), Number(r.compenso_lordo)]),
      ['Totale', '', '', '', totOre, totLordo],
    ])
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Statistica etichetta="Persone" valore={righe.length} />
        <Statistica etichetta="Ore" valore={formatOre(totOre)} />
        <Statistica etichetta="Lordo" valore={formatEuro(totLordo)} />
      </div>
      {righe.length === 0 ? (
        <Vuoto titolo="Nessuna ora registrata in questo mese" />
      ) : (
        <>
          <div className="mb-3 flex gap-2 print:hidden">
            <Bottone variante="secondario" className="min-h-10 text-sm" onClick={esporta}>Esporta Excel (CSV)</Bottone>
            <Bottone variante="secondario" className="min-h-10 text-sm" onClick={() => window.print()}>Stampa / PDF</Bottone>
          </div>
          <ul className="space-y-2">
            {righe.map((r) => (
              <li key={r.collaboratore_id}>
                <Scheda className="p-0">
                  <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setAperto(aperto === r.collaboratore_id ? null : r.collaboratore_id)} aria-expanded={aperto === r.collaboratore_id}>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{nomeCompleto(r.profilo) || 'Utente rimosso'}</p>
                      <p className="text-sm text-slate-500">{r.giorni_lavorati} {r.giorni_lavorati === 1 ? 'giorno' : 'giorni'} · {formatOre(r.ore_totali)}</p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{formatEuro(r.compenso_lordo)}</p>
                  </button>
                  {aperto === r.collaboratore_id && (
                    <div className="border-t border-slate-100 px-4 pb-2">
                      <ElencoTurni turni={dati!.turni.filter((t) => t.collaboratore_id === r.collaboratore_id)} />
                    </div>
                  )}
                </Scheda>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function SaldiStaff() {
  const { isAdmin } = usePermessi()
  const [soloDaPagare, setSoloDaPagare] = useState(true)
  const [aperto, setAperto] = useState<string | null>(null)

  const { dati, errore, caricamento, ricarica } = useDati(async () => {
    const [saldi, profili] = await Promise.all([supabase.from('saldi').select('*'), supabase.from('profiles').select('*')])
    return {
      saldi: oppureErrore(saldi) as Saldo[],
      profili: new Map((oppureErrore(profili) as Profilo[]).map((p) => [p.id, p])),
    }
  }, [])

  const righe = useMemo(() => {
    if (!dati) return []
    return dati.saldi
      .map((s) => ({ ...s, profilo: dati.profili.get(s.collaboratore_id) }))
      .filter((s) => (soloDaPagare ? Number(s.saldo) > 0 : Number(s.compensi) + Number(s.rimborsi) + Number(s.pagato) > 0))
      .sort((a, b) => Number(b.saldo) - Number(a.saldo))
  }, [dati, soloDaPagare])

  if (caricamento) return <Caricamento />
  if (errore) return <Avviso>{errore}</Avviso>
  const totale = righe.reduce((s, r) => s + Math.max(0, Number(r.saldo)), 0)

  function esporta() {
    scaricaCsv(`saldi-${oggiIso()}.csv`, [
      ['Collaboratore', 'Email', 'Compensi (€)', 'Rimborsi (€)', 'Pagato (€)', 'Saldo (€)'],
      ...righe.map((r) => [nomeCompleto(r.profilo), r.profilo?.email ?? '', Number(r.compensi), Number(r.rimborsi), Number(r.pagato), Number(r.saldo)]),
    ])
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Statistica etichetta="Da pagare" valore={formatEuro(totale)} evidenzia={totale > 0} />
        <Statistica etichetta="Persone" valore={righe.filter((r) => Number(r.saldo) > 0).length} />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={soloDaPagare} onChange={(e) => setSoloDaPagare(e.target.checked)} />
          Solo con saldo da pagare
        </label>
        <Bottone variante="secondario" className="min-h-10 text-sm" onClick={esporta}>Esporta CSV</Bottone>
      </div>
      {righe.length === 0 ? (
        <Vuoto titolo={soloDaPagare ? 'Nessun saldo da pagare' : 'Nessun movimento registrato'} />
      ) : (
        <ul className="space-y-2">
          {righe.map((r) => (
            <li key={r.collaboratore_id}>
              <Scheda className="p-0">
                <button className="flex w-full items-center justify-between gap-3 p-4 text-left" onClick={() => setAperto(aperto === r.collaboratore_id ? null : r.collaboratore_id)} aria-expanded={aperto === r.collaboratore_id}>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{nomeCompleto(r.profilo) || 'Utente rimosso'}</p>
                    <p className="text-sm text-slate-500">Maturato {formatEuro(Number(r.compensi) + Number(r.rimborsi))} · pagato {formatEuro(r.pagato)}</p>
                  </div>
                  <p className={`shrink-0 font-semibold tabular-nums ${Number(r.saldo) < 0 ? 'text-red-700' : ''}`}>{formatEuro(r.saldo)}</p>
                </button>
                {aperto === r.collaboratore_id && (
                  <DettaglioSaldo
                    collaboratoreId={r.collaboratore_id}
                    saldo={Number(r.saldo)}
                    puoEliminare={isAdmin}
                    onCambiato={() => void ricarica()}
                  />
                )}
              </Scheda>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function DettaglioSaldo({ collaboratoreId, saldo, puoEliminare, onCambiato }: { collaboratoreId: string; saldo: number; puoEliminare: boolean; onCambiato: () => void }) {
  const [importo, setImporto] = useState(saldo > 0 ? saldo.toFixed(2).replace('.', ',') : '')
  const [tipo, setTipo] = useState<TipoPagamento>(saldo > 0 ? 'saldo' : 'acconto')
  const [metodo, setMetodo] = useState<MetodoPagamento>('bonifico')
  const [data, setData] = useState(oggiIso())
  const [note, setNote] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  const { dati: movimenti, ricarica } = useDati(async () => {
    return oppureErrore(await supabase.from('movimenti').select('*').eq('collaboratore_id', collaboratoreId).order('data', { ascending: false }).limit(30)) as Movimento[]
  }, [collaboratoreId])

  async function registra(e: FormEvent) {
    e.preventDefault()
    const valore = Math.round(Number(importo.replace(',', '.')) * 100) / 100
    if (!(valore > 0)) return setErrore('Importo non valido')
    if (valore > saldo && tipo === 'saldo' && !confirm('L’importo supera il saldo dovuto. Registrare comunque?')) return
    setErrore('')
    setInvio(true)
    const { error } = await supabase.from('pagamenti').insert({ collaboratore_id: collaboratoreId, importo: valore, tipo, metodo, data, note: note.trim() || null })
    setInvio(false)
    if (error) return setErrore(messaggioErrore(error))
    setNote('')
    await ricarica()
    onCambiato()
  }

  async function eliminaPagamento(id: string) {
    if (!confirm('Eliminare questo pagamento? La modifica resta nel registro modifiche.')) return
    const { error } = await supabase.from('pagamenti').delete().eq('id', id)
    if (error) return setErrore(messaggioErrore(error))
    await ricarica()
    onCambiato()
  }

  return (
    <div className="space-y-4 border-t border-slate-100 p-4">
      <form onSubmit={registra} className="space-y-3">
        <h3 className="font-semibold">Registra pagamento</h3>
        <div className="grid grid-cols-2 gap-3">
          <Campo etichetta="Importo €">
            <Input inputMode="decimal" required value={importo} onChange={(e) => setImporto(e.target.value)} />
          </Campo>
          <Campo etichetta="Data">
            <Input type="date" required max={oggiIso()} value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo etichetta="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPagamento)}>
              <option value="acconto">Acconto</option>
              <option value="saldo">Saldo</option>
            </Select>
          </Campo>
          <Campo etichetta="Metodo">
            <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPagamento)}>
              <option value="bonifico">Bonifico</option>
              <option value="contanti">Contanti</option>
              <option value="altro">Altro</option>
            </Select>
          </Campo>
        </div>
        <Campo etichetta="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. CRO o riferimento del bonifico" />
        </Campo>
        {errore && <Avviso>{errore}</Avviso>}
        <Bottone type="submit" caricamento={invio}>Registra</Bottone>
      </form>
      <div>
        <h3 className="mb-1 font-semibold">Ultimi movimenti</h3>
        {!movimenti?.length ? (
          <p className="text-sm text-slate-500">Nessun movimento</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {movimenti.map((m) => (
              <li key={`${m.tipo}-${m.riferimento}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium capitalize">{m.tipo}</p>
                  <p className="truncate text-slate-500">{formatData(m.data)} · {m.descrizione}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`tabular-nums ${m.importo < 0 ? 'text-emerald-700' : ''}`}>{m.importo < 0 ? '−' : '+'}{formatEuro(Math.abs(m.importo))}</span>
                  {puoEliminare && m.tipo === 'pagamento' && (
                    <button className="min-h-9 rounded-lg px-2 text-xs text-red-700 hover:bg-red-50" onClick={() => void eliminaPagamento(m.riferimento)} aria-label="Elimina pagamento">
                      Elimina
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
