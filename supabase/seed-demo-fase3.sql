-- =============================================================================
-- Dati DEMO fittizi per l'area commerciale (Fase 3): aziende, sopralluogo,
-- preventivi con voci, follow-up. Da eseguire dopo seed-demo.sql, solo su progetti di prova.
-- Si può rieseguire: rigenera i dati DEMO commerciali.
-- =============================================================================
do $$
declare
  hotel uuid;
  studio uuid;
  sop uuid;
  prev_inviato uuid;
  prev_bozza uuid;
  resp uuid := (select id from public.profiles where email = 'demo.responsabile.1@example.com');
begin
  -- Pulizia dei dati DEMO precedenti
  delete from public.preventivi where azienda_id in (select id from public.aziende where nome like 'DEMO %');
  delete from public.sopralluoghi where titolo like 'DEMO %';
  delete from public.aziende where nome like 'DEMO %';

  insert into public.aziende (nome, settore, referente, ruolo_referente, email, telefono, indirizzo, stato_pipeline, responsabile_id, creato_da, note)
  values ('DEMO Hotel Aurora', 'Hospitality', 'DEMO Laura Verdi', 'Event manager', 'eventi@example.com', '+39 000 000 1001',
          'DEMO Via del Lago 1, Como', 'cliente_attivo', resp, resp, 'DEMO: cliente ricorrente per matrimoni ed eventi aziendali')
  returning id into hotel;

  insert into public.aziende (nome, settore, referente, ruolo_referente, email, telefono, stato_pipeline, responsabile_id, creato_da)
  values ('DEMO Studio Legale Bianchi', 'Servizi professionali', 'DEMO Marco Bianchi', 'Socio', 'segreteria@example.com', '+39 000 000 1002',
          'contattato', resp, resp)
  returning id into studio;

  insert into public.aziende (nome, settore, stato_pipeline, responsabile_id, creato_da)
  values ('DEMO Fondazione Arte Viva', 'Cultura', 'da_contattare', resp, resp);

  -- Collega l'evento DEMO del matrimonio all'hotel
  update public.eventi set azienda_id = hotel where nome = 'DEMO Matrimonio';

  insert into public.sopralluoghi (azienda_id, titolo, data, indirizzo, referente_luogo, checklist, misure, note, creato_da)
  values (hotel, 'DEMO Sala Panorama – Hotel Aurora', current_date - 2, 'DEMO Via del Lago 1, Como', 'DEMO Paolo (maître) +39 000 000 1003',
    '[{"chiave":"accessi","etichetta":"Accessi","stato":"ok","nota":"Montacarichi sul retro"},
      {"chiave":"spazi","etichetta":"Spazi","stato":"ok","nota":""},
      {"chiave":"cucina","etichetta":"Cucina e office","stato":"problema","nota":"Office piccolo: servono 2 runner in più"},
      {"chiave":"bagni","etichetta":"Bagni","stato":"ok","nota":""},
      {"chiave":"spogliatoio","etichetta":"Spogliatoio personale","stato":"problema","nota":"Nessuno spogliatoio: chiedere una saletta"},
      {"chiave":"parcheggio","etichetta":"Parcheggio","stato":"na","nota":""},
      {"chiave":"vincoli","etichetta":"Vincoli","stato":"ok","nota":"Musica fino alle 24"}]'::jsonb,
    'DEMO: sala 20×14 m, 16 tavoli rotondi da 10', 'DEMO: terrazza utilizzabile per l''aperitivo', resp)
  returning id into sop;

  -- Preventivo inviato in attesa di risposta
  insert into public.preventivi (azienda_id, titolo, data_evento, luogo, ospiti, iva_pct, note_cliente, note_interne, creato_da)
  values (studio, 'DEMO Cena di fine anno', current_date + 45, 'DEMO Ristorante Il Faro, Milano', 80, 22,
          'DEMO: divise nere incluse. Pagamento 30% alla conferma, saldo a fine evento.', 'DEMO: margine minimo concordato 30%', resp)
  returning id into prev_inviato;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (prev_inviato, 0, 'personale', 'DEMO Camerieri di sala', 6, 6, 24, 15),
    (prev_inviato, 1, 'personale', 'DEMO Bartender', 2, 6, 28, 17),
    (prev_inviato, 2, 'personale', 'DEMO Capo sala', 1, 7, 32, 20),
    (prev_inviato, 3, 'servizio', 'DEMO Coordinamento e sopralluogo', 1, null, 150, 50);
  update public.preventivi set stato = 'inviato' where id = prev_inviato;

  -- Bozza nata dal sopralluogo
  insert into public.preventivi (azienda_id, sopralluogo_id, titolo, data_evento, luogo, ospiti, iva_pct, sconto_pct, creato_da)
  values (hotel, sop, 'DEMO Gala aziendale 160 ospiti', current_date + 60, 'DEMO Sala Panorama – Hotel Aurora', 160, 22, 5, resp)
  returning id into prev_bozza;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (prev_bozza, 0, 'personale', 'DEMO Camerieri di sala', 11, 7, 24, 15),
    (prev_bozza, 1, 'personale', 'DEMO Runner (office ridotto)', 2, 7, 20, 13),
    (prev_bozza, 2, 'servizio', 'DEMO Guardaroba', 1, null, 180, 90);

  insert into public.followup (azienda_id, data, nota, assegnato_a, creato_da) values
    (studio, current_date, 'DEMO Richiamare per l’esito del preventivo', resp, resp),
    (hotel, current_date + 10, 'DEMO Proporre il pacchetto estate', resp, resp);
end $$;

select a.nome, a.stato_pipeline, count(p.id) as preventivi
from public.aziende a left join public.preventivi p on p.azienda_id = a.id
where a.nome like 'DEMO %' group by a.nome, a.stato_pipeline order by a.nome;
