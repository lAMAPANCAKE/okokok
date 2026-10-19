import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { messaggioErrore, supabase } from '../lib/supabase'
import { COMPETENZE, type Profilo, type ProfiloPrivato } from '../lib/types'
import { inizialiNome } from '../lib/format'
import { Avviso, Bottone, Campo, Input } from './ui'

/** Normalizza l'IBAN e ne verifica il checksum (ISO 13616, mod 97). */
export function ibanValido(iban: string): boolean {
  const s = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false
  const riordinato = s.slice(4) + s.slice(0, 4)
  const numerico = riordinato.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let resto = 0
  for (const cifra of numerico) resto = (resto * 10 + Number(cifra)) % 97
  return resto === 1
}

export function FotoProfilo({ profilo, dimensione = 'h-16 w-16' }: { profilo: Profilo; dimensione?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let attivo = true
    if (!profilo.foto_path) {
      setUrl(null)
      return
    }
    supabase.storage
      .from('foto-profilo')
      .createSignedUrl(profilo.foto_path, 3600)
      .then(({ data }) => attivo && setUrl(data?.signedUrl ?? null))
    return () => {
      attivo = false
    }
  }, [profilo.foto_path])

  return url ? (
    <img src={url} alt="" className={`${dimensione} rounded-full object-cover`} />
  ) : (
    <span className={`${dimensione} inline-flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600`}>
      {inizialiNome(profilo)}
    </span>
  )
}

interface Props {
  profilo: Profilo
  /** Campi extra in testa al modulo (es. nuova password in onboarding) */
  intestazione?: ReactNode
  etichettaSalva?: string
  /** Validazione aggiuntiva: restituisce un messaggio d'errore o null */
  validaExtra?: () => string | null
  /** Eseguito prima del salvataggio del profilo (es. aggiornamento password) */
  primaDiSalvare?: () => Promise<void>
  dopoSalvataggio: () => void
}

export function ModuloProfilo({ profilo, intestazione, etichettaSalva = 'Salva', validaExtra, primaDiSalvare, dopoSalvataggio }: Props) {
  const [dati, setDati] = useState({
    nome: profilo.nome,
    cognome: profilo.cognome,
    telefono: profilo.telefono ?? '',
    taglia_giacca: profilo.taglia_giacca ?? '',
    taglia_pantalone: profilo.taglia_pantalone ?? '',
    numero_scarpe: profilo.numero_scarpe ?? '',
    competenze: profilo.competenze,
  })
  const [privati, setPrivati] = useState({ codice_fiscale: '', data_nascita: '', indirizzo: '', iban: '' })
  const [foto, setFoto] = useState<File | null>(null)
  const [errore, setErrore] = useState('')
  const [salvato, setSalvato] = useState(false)
  const [invio, setInvio] = useState(false)

  useEffect(() => {
    supabase
      .from('profili_privati')
      .select('*')
      .eq('id', profilo.id)
      .maybeSingle()
      .then(({ data }) => {
        const p = data as ProfiloPrivato | null
        if (p) {
          setPrivati({
            codice_fiscale: p.codice_fiscale ?? '',
            data_nascita: p.data_nascita ?? '',
            indirizzo: p.indirizzo ?? '',
            iban: p.iban ?? '',
          })
        }
      })
  }, [profilo.id])

  const imposta = (campo: keyof typeof dati) => (v: string) => setDati((d) => ({ ...d, [campo]: v }))
  const impostaPrivato = (campo: keyof typeof privati) => (v: string) => setPrivati((d) => ({ ...d, [campo]: v }))

  function alternaCompetenza(c: string) {
    setDati((d) => ({
      ...d,
      competenze: d.competenze.includes(c) ? d.competenze.filter((x) => x !== c) : [...d.competenze, c],
    }))
  }

  async function salva(e: FormEvent) {
    e.preventDefault()
    setErrore('')
    setSalvato(false)
    const extra = validaExtra?.()
    if (extra) return setErrore(extra)
    if (!dati.nome.trim() || !dati.cognome.trim()) return setErrore('Nome e cognome sono obbligatori')
    if (privati.iban && !ibanValido(privati.iban)) return setErrore('IBAN non valido: controlla di averlo copiato per intero')
    if (privati.codice_fiscale && !/^[A-Z0-9]{16}$/i.test(privati.codice_fiscale.trim())) return setErrore('Il codice fiscale deve avere 16 caratteri')

    setInvio(true)
    try {
      await primaDiSalvare?.()

      let foto_path = profilo.foto_path
      if (foto) {
        const estensione = foto.name.split('.').pop()?.toLowerCase() || 'jpg'
        foto_path = `${profilo.id}/foto-${Date.now()}.${estensione}`
        const { error } = await supabase.storage.from('foto-profilo').upload(foto_path, foto, { contentType: foto.type })
        if (error) throw error
        if (profilo.foto_path) await supabase.storage.from('foto-profilo').remove([profilo.foto_path])
      }

      const { error: e1 } = await supabase
        .from('profiles')
        .update({
          nome: dati.nome.trim(),
          cognome: dati.cognome.trim(),
          telefono: dati.telefono.trim() || null,
          taglia_giacca: dati.taglia_giacca.trim() || null,
          taglia_pantalone: dati.taglia_pantalone.trim() || null,
          numero_scarpe: dati.numero_scarpe.trim() || null,
          competenze: dati.competenze,
          foto_path,
          profilo_completo: true,
        })
        .eq('id', profilo.id)
      if (e1) throw e1

      const { error: e2 } = await supabase
        .from('profili_privati')
        .update({
          codice_fiscale: privati.codice_fiscale.trim().toUpperCase() || null,
          data_nascita: privati.data_nascita || null,
          indirizzo: privati.indirizzo.trim() || null,
          iban: privati.iban.replace(/\s+/g, '').toUpperCase() || null,
        })
        .eq('id', profilo.id)
      if (e2) throw e2

      setSalvato(true)
      setFoto(null)
      dopoSalvataggio()
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setInvio(false)
    }
  }

  return (
    <form onSubmit={salva} className="space-y-6">
      {intestazione}

      <section className="space-y-4">
        <h2 className="font-semibold">Dati personali</h2>
        <div className="flex items-center gap-4">
          <FotoProfilo profilo={profilo} />
          <label className="text-sm">
            <span className="font-medium text-slate-700">Foto</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etichetta="Nome">
            <Input autoComplete="given-name" required value={dati.nome} onChange={(e) => imposta('nome')(e.target.value)} />
          </Campo>
          <Campo etichetta="Cognome">
            <Input autoComplete="family-name" required value={dati.cognome} onChange={(e) => imposta('cognome')(e.target.value)} />
          </Campo>
          <Campo etichetta="Telefono">
            <Input type="tel" autoComplete="tel" inputMode="tel" value={dati.telefono} onChange={(e) => imposta('telefono')(e.target.value)} />
          </Campo>
          <Campo etichetta="Data di nascita">
            <Input type="date" autoComplete="bday" value={privati.data_nascita} onChange={(e) => impostaPrivato('data_nascita')(e.target.value)} />
          </Campo>
          <Campo etichetta="Codice fiscale">
            <Input autoCapitalize="characters" maxLength={16} value={privati.codice_fiscale} onChange={(e) => impostaPrivato('codice_fiscale')(e.target.value)} />
          </Campo>
          <Campo etichetta="Indirizzo di residenza">
            <Input autoComplete="street-address" value={privati.indirizzo} onChange={(e) => impostaPrivato('indirizzo')(e.target.value)} />
          </Campo>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Pagamenti</h2>
        <Campo etichetta="IBAN" aiuto="Visibile solo a te e all’amministrazione">
          <Input autoCapitalize="characters" autoComplete="off" value={privati.iban} onChange={(e) => impostaPrivato('iban')(e.target.value)} />
        </Campo>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Divisa</h2>
        <div className="grid grid-cols-3 gap-3">
          <Campo etichetta="Giacca">
            <Input value={dati.taglia_giacca} onChange={(e) => imposta('taglia_giacca')(e.target.value)} placeholder="es. M" />
          </Campo>
          <Campo etichetta="Pantalone">
            <Input value={dati.taglia_pantalone} onChange={(e) => imposta('taglia_pantalone')(e.target.value)} placeholder="es. 46" />
          </Campo>
          <Campo etichetta="Scarpe">
            <Input inputMode="numeric" value={dati.numero_scarpe} onChange={(e) => imposta('numero_scarpe')(e.target.value)} placeholder="es. 42" />
          </Campo>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Competenze</h2>
        <div className="flex flex-wrap gap-2">
          {COMPETENZE.map((c) => {
            const attiva = dati.competenze.includes(c)
            return (
              <button
                key={c}
                type="button"
                aria-pressed={attiva}
                onClick={() => alternaCompetenza(c)}
                className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 ${attiva ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300'}`}
              >
                {c}
              </button>
            )
          })}
        </div>
      </section>

      {errore && <Avviso>{errore}</Avviso>}
      {salvato && <Avviso tipo="successo">Profilo salvato</Avviso>}
      <Bottone type="submit" caricamento={invio} className="w-full sm:w-auto">
        {etichettaSalva}
      </Bottone>
    </form>
  )
}
