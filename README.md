# Gestionale Eventi

Strumento interno per la gestione operativa del personale: turni, ore, compensi.
PWA mobile-first (React + Vite + TypeScript + Tailwind) con backend Supabase (Postgres, Auth, Storage).

## Stato: Fasi 1–4 (brief completo)

| Funzione | Collaboratore | Responsabile | Admin |
|---|---|---|---|
| **Fase 4** · Calendario dei giorni non disponibili (un tocco per giorno) | propri | lettura | lettura |
| Assegnazione turni: chi non è disponibile è nascosto o segnalato 🚫; avviso al responsabile se si rende indisponibile con un turno già proposto | — | ✓ | ✓ |
| Valutazioni post-evento 1–5 stelle con note, media e storico per persona | — | ✓ | ✓ |
| Notifiche push PWA (anche ad app chiusa) per ogni notifica in-app | ✓ | ✓ | ✓ |
| Report margini per evento: ricavo dal preventivo accettato, costi reali (ore + rimborsi), scostamento dal previsto, CSV | — | ✓ | ✓ |
| **Fase 3** · CRM aziende: scheda, referente, pipeline (da contattare → cliente attivo / perso) | — | ✓ | ✓ |
| Follow-up con data, promemoria in-app il giorno previsto | — | ✓ | ✓ |
| Preventivi numerati (AAAA-NNN) con voci personale/servizi, sconto, IVA | — | ✓ | ✓ |
| Margine e costi interni (mai nel PDF), stati bozza → inviato → accettato/rifiutato/perso | — | ✓ | ✓ |
| PDF del preventivo generato sul telefono, tasso di conversione per cliente e totale | — | ✓ | ✓ |
| Da preventivo accettato a evento (con fabbisogno di personale già calcolato) | — | ✓ | ✓ |
| Sopralluoghi: checklist in loco, misure, foto e planimetrie (bucket privato) | — | ✓ | ✓ |
| Dati aziendali e condizioni stampati sui preventivi | — | — | ✓ |
| **Fase 2** · Documenti con scadenza (foto/PDF, bucket privato) | propri | — | tutti + verifica |
| Documenti obbligatori mancanti, promemoria a 30/15/7 giorni | propri | — | tutti |
| Trasferte e rimborsi con ricevuta: richiesto → approvato/rifiutato → pagato | propri | approva | ✓ |
| Registro pagamenti (acconti, saldi), saldo dovuto e movimenti | lettura propri | ✓ | ✓ (+ elimina) |
| Notifiche in-app (turni, documenti, rimborsi, pagamenti) | ✓ | ✓ | ✓ |
| **Fase 1** | | | |
| Accesso, recupero password, registrazione su invito | ✓ | ✓ | ✓ |
| Profilo (anagrafica, IBAN, taglie, competenze, foto) | proprio | proprio | proprio |
| Eventi: crea, modifica, fabbisogno e copertura | — | ✓ | ✓ |
| Turni: assegna, annulla, riproponi | — | ✓ | ✓ |
| Turni: conferma / rifiuta | propri | — | — |
| Ore effettive con maggiorazioni → compenso lordo | lettura propri | ✓ | ✓ |
| Riepilogo mensile + export CSV (Excel) / stampa PDF | proprio | tutti | tutti |
| Dashboard | base | completa | completa |
| Inviti, ruoli, tariffe, attivazione account | — | — | ✓ |
| Maggiorazioni e registro modifiche (audit log) | — | — | ✓ |

Da configurare sul progetto Supabase: email con Brevo e funzione inviti (sezione 2), notifiche push (sezione 2-bis).

**Preventivi.** Ogni voce ha prezzo di vendita e costo interno; il margine si vede solo nell’app. Dopo l’invio il preventivo è bloccato (il cliente ha quella versione): per cambiarlo si riporta in bozza. Quando passa a “inviato” l’azienda va “in trattativa”, quando è “accettato” diventa “cliente attivo”. Prima di inviare il primo PDF compila **Altro → Impostazioni → Dati aziendali** (ragione sociale, P. IVA, condizioni). Le email (inviti, notifiche) richiedono la configurazione di Brevo (sezione 2).

**Come funzionano saldo e rimborsi.** Saldo = compensi maturati + rimborsi approvati − pagamenti registrati. Quando un rimborso viene segnato come pagato, l’app registra da sola il pagamento corrispondente: quel pagamento non si può eliminare a parte. Un responsabile non può approvare le proprie richieste di rimborso (l’admin sì).

**Promemoria scadenze.** Ogni giorno alle 05:30 UTC (pg_cron) la funzione `genera_promemoria_scadenze()` notifica collaboratore e admin quando un documento è a 30, 15 o 7 giorni dalla scadenza, o è scaduto. Ogni soglia viene notificata una sola volta. Per lanciarla a mano: `select public.genera_promemoria_scadenze();` nello SQL Editor.

## Struttura

```
gestionale/
├─ src/
│  ├─ auth/            sessione e permessi per ruolo
│  ├─ components/      layout, componenti UI, modulo profilo
│  ├─ lib/             client Supabase, tipi, formattazione
│  └─ pages/           schermate (auth, eventi, admin, …)
├─ supabase/
│  ├─ migrations/      schema SQL, RLS, trigger (si applicano in ordine)
│  └─ functions/       Edge Function `invita-utente`
├─ scripts/seed-demo.mjs   dati DEMO fittizi
└─ public/             icona PWA
```

## Sicurezza in breve

- Ogni tabella ha **Row Level Security**: il collaboratore legge solo i propri turni ed eventi; i dati sensibili (IBAN, codice fiscale, nascita, indirizzo) stanno in `profili_privati`, visibile solo al proprietario e all’admin.
- Ruolo, tariffa e attivazione si cambiano solo da admin (trigger `proteggi_campi_profilo`).
- Il collaboratore risponde ai turni solo tramite la funzione `rispondi_turno` (non può modificare altro).
- Le foto profilo sono in un bucket **privato**, servite con link firmati a scadenza.
- Ogni modifica a turni/ore/compensi, tariffe, ruoli e maggiorazioni finisce in `audit_log` (chi, cosa, quando).
- Il compenso è calcolato dal database e “fotografa” le maggiorazioni del momento: cambiarle dopo non altera lo storico. I turni con ore registrate non si possono eliminare.
- La chiave `service_role` è usata solo nella Edge Function e nello script DEMO, mai nel frontend.

---

## 1. Setup locale

Prerequisiti: **Node.js 20+** (testato con 24) e un progetto Supabase (vedi sezione 2).

```bash
npm install
cp .env.example .env.local      # su Windows: copy .env.example .env.local
# inserisci VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

Apri http://localhost:5173. Per provarlo dal telefono sulla stessa rete Wi‑Fi: `npm run dev -- --host` e apri l’indirizzo IP mostrato.

Altri comandi: `npm run build` (build di produzione), `npm run preview` (anteprima della build), `npm run lint`.

## 2. Configurare Supabase

1. Crea un progetto su https://supabase.com scegliendo la regione **Central EU (Frankfurt)** (dati in UE, GDPR).
2. **Applica le migrazioni**, in ordine:
   - *Da browser*: SQL Editor → incolla ed esegui `supabase/migrations/20261018000001_fase1_schema.sql`, poi `…000002_fase1_sicurezza.sql`, `…000003_fase2.sql`, `…000004_fase3.sql` e `…000005_fase4.sql`.
   - *Oppure da terminale* (CLI senza installazione):
     ```bash
     npx supabase login
     npx supabase link --project-ref <id-progetto>
     npx supabase db push
     ```
3. **Authentication → Sign In / Providers → Email**: lascia attivo Email, **disattiva “Allow new users to sign up”** (si entra solo su invito).
4. **Authentication → URL Configuration**:
   - Site URL: l’indirizzo dell’app (in locale `http://localhost:5173`, poi quello Vercel)
   - Redirect URLs: aggiungi `http://localhost:5173/**` e `https://<tuo-dominio>/**`
5. **Email con Brevo** (inviti e recupero password):
   - Su Brevo: crea l’account, verifica il dominio mittente (record DNS SPF/DKIM), poi *SMTP & API → SMTP* e genera una chiave SMTP.
   - Su Supabase: **Authentication → Emails → SMTP Settings** → abilita Custom SMTP: host `smtp-relay.brevo.com`, porta `587`, utente = login SMTP Brevo, password = chiave SMTP, mittente = un indirizzo del dominio verificato.
   - In **Authentication → Emails → Templates** traduci in italiano i testi di “Invite user” e “Reset password”.
6. **Edge Function per gli inviti**:
   ```bash
   npx supabase functions deploy invita-utente
   npx supabase secrets set APP_URL=https://<tuo-dominio>
   ```
   (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` sono già disponibili alla funzione.)
7. **Primo amministratore**: Authentication → Users → *Add user* (email + password, “Auto confirm”). Poi nel SQL Editor:
   ```sql
   update public.profiles
   set ruolo = 'admin', attivo = true, profilo_completo = false
   where email = 'tua@email.it';
   ```
   Al primo accesso l’app ti chiederà di completare il profilo. Da lì inviti tutti gli altri da **Utenti → Invita**.
8. **Maggiorazioni**: Utenti → Impostazioni. Partono da 0 %: inserisci le percentuali del vostro contratto prima di registrare le ore.

## 2-bis. Notifiche push

Ogni notifica dell’app (turno proposto, scadenza, rimborso, pagamento, follow-up…) può arrivare anche come notifica push sul telefono. Senza questa configurazione l’app funziona lo stesso: le notifiche restano solo in-app.

1. **Chiavi**: le chiavi VAPID sono già state generate in `.env.push` (escluso da git). La chiave pubblica è anche in `.env.local` come `VITE_VAPID_PUBLIC_KEY`. Su Vercel aggiungi la stessa variabile.
2. **Pubblica la funzione** (serve `npx supabase login` una volta):
   ```bash
   npx supabase functions deploy invia-push --no-verify-jwt
   npx supabase secrets set --env-file .env.push
   ```
   Imposta `VAPID_SUBJECT` in `.env.push` a un indirizzo di contatto, es. `mailto:tua@email.it`, prima del comando.
3. **Collega il database alla funzione**: in *Database → Extensions* abilita **pg_net**, poi nel SQL Editor (sostituisci il segreto con il valore di `PUSH_SECRET` in `.env.push`):
   ```sql
   select vault.create_secret('https://<id-progetto>.supabase.co/functions/v1/invia-push', 'push_url');
   select vault.create_secret('<PUSH_SECRET>', 'push_secret');
   ```
4. Ogni utente attiva i push dal proprio telefono in **Profilo → Notifiche push**. Su iPhone serve prima “Aggiungi alla schermata Home” (iOS 16.4 o successivo).

## 3. Dati DEMO (facoltativo, solo ambienti di prova)

Crea 3 utenti per ruolo (`demo.<ruolo>.<n>@example.com`), 2 eventi e alcuni turni, tutti con nomi che iniziano per **DEMO**.

```bash
cp .env.seed.example .env.seed   # compila URL, service role key e una DEMO_PASSWORD a tua scelta
node --env-file=.env.seed scripts/seed-demo.mjs
```

Si può rilanciare: rigenera gli eventi DEMO. Non usarlo sul database di produzione.

In alternativa, senza service role key: apri `supabase/seed-demo.sql`, sostituisci `DEMO_PASSWORD_QUI` con la password scelta ed eseguilo nello SQL Editor.

Dati DEMO commerciali (3 aziende, 1 sopralluogo, 2 preventivi, follow-up): esegui poi `supabase/seed-demo-fase3.sql` nello SQL Editor. Infine `supabase/seed-demo-fase4.sql` (valutazioni, indisponibilità, preventivo accettato per il report margini).

**Test del database** (non serve Supabase né Docker): `npm run test:db` applica tutte le migrazioni su un Postgres locale in memoria e verifica permessi per ruolo, calcoli, flussi e seed DEMO.

## 4. Deploy su Vercel

1. Metti la cartella `gestionale` in un repository Git (GitHub/GitLab) e importalo su https://vercel.com → *Add New → Project*.
2. Framework: **Vite** (rilevato in automatico). Build command `npm run build`, output `dist`. Se il repository contiene anche altre cartelle, imposta *Root Directory* = `gestionale`.
3. *Environment Variables*: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (le stesse di `.env.local`). **Non** aggiungere la service role key.
4. Deploy. Poi aggiorna in Supabase *Site URL* e *Redirect URLs* con il dominio Vercel e rilancia `npx supabase secrets set APP_URL=…`.
5. `vercel.json` gestisce già le rotte della single page app e impedisce l’indicizzazione sui motori di ricerca.

Installazione sul telefono: apri il sito → Android/Chrome “Installa app”; iPhone/Safari → Condividi → “Aggiungi alla schermata Home”.

### Costi

In sviluppo bastano i piani gratuiti. Per l’uso reale valuta:
- **Supabase Pro** (~25 $/mese): backup giornalieri automatici e nessuna pausa del progetto. Il piano Free va in pausa dopo 7 giorni senza attività e non ha backup scaricabili.
- **Vercel Pro** (~20 $/mese): il piano Hobby è riservato a uso non commerciale. In alternativa si può pubblicare la cartella `dist` su altri hosting statici (Netlify, Cloudflare Pages).
- **Brevo**: il piano gratuito (300 email/giorno) basta per inviti e recuperi password.

## 5. Backup del database

- **Piano Pro**: backup giornalieri automatici (Database → Backups), con ripristino dal pannello.
- **Backup manuale** (qualsiasi piano), da fare almeno settimanalmente e conservare in un luogo sicuro e cifrato:
  ```bash
  npx supabase db dump --linked -f backup-schema.sql
  npx supabase db dump --linked --data-only -f backup-dati.sql
  ```
  Ripristino su un progetto vuoto: esegui `backup-schema.sql` e poi `backup-dati.sql` (SQL Editor o `psql`).
- Foto profilo, documenti e ricevute stanno nello Storage e non sono inclusi nel dump: scaricali dal pannello Storage o con la CLI, un bucket alla volta (`npx supabase storage cp -r ss:///documenti ./backup-documenti --experimental`, lo stesso per `foto-profilo`, `ricevute` e `sopralluoghi`).
- I backup contengono dati personali (IBAN, codici fiscali): trattali come documenti riservati.
