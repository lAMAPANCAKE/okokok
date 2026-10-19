-- =============================================================================
-- Dati DEMO fittizi (alternativa a scripts/seed-demo.mjs, senza service role key)
-- Da eseguire nello SQL Editor di Supabase SOLO su un progetto di prova.
-- Prima di eseguire sostituisci DEMO_PASSWORD_QUI con la password scelta
-- (la stessa di DEMO_PASSWORD in .env.seed). Si può rieseguire.
-- =============================================================================
do $$
declare
  pw constant text := 'DEMO_PASSWORD_QUI';
  u record;
  uid uuid;
  ids jsonb := '{}';
  ev_passato uuid;
  ev_futuro uuid;
  vecchi uuid[];
  t record;
begin
  if pw = 'DEMO_PASSWORD_QUI' or length(pw) < 8 then
    raise exception 'Imposta una password DEMO di almeno 8 caratteri al posto di DEMO_PASSWORD_QUI';
  end if;

  for u in
    select * from (values
      ('demo.admin.1@example.com',         'admin',         'DEMO Admin',         '1', 0::numeric,  '{}'::text[]),
      ('demo.admin.2@example.com',         'admin',         'DEMO Admin',         '2', 0,  '{}'),
      ('demo.admin.3@example.com',         'admin',         'DEMO Admin',         '3', 0,  '{}'),
      ('demo.responsabile.1@example.com',  'responsabile',  'DEMO Responsabile',  '1', 0,  '{sala}'),
      ('demo.responsabile.2@example.com',  'responsabile',  'DEMO Responsabile',  '2', 0,  '{sala}'),
      ('demo.responsabile.3@example.com',  'responsabile',  'DEMO Responsabile',  '3', 0,  '{sala}'),
      ('demo.collaboratore.1@example.com', 'collaboratore', 'DEMO Collaboratore', '1', 12, '{sala,inglese}'),
      ('demo.collaboratore.2@example.com', 'collaboratore', 'DEMO Collaboratore', '2', 13, '{bar,"patente B"}'),
      ('demo.collaboratore.3@example.com', 'collaboratore', 'DEMO Collaboratore', '3', 12, '{hostess,inglese,francese}')
    ) as v(email, ruolo, nome, cognome, tariffa, competenze)
  loop
    select id into uid from auth.users where email = u.email;
    if uid is null then
      insert into public.inviti (email, ruolo, tariffa_oraria) values (u.email, u.ruolo::public.ruolo_utente, u.tariffa);
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', u.email,
        extensions.crypt(pw, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now());
    else
      update auth.users set encrypted_password = extensions.crypt(pw, extensions.gen_salt('bf')) where id = uid;
    end if;

    update public.profiles
    set nome = u.nome, cognome = u.cognome, ruolo = u.ruolo::public.ruolo_utente, tariffa_oraria = u.tariffa,
        competenze = u.competenze, attivo = true, profilo_completo = true, telefono = '+39 000 000 000' || u.cognome
    where id = uid;
    ids := ids || jsonb_build_object(u.ruolo || u.cognome, uid);
  end loop;

  -- Rigenera gli eventi DEMO (i turni completati vanno prima riportati ad annullati)
  select array_agg(id) into vecchi from public.eventi where nome like 'DEMO %';
  if vecchi is not null then
    update public.turni set ore_totali = null, ore_notturne = 0, ore_festive = 0, ore_straordinarie = 0, stato = 'annullato'
    where evento_id = any (vecchi);
    delete from public.eventi where id = any (vecchi);
  end if;

  insert into public.eventi (nome, cliente, data, luogo, ora_inizio, ora_fine, personale_richiesto, stato, note, creato_da)
  values ('DEMO Cena aziendale', 'DEMO Cliente S.r.l.', current_date - 5, 'DEMO Villa, Milano', '19:00', '00:30', 2, 'concluso',
          'DEMO: divisa nera, ritrovo 18:30', (ids ->> 'responsabile1')::uuid)
  returning id into ev_passato;

  insert into public.eventi (nome, cliente, data, luogo, ora_inizio, ora_fine, personale_richiesto, note, creato_da)
  values ('DEMO Matrimonio', 'DEMO Famiglia Rossi', current_date + 4, 'DEMO Cascina, Bergamo', '16:00', '01:00', 4,
          'DEMO: aperitivo in giardino, poi cena placée', (ids ->> 'responsabile1')::uuid)
  returning id into ev_futuro;

  insert into public.turni (evento_id, collaboratore_id, data, ora_inizio, ora_fine, mansione, tariffa_oraria, stato) values
    (ev_passato, (ids ->> 'collaboratore1')::uuid, current_date - 5, '18:30', '00:30', 'cameriere di sala', 12, 'confermato'),
    (ev_passato, (ids ->> 'collaboratore2')::uuid, current_date - 5, '18:30', '01:00', 'bartender', 13, 'confermato');
  update public.turni set ore_totali = 6, ore_notturne = 0.5 where evento_id = ev_passato;

  insert into public.turni (evento_id, collaboratore_id, data, ora_inizio, ora_fine, mansione, tariffa_oraria, stato) values
    (ev_futuro, (ids ->> 'collaboratore1')::uuid, current_date + 4, '15:30', '01:00', 'capo sala', 14, 'confermato'),
    (ev_futuro, (ids ->> 'collaboratore2')::uuid, current_date + 4, '16:00', '01:00', 'bartender', 13, 'proposto'),
    (ev_futuro, (ids ->> 'collaboratore3')::uuid, current_date + 4, '16:00', '20:00', 'hostess', 12, 'proposto');
end $$;

select email, ruolo, tariffa_oraria from public.profiles where email like 'demo.%' order by ruolo, email;
