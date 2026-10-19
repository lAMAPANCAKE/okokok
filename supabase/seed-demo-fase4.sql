-- =============================================================================
-- Dati DEMO fittizi per la Fase 4: valutazioni, indisponibilità e un preventivo
-- accettato collegato all'evento passato (per il report margini).
-- Da eseguire dopo seed-demo.sql e seed-demo-fase3.sql, solo su progetti di prova. Rieseguibile.
-- =============================================================================
do $$
declare
  c1 uuid := (select id from public.profiles where email = 'demo.collaboratore.1@example.com');
  c2 uuid := (select id from public.profiles where email = 'demo.collaboratore.2@example.com');
  c3 uuid := (select id from public.profiles where email = 'demo.collaboratore.3@example.com');
  resp uuid := (select id from public.profiles where email = 'demo.responsabile.1@example.com');
  cena uuid := (select id from public.eventi where nome = 'DEMO Cena aziendale' limit 1);
  matrimonio date := (select data from public.eventi where nome = 'DEMO Matrimonio' limit 1);
  hotel uuid := (select id from public.aziende where nome = 'DEMO Hotel Aurora' limit 1);
  prev uuid;
begin
  if cena is null or hotel is null then
    raise exception 'Esegui prima seed-demo.sql e seed-demo-fase3.sql';
  end if;

  -- Valutazioni del personale che ha lavorato alla cena
  delete from public.valutazioni where evento_id = cena;
  insert into public.valutazioni (evento_id, collaboratore_id, punteggio, note, valutato_da) values
    (cena, c1, 5, 'DEMO: impeccabile, ottimo con gli ospiti', resp),
    (cena, c2, 4, 'DEMO: veloce al bar, arrivato con 10 minuti di ritardo', resp);

  -- Il collaboratore 3 non è disponibile il giorno del matrimonio (ha un turno proposto)
  delete from public.indisponibilita where collaboratore_id = c3 and nota like 'DEMO%';
  insert into public.indisponibilita (collaboratore_id, data, nota) values
    (c3, matrimonio, 'DEMO esame universitario'),
    (c3, matrimonio + 7, 'DEMO vacanza')
  on conflict (collaboratore_id, data) do nothing;

  -- Preventivo accettato per la cena già svolta, così il report mostra ricavi e margine
  delete from public.preventivi where titolo = 'DEMO Cena aziendale (consuntivo)';
  update public.eventi set azienda_id = hotel where id = cena;
  insert into public.preventivi (azienda_id, titolo, data_evento, luogo, ospiti, iva_pct, creato_da)
  values (hotel, 'DEMO Cena aziendale (consuntivo)', (select data from public.eventi where id = cena), 'DEMO Villa, Milano', 60, 22, resp)
  returning id into prev;
  insert into public.preventivo_voci (preventivo_id, ordine, tipo, descrizione, quantita, ore, prezzo_unitario, costo_unitario) values
    (prev, 0, 'personale', 'DEMO Camerieri di sala', 1, 6, 24, 13),
    (prev, 1, 'personale', 'DEMO Bartender', 1, 6.5, 28, 14);
  update public.preventivi set evento_id = cena, stato = 'inviato' where id = prev;
  update public.preventivi set stato = 'accettato' where id = prev;
end $$;

select r.nome, r.ricavo, r.costo_personale, r.costo_rimborsi, r.ricavo - r.costo_personale - r.costo_rimborsi as margine
from public.report_eventi r where r.nome like 'DEMO %' and r.ricavo > 0;
