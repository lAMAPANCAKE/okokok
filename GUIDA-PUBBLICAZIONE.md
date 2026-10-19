# Pubblicare email e notifiche push

Progetto Supabase: `ezwpkvuhlupjmhquksui` (Francoforte). Tempo stimato: 20–30 minuti.
I comandi vanno lanciati nel terminale **dentro la cartella `gestionale`**.

---

## Parte 1 — Email con Brevo (inviti e recupero password)

1. **Crea l’account** su https://www.brevo.com (piano gratuito: 300 email/giorno).
2. **Mittente**: *Senders, Domains & Dedicated IPs → Senders → Add a sender*, con un indirizzo tuo (es. `noreply@tuodominio.it`) e conferma dal link che ricevi.
   Meglio ancora, in *Domains* autentica il tuo dominio aggiungendo i record DNS che Brevo indica (SPF/DKIM): le email finiscono molto meno in spam.
   *Se non hai un dominio puoi partire con un indirizzo Gmail verificato, ma una parte delle email potrebbe finire in spam.*
3. **Chiave SMTP**: *SMTP & API → SMTP → Generate a new SMTP key*. Annota **login SMTP** e **chiave** (la chiave si vede una volta sola).
4. **Supabase**: *Authentication → Emails → SMTP Settings → Enable Custom SMTP*:
   - Sender email: il mittente verificato al punto 2
   - Sender name: `Gestionale Eventi`
   - Host: `smtp-relay.brevo.com` · Port: `587`
   - Username: il login SMTP · Password: la chiave SMTP
   - Salva.
5. **Testi in italiano**: *Authentication → Emails → Templates*: per “Invite user” e “Reset password” incolla i testi della sezione **Modelli email** in fondo a questo file.

## Parte 2 — Pubblicare le funzioni

1. Accedi alla CLI (si apre il browser, conferma con il tuo account Supabase):
   ```bash
   npx supabase login
   ```
2. Pubblica le due funzioni:
   ```bash
   npx supabase functions deploy invita-utente --project-ref ezwpkvuhlupjmhquksui
   npx supabase functions deploy invia-push --project-ref ezwpkvuhlupjmhquksui --no-verify-jwt
   ```
3. Apri `.env.push` e alla riga `VAPID_SUBJECT=mailto:` aggiungi un tuo indirizzo di contatto (es. `mailto:tua@email.it`). Poi carica i segreti:
   ```bash
   npx supabase secrets set --env-file .env.push --project-ref ezwpkvuhlupjmhquksui
   npx supabase secrets set APP_URL=http://localhost:5173 --project-ref ezwpkvuhlupjmhquksui
   ```
   Quando l’app sarà online su Vercel, ripeti l’ultimo comando con l’indirizzo definitivo.

## Parte 3 — Collegare il database ai push

Nello **SQL Editor** di Supabase incolla ed esegui il contenuto di `supabase/configura-push.local.sql`: abilita `pg_net` e salva nel Vault l’indirizzo della funzione e il segreto condiviso. Il file contiene un segreto: non condividerlo e non metterlo su GitHub (è già escluso da git).

## Parte 4 — Prova

1. **Inviti**: entra come admin → *Altro → Utenti → Invita un utente* con un tuo secondo indirizzo email. Deve arrivare l’email; il link porta alla pagina “Benvenuto”.
2. **Push**: i push richiedono il service worker, attivo solo nell’app compilata:
   ```bash
   npm run build
   npm run preview
   ```
   Apri http://localhost:4173, entra, vai su *Profilo → Notifiche push → Attiva*. Poi, da un altro account staff, proponi un turno a quell’utente: deve arrivare la notifica.
   Sul telefono lo proverai appena l’app è su Vercel (su iPhone dopo “Aggiungi alla schermata Home”).

Se qualcosa non va: *Edge Functions → invia-push (o invita-utente) → Logs* in Supabase mostra l’errore.

---

## Modelli email

**Invite user** — Oggetto: `Sei stato invitato nel Gestionale Eventi`

```html
<h2>Benvenuto!</h2>
<p>Sei stato invitato a usare il Gestionale Eventi, l’app per turni, ore e compensi.</p>
<p><a href="{{ .ConfirmationURL }}">Accetta l’invito e scegli la tua password</a></p>
<p>Il link ha una scadenza: se non funziona più, chiedi un nuovo invito. Se non aspettavi questo invito puoi ignorare l’email.</p>
```

**Reset password** — Oggetto: `Reimposta la password del Gestionale Eventi`

```html
<h2>Reimposta la password</h2>
<p>Abbiamo ricevuto una richiesta di reimpostare la tua password.</p>
<p><a href="{{ .ConfirmationURL }}">Scegli una nuova password</a></p>
<p>Se non sei stato tu, ignora questa email: la password resta invariata.</p>
```
