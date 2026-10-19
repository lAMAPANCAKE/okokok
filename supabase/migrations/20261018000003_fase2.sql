-- =============================================================================
-- Fase 2 — documenti e scadenze, pagamenti e saldi, trasferte/rimborsi, notifiche
-- =============================================================================

create type public.tipo_documento as enum ('carta_identita', 'codice_fiscale', 'patente', 'contratto', 'permesso_soggiorno', 'attestato_haccp', 'altro');
create type public.verifica_documento as enum ('in_verifica', 'approvato', 'rifiutato');
create type public.tipo_rimborso as enum ('viaggio', 'hotel', 'pasti', 'altro');
create type public.stato_rimborso as enum ('richiesto', 'approvato', 'rifiutato', 'rimborsato');
create type public.tipo_pagamento as enum ('acconto', 'saldo', 'rimborso');
create type public.metodo_pagamento as enum ('bonifico', 'contanti', 'altro');

-- Documenti richiesti a ogni collaboratore (modificabile dall'admin)
alter table public.impostazioni
  add column documenti_obbligatori public.tipo_documento[] not null
  default array['carta_identita', 'codice_fiscale', 'contratto']::public.tipo_documento[];

-- -----------------------------------------------------------------------------
-- Notifiche in-app (le email/push arriveranno con Brevo e la Fase 4)
-- -----------------------------------------------------------------------------
create table public.notifiche (
  id         bigint generated always as identity primary key,
  utente_id  uuid not null references public.profiles (id) on delete cascade,
  tipo       text not null,
  titolo     text not null,
  testo      text,
  link       text,
  chiave     text,               -- evita duplicati (es. promemoria già inviato)
  letta_il   timestamptz,
  creato_il  timestamptz not null default now(),
  unique (utente_id, chiave)
);
create index notifiche_utente on public.notifiche (utente_id, creato_il desc);

create or replace function public.notifica(p_utente uuid, p_tipo text, p_titolo text, p_testo text, p_link text, p_chiave text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifiche (utente_id, tipo, titolo, testo, link, chiave)
  values (p_utente, p_tipo, p_titolo, p_testo, p_link, p_chiave)
  on conflict (utente_id, chiave) do nothing
$$;
revoke execute on function public.notifica(uuid, text, text, text, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Documenti (GDPR: solo proprietario e admin)
-- -----------------------------------------------------------------------------
create table public.documenti (
  id                uuid primary key default gen_random_uuid(),
  collaboratore_id  uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  tipo              public.tipo_documento not null,
  descrizione       text,
  file_path         text not null,
  file_nome         text,
  scadenza          date,
  stato_verifica    public.verifica_documento not null default 'in_verifica',
  note_verifica     text,
  verificato_da     uuid references public.profiles (id) on delete set null,
  verificato_il     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index documenti_collaboratore on public.documenti (collaboratore_id, tipo);
create index documenti_scadenza on public.documenti (scadenza) where scadenza is not null;
create trigger documenti_updated_at before update on public.documenti
  for each row execute function public.set_updated_at();

-- Il proprietario carica e aggiorna (torna "in verifica"); solo l'admin verifica.
create or replace function public.regole_documento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op = 'INSERT' or new.stato_verifica is distinct from old.stato_verifica then
      if new.stato_verifica = 'in_verifica' then
        new.verificato_da := null;
        new.verificato_il := null;
      else
        new.verificato_da := auth.uid();
        new.verificato_il := now();
      end if;
    end if;
    return new;
  end if;

  if new.collaboratore_id <> auth.uid() or (tg_op = 'UPDATE' and old.collaboratore_id <> auth.uid()) then
    raise exception 'Puoi gestire solo i tuoi documenti' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.stato_verifica = 'approvato' then
    raise exception 'Il documento è già stato approvato: caricane uno nuovo' using errcode = '42501';
  end if;
  new.stato_verifica := 'in_verifica';
  new.note_verifica := case when tg_op = 'UPDATE' then old.note_verifica end;
  new.verificato_da := null;
  new.verificato_il := null;
  return new;
end $$;

create trigger documenti_regole before insert or update on public.documenti
  for each row execute function public.regole_documento();

create or replace function public.esito_documento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stato_verifica in ('approvato', 'rifiutato') and new.stato_verifica is distinct from old.stato_verifica then
    perform public.notifica(
      new.collaboratore_id, 'documento',
      case when new.stato_verifica = 'approvato' then 'Documento approvato' else 'Documento rifiutato' end,
      case when new.stato_verifica = 'rifiutato' then coalesce('Motivo: ' || new.note_verifica, 'Caricane una nuova versione.') end,
      '/documenti');
  end if;
  return new;
end $$;

create trigger documenti_esito after update on public.documenti
  for each row execute function public.esito_documento();

create trigger documenti_audit after update on public.documenti
  for each row when (old.stato_verifica is distinct from new.stato_verifica)
  execute function public.registra_audit();

-- Stato di validità del documento più recente per tipo
create view public.documenti_validita with (security_invoker = true) as
select
  d.*,
  case
    when d.stato_verifica = 'rifiutato' then 'rifiutato'
    when d.scadenza is null then 'valido'
    when d.scadenza < current_date then 'scaduto'
    when d.scadenza <= current_date + 30 then 'in_scadenza'
    else 'valido'
  end as validita,
  (d.scadenza - current_date) as giorni_alla_scadenza,
  not exists (
    select 1 from public.documenti n
    where n.collaboratore_id = d.collaboratore_id and n.tipo = d.tipo and n.id <> d.id
      and n.stato_verifica <> 'rifiutato' and n.created_at > d.created_at
  ) as piu_recente
from public.documenti d;

-- Documenti obbligatori mancanti (nessuna versione valida o in verifica)
create view public.documenti_mancanti with (security_invoker = true) as
select p.id as collaboratore_id, t.tipo
from public.profiles p
cross join lateral unnest((select documenti_obbligatori from public.impostazioni where id)) as t(tipo)
where p.attivo and p.ruolo = 'collaboratore'
  and not exists (
    select 1 from public.documenti d
    where d.collaboratore_id = p.id and d.tipo = t.tipo and d.stato_verifica <> 'rifiutato'
      and (d.scadenza is null or d.scadenza >= current_date)
  );

-- Promemoria a 30/15/7 giorni dalla scadenza (e a scadenza superata) per utente e admin
create or replace function public.genera_promemoria_scadenze()
returns integer language plpgsql security definer set search_path = public as $$
declare
  d record;
  soglia text;
  adm record;
  nome_tipo text;
  n integer := 0;
begin
  for d in
    select v.*, p.nome, p.cognome
    from public.documenti_validita v
    join public.profiles p on p.id = v.collaboratore_id and p.attivo
    where v.piu_recente and v.stato_verifica <> 'rifiutato' and v.scadenza is not null
      and v.giorni_alla_scadenza <= 30
  loop
    soglia := case
      when d.giorni_alla_scadenza < 0 then 'scaduto'
      when d.giorni_alla_scadenza <= 7 then '7'
      when d.giorni_alla_scadenza <= 15 then '15'
      else '30'
    end;
    nome_tipo := replace(d.tipo::text, '_', ' ');
    perform public.notifica(
      d.collaboratore_id, 'scadenza',
      case when soglia = 'scaduto' then 'Documento scaduto: ' || nome_tipo else 'Documento in scadenza: ' || nome_tipo end,
      case when soglia = 'scaduto' then 'Scaduto il ' || to_char(d.scadenza, 'DD/MM/YYYY') || '. Carica la nuova versione.'
           else 'Scade il ' || to_char(d.scadenza, 'DD/MM/YYYY') || ' (tra ' || d.giorni_alla_scadenza || ' giorni).' end,
      '/documenti', 'doc:' || d.id || ':' || soglia);
    for adm in select id from public.profiles where ruolo = 'admin' and attivo loop
      perform public.notifica(
        adm.id, 'scadenza',
        trim(d.nome || ' ' || d.cognome) || ': ' || nome_tipo || case when soglia = 'scaduto' then ' scaduto' else ' in scadenza' end,
        'Scadenza ' || to_char(d.scadenza, 'DD/MM/YYYY'),
        '/documenti', 'doc:' || d.id || ':' || soglia);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.genera_promemoria_scadenze() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Pagamenti (acconti, saldi, rimborsi versati)
-- -----------------------------------------------------------------------------
create table public.pagamenti (
  id                uuid primary key default gen_random_uuid(),
  collaboratore_id  uuid not null references public.profiles (id) on delete restrict,
  data              date not null default current_date,
  importo           numeric(10,2) not null check (importo > 0),
  tipo              public.tipo_pagamento not null default 'acconto',
  metodo            public.metodo_pagamento not null default 'bonifico',
  mese_riferimento  date,
  note              text,
  creato_da         uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now()
);
create index pagamenti_collaboratore on public.pagamenti (collaboratore_id, data);

create trigger pagamenti_audit after insert or update or delete on public.pagamenti
  for each row execute function public.registra_audit();

-- Il pagamento di un rimborso è legato alla richiesta: non si elimina né si modifica a parte
create or replace function public.proteggi_pagamento_rimborso()
returns trigger language plpgsql as $$
begin
  if old.tipo = 'rimborso' and exists (select 1 from public.rimborsi r where r.pagamento_id = old.id) then
    raise exception 'Questo pagamento è collegato a un rimborso e non può essere modificato o eliminato' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create trigger pagamenti_proteggi_rimborso before update or delete on public.pagamenti
  for each row execute function public.proteggi_pagamento_rimborso();

create or replace function public.notifica_pagamento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notifica(new.collaboratore_id, 'pagamento', 'Pagamento registrato',
    to_char(new.importo, 'FM999G999D00') || ' € (' || new.tipo || ') del ' || to_char(new.data, 'DD/MM/YYYY'), '/compensi');
  return new;
end $$;

create trigger pagamenti_notifica after insert on public.pagamenti
  for each row execute function public.notifica_pagamento();

-- -----------------------------------------------------------------------------
-- Trasferte e rimborsi spese
-- -----------------------------------------------------------------------------
create table public.rimborsi (
  id                uuid primary key default gen_random_uuid(),
  collaboratore_id  uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  evento_id         uuid references public.eventi (id) on delete set null,
  tipo              public.tipo_rimborso not null,
  data_spesa        date not null,
  importo           numeric(10,2) not null check (importo > 0),
  descrizione       text,
  ricevuta_path     text,
  stato             public.stato_rimborso not null default 'richiesto',
  motivo_rifiuto    text,
  gestito_da        uuid references public.profiles (id) on delete set null,
  gestito_il        timestamptz,
  pagamento_id      uuid references public.pagamenti (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index rimborsi_collaboratore on public.rimborsi (collaboratore_id, data_spesa);
create index rimborsi_stato on public.rimborsi (stato);
create trigger rimborsi_updated_at before update on public.rimborsi
  for each row execute function public.set_updated_at();

-- Flusso: richiesto → approvato/rifiutato → rimborsato.
-- Il richiedente modifica solo richieste aperte o rifiutate (che tornano "richiesto").
-- Lo staff gestisce lo stato ma non approva le proprie richieste (salvo admin).
create or replace function public.regole_rimborso()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  staff boolean := auth.uid() is null or public.is_staff();
  consentito boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.collaboratore_id <> auth.uid() then
      raise exception 'Puoi richiedere rimborsi solo per te stesso' using errcode = '42501';
    end if;
    new.stato := 'richiesto';
    new.motivo_rifiuto := null;
    new.gestito_da := null;
    new.gestito_il := null;
    new.pagamento_id := null;
    return new;
  end if;

  if old.stato = 'rimborsato' then
    raise exception 'Rimborso già pagato: non è più modificabile' using errcode = '42501';
  end if;
  if new.collaboratore_id <> old.collaboratore_id then
    raise exception 'Non si può cambiare il richiedente' using errcode = '42501';
  end if;

  if new.stato is distinct from old.stato and new.stato <> 'richiesto' then
    if not staff then
      raise exception 'Solo i responsabili possono approvare o rifiutare' using errcode = '42501';
    end if;
    if auth.uid() = old.collaboratore_id and not public.is_admin() then
      raise exception 'Non puoi gestire una tua richiesta di rimborso' using errcode = '42501';
    end if;
    consentito := (old.stato = 'richiesto' and new.stato in ('approvato', 'rifiutato'))
               or (old.stato = 'approvato' and new.stato in ('rimborsato', 'rifiutato'))
               or (old.stato = 'rifiutato' and new.stato = 'approvato');
    if not consentito then
      raise exception 'Passaggio di stato non valido: % → %', old.stato, new.stato using errcode = '22023';
    end if;
    if new.importo <> old.importo or new.tipo <> old.tipo or new.data_spesa <> old.data_spesa then
      raise exception 'Chi gestisce la richiesta non può modificarne i dati' using errcode = '42501';
    end if;
    new.gestito_da := auth.uid();
    new.gestito_il := now();
    if new.stato <> 'rifiutato' then new.motivo_rifiuto := null; end if;

    if new.stato = 'rimborsato' then
      insert into public.pagamenti (collaboratore_id, data, importo, tipo, metodo, note)
      values (new.collaboratore_id, current_date, new.importo, 'rimborso', 'bonifico', 'Rimborso spese ' || new.tipo)
      returning id into new.pagamento_id;
    end if;
    return new;
  end if;

  -- Modifica dei dati da parte del richiedente
  if auth.uid() is not null and auth.uid() <> old.collaboratore_id and not public.is_admin() then
    raise exception 'Puoi modificare solo le tue richieste' using errcode = '42501';
  end if;
  if old.stato not in ('richiesto', 'rifiutato') and not public.is_admin() then
    raise exception 'La richiesta è già stata approvata' using errcode = '42501';
  end if;
  new.stato := 'richiesto';
  new.gestito_da := null;
  new.gestito_il := null;
  return new;
end $$;

create trigger rimborsi_regole before insert or update on public.rimborsi
  for each row execute function public.regole_rimborso();

create or replace function public.esito_rimborso()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stato is distinct from old.stato and new.stato in ('approvato', 'rifiutato', 'rimborsato') then
    perform public.notifica(new.collaboratore_id, 'rimborso',
      case new.stato when 'approvato' then 'Rimborso approvato' when 'rifiutato' then 'Rimborso rifiutato' else 'Rimborso pagato' end,
      to_char(new.importo, 'FM999G999D00') || ' € · ' || new.tipo || coalesce(' · ' || new.motivo_rifiuto, ''),
      '/rimborsi');
  end if;
  return new;
end $$;

create trigger rimborsi_esito after update on public.rimborsi
  for each row execute function public.esito_rimborso();

create trigger rimborsi_audit after insert or update or delete on public.rimborsi
  for each row execute function public.registra_audit();

-- -----------------------------------------------------------------------------
-- Saldi e movimenti: compensi maturati + rimborsi approvati − pagamenti
-- -----------------------------------------------------------------------------
create view public.movimenti with (security_invoker = true) as
select t.collaboratore_id, t.data, 'compenso'::text as tipo, t.compenso_lordo as importo,
       coalesce(e.nome, 'Turno') || ' · ' || t.mansione as descrizione, t.id as riferimento
from public.turni t
left join public.eventi e on e.id = t.evento_id
where t.stato = 'completato'
union all
select r.collaboratore_id, r.data_spesa, 'rimborso', r.importo,
       'Rimborso ' || r.tipo || coalesce(' · ' || r.descrizione, ''), r.id
from public.rimborsi r
where r.stato in ('approvato', 'rimborsato')
union all
select p.collaboratore_id, p.data, 'pagamento', -p.importo,
       initcap(p.tipo::text) || ' · ' || p.metodo || coalesce(' · ' || p.note, ''), p.id
from public.pagamenti p;

create view public.saldi with (security_invoker = true) as
select
  pr.id as collaboratore_id,
  coalesce((select sum(compenso_lordo) from public.turni t where t.collaboratore_id = pr.id and t.stato = 'completato'), 0) as compensi,
  coalesce((select sum(importo) from public.rimborsi r where r.collaboratore_id = pr.id and r.stato in ('approvato', 'rimborsato')), 0) as rimborsi,
  coalesce((select sum(importo) from public.pagamenti p where p.collaboratore_id = pr.id), 0) as pagato,
  coalesce((select sum(compenso_lordo) from public.turni t where t.collaboratore_id = pr.id and t.stato = 'completato'), 0)
  + coalesce((select sum(importo) from public.rimborsi r where r.collaboratore_id = pr.id and r.stato in ('approvato', 'rimborsato')), 0)
  - coalesce((select sum(importo) from public.pagamenti p where p.collaboratore_id = pr.id), 0) as saldo
from public.profiles pr;

-- -----------------------------------------------------------------------------
-- Notifiche automatiche sui turni
-- -----------------------------------------------------------------------------
create or replace function public.notifica_turno()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nome_evento text;
begin
  select nome into nome_evento from public.eventi where id = new.evento_id;
  if tg_op = 'INSERT' and new.stato = 'proposto'
     or tg_op = 'UPDATE' and new.stato = 'proposto' and old.stato is distinct from 'proposto' then
    perform public.notifica(new.collaboratore_id, 'turno', 'Nuovo turno da confermare',
      coalesce(nome_evento, 'Evento') || ' · ' || to_char(new.data, 'DD/MM') || ' ' || to_char(new.ora_inizio, 'HH24:MI'), '/turni');
  elsif tg_op = 'UPDATE' and new.stato = 'annullato' and old.stato is distinct from 'annullato' then
    perform public.notifica(new.collaboratore_id, 'turno', 'Turno annullato',
      coalesce(nome_evento, 'Evento') || ' · ' || to_char(new.data, 'DD/MM'), '/turni');
  elsif tg_op = 'UPDATE' and old.stato = new.stato and new.stato in ('proposto', 'confermato')
        and (new.ora_inizio, new.ora_fine, new.data) is distinct from (old.ora_inizio, old.ora_fine, old.data) then
    perform public.notifica(new.collaboratore_id, 'turno', 'Turno modificato',
      coalesce(nome_evento, 'Evento') || ' · ' || to_char(new.data, 'DD/MM') || ' ' || to_char(new.ora_inizio, 'HH24:MI') || '–' || to_char(new.ora_fine, 'HH24:MI'), '/turni');
  end if;
  return new;
end $$;

create trigger turni_notifica after insert or update on public.turni
  for each row execute function public.notifica_turno();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.notifiche enable row level security;
alter table public.documenti enable row level security;
alter table public.pagamenti enable row level security;
alter table public.rimborsi  enable row level security;

create policy notifiche_proprie on public.notifiche for select to authenticated using (utente_id = auth.uid());
create policy notifiche_lettura on public.notifiche for update to authenticated
  using (utente_id = auth.uid()) with check (utente_id = auth.uid());
create policy notifiche_elimina on public.notifiche for delete to authenticated using (utente_id = auth.uid());

-- documenti: proprietario e admin (i responsabili non vedono documenti personali)
create policy documenti_select on public.documenti for select to authenticated
  using (collaboratore_id = auth.uid() or public.is_admin());
create policy documenti_insert on public.documenti for insert to authenticated
  with check (collaboratore_id = auth.uid() or public.is_admin());
create policy documenti_update on public.documenti for update to authenticated
  using (collaboratore_id = auth.uid() or public.is_admin())
  with check (collaboratore_id = auth.uid() or public.is_admin());
create policy documenti_delete on public.documenti for delete to authenticated
  using ((collaboratore_id = auth.uid() and stato_verifica <> 'approvato') or public.is_admin());

-- pagamenti: il collaboratore legge i propri; responsabili e admin gestiscono
create policy pagamenti_select on public.pagamenti for select to authenticated
  using (collaboratore_id = auth.uid() or public.is_staff());
create policy pagamenti_insert on public.pagamenti for insert to authenticated with check (public.is_staff());
create policy pagamenti_update on public.pagamenti for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy pagamenti_delete on public.pagamenti for delete to authenticated using (public.is_admin());

-- rimborsi: il richiedente vede e crea i propri; lo staff gestisce
create policy rimborsi_select on public.rimborsi for select to authenticated
  using (collaboratore_id = auth.uid() or public.is_staff());
create policy rimborsi_insert on public.rimborsi for insert to authenticated
  with check (collaboratore_id = auth.uid());
create policy rimborsi_update on public.rimborsi for update to authenticated
  using (collaboratore_id = auth.uid() or public.is_staff())
  with check (collaboratore_id = auth.uid() or public.is_staff());
create policy rimborsi_delete on public.rimborsi for delete to authenticated
  using ((collaboratore_id = auth.uid() and stato in ('richiesto', 'rifiutato')) or (public.is_admin() and stato <> 'rimborsato'));

revoke all on public.notifiche, public.documenti, public.pagamenti, public.rimborsi from anon;

-- -----------------------------------------------------------------------------
-- Storage privato: documenti (proprietario + admin) e ricevute (proprietario + staff)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documenti', 'documenti', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('ricevute',  'ricevute',  false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy documenti_file_lettura on storage.objects for select to authenticated
  using (bucket_id = 'documenti' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy documenti_file_caricamento on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy documenti_file_eliminazione on storage.objects for delete to authenticated
  using (bucket_id = 'documenti' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy ricevute_lettura on storage.objects for select to authenticated
  using (bucket_id = 'ricevute' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
create policy ricevute_caricamento on storage.objects for insert to authenticated
  with check (bucket_id = 'ricevute' and (storage.foldername(name))[1] = auth.uid()::text);
create policy ricevute_eliminazione on storage.objects for delete to authenticated
  using (bucket_id = 'ricevute' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- Promemoria quotidiano alle 05:30 UTC (7:30 ora legale italiana, 6:30 ora solare)
-- pg_cron è disponibile su Supabase; altrove lo schema si applica comunque.
-- -----------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('promemoria-scadenze-documenti', '30 5 * * *', 'select public.genera_promemoria_scadenze()');
exception when others then
  raise notice 'pg_cron non disponibile (%): pianifica genera_promemoria_scadenze() a mano', sqlerrm;
end $$;
