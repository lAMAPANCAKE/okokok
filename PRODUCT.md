# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Due gruppi con lo stesso peso:
- **Responsabili** (titolare, socio, responsabile): pianificano eventi, fanno i sopralluoghi, scrivono i preventivi, formano il gruppo di lavoro e controllano i conti. Soprattutto da telefono, spostandosi tra ufficio, location ed evento.
- **Collaboratori** (camerieri, baristi, hostess): confermano o rifiutano i turni, segnano i giorni in cui non ci sono, leggono ordine di servizio e punto di ritrovo, vedono ore e pagamenti, caricano documenti e rimborsi. Quasi solo da telefono, spesso poco prima o durante il turno.

## Product Purpose
Gestire un’azienda di catering ed eventi dall’inizio alla fine in un’unica app: cliente → sopralluogo → preventivo → evento → personale → lista di carico → fattura. Ogni informazione si scrive una volta e arriva a chi serve. Successo: meno telefonate e messaggi WhatsApp, niente ricopiature tra Word ed Excel, margini chiari per ogni evento.

## Positioning
Il sopralluogo è la fonte di tutto: foto per zona, sala 3D con i coperti contati, e da lì si calcolano preventivo, ordine di servizio, lista di carico e gruppo di lavoro. Un gestionale del personale o un CRM qualsiasi non collega questi passaggi.

## Operating Context
- Telefono in una mano, spesso all’aperto o in una location semivuota, a volte senza rete (foto e zone si salvano e partono dopo).
- PWA installata (Aggiungi a schermata Home), interfaccia in italiano.
- Documenti che escono dall’app: PDF di preventivo e rendering per il cliente, ordine di servizio e lista di carico per staff e magazzino, messaggio WhatsApp per il gruppo.
- Ruoli: admin, responsabile, collaboratore; i permessi del database (RLS Supabase) decidono chi vede cosa.

## Capabilities and Constraints
- React + Vite + Tailwind, Supabase (Postgres, Auth, Storage), pubblicata su GitHub Pages.
- Sala 3D in three.js con modelli pronti (matrimonio, gala, convention, aperitivo…) e arredi disegnati in codice.
- Rendering per il cliente tramite ChatGPT (flusso semi-manuale).
- Accesso anche con nome utente (es. `admin`).
- Dati demo marcati DEMO; i dati reali non vanno toccati.

## Brand Commitments
Nome: “Gestionale Eventi”. Nessun logo o colore aziendale obbligatorio (l’utente ha lasciato libero). Ogni area ha sempre lo stesso colore e la stessa icona in tutta l’app.

## Evidence on Hand
Solo dati DEMO (eventi, clienti, camerieri, preventivi). Nessuna testimonianza, cliente reale o numero da pubblicare: non inventarne.

## Product Principles
1. Si scrive una volta, si usa ovunque: niente si ricopia a mano da una schermata all’altra.
2. Ogni area a due tocchi col pollice; lo stato (cosa manca, cosa aspetta) si vede prima di aprire.
3. Il giorno del turno il collaboratore trova ora, luogo, divisa e referente senza chiedere a nessuno.
4. I documenti per il cliente sono presentabili così come escono, senza ritocchi.
5. Chiarezza sui soldi: il margine interno non compare mai in ciò che vede il cliente.

## Accessibility & Inclusion
Leggibile all’aperto e di colpo d’occhio: contrasto sufficiente, aree da toccare di almeno 44 px, colore mai unico segnale (sempre con una parola).
