-- =============================================================================
-- DEMO completa: account manager "admin" e dati di esempio in ogni sezione,
-- per capire il funzionamento dell'app. Tutto è marcato DEMO e si può rieseguire:
-- ogni volta cancella e ricrea solo i dati DEMO (eventi, clienti, preventivi,
-- fatture, rimborsi e calendari dei 10 camerieri fittizi).
--
-- Accesso: nome utente "admin" (email interna admin@utenti.gestionale).
-- Prima di eseguire sostituisci PASSWORD_ADMIN_QUI con una password robusta.
-- I 10 camerieri fittizi (demo.cameriere.N@example.com) non possono accedere.
-- =============================================================================
do $$
declare
  pw constant text := 'PASSWORD_ADMIN_QUI';
  email_admin constant text := 'admin@utenti.gestionale';
  admin uuid;
  uid uuid;
  u record;
  c uuid[] := '{}';
  vecchi uuid[];
  aurora uuid; bianchi uuid; tech uuid; arte uuid; rossi uuid;
  e_conv uuid; e_matr uuid; e_gala uuid; e_aper uuid; e_cena uuid;
  sop uuid; p uuid; f uuid;
  r uuid;
begin
  if pw = 'PASSWORD_ADMIN_QUI' or length(pw) < 10 then
    raise exception 'Imposta una password di almeno 10 caratteri al posto di PASSWORD_ADMIN_QUI';
  end if;

  -- ---------------------------------------------------------------- utenti
  -- Account manager (admin)
  select id into admin from auth.users where email = email_admin;
  if admin is null then
    insert into public.inviti (email, ruolo, tariffa_oraria) values (email_admin, 'admin', 0);
    admin := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', admin, 'authenticated', 'authenticated', email_admin,
      extensions.crypt(pw, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), admin, admin::text, jsonb_build_object('sub', admin::text, 'email', email_admin, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf')) where id = admin;
  end if;
  update public.profiles set nome = 'Admin', cognome = 'Demo', ruolo = 'admin', attivo = true, profilo_completo = true,
    telefono = '+39 000 000 0000', competenze = '{}' where id = admin;

  -- 10 camerieri fittizi (senza accesso: password casuale mai comunicata)
  for u in
    select * from (values
      (1, 'Giulia', 'Rinaldi', 13::numeric, '{sala,inglese,"capo rango"}'::text[]),
      (2, 'Marco', 'Ferri', 14, '{bar,sala,"patente B"}'),
      (3, 'Sara', 'Conti', 12, '{sala,hostess,francese}'),
      (4, 'Luca', 'Moretti', 12, '{sala,"patente B"}'),
      (5, 'Chiara', 'Galli', 13, '{bar,inglese}'),
      (6, 'Davide', 'Fontana', 12, '{sala,cucina}'),
      (7, 'Elena', 'Marino', 12, '{sala,hostess,inglese}'),
      (8, 'Matteo', 'Greco', 13, '{bar,sommelier}'),
      (9, 'Francesca', 'Lombardi', 12, '{sala,"capo rango"}'),
      (10, 'Simone', 'Costa', 11, '{sala,runner}')
    ) as v(n, nome, cognome, tariffa, competenze)
  loop
    select id into uid from auth.users where email = 'demo.cameriere.' || u.n || '@example.com';
    if uid is null then
      insert into public.inviti (email, ruolo, tariffa_oraria) values ('demo.cameriere.' || u.n || '@example.com', 'collaboratore', u.tariffa);
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'demo.cameriere.' || u.n || '@example.com',
        extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', 'demo.cameriere.' || u.n || '@example.com', 'email_verified', true), 'email', now(), now(), now());
    end if;
    update public.profiles set nome = u.nome, cognome = u.cognome, ruolo = 'collaboratore', tariffa_oraria = u.tariffa,
      competenze = u.competenze, attivo = true, profilo_completo = true, telefono = '+39 000 000 00' || lpad(u.n::text, 2, '0'),
      taglia_giacca = (array['S','M','L','M','S','L','M','L','S','M'])[u.n], taglia_pantalone = (array['42','48','44','50','42','50','44','50','42','48'])[u.n]
    where id = uid;
    c := c || uid;
  end loop;

  -- ---------------------------------------------------------------- pulizia DEMO precedente
  -- Prima i rimborsi: cancellando gli eventi verrebbero modificati, e quelli già approvati non lo permettono
  delete from public.rimborsi where collaboratore_id = any (c);
  delete from public.pagamenti where collaboratore_id = any (c);
  select array_agg(id) into vecchi from public.eventi where nome like 'DEMO %';
  if vecchi is not null then
    -- anche i rimborsi degli utenti DEMO dei seed precedenti
    delete from public.rimborsi where evento_id = any (vecchi)
      and collaboratore_id in (select id from auth.users where email like 'demo.%@example.com');
    update public.turni set ore_totali = null, ore_notturne = 0, ore_festive = 0, ore_straordinarie = 0, stato = 'annullato'
    where evento_id = any (vecchi) and stato = 'completato';
  end if;
  delete from public.incassi where fattura_id in (select id from public.fatture where azienda_id in (select id from public.aziende where nome like 'DEMO %'));
  delete from public.fatture where azienda_id in (select id from public.aziende where nome like 'DEMO %');
  delete from public.preventivi where azienda_id in (select id from public.aziende where nome like 'DEMO %');
  delete from public.sopralluoghi where titolo like 'DEMO %';
  delete from public.aziende where nome like 'DEMO %';
  if vecchi is not null then delete from public.eventi where id = any (vecchi); end if;
  delete from public.indisponibilita where collaboratore_id = any (c);
  delete from public.notifiche where utente_id = admin and chiave like 'demo-%';

  -- ---------------------------------------------------------------- impostazioni (solo se vuote)
  update public.impostazioni set
    ragione_sociale = coalesce(ragione_sociale, 'DEMO Catering & Eventi S.r.l.'),
    indirizzo_sede = coalesce(indirizzo_sede, 'DEMO Via Roma 1, Milano'),
    condizioni_preventivo = coalesce(condizioni_preventivo, 'DEMO: acconto 30% alla conferma, saldo a fine evento. Prezzi IVA esclusa.');

  -- ---------------------------------------------------------------- clienti (CRM)
  insert into public.aziende (nome, settore, referente, ruolo_referente, email, telefono, indirizzo, stato_pipeline, responsabile_id, creato_da, note)
  values ('DEMO Hotel Aurora', 'Hospitality', 'Laura Verdi', 'Event manager', 'eventi@example.com', '+39 000 000 1001', 'Via del Lago 1, Como', 'cliente_attivo', admin, admin, 'DEMO: cliente ricorrente per gala e matrimoni')
  returning id into aurora;
  insert into public.aziende (nome, settore, referente, ruolo_referente, email, telefono, stato_pipeline, responsabile_id, creato_da)
  values ('DEMO Studio Legale Bianchi', 'Servizi professionali', 'Marco Bianchi', 'Socio', 'segreteria@example.com', '+39 000 000 1002', 'contattato', admin, admin)
  returning id into bianchi;
  insert into public.aziende (nome, settore, referente, ruolo_referente, email, telefono, indirizzo, stato_pipeline, responsabile_id, creato_da)
  values ('DEMO Tech Italia S.p.A.', 'Tecnologia', 'Andrea Neri', 'Office manager', 'office@example.com', '+39 000 000 1003', 'Viale Monza 100, Milano', 'contattato', admin, admin)
  returning id into tech;
  insert into public.aziende (nome, settore, stato_pipeline, responsabile_id, creato_da, note)
  values ('DEMO Fondazione Arte Viva', 'Cultura', 'da_contattare', admin, admin, 'DEMO: inaugurazione mostra a primavera')
  returning id into arte;
  insert into public.aziende (nome, settore, referente, email, telefono, stato_pipeline, responsabile_id, creato_da)
  values ('DEMO Famiglia Rossi (privati)', 'Privati', 'Anna Rossi', 'anna.rossi@example.com', '+39 000 000 1004', 'contattato', admin, admin)
  returning id into rossi;
  insert into public.followup (azienda_id, data, nota, assegnato_a, creato_da) values
    (bianchi, current_date, 'DEMO Richiamare per l’esito del preventivo dell’aperitivo', admin, admin),
    (arte, current_date + 7, 'DEMO Primo contatto: presentare il catalogo eventi culturali', admin, admin),
    (aurora, current_date + 20, 'DEMO Proporre il pacchetto gala di Capodanno', admin, admin);

  -- ---------------------------------------------------------------- eventi
  insert into public.eventi (nome, cliente, azienda_id, data, luogo, ora_inizio, ora_fine, personale_richiesto, note, creato_da, punto_ritrovo, ora_ritrovo, divisa, referente)
  values ('DEMO Convention Tech Italia', 'DEMO Tech Italia S.p.A.', tech, current_date + 3, 'Centro Congressi Stelline, Milano', '08:30', '17:30', 6,
          'DEMO: welcome coffee, due coffee break e pranzo a buffet', admin, 'Ingresso carico/scarico, Via Magenta 59', '07:15', 'Camicia bianca, gilet e pantalone neri', 'Andrea Neri +39 000 000 1003')
  returning id into e_conv;
  insert into public.eventi (nome, cliente, azienda_id, data, luogo, ora_inizio, ora_fine, personale_richiesto, note, creato_da, punto_ritrovo, ora_ritrovo, divisa, referente)
  values ('DEMO Matrimonio Rossi–Bianchi', 'DEMO Famiglia Rossi', rossi, current_date + 6, 'Villa Aurora, Via del Lago 1, Como', '17:00', '01:00', 16,
          'DEMO: cerimonia in giardino, aperitivo, cena placée per 122 ospiti', admin, 'Cancello di servizio sul retro (parcheggio staff)', '14:30', 'Giacca nera, camicia bianca, papillon nero, scarpe nere lucide', 'Paolo, maître di villa +39 000 000 2001')
  returning id into e_matr;
  insert into public.eventi (nome, cliente, azienda_id, data, luogo, ora_inizio, ora_fine, personale_richiesto, note, creato_da, punto_ritrovo, ora_ritrovo, divisa)
  values ('DEMO Cena di gala Hotel Aurora', 'DEMO Hotel Aurora', aurora, current_date + 10, 'Hotel Aurora, Sala Panorama, Como', '20:00', '00:30', 12,
          'DEMO: gala aziendale, servizio al tavolo', admin, 'Hall di servizio, piano -1', '18:00', 'Divisa nera completa, guanti bianchi per il servizio')
  returning id into e_gala;
  insert into public.eventi (nome, cliente, azienda_id, data, luogo, ora_inizio, ora_fine, personale_richiesto, note, creato_da)
  values ('DEMO Aperitivo Studio Bianchi', 'DEMO Studio Legale Bianchi', bianchi, current_date + 13, 'Terrazza Studio Bianchi, Milano', '18:30', '21:30', 4,
          'DEMO: aperitivo in piedi per 60 persone', admin)
  returning id into e_aper;
  insert into public.eventi (nome, cliente, azienda_id, data, luogo, ora_inizio, ora_fine, personale_richiesto, stato, note, creato_da)
  values ('DEMO Cena aziendale Tech Italia', 'DEMO Tech Italia S.p.A.', tech, current_date - 5, 'Ristorante Il Faro, Milano', '19:30', '23:30', 4, 'concluso',
          'DEMO: evento già svolto, con ore registrate e valutazioni', admin)
  returning id into e_cena;

  -- Turni: chi è impegnato, chi deve ancora confermare, chi ha rifiutato
  insert into public.turni (evento_id, collaboratore_id, data, ora_inizio, ora_fine, mansione, tariffa_oraria, stato) values
    (e_conv, c[1], current_date + 3, '07:15', '17:30', 'Responsabile di sala', 13, 'confermato'),
    (e_conv, c[2], current_date + 3, '07:15', '17:30', 'Barista', 14, 'confermato'),
    (e_conv, c[3], current_date + 3, '07:30', '17:30', 'Hostess accoglienza', 12, 'confermato'),
    (e_conv, c[4], current_date + 3, '07:30', '17:30', 'Cameriere di sala', 12, 'confermato'),
    (e_conv, c[5], current_date + 3, '07:30', '17:30', 'Barista', 13, 'proposto'),
    (e_matr, c[1], current_date + 6, '14:30', '01:30', 'Responsabile di sala', 13, 'confermato'),
    (e_matr, c[2], current_date + 6, '14:30', '01:30', 'Barista', 14, 'confermato'),
    (e_matr, c[3], current_date + 6, '15:00', '01:00', 'Cameriere di sala', 12, 'confermato'),
    (e_matr, c[6], current_date + 6, '15:00', '01:00', 'Cameriere di sala', 12, 'confermato'),
    (e_matr, c[7], current_date + 6, '15:00', '01:00', 'Cameriere di sala', 12, 'confermato'),
    (e_matr, c[8], current_date + 6, '15:00', '01:30', 'Barista sommelier', 13, 'confermato'),
    (e_matr, c[9], current_date + 6, '15:00', '01:00', 'Cameriere di sala', 12, 'proposto'),
    (e_matr, c[4], current_date + 6, '15:00', '01:00', 'Cameriere di sala', 12, 'proposto'),
    (e_gala, c[2], current_date + 10, '18:00', '00:30', 'Barista', 14, 'confermato'),
    (e_gala, c[5], current_date + 10, '18:00', '00:30', 'Barista', 13, 'confermato'),
    (e_gala, c[6], current_date + 10, '18:00', '00:30', 'Cameriere di sala', 12, 'confermato'),
    (e_gala, c[10], current_date + 10, '18:00', '00:30', 'Runner', 11, 'proposto'),
    (e_aper, c[3], current_date + 13, '17:30', '22:00', 'Hostess', 12, 'confermato'),
    (e_aper, c[7], current_date + 13, '17:30', '22:00', 'Cameriera', 12, 'confermato'),
    (e_cena, c[1], current_date - 5, '18:30', '00:00', 'Responsabile di sala', 13, 'confermato'),
    (e_cena, c[2], current_date - 5, '18:30', '00:00', 'Barista', 14, 'confermato'),
    (e_cena, c[4], current_date - 5, '18:30', '00:00', 'Cameriere di sala', 12, 'confermato'),
    (e_cena, c[6], current_date - 5, '18:30', '00:00', 'Cameriere di sala', 12, 'confermato');
  -- Luca ha rifiutato il matrimonio (esame), resta visibile come rifiutato
  update public.turni set stato = 'rifiutato', motivo_rifiuto = 'DEMO: esame universitario', risposto_il = now()
  where evento_id = e_matr and collaboratore_id = c[4];
  -- Ore registrate per l'evento passato: il compenso si calcola da solo
  update public.turni set ore_totali = 5.5, ore_notturne = 0 where evento_id = e_cena;

  insert into public.valutazioni (evento_id, collaboratore_id, punteggio, note, valutato_da) values
    (e_cena, c[1], 5, 'DEMO: coordinamento impeccabile', admin),
    (e_cena, c[2], 4, 'DEMO: ottimi cocktail, un po’ lento a fine serata', admin),
    (e_cena, c[4], 5, 'DEMO: preciso e gentile con gli ospiti', admin),
    (e_cena, c[6], 3, 'DEMO: arrivato 15 minuti in ritardo', admin);

  -- Calendari: giorni in cui i camerieri non sono disponibili
  insert into public.indisponibilita (collaboratore_id, data, nota) values
    (c[4], current_date + 6, 'DEMO esame universitario'),
    (c[5], current_date + 5, 'DEMO vacanza'), (c[5], current_date + 6, 'DEMO vacanza'), (c[5], current_date + 7, 'DEMO vacanza'),
    (c[6], current_date + 2, 'DEMO visita medica'),
    (c[7], current_date + 1, 'DEMO altro lavoro'),
    (c[8], current_date + 13, 'DEMO matrimonio di famiglia'),
    (c[9], current_date + 10, 'DEMO impegno personale'),
    (c[10], current_date + 3, 'DEMO lezioni'), (c[10], current_date + 4, 'DEMO lezioni'),
    (c[3], current_date + 9, 'DEMO giorno libero'), (c[1], current_date + 12, 'DEMO ferie')
  on conflict (collaboratore_id, data) do nothing;

  -- ---------------------------------------------------------------- sopralluogo con zone e sala 3D
  insert into public.sopralluoghi (azienda_id, evento_id, titolo, data, indirizzo, referente_luogo, checklist, misure, note, creato_da, allestimento)
  values (rossi, e_matr, 'DEMO Villa Aurora – matrimonio Rossi', current_date - 8, 'Via del Lago 1, Como', 'Paolo, maître di villa +39 000 000 2001',
    '[{"chiave":"accessi","etichetta":"Accessi","stato":"ok","nota":"Furgoni dal cancello sul retro, dalle 12"},
      {"chiave":"spazi","etichetta":"Spazi","stato":"ok","nota":"Sala 26×18 m e giardino"},
      {"chiave":"cucina","etichetta":"Cucina e office","stato":"problema","nota":"Nessuna cucina: montare la cucina da campo nel back"},
      {"chiave":"bagni","etichetta":"Bagni","stato":"ok","nota":""},
      {"chiave":"spogliatoio","etichetta":"Spogliatoio personale","stato":"problema","nota":"Chiedere la saletta accanto al back"},
      {"chiave":"parcheggio","etichetta":"Parcheggio","stato":"ok","nota":"Parcheggio staff dietro la villa"},
      {"chiave":"vincoli","etichetta":"Vincoli","stato":"ok","nota":"Musica all’aperto fino alle 24"}]'::jsonb,
    'Sala 26×18 m, altezza 4,5 m; giardino 36×25 m', 'DEMO: la sposa vuole fiori bianchi e rosa cipria', admin, '{"versione": 1, "pareti": {"punti": [[-13, -9], [13, -9], [13, 9], [-13, 9]], "chiusa": true, "altezza": 4.5}, "pavimento": "marmo", "planimetria": null, "foto_pareti": {}, "oggetti": [{"id": "100943e6", "tipo": "sposi", "x": 0, "z": -7.4, "rot": 0, "sedie": 2, "lunghezza": 3.6}, {"id": "50ca90cd", "tipo": "photobooth", "x": 0, "z": -8.75, "rot": 0, "bloccato": true}, {"id": "a16ce49f", "tipo": "pianta", "x": -2.8, "z": -8.2, "rot": 0}, {"id": "b91a32ec", "tipo": "pianta", "x": 2.8, "z": -8.2, "rot": 0}, {"id": "194b90a3", "tipo": "torta", "x": 0, "z": -5.2, "rot": 0}, {"id": "c52e7513", "tipo": "tondo_180", "x": -9.4, "z": -3.6, "rot": 0, "sedie": 10}, {"id": "131de9c8", "tipo": "tondo_180", "x": -4.6, "z": -3.6, "rot": 0, "sedie": 10}, {"id": "82a67b23", "tipo": "tondo_180", "x": 4.6, "z": -3.6, "rot": 0, "sedie": 10}, {"id": "5e3dad8b", "tipo": "tondo_180", "x": 9.4, "z": -3.6, "rot": 0, "sedie": 10}, {"id": "44d0f9c4", "tipo": "tondo_180", "x": -9.4, "z": 0.4, "rot": 0, "sedie": 10}, {"id": "e0e4825d", "tipo": "tondo_180", "x": -4.6, "z": 0.4, "rot": 0, "sedie": 10}, {"id": "763cde37", "tipo": "tondo_180", "x": 4.6, "z": 0.4, "rot": 0, "sedie": 10}, {"id": "83533ad5", "tipo": "tondo_180", "x": 9.4, "z": 0.4, "rot": 0, "sedie": 10}, {"id": "9a2118ea", "tipo": "tondo_180", "x": -9.4, "z": 4.4, "rot": 0, "sedie": 10}, {"id": "08bf4ee8", "tipo": "tondo_180", "x": -4.6, "z": 4.4, "rot": 0, "sedie": 10}, {"id": "a9bedb2c", "tipo": "tondo_180", "x": 4.6, "z": 4.4, "rot": 0, "sedie": 10}, {"id": "99d1cac7", "tipo": "tondo_180", "x": 9.4, "z": 4.4, "rot": 0, "sedie": 10}, {"id": "077b2cc0", "tipo": "pista", "x": 0, "z": 0.4, "rot": 0, "lunghezza": 5}, {"id": "e053c5f8", "tipo": "dj", "x": 0, "z": 4.4, "rot": 0}, {"id": "b2ea20a2", "tipo": "cassa", "x": -2.4, "z": 4.4, "rot": 0}, {"id": "7555112e", "tipo": "cassa", "x": 2.4, "z": 4.4, "rot": 0}, {"id": "cc18f20c", "tipo": "buffet", "x": -12.2, "z": 0.4, "rot": 90, "lunghezza": 4.8}, {"id": "dd3807a6", "tipo": "bar", "x": 11.6, "z": 0.4, "rot": 270, "lunghezza": 4}, {"id": "f2e8b763", "tipo": "confettata", "x": -10.6, "z": 7.2, "rot": 0}, {"id": "79b35261", "tipo": "tableau", "x": -3.8, "z": 7.6, "rot": 0}, {"id": "f763f2b8", "tipo": "lounge", "x": 9.8, "z": 7.8, "rot": 0}, {"id": "a9d7bbd3", "tipo": "lounge", "x": 10.4, "z": -7.9, "rot": 180}, {"id": "42933576", "tipo": "pianta", "x": -12.3, "z": -8.3, "rot": 0}, {"id": "c62f818c", "tipo": "pianta", "x": 12.3, "z": -8.3, "rot": 0}, {"id": "2e0b337c", "tipo": "pianta", "x": -12.3, "z": 8.3, "rot": 0}, {"id": "89855d4f", "tipo": "pianta", "x": 12.3, "z": 8.3, "rot": 0}, {"id": "12883ce3", "tipo": "porta", "x": 0, "z": 9, "rot": 0}, {"id": "a9eda872", "tipo": "giardino", "x": 0, "z": 22.5, "rot": 0, "lunghezza": 36, "bloccato": true}, {"id": "bda79f23", "tipo": "vialetto", "x": 0, "z": 13, "rot": 90, "lunghezza": 8, "bloccato": true}, {"id": "51d75283", "tipo": "gazebo", "x": -10.5, "z": 14, "rot": 0, "lunghezza": 6}, {"id": "dc3c7a96", "tipo": "buffet", "x": -10.5, "z": 14, "rot": 0, "lunghezza": 3.6}, {"id": "c8dbba8a", "tipo": "bar", "x": 10.5, "z": 12.6, "rot": 0, "lunghezza": 4}, {"id": "4a30ad9e", "tipo": "cocktail", "x": -5, "z": 12, "rot": 0}, {"id": "7dc43ea9", "tipo": "cocktail", "x": 5, "z": 12, "rot": 0}, {"id": "8621cedd", "tipo": "cocktail", "x": -5, "z": 15, "rot": 0}, {"id": "9573cdab", "tipo": "cocktail", "x": 5, "z": 15, "rot": 0}, {"id": "9bde3834", "tipo": "cocktail", "x": -3.5, "z": 18, "rot": 0}, {"id": "eb6fabc8", "tipo": "cocktail", "x": 3.5, "z": 18, "rot": 0}, {"id": "9824c7ca", "tipo": "lounge", "x": 12, "z": 17, "rot": 270}, {"id": "0a0d64f8", "tipo": "photobooth", "x": 15, "z": 22, "rot": 90}, {"id": "e2a6441c", "tipo": "tappeto", "x": 0, "z": 26.3, "rot": 90, "lunghezza": 10, "bloccato": true}, {"id": "08677986", "tipo": "fila", "x": -2.9, "z": 21.8, "rot": 180, "sedie": 7}, {"id": "1ad38c82", "tipo": "fila", "x": 2.9, "z": 21.8, "rot": 180, "sedie": 7}, {"id": "71310c48", "tipo": "fila", "x": -2.9, "z": 23, "rot": 180, "sedie": 7}, {"id": "d7e14bf9", "tipo": "fila", "x": 2.9, "z": 23, "rot": 180, "sedie": 7}, {"id": "b204f948", "tipo": "fila", "x": -2.9, "z": 24.2, "rot": 180, "sedie": 7}, {"id": "822bf924", "tipo": "fila", "x": 2.9, "z": 24.2, "rot": 180, "sedie": 7}, {"id": "6ab5b0a8", "tipo": "fila", "x": -2.9, "z": 25.4, "rot": 180, "sedie": 7}, {"id": "8300b550", "tipo": "fila", "x": 2.9, "z": 25.4, "rot": 180, "sedie": 7}, {"id": "6bda8b10", "tipo": "fila", "x": -2.9, "z": 26.6, "rot": 180, "sedie": 7}, {"id": "5c3fe29a", "tipo": "fila", "x": 2.9, "z": 26.6, "rot": 180, "sedie": 7}, {"id": "d3b4b293", "tipo": "fila", "x": -2.9, "z": 27.8, "rot": 180, "sedie": 7}, {"id": "bcd19a54", "tipo": "fila", "x": 2.9, "z": 27.8, "rot": 180, "sedie": 7}, {"id": "9f283149", "tipo": "fila", "x": -2.9, "z": 29, "rot": 180, "sedie": 7}, {"id": "99f78a3e", "tipo": "fila", "x": 2.9, "z": 29, "rot": 180, "sedie": 7}, {"id": "447f06ce", "tipo": "arco", "x": 0, "z": 31.8, "rot": 0}, {"id": "5bec7834", "tipo": "pianta", "x": -2, "z": 32, "rot": 0}, {"id": "bd11ced1", "tipo": "pianta", "x": 2, "z": 32, "rot": 0}, {"id": "200cfc04", "tipo": "lanterna", "x": -0.8, "z": 21.5, "rot": 0}, {"id": "dbc83879", "tipo": "lanterna", "x": 0.8, "z": 21.5, "rot": 0}, {"id": "80e875d4", "tipo": "lanterna", "x": -0.8, "z": 24, "rot": 0}, {"id": "6481a388", "tipo": "lanterna", "x": 0.8, "z": 24, "rot": 0}, {"id": "de0b25b8", "tipo": "lanterna", "x": -0.8, "z": 26.5, "rot": 0}, {"id": "39ffafb9", "tipo": "lanterna", "x": 0.8, "z": 26.5, "rot": 0}, {"id": "f614d3fc", "tipo": "lanterna", "x": -0.8, "z": 29, "rot": 0}, {"id": "9275e1dd", "tipo": "lanterna", "x": 0.8, "z": 29, "rot": 0}, {"id": "d7eb5f1c", "tipo": "albero", "x": -16, "z": 12, "rot": 0}, {"id": "210edda6", "tipo": "albero", "x": 16, "z": 11.5, "rot": 0}, {"id": "4781a549", "tipo": "albero", "x": -16, "z": 31, "rot": 0}, {"id": "8a83b0fe", "tipo": "albero", "x": 16, "z": 31, "rot": 0}, {"id": "9ebc7293", "tipo": "albero", "x": -8, "z": 33.5, "rot": 0}, {"id": "5ca9df32", "tipo": "albero", "x": 8, "z": 33.5, "rot": 0}, {"id": "42805706", "tipo": "siepe", "x": -17.6, "z": 22.5, "rot": 90, "lunghezza": 20}, {"id": "f7274f55", "tipo": "siepe", "x": 17.6, "z": 22.5, "rot": 90, "lunghezza": 20}]}'::jsonb)
  returning id into sop;
  insert into public.sopralluogo_zone (sopralluogo_id, tipo, nome, voci, stile, descrizione, note_operative, ordine)
  values (sop, 'bar', 'Bar in giardino', '["Bancone bar operativo", "Retrobanco con bottigliera", "Frigoriferi a vetro", "Macchina del ghiaccio", "Lavabicchieri"]'::jsonb, '{"stile": "Elegante", "momento": "sera", "colori": "bianco, rosa cipria e oro"}'::jsonb, 'Bancone lungo la siepe a destra del vialetto, retrobanco illuminato, due frigo a vetro ai lati', '2 prese da 16 A dietro la siepe; acqua dal rubinetto del giardino', 0);
  insert into public.sopralluogo_zone (sopralluogo_id, tipo, nome, voci, stile, descrizione, note_operative, ordine)
  values (sop, 'sala', 'Sala ricevimento', '["Tavoli tondi apparecchiati", "Sedie chiavarine", "Tovagliato lungo fino a terra", "Centrotavola floreali", "Tavolo d’onore", "Luci d’atmosfera"]'::jsonb, '{"stile": "Elegante", "momento": "sera", "colori": "bianco, rosa cipria e oro"}'::jsonb, 'Tavoli tondi da 10 con tovaglie lunghe bianche, centrotavola bassi di rose, tavolo degli sposi davanti alla parete fiorita', null, 1);
  insert into public.sopralluogo_zone (sopralluogo_id, tipo, nome, voci, stile, descrizione, note_operative, ordine)
  values (sop, 'cucina', 'Cucina da campo', '["Cucina da campo montata", "Linea calda", "Abbattitore", "Piani di lavoro in acciaio", "Lavaggio e lavastoviglie"]'::jsonb, '{}'::jsonb, 'Cucina da campo nel back dietro la sala, con linea calda verso il pass', 'Serve un quadro elettrico da 32 A: chiedere alla villa', 2);
  insert into public.sopralluogo_zone (sopralluogo_id, tipo, nome, voci, stile, descrizione, note_operative, ordine)
  values (sop, 'back', 'Back di servizio', '["Separé / pannelli divisori", "Tavoli d’appoggio in acciaio", "Carrelli", "Frigoriferi di servizio"]'::jsonb, '{}'::jsonb, 'Separé neri per nascondere il back alla vista degli ospiti', 'Ingresso furgoni dal retro', 3);
  insert into public.sopralluogo_zone (sopralluogo_id, tipo, nome, voci, stile, descrizione, note_operative, ordine)
  values (sop, 'sbarazzo', 'Zona sbarazzo', '["Tavoli da sbarazzo coperti", "Carrelli portavassoi", "Contenitori per la raccolta differenziata"]'::jsonb, '{}'::jsonb, 'Sbarazzo tra sala e back, coperto da tende', null, 4);

  -- Secondo sopralluogo, per il gala (senza sala 3D: si può creare da un modello)
  insert into public.sopralluoghi (azienda_id, evento_id, titolo, data, indirizzo, referente_luogo, checklist, misure, creato_da)
  values (aurora, e_gala, 'DEMO Hotel Aurora – Sala Panorama', current_date - 3, 'Via del Lago 1, Como', 'Laura Verdi +39 000 000 1001', '[]', 'Sala 22×14 m, altezza 5 m', admin);

  -- ---------------------------------------------------------------- preventivi
  -- Matrimonio: accettato e collegato all'evento
  insert into public.preventivi (azienda_id, sopralluogo_id, titolo, data_evento, luogo, ospiti, iva_pct, note_cliente, note_interne, creato_da)
  values (rossi, sop, 'DEMO Matrimonio Rossi–Bianchi', current_date + 6, 'Villa Aurora, Como', 122, 22,
          'Servizio completo di sala, bar e cucina. Acconto 30% alla conferma.', 'DEMO: margine obiettivo 35%', admin)
  returning id into p;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (p, 0, 'personale', 'Camerieri', 12, 6, 24, 13),
    (p, 1, 'personale', 'Responsabile di sala', 1, 7, 32, 18),
    (p, 2, 'personale', 'Baristi', 4, 6, 26, 14),
    (p, 3, 'personale', 'Cuochi', 3, 8, 30, 17),
    (p, 4, 'personale', 'Lavapiatti', 2, 8, 18, 11),
    (p, 5, 'servizio', 'Tavolo tondo Ø180', 12, null, 25, 10),
    (p, 6, 'servizio', 'Sedie', 220, null, 3.5, 1.2),
    (p, 7, 'servizio', 'Tovagliato e mise en place', 122, null, 6, 2.5),
    (p, 8, 'servizio', 'Bar in giardino: Bancone bar operativo', 2, null, 180, 70),
    (p, 9, 'servizio', 'Cucina da campo: Cucina da campo montata', 1, null, 650, 300);
  update public.preventivi set stato = 'inviato' where id = p;
  update public.preventivi set stato = 'accettato', evento_id = e_matr where id = p;

  -- Convention: accettato
  insert into public.preventivi (azienda_id, titolo, data_evento, luogo, ospiti, iva_pct, creato_da)
  values (tech, 'DEMO Convention annuale', current_date + 3, 'Centro Congressi Stelline, Milano', 120, 22, admin) returning id into p;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (p, 0, 'personale', 'Camerieri', 3, 10, 24, 13), (p, 1, 'personale', 'Baristi', 2, 10, 26, 14),
    (p, 2, 'servizio', 'Coffee station', 2, null, 220, 90), (p, 3, 'servizio', 'Pranzo a buffet (a persona)', 120, null, 22, 11);
  update public.preventivi set stato = 'inviato' where id = p;
  update public.preventivi set stato = 'accettato', evento_id = e_conv where id = p;

  -- Cena già svolta: accettato, per il report margini
  insert into public.preventivi (azienda_id, titolo, data_evento, luogo, ospiti, iva_pct, creato_da)
  values (tech, 'DEMO Cena aziendale (consuntivo)', current_date - 5, 'Ristorante Il Faro, Milano', 40, 22, admin) returning id into p;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (p, 0, 'personale', 'Camerieri', 2, 5.5, 24, 12), (p, 1, 'personale', 'Responsabile di sala', 1, 5.5, 32, 13), (p, 2, 'personale', 'Baristi', 1, 5.5, 26, 14);
  update public.preventivi set stato = 'inviato' where id = p;
  update public.preventivi set stato = 'accettato', evento_id = e_cena where id = p;

  -- Aperitivo: inviato, in attesa di risposta
  insert into public.preventivi (azienda_id, titolo, data_evento, luogo, ospiti, iva_pct, note_cliente, creato_da)
  values (bianchi, 'DEMO Aperitivo di fine anno', current_date + 13, 'Terrazza Studio Bianchi, Milano', 60, 22, 'Aperitivo in piedi con finger food e bar.', admin) returning id into p;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (p, 0, 'personale', 'Camerieri', 2, 4.5, 24, 12), (p, 1, 'personale', 'Baristi', 1, 4.5, 26, 14), (p, 2, 'servizio', 'Finger food (a persona)', 60, null, 18, 8);
  update public.preventivi set stato = 'inviato', evento_id = e_aper where id = p;

  -- Gala: bozza da completare
  insert into public.preventivi (azienda_id, titolo, data_evento, luogo, ospiti, iva_pct, sconto_pct, note_interne, creato_da)
  values (aurora, 'DEMO Cena di gala 130 ospiti', current_date + 10, 'Hotel Aurora, Sala Panorama', 130, 22, 5, 'DEMO: da completare con la proposta dal sopralluogo', admin) returning id into p;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (p, 0, 'personale', 'Camerieri', 12, 6, 24, 13);

  -- Fondazione: rifiutato
  insert into public.preventivi (azienda_id, titolo, data_evento, ospiti, iva_pct, creato_da)
  values (arte, 'DEMO Inaugurazione mostra', current_date + 40, 200, 22, admin) returning id into p;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (p, 0, 'personale', 'Camerieri', 6, 4, 24, 13);
  update public.preventivi set stato = 'inviato' where id = p;
  update public.preventivi set stato = 'rifiutato', motivo_esito = 'DEMO: budget ridotto, rimandato al prossimo anno' where id = p;

  -- ---------------------------------------------------------------- ordini di servizio e lista di carico
  insert into public.ordini_servizio (evento_id, scaletta, menu, intolleranze, checklist, dress_code, note) values
    (e_matr, '[{"ora": "13:00", "attivita": "Montaggio e allestimento", "zona": "Back"}, {"ora": "16:00", "attivita": "Briefing dello staff", "zona": "Back"}, {"ora": "17:00", "attivita": "Arrivo ospiti e aperitivo di benvenuto", "zona": "Giardino"}, {"ora": "18:30", "attivita": "Ospiti a tavola: antipasti", "zona": "Sala"}, {"ora": "19:30", "attivita": "Primi", "zona": "Sala"}, {"ora": "20:15", "attivita": "Secondi", "zona": "Sala"}, {"ora": "21:15", "attivita": "Taglio della torta", "zona": "Sala"}, {"ora": "21:30", "attivita": "Buffet dei dolci e open bar", "zona": "Bar in giardino"}, {"ora": "23:00", "attivita": "Fine servizio", "zona": ""}, {"ora": "23:30", "attivita": "Smontaggio", "zona": ""}]'::jsonb, '[{"portata": "Aperitivo", "piatto": "Finger food di benvenuto e bollicine", "allergeni": [1, 3, 7, 12]}, {"portata": "Antipasti", "piatto": "Vitello tonnato con capperi di Pantelleria", "allergeni": [3, 4, 12]}, {"portata": "Antipasti", "piatto": "Burrata con pomodorini confit (variante vegetariana)", "allergeni": [7]}, {"portata": "Primi", "piatto": "Risotto alla milanese con ossobuco", "allergeni": [7, 9, 12], "note": "Disponibile senza lattosio"}, {"portata": "Primi", "piatto": "Tortelli di zucca, burro e salvia", "allergeni": [1, 3, 7, 8]}, {"portata": "Secondi", "piatto": "Filetto di manzo al Barolo, patate al forno", "allergeni": [9, 12]}, {"portata": "Torta", "piatto": "Torta nuziale millefoglie chantilly e frutti di bosco", "allergeni": [1, 3, 7, 8]}, {"portata": "Open bar", "piatto": "Open bar con cocktail classici e analcolici", "allergeni": [12]}]'::jsonb,
     '[{"tipo":"Celiachia","numero":3,"note":"tavoli 2, 5 e 9"},{"tipo":"Vegetariano","numero":6},{"tipo":"Intolleranza al lattosio","numero":2,"note":"tavolo 4"},{"tipo":"Menù bambini","numero":8,"note":"tavolo 11"}]'::jsonb,
     '[{"zona": "Bar in giardino", "voce": "Bancone bar operativo", "fatto": false}, {"zona": "Bar in giardino", "voce": "Retrobanco con bottigliera", "fatto": false}, {"zona": "Bar in giardino", "voce": "Frigoriferi a vetro", "fatto": false}, {"zona": "Bar in giardino", "voce": "Macchina del ghiaccio", "fatto": false}, {"zona": "Bar in giardino", "voce": "Lavabicchieri", "fatto": false}, {"zona": "Sala ricevimento", "voce": "Tavoli tondi apparecchiati", "fatto": false}, {"zona": "Sala ricevimento", "voce": "Sedie chiavarine", "fatto": false}, {"zona": "Sala ricevimento", "voce": "Tovagliato lungo fino a terra", "fatto": false}, {"zona": "Sala ricevimento", "voce": "Centrotavola floreali", "fatto": false}, {"zona": "Sala ricevimento", "voce": "Tavolo d’onore", "fatto": false}, {"zona": "Sala ricevimento", "voce": "Luci d’atmosfera", "fatto": false}, {"zona": "Cucina da campo", "voce": "Cucina da campo montata", "fatto": false}, {"zona": "Cucina da campo", "voce": "Linea calda", "fatto": false}, {"zona": "Cucina da campo", "voce": "Abbattitore", "fatto": false}, {"zona": "Cucina da campo", "voce": "Piani di lavoro in acciaio", "fatto": false}, {"zona": "Cucina da campo", "voce": "Lavaggio e lavastoviglie", "fatto": false}, {"zona": "Back di servizio", "voce": "Separé / pannelli divisori", "fatto": false}, {"zona": "Back di servizio", "voce": "Tavoli d’appoggio in acciaio", "fatto": false}, {"zona": "Back di servizio", "voce": "Carrelli", "fatto": false}, {"zona": "Back di servizio", "voce": "Frigoriferi di servizio", "fatto": false}, {"zona": "Zona sbarazzo", "voce": "Tavoli da sbarazzo coperti", "fatto": false}, {"zona": "Zona sbarazzo", "voce": "Carrelli portavassoi", "fatto": false}, {"zona": "Zona sbarazzo", "voce": "Contenitori per la raccolta differenziata", "fatto": false}]'::jsonb,
     'Giacca nera, camicia bianca, papillon nero, scarpe nere lucide',
     'DEMO: parcheggio staff dietro la villa. Gli sposi arrivano alle 18:30 dal giardino: tutto lo staff in posizione per il brindisi.'),
    (e_conv, '[{"ora": "07:00", "attivita": "Montaggio e allestimento"}, {"ora": "08:15", "attivita": "Briefing dello staff"}, {"ora": "08:30", "attivita": "Welcome coffee"}, {"ora": "10:30", "attivita": "Coffee break"}, {"ora": "12:00", "attivita": "Pranzo a buffet"}, {"ora": "14:30", "attivita": "Coffee break pomeridiano"}, {"ora": "15:30", "attivita": "Smontaggio"}]'::jsonb,
     '[{"portata":"Coffee break","piatto":"Caffè, tè, succhi e mini croissant","allergeni":[1,3,7]},{"portata":"Coffee break","piatto":"Frutta fresca e yogurt","allergeni":[7]},{"portata":"Primi","piatto":"Insalata di farro con verdure grigliate","allergeni":[1]},{"portata":"Secondi","piatto":"Roast beef con salsa verde","allergeni":[10]},{"portata":"Dessert","piatto":"Crostatine di frutta","allergeni":[1,3,7,8]}]'::jsonb,
     '[{"tipo":"Celiachia","numero":2},{"tipo":"Vegano","numero":4}]'::jsonb, '[]'::jsonb, 'Camicia bianca, gilet e pantalone neri', 'DEMO: badge da ritirare all’ingresso carico/scarico');

  insert into public.liste_carico (evento_id, voci, coperti, ospiti, scorta_pct)
  values (e_matr, '[{"chiave": "3de61c49-e739-40b6-8f98-eaa6090d18d5", "reparto": "sala", "voce": "Tavolo tondo Ø180", "quantita": 12, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "85aaa589-ece2-4231-9a09-7acc400ec947", "reparto": "sala", "voce": "Tavolo sposi", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "d1b98f49-f93f-4131-adff-7edc8443981c", "reparto": "sala", "voce": "Tavolo cocktail", "quantita": 6, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "99dff03f-6724-4527-9841-a943b5778f06", "reparto": "sala", "voce": "Buffet", "quantita": 2, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "cca8b201-46ea-451e-a710-3e34ec7ff69a", "reparto": "sala", "voce": "Tavolo torta", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "b549e52a-2216-4873-a344-05a92b6e3569", "reparto": "sala", "voce": "Confettata", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "b8aed448-ea9a-4d68-aa55-690216fe879e", "reparto": "sala", "voce": "Sedie", "quantita": 220, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "c7bbfc55-c1fa-4549-b042-97f2e7ecbf25", "reparto": "sala", "voce": "Tovaglie", "quantita": 19, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "ff706edf-905c-45ee-846d-7271a26a3c0f", "reparto": "sala", "voce": "Coperture elastiche per tavoli cocktail", "quantita": 6, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "7ccbc30c-fbc2-43a9-b3aa-fa9869a9972c", "reparto": "sala", "voce": "Centrotavola", "quantita": 13, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "2e072b8f-da18-40f9-bca3-33cfbdedde0a", "reparto": "sala", "voce": "Caraffe per l’acqua", "quantita": 13, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "7dab8130-a6d1-46e1-a9fb-11e3171f802c", "reparto": "sala", "voce": "Numeri / segnatavolo", "quantita": 13, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "169404ab-93be-4fd8-8930-b2dc6518e398", "reparto": "sala", "voce": "Tovaglioli", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "16897fb5-76e5-4cb5-9b0c-b816b9a7db9d", "reparto": "sala", "voce": "Sottopiatti", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "56a8a360-fb7f-400a-811a-26f702c14c8a", "reparto": "sala", "voce": "Piatti piani", "quantita": 269, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "577a045a-63b7-4040-a31a-3c471fd804e9", "reparto": "sala", "voce": "Piatti fondi", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "dee327c9-0f52-45e5-890e-61c14f983f6f", "reparto": "sala", "voce": "Piatti da dessert", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "b47335cb-008a-4fca-b0b0-b6cc90e751f3", "reparto": "sala", "voce": "Forchette", "quantita": 403, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "3bcf1fb8-4856-4721-a60a-953435dfb772", "reparto": "sala", "voce": "Coltelli", "quantita": 269, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "3f4ac392-c0da-47d7-a1fb-06e25998441b", "reparto": "sala", "voce": "Cucchiai", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "f13dca49-15d5-43de-a2ca-54f82dc96dbb", "reparto": "sala", "voce": "Posate da dessert", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "a46eb3eb-36e7-4fcb-9f61-292b6c0f0aee", "reparto": "sala", "voce": "Tazzine e piattini da caffè", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "2846eb16-de8b-46fd-96d5-5be7895f1259", "reparto": "sala", "voce": "Bicchieri acqua", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "7af8aa50-410b-4f26-8d33-22ce8d0a854b", "reparto": "sala", "voce": "Calici vino", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "9b8ec80f-d38f-4e1b-9410-12ed446025c1", "reparto": "sala", "voce": "Flûte per il brindisi", "quantita": 135, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "1afa0430-43ba-48b3-b31e-b1c12a47078f", "reparto": "sala", "voce": "Piattini per l’aperitivo", "quantita": 143, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "955b6fac-5f31-42d9-904b-7ec0b3132263", "reparto": "sala", "voce": "Vassoi di servizio", "quantita": 13, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "1992812e-3ea4-45c3-8602-e2f9b6176f32", "reparto": "bar", "voce": "Bancone bar", "quantita": 2, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "0efcd659-e119-45a2-807e-348e08b5fd4e", "reparto": "bar", "voce": "Secchielli per il ghiaccio", "quantita": 4, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "b887e45b-b51e-47a1-ae23-80fae674034d", "reparto": "bar", "voce": "Tumbler", "quantita": 286, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "e8b8102e-f67b-41d8-8d30-166e64146a74", "reparto": "bar", "voce": "Calici e coppe da cocktail", "quantita": 143, "unita": "pz", "caricato": false, "auto": true, "note": "+10% di scorta"}, {"chiave": "cbe7943d-f639-416c-9073-a1b56634c6b0", "reparto": "bar", "voce": "Kit bar (shaker, jigger, pinze, apribottiglie, taglieri)", "quantita": 2, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "1c93343a-e02f-45c4-808e-4637d4c8a819", "reparto": "consumabili", "voce": "Ghiaccio", "quantita": 130, "unita": "kg", "caricato": false, "auto": true, "note": "1 kg a ospite"}, {"chiave": "16800b21-9954-48ec-a8d4-007805cab907", "reparto": "consumabili", "voce": "Tovagliolini cocktail", "quantita": 260, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "16fd87cf-64aa-4aa8-b204-b1761e71cd70", "reparto": "cucina", "voce": "Chafing dish", "quantita": 8, "unita": "pz", "caricato": false, "auto": true, "note": "4 per buffet"}, {"chiave": "218af4a8-821f-4e56-bf38-fb9687eb9d2b", "reparto": "cucina", "voce": "Teglie gastronorm 1/1", "quantita": 13, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "51a86163-720d-4f4a-a2f7-e6bb2e8461da", "reparto": "cucina", "voce": "Contenitori isotermici", "quantita": 4, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "55af1fa7-d7f8-4b07-8ca0-f872077c9546", "reparto": "cucina", "voce": "Kit attrezzi di cucina (pentole, mestoli, coltelli, taglieri)", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "e511cbcf-3e54-4a9b-9a79-8c25bbe752f2", "reparto": "allestimento", "voce": "Divanetto lounge", "quantita": 3, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "3073c7ed-94a6-4366-8725-ad5ad97a6a61", "reparto": "allestimento", "voce": "Arco floreale", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "e538bc0d-6235-4907-8ea6-58458b7eac22", "reparto": "allestimento", "voce": "Navata / tappeto", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "e6891620-b981-4928-b643-71e494da7132", "reparto": "allestimento", "voce": "Lanterna", "quantita": 8, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "1805f9b0-28a5-4a9b-ae38-5d8bc677a3f7", "reparto": "allestimento", "voce": "Tableau de mariage", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "7a09bad4-a235-4276-ad11-a38b1f38c3f0", "reparto": "allestimento", "voce": "Pista da ballo", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "06daba0d-9f8d-4eb1-a5ba-dcd42f67def9", "reparto": "allestimento", "voce": "Consolle DJ", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "834fa09e-f675-4d82-9433-d841798b9cae", "reparto": "allestimento", "voce": "Cassa audio", "quantita": 2, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "5e703e61-975a-46f7-b099-d50358c9d5ff", "reparto": "allestimento", "voce": "Photo booth", "quantita": 2, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "1d1adad0-b108-40d3-ae33-18bc7f145e04", "reparto": "allestimento", "voce": "Pianta in vaso", "quantita": 8, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "2495bce7-a963-4303-b6b6-add45fe46157", "reparto": "allestimento", "voce": "Gazebo", "quantita": 1, "unita": "pz", "caricato": false, "auto": true}, {"chiave": "ea465788-a057-4c3b-b2ec-1e5bddd18dcd", "reparto": "bar", "voce": "Retrobanco con bottigliera", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Bar in giardino"}, {"chiave": "deb95803-5fbc-4648-ba4e-4837a9321862", "reparto": "bar", "voce": "Frigoriferi a vetro", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Bar in giardino"}, {"chiave": "9db4cfce-3f91-4052-9f9b-75c0448b3193", "reparto": "bar", "voce": "Macchina del ghiaccio", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Bar in giardino"}, {"chiave": "ea48baca-c081-4150-bb54-8057ade71029", "reparto": "bar", "voce": "Lavabicchieri", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Bar in giardino"}, {"chiave": "6b2adb14-a16b-48be-8d65-0edca2ded26d", "reparto": "sala", "voce": "Tavolo d’onore", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Sala ricevimento"}, {"chiave": "f0fc0ee1-8009-419e-999f-3202dc547454", "reparto": "sala", "voce": "Luci d’atmosfera", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Sala ricevimento"}, {"chiave": "fc26bb79-118d-4feb-b6c6-78885b2cda32", "reparto": "cucina", "voce": "Cucina da campo montata", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Cucina da campo"}, {"chiave": "90ae97d6-1bd5-4fe4-a235-d91b006a9461", "reparto": "cucina", "voce": "Linea calda", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Cucina da campo"}, {"chiave": "d8765112-4285-4b27-899a-4759a5908f06", "reparto": "cucina", "voce": "Abbattitore", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Cucina da campo"}, {"chiave": "25c48d13-a52c-4b27-89e1-5d39b04093d1", "reparto": "cucina", "voce": "Piani di lavoro in acciaio", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Cucina da campo"}, {"chiave": "39b3ccc1-a79b-4dcc-bb47-4e7411826314", "reparto": "cucina", "voce": "Lavaggio e lavastoviglie", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Cucina da campo"}, {"chiave": "b3421964-8c6d-4c65-82ad-9bc6e7156ac2", "reparto": "allestimento", "voce": "Separé / pannelli divisori", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Back di servizio"}, {"chiave": "59520c39-2c38-48cb-ba3c-dafd810f51c0", "reparto": "allestimento", "voce": "Carrelli", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Back di servizio"}, {"chiave": "ba3e352a-3f97-476e-8f43-940c99b12b51", "reparto": "allestimento", "voce": "Frigoriferi di servizio", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Back di servizio"}, {"chiave": "57cdbf5b-ee2c-4d80-b990-07dc1824c2c4", "reparto": "sala", "voce": "Carrelli portavassoi", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Zona sbarazzo"}, {"chiave": "68042d61-f051-48a7-9dd7-87ca96f3ada8", "reparto": "sala", "voce": "Contenitori per la raccolta differenziata", "quantita": 1, "unita": "pz", "caricato": false, "auto": true, "note": "zona Zona sbarazzo"}, {"chiave": "7074398e-f8c9-45a8-ab4a-fbb8e2ecc38c", "reparto": "consumabili", "voce": "Sacchi per la spazzatura", "quantita": 6, "unita": "pz", "caricato": false, "auto": true, "note": "differenziata"}, {"chiave": "a19dbfda-f2a4-49a9-8f93-436c474fc10b", "reparto": "consumabili", "voce": "Pellicola e alluminio", "quantita": 1, "unita": "kit", "caricato": false, "auto": true}, {"chiave": "d4091ad0-4f53-4b59-91ab-79d75201c6a7", "reparto": "consumabili", "voce": "Kit pulizia (detersivi, spugne, panni)", "quantita": 1, "unita": "kit", "caricato": false, "auto": true}]'::jsonb, 122, 130, 10);

  -- ---------------------------------------------------------------- fatture e incassi
  insert into public.fatture (numero, azienda_id, evento_id, data_emissione, data_scadenza, descrizione, imponibile, iva_pct, creato_da)
  values ('DEMO-001', tech, e_cena, current_date - 4, current_date + 26, 'DEMO Servizio di sala cena aziendale', 1450, 22, admin) returning id into f;
  insert into public.incassi (fattura_id, data, importo, metodo, note) values (f, current_date - 1, 1769, 'bonifico', 'DEMO saldo');
  insert into public.fatture (numero, azienda_id, evento_id, data_emissione, data_scadenza, descrizione, imponibile, iva_pct, creato_da)
  values ('DEMO-002', rossi, e_matr, current_date - 7, current_date + 7, 'DEMO Acconto 30% matrimonio Rossi–Bianchi', 3900, 22, admin) returning id into f;
  insert into public.incassi (fattura_id, data, importo, metodo, note) values (f, current_date - 2, 2000, 'bonifico', 'DEMO primo bonifico');
  insert into public.fatture (numero, azienda_id, data_emissione, data_scadenza, descrizione, imponibile, iva_pct, creato_da)
  values ('DEMO-003', aurora, current_date - 45, current_date - 15, 'DEMO Brunch aziendale di settembre', 980, 22, admin);

  -- ---------------------------------------------------------------- rimborsi e pagamenti
  insert into public.rimborsi (collaboratore_id, evento_id, tipo, data_spesa, importo, descrizione) values
    (c[1], e_cena, 'viaggio', current_date - 5, 18.40, 'DEMO Treno Como–Milano andata e ritorno') returning id into r;
  update public.rimborsi set stato = 'approvato' where id = r;
  insert into public.rimborsi (collaboratore_id, evento_id, tipo, data_spesa, importo, descrizione) values
    (c[2], e_cena, 'pasti', current_date - 5, 12.00, 'DEMO Cena prima del servizio');
  insert into public.rimborsi (collaboratore_id, evento_id, tipo, data_spesa, importo, descrizione) values
    (c[6], e_cena, 'altro', current_date - 5, 35.00, 'DEMO Taxi notturno') returning id into r;
  update public.rimborsi set stato = 'rifiutato', motivo_rifiuto = 'DEMO: rientro previsto con il furgone aziendale' where id = r;
  insert into public.pagamenti (collaboratore_id, data, importo, tipo, metodo, note, creato_da) values
    (c[1], current_date - 1, 50, 'acconto', 'bonifico', 'DEMO acconto', admin),
    (c[4], current_date - 1, 66, 'saldo', 'bonifico', 'DEMO saldo cena aziendale', admin);

  -- ---------------------------------------------------------------- notifiche di benvenuto per l'admin
  insert into public.notifiche (utente_id, tipo, titolo, testo, link, chiave) values
    (admin, 'info', 'Benvenuto nella DEMO', 'Parti dall’evento “DEMO Matrimonio Rossi–Bianchi”: gruppo di lavoro, ordine di servizio e lista di carico sono già compilati.', '/eventi/' || e_matr, 'demo-1'),
    (admin, 'info', 'Chi è libero questa settimana?', 'Guarda la disponibilità dei 10 camerieri: liberi, impegnati e non disponibili.', '/disponibilita-personale', 'demo-2'),
    (admin, 'info', 'Sopralluogo con sala 3D', 'Apri il sopralluogo DEMO di Villa Aurora: zone, allestimento 3D e rendering.', '/sopralluoghi/' || sop, 'demo-3');
end $$;

select 'admin' as accesso, (select count(*) from public.profiles where email like 'demo.cameriere.%') as camerieri,
  (select count(*) from public.eventi where nome like 'DEMO %') as eventi_demo, (select count(*) from public.turni t join public.eventi e on e.id = t.evento_id where e.nome like 'DEMO %') as turni_demo;
