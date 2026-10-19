import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth, usePermessi } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { Avviso, Bottone, Caricamento } from './components/ui'
import { configurato } from './lib/supabase'
import Benvenuto from './pages/auth/Benvenuto'
import Login, { GuscioAuth } from './pages/auth/Login'
import RecuperaPassword from './pages/auth/RecuperaPassword'
import Registrati from './pages/auth/Registrati'
import ReimpostaPassword from './pages/auth/ReimpostaPassword'
import Compensi from './pages/Compensi'
import Dashboard from './pages/Dashboard'
import EventoDettaglio from './pages/eventi/EventoDettaglio'
import Eventi from './pages/eventi/Eventi'
import ModuloEvento from './pages/eventi/ModuloEvento'
import AziendaDettaglio from './pages/crm/AziendaDettaglio'
import Aziende from './pages/crm/Aziende'
import ModuloAzienda from './pages/crm/ModuloAzienda'
import Disponibilita from './pages/Disponibilita'
import Documenti from './pages/Documenti'
import Personale from './pages/Personale'
import Report from './pages/Report'
import Menu from './pages/Menu'
import PreventivoDettaglio, { NuovoPreventivo } from './pages/preventivi/PreventivoDettaglio'
import Preventivi from './pages/preventivi/Preventivi'
import SopralluogoDettaglio, { NuovoSopralluogo } from './pages/sopralluoghi/SopralluogoDettaglio'
import Sopralluoghi from './pages/sopralluoghi/Sopralluoghi'
import MieiTurni from './pages/MieiTurni'
import Notifiche from './pages/Notifiche'
import Rimborsi from './pages/Rimborsi'
import Profilo from './pages/Profilo'
import Impostazioni from './pages/admin/Impostazioni'
import Utenti from './pages/admin/Utenti'
import Fatture from './pages/fatture/Fatture'
import FatturaDettaglio from './pages/fatture/FatturaDettaglio'
import ModuloFattura from './pages/fatture/ModuloFattura'

function Protetta({ children }: { children: ReactNode }) {
  const { session, profilo, caricamento, recuperoPassword, esci } = useAuth()
  const location = useLocation()

  if (caricamento) return <Caricamento />
  if (!session) return <Navigate to="/login" replace state={{ da: location.pathname }} />
  if (recuperoPassword) return <Navigate to="/reimposta-password" replace />
  if (!profilo || !profilo.attivo) {
    return (
      <GuscioAuth titolo="Account non attivo">
        <div className="space-y-4">
          <Avviso tipo="info">Il tuo account non è ancora attivo: l’amministrazione deve abilitarlo. Riprova più tardi o contattala.</Avviso>
          <Bottone variante="secondario" className="w-full" onClick={() => void esci()}>
            Esci
          </Bottone>
        </div>
      </GuscioAuth>
    )
  }
  if (!profilo.profilo_completo) return <Navigate to="/benvenuto" replace />
  return <>{children}</>
}

function SoloStaff({ children }: { children: ReactNode }) {
  return usePermessi().isStaff ? <>{children}</> : <Navigate to="/" replace />
}

function SoloAdmin({ children }: { children: ReactNode }) {
  return usePermessi().isAdmin ? <>{children}</> : <Navigate to="/" replace />
}

/** Documenti personali: proprietario e admin, non i responsabili (GDPR) */
function DocumentiConsentiti({ children }: { children: ReactNode }) {
  const { isStaff, isAdmin } = usePermessi()
  return !isStaff || isAdmin ? <>{children}</> : <Navigate to="/" replace />
}

function SoloOspite({ children }: { children: ReactNode }) {
  const { session, caricamento } = useAuth()
  if (caricamento) return <Caricamento />
  return session ? <Navigate to="/" replace /> : <>{children}</>
}

function ConfigurazioneMancante() {
  return (
    <GuscioAuth titolo="Configurazione mancante">
      <Avviso>
        Mancano le variabili <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>. Copia <code>.env.example</code> in{' '}
        <code>.env.local</code> e inserisci i valori del tuo progetto Supabase (vedi README).
      </Avviso>
    </GuscioAuth>
  )
}

export default function App() {
  if (!configurato) return <ConfigurazioneMancante />

  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<SoloOspite><Login /></SoloOspite>} />
          <Route path="/recupera-password" element={<SoloOspite><RecuperaPassword /></SoloOspite>} />
          <Route path="/registrati" element={<SoloOspite><Registrati /></SoloOspite>} />
          <Route path="/reimposta-password" element={<ReimpostaPassword />} />
          <Route path="/benvenuto" element={<Benvenuto />} />

          <Route element={<Protetta><Layout /></Protetta>}>
            <Route index element={<Dashboard />} />
            <Route path="turni" element={<MieiTurni />} />
            <Route path="compensi" element={<Compensi />} />
            <Route path="profilo" element={<Profilo />} />
            <Route path="rimborsi" element={<Rimborsi />} />
            <Route path="notifiche" element={<Notifiche />} />
            <Route path="documenti" element={<DocumentiConsentiti><Documenti /></DocumentiConsentiti>} />

            <Route path="eventi" element={<SoloStaff><Eventi /></SoloStaff>} />
            <Route path="eventi/nuovo" element={<SoloStaff><ModuloEvento /></SoloStaff>} />
            <Route path="eventi/:id" element={<SoloStaff><EventoDettaglio /></SoloStaff>} />
            <Route path="eventi/:id/modifica" element={<SoloStaff><ModuloEvento /></SoloStaff>} />

            <Route path="menu" element={<Menu />} />
            <Route path="disponibilita" element={<Disponibilita />} />
            <Route path="personale/:id" element={<SoloStaff><Personale /></SoloStaff>} />
            <Route path="report" element={<SoloStaff><Report /></SoloStaff>} />
            <Route path="crm" element={<SoloStaff><Aziende /></SoloStaff>} />
            <Route path="crm/nuova" element={<SoloStaff><ModuloAzienda /></SoloStaff>} />
            <Route path="crm/:id" element={<SoloStaff><AziendaDettaglio /></SoloStaff>} />
            <Route path="crm/:id/modifica" element={<SoloStaff><ModuloAzienda /></SoloStaff>} />
            <Route path="preventivi" element={<SoloStaff><Preventivi /></SoloStaff>} />
            <Route path="preventivi/nuovo" element={<SoloStaff><NuovoPreventivo /></SoloStaff>} />
            <Route path="preventivi/:id" element={<SoloStaff><PreventivoDettaglio /></SoloStaff>} />
            <Route path="sopralluoghi" element={<SoloStaff><Sopralluoghi /></SoloStaff>} />
            <Route path="sopralluoghi/nuovo" element={<SoloStaff><NuovoSopralluogo /></SoloStaff>} />
            <Route path="sopralluoghi/:id" element={<SoloStaff><SopralluogoDettaglio /></SoloStaff>} />

            <Route path="admin/utenti" element={<SoloAdmin><Utenti /></SoloAdmin>} />
            <Route path="admin/impostazioni" element={<SoloAdmin><Impostazioni /></SoloAdmin>} />
            <Route path="fatture" element={<SoloAdmin><Fatture /></SoloAdmin>} />
            <Route path="fatture/nuova" element={<SoloAdmin><ModuloFattura /></SoloAdmin>} />
            <Route path="fatture/:id" element={<SoloAdmin><FatturaDettaglio /></SoloAdmin>} />
            <Route path="fatture/:id/modifica" element={<SoloAdmin><ModuloFattura /></SoloAdmin>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
