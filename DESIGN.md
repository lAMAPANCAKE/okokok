---
name: Gestionale Eventi
description: Il gestionale di un catering per eventi, sul telefono di chi lavora in sala e di chi la organizza.
colors:
  bordeaux: "#7A1F33"
  bordeaux-deep: "#5E1626"
  bordeaux-soft: "#F6E9EC"
  linen: "#FAF8F5"
  tablecloth: "#FFFFFF"
  ink: "#1F1A17"
  ink-muted: "#5F5650"
  seam: "#E8E2DA"
  seam-strong: "#D3CAC0"
  sage-ok: "#2F6B4F"
  sage-ok-soft: "#E6F1EA"
  amber-wait: "#8A5410"
  amber-wait-soft: "#FBF1DF"
  wine-alert: "#9B2C2C"
  wine-alert-soft: "#FBE9E7"
  slate-busy: "#2F5D7C"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
  figure:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.bordeaux}"
    textColor: "{colors.tablecloth}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.bordeaux-deep}"
  button-secondary:
    backgroundColor: "{colors.tablecloth}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.bordeaux}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  input:
    backgroundColor: "{colors.tablecloth}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "48px"
  card:
    backgroundColor: "{colors.tablecloth}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  area-tile:
    backgroundColor: "{colors.tablecloth}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
  chip-status-ok:
    backgroundColor: "{colors.sage-ok-soft}"
    textColor: "{colors.sage-ok}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-status-wait:
    backgroundColor: "{colors.amber-wait-soft}"
    textColor: "{colors.amber-wait}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-status-alert:
    backgroundColor: "{colors.wine-alert-soft}"
    textColor: "{colors.wine-alert}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  nav-bottom-active:
    backgroundColor: "{colors.bordeaux-soft}"
    textColor: "{colors.bordeaux}"
    rounded: "{rounded.pill}"
---

<!-- DIREZIONE SCELTA: questo file descrive lo stile verso cui portare l'app (scelto il 25/10/2026: "la sala apparecchiata", componenti leggeri, bordeaux, tutto senza grazie). Il codice oggi usa ancora indaco/viola, ardesia fredda e il font di sistema: la migrazione è da fare. Dopo la migrazione, rilanciare /impeccable document per allineare i valori al codice. -->

# Design System: Gestionale Eventi

## Overview

**Creative North Star: "La sala apparecchiata"**

L’app deve somigliare a una sala pronta un’ora prima degli ospiti: tovaglie stese, ogni cosa al suo posto, nessun oggetto di troppo. Lo sfondo è un lino caldo, le schede sono tovaglie bianche appena separate da una cucitura sottile, e il bordeaux compare come il vino nei calici: poco, dove conta. L’eleganza viene dall’ordine e dallo spazio, non dalla decorazione.

È uno strumento di lavoro (modalità Operate): si usa col pollice, in piedi, spesso all’aperto o in una location semivuota. Per questo la raffinatezza resta sotto la leggibilità: testi scuri e caldi, contrasto pieno, aree da toccare grandi anche quando sembrano leggere. Lo stato di ogni cosa (confermato, in attesa, mancante) si legge prima di aprirla, sempre con una parola accanto al colore.

Ogni area dell’app tiene la sua icona e la sua tinta, ma in versione tenue: le tinte riconoscono, il bordeaux comanda.

**Key Characteristics:**
- Fondo lino caldo, schede bianche, cuciture sottili al posto di ombre e anelli.
- Un solo colore d’azione, il bordeaux; tinte delle aree tenui e mai in competizione.
- Un solo carattere senza grazie in tutta l’app, con pesi misurati.
- Componenti leggeri ma con aree da toccare di almeno 44 px.
- Stati sempre con parola + colore, mai solo colore.

## Colors

Una tavolozza da sala: lino, tovaglia bianca, inchiostro caldo e un bordeaux da vino rosso, con tre colori di stato presi dalla stessa famiglia calda.

### Primary
- **Bordeaux** (#7A1F33): pulsante principale di ogni schermata, pulsante + della barra in basso, voce attiva della navigazione, link d’azione. Bianco su bordeaux supera ampiamente il contrasto AA.
- **Bordeaux scuro** (#5E1626): stato premuto e hover del pulsante principale.
- **Bordeaux velato** (#F6E9EC): fondo della voce attiva nella barra in basso e della selezione; mai come fondo di grandi superfici.

### Neutral
- **Lino** (#FAF8F5): fondo di tutte le pagine.
- **Tovaglia** (#FFFFFF): schede, campi, barra superiore e inferiore.
- **Inchiostro** (#1F1A17): titoli e testo principale.
- **Inchiostro tenue** (#5F5650): testo secondario, date, descrizioni sotto i titoli (contrasto ≥ 4.5:1 sul lino).
- **Cucitura** (#E8E2DA): bordo di schede e separatori.
- **Cucitura marcata** (#D3CAC0): bordo dei campi e dei pulsanti secondari.

### Stati
- **Salvia** (#2F6B4F su #E6F1EA): confermato, coperto, caricato, tutto in ordine.
- **Ambra** (#8A5410 su #FBF1DF): da confermare, in attesa, mancano persone.
- **Vino** (#9B2C2C su #FBE9E7): rifiutato, scaduto, non disponibile, errori.
- **Ardesia** (#2F5D7C): impegnato in un altro evento (griglia del personale), con testo bianco.

### Named Rules
**The Wine Glass Rule.** Il bordeaux è il vino nel calice: occupa meno del 10% di una schermata. Un solo pulsante bordeaux per schermata; il resto è secondario o tranquillo.

**The Word-With-Color Rule.** Ogni stato colorato porta la sua parola (“Confermato”, “Mancano 4”, “Non disp.”). Il colore conferma, la parola informa.

**The Quiet Tint Rule.** Le tinte delle aree (eventi, personale, sopralluoghi, preventivi…) restano su fondi pallidi dietro le icone; non diventano mai pulsanti, testi lunghi o fondi di sezione.

## Typography

**Display Font:** nessuno distinto: i titoli usano lo stesso carattere.
**Body Font:** Plus Jakarta Sans (con ui-sans-serif, system-ui)

**Character:** un senza grazie con aperture morbide e un tocco caldo, leggibile a 12 px sul telefono e composto ai titoli. Va caricato davvero nell’app (oggi il CSS dichiara Inter ma non lo carica, quindi si vede il font di sistema).

### Hierarchy
- **Headline** (650, 1.5rem, 1.2): titolo della pagina, uno per schermata.
- **Title** (600, 1.0625rem, 1.3): titolo di sezione e di scheda (“Squadra”, “Da fare”, nome dell’evento in elenco).
- **Body** (400, 1rem, 1.5): testo dei campi e contenuto principale.
- **Body small** (400, 0.875rem, 1.45): descrizioni, date, righe secondarie.
- **Label** (600, 0.75rem, +0.02em): etichette della barra in basso, chip di stato, intestazioni di gruppo. Minimo 12 px.
- **Figure** (600, 1.5rem, cifre tabulari): numeri di riepilogo (ore, compensi, posti scoperti).

### Named Rules
**The Twelve Floor Rule.** Nessun testo sotto i 12 px, nemmeno etichette o note.

**The Tabular Money Rule.** Euro, ore e conteggi usano cifre tabulari, così le colonne si allineano.

## Layout

Una colonna sul telefono (margini laterali 16 px), contenuto al massimo 768 px su schermi larghi con la barra laterale a sinistra (256 px). Ritmo su scala 4/8: 8 px dentro i gruppi, 12–16 px tra elementi, 24 px tra sezioni. Più spazio sopra un titolo di sezione che sotto. La barra in basso del telefono è fissa con 5 posti e il pulsante + al centro; il contenuto lascia 112 px liberi in fondo. Le griglie di riquadri sono a 3 colonne in Home e a 2 colonne negli strumenti dell’evento.

## Elevation & Depth

Piatta per scelta: la profondità viene dal contrasto lino/tovaglia e da una cucitura di 1 px, non dalle ombre. Un’ombra morbida compare solo su ciò che galleggia sopra la pagina.

### Shadow Vocabulary
- **Foglio** (`box-shadow: 0 12px 32px rgba(31, 26, 23, 0.16)`): pannello “Crea nuovo”, finestre e menu sovrapposti.
- **Pulsante +** (`box-shadow: 0 6px 16px rgba(122, 31, 51, 0.28)`): solo il pulsante + della barra in basso.

### Named Rules
**The Flat Tablecloth Rule.** Schede e riquadri non hanno ombra a riposo. Se serve distinguere, si usa la cucitura o un fondo più chiaro, mai un’ombra in più.

## Shapes

Angoli morbidi ma non gonfi: 12 px per pulsanti e campi, 16 px per schede e riquadri, pillola per chip di stato e voce attiva della navigazione. Bordi sempre di 1 px; nessun bordo colorato laterale. Le icone sono disegnate a tratto (1.8 px, estremità arrotondate) in un solo stile in tutta l’app; niente emoji al posto delle icone nell’interfaccia.

## Components

### Buttons
- **Shape:** angoli morbidi (12 px), altezza 48 px (44 px per i pulsanti tranquilli).
- **Primary:** bordeaux con testo bianco, peso 600; uno per schermata.
- **Hover / Focus:** bordeaux scuro; anello di focus 2 px bordeaux con 2 px di distacco.
- **Secondary:** tovaglia con cucitura marcata e testo inchiostro.
- **Quiet:** solo testo bordeaux, per azioni accessorie (“Clienti →”, “Turni e ore →”), sempre con area da toccare di 44 px.

### Chips
- **Style:** pillola, fondo tenue e testo scuro della stessa famiglia (salvia, ambra, vino), etichetta da 12 px.
- **State:** solo stato, mai azione; i contatori in evidenza sui riquadri usano ambra scura con testo bianco.

### Cards / Containers
- **Corner Style:** 16 px.
- **Background:** tovaglia su lino.
- **Shadow Strategy:** nessuna (vedi The Flat Tablecloth Rule).
- **Border:** cucitura 1 px.
- **Internal Padding:** 16 px; mai schede dentro schede.

### Inputs / Fields
- **Style:** tovaglia, cucitura marcata 1 px, 12 px, altezza 48 px, testo a 16 px (evita lo zoom su iPhone).
- **Focus:** bordo bordeaux 2 px.
- **Error / Disabled:** bordo e messaggio vino; disabilitato su lino con testo tenue.

### Navigation
- **Barra in basso (telefono):** tovaglia, 5 posti, etichette da 12 px; voce attiva con pillola bordeaux velato e icona bordeaux; pulsante + bordeaux al centro, sollevato.
- **Barra laterale (computer):** gruppi con intestazione da 12 px in inchiostro tenue; voce attiva con fondo inchiostro e testo bianco; ogni voce con la sua icona in tinta tenue.

### Area Tile
Il riquadro d’area è il componente che definisce l’app: tovaglia, cucitura, icona tenue in alto a sinistra, nome dell’area in basso, eventuale contatore in alto a destra (ambra scura se chiede attenzione). Si usa in Home, in “Tutte le aree” e negli strumenti dell’evento.

## Do's and Don'ts

### Do:
- **Do** usare il bordeaux (#7A1F33) per un solo pulsante principale per schermata.
- **Do** separare le schede con la cucitura (#E8E2DA) su fondo lino (#FAF8F5), senza ombre.
- **Do** accompagnare ogni colore di stato con la sua parola.
- **Do** tenere le aree da toccare a 44 px anche per link e icone.
- **Do** usare cifre tabulari per euro, ore e conteggi.

### Don't:
- **Don't** usare gradienti viola/indaco, testo sfumato o vetro smerigliato decorativo.
- **Don't** usare emoji come icone nell’interfaccia (📍, 🍽️, 🍸): servono icone disegnate.
- **Don't** mettere bordi colorati laterali su schede, avvisi o righe di elenco.
- **Don't** scendere sotto i 12 px di testo.
- **Don't** mettere etichette in maiuscoletto sopra i titoli di pagina: il titolo basta.
