-- =============================================================================
-- Fase 1 — schema: profili, inviti, impostazioni, eventi, turni, audit log
-- =============================================================================

create type public.ruolo_utente as enum ('collaboratore', 'responsabile', 'admin');
create type public.stato_evento as enum ('pianificato', 'concluso', 'annullato');
create type public.stato_turno  as enum ('proposto', 'confermato', 'rifiutato', 'completato', 'annullato');

-- Aggiorna updated_at a ogni modifica
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Profili (dati visibili ai responsabili per organizzare i turni)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  nome              text not null default '',
  cognome           text not null default '',
  telefono          text,
  ruolo             public.ruolo_utente not null default 'collaboratore',
  competenze        text[] not null default '{}',
  taglia_giacca     text,
  taglia_pantalone  text,
  numero_scarpe     text,
  foto_path         text,
  tariffa_oraria    numeric(8,2) not null default 0 check (tariffa_oraria >= 0),
  attivo            boolean not null default true,
  profilo_completo  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Dati sensibili (GDPR): solo il proprietario e l'admin
create table public.profili_privati (
  id              uuid primary key references public.profiles (id) on delete cascade,
  codice_fiscale  text,
  data_nascita    date,
  indirizzo       text,
  iban            text,
  updated_at      timestamptz not null default now()
);
create trigger profili_privati_updated_at before update on public.profili_privati
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Inviti: la registrazione avviene solo tramite invito dell'admin
-- -----------------------------------------------------------------------------
create table public.inviti (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  ruolo           public.ruolo_utente not null default 'collaboratore',
  tariffa_oraria  numeric(8,2) not null default 0 check (tariffa_oraria >= 0),
  creato_da       uuid references public.profiles (id) on delete set null,
  creato_il       timestamptz not null default now(),
  accettato_il    timestamptz
);
create unique index inviti_email_aperto on public.inviti (lower(email)) where accettato_il is null;

-- -----------------------------------------------------------------------------
-- Impostazioni globali (riga unica): maggiorazioni in percentuale.
-- Partono da 0: le imposta l'admin, nessun valore presunto.
-- -----------------------------------------------------------------------------
create table public.impostazioni (
  id                  boolean primary key default true check (id),
  magg_notturno       numeric(5,2) not null default 0 check (magg_notturno >= 0),
  magg_festivo        numeric(5,2) not null default 0 check (magg_festivo >= 0),
  magg_straordinario  numeric(5,2) not null default 0 check (magg_straordinario >= 0),
  updated_at          timestamptz not null default now()
);
insert into public.impostazioni default values;
create trigger impostazioni_updated_at before update on public.impostazioni
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Eventi e turni
-- -----------------------------------------------------------------------------
create table public.eventi (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null check (length(trim(nome)) > 0),
  cliente              text,
  data                 date not null,
  luogo                text,
  ora_inizio           time,
  ora_fine             time,
  note                 text,
  personale_richiesto  integer not null default 0 check (personale_richiesto >= 0),
  stato                public.stato_evento not null default 'pianificato',
  creato_da            uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index eventi_data on public.eventi (data);
create trigger eventi_updated_at before update on public.eventi
  for each row execute function public.set_updated_at();

-- ora_fine < ora_inizio indica un turno che finisce dopo mezzanotte.
-- Le ore notturne/festive/straordinarie sono quote delle ore totali con maggiorazione.
create table public.turni (
  id                 uuid primary key default gen_random_uuid(),
  evento_id          uuid not null references public.eventi (id) on delete cascade,
  collaboratore_id   uuid not null references public.profiles (id) on delete restrict,
  data               date not null,
  ora_inizio         time not null,
  ora_fine           time not null,
  mansione           text not null check (length(trim(mansione)) > 0),
  tariffa_oraria     numeric(8,2) not null check (tariffa_oraria >= 0),
  stato              public.stato_turno not null default 'proposto',
  motivo_rifiuto     text,
  risposto_il        timestamptz,
  ore_totali         numeric(5,2) check (ore_totali between 0 and 24),
  ore_notturne       numeric(5,2) not null default 0 check (ore_notturne >= 0),
  ore_festive        numeric(5,2) not null default 0 check (ore_festive >= 0),
  ore_straordinarie  numeric(5,2) not null default 0 check (ore_straordinarie >= 0),
  compenso_lordo     numeric(10,2),
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint turni_quote_ore check (
    ore_notturne      <= coalesce(ore_totali, 0) and
    ore_festive       <= coalesce(ore_totali, 0) and
    ore_straordinarie <= coalesce(ore_totali, 0)
  ),
  constraint turni_ore_solo_se_svolto check (
    ore_totali is null or stato in ('confermato', 'completato')
  )
);
create index turni_collaboratore_data on public.turni (collaboratore_id, data);
create index turni_evento on public.turni (evento_id);
create index turni_data on public.turni (data);
create trigger turni_updated_at before update on public.turni
  for each row execute function public.set_updated_at();

-- Calcolo del compenso: fotografa le maggiorazioni al momento della registrazione,
-- così una modifica futura delle percentuali non altera lo storico.
create or replace function public.calcola_compenso_turno()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  imp public.impostazioni;
begin
  if new.ore_totali is null then
    new.compenso_lordo := null;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.ore_totali        is not distinct from old.ore_totali
     and new.ore_notturne      is not distinct from old.ore_notturne
     and new.ore_festive       is not distinct from old.ore_festive
     and new.ore_straordinarie is not distinct from old.ore_straordinarie
     and new.tariffa_oraria    is not distinct from old.tariffa_oraria
     and old.compenso_lordo is not null then
    return new;
  end if;

  select * into imp from public.impostazioni where id;

  new.compenso_lordo := round(
    new.tariffa_oraria * (
      new.ore_totali
      + new.ore_notturne      * imp.magg_notturno      / 100
      + new.ore_festive       * imp.magg_festivo       / 100
      + new.ore_straordinarie * imp.magg_straordinario / 100
    ), 2);

  if new.stato = 'confermato' then
    new.stato := 'completato';
  end if;
  return new;
end $$;

create trigger turni_compenso before insert or update on public.turni
  for each row execute function public.calcola_compenso_turno();

-- Un turno con ore registrate è storico dei compensi: non si elimina (né col suo evento).
create or replace function public.blocca_eliminazione_turno_completato()
returns trigger language plpgsql as $$
begin
  if old.stato = 'completato' then
    raise exception 'Il turno ha ore registrate e non può essere eliminato: annulla l’evento invece di eliminarlo'
      using errcode = '23503';
  end if;
  return old;
end $$;

create trigger turni_blocca_eliminazione before delete on public.turni
  for each row execute function public.blocca_eliminazione_turno_completato();

-- -----------------------------------------------------------------------------
-- Audit log: chi ha modificato cosa e quando (ore, tariffe, compensi, ruoli)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  tabella     text not null,
  record_id   text,
  azione      text not null,
  utente_id   uuid,
  vecchio     jsonb,
  nuovo       jsonb,
  creato_il   timestamptz not null default now()
);
create index audit_log_record on public.audit_log (tabella, record_id);
create index audit_log_data on public.audit_log (creato_il desc);

create or replace function public.registra_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  vecchio jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  nuovo   jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into public.audit_log (tabella, record_id, azione, utente_id, vecchio, nuovo)
  values (tg_table_name, coalesce(nuovo ->> 'id', vecchio ->> 'id'), tg_op, auth.uid(), vecchio, nuovo);
  return coalesce(new, old);
end $$;

create trigger turni_audit after insert or update or delete on public.turni
  for each row execute function public.registra_audit();

create trigger profiles_audit after update on public.profiles
  for each row
  when (old.tariffa_oraria is distinct from new.tariffa_oraria
        or old.ruolo is distinct from new.ruolo
        or old.attivo is distinct from new.attivo)
  execute function public.registra_audit();

create trigger impostazioni_audit after update on public.impostazioni
  for each row execute function public.registra_audit();

-- -----------------------------------------------------------------------------
-- Viste di riepilogo (security_invoker: rispettano i permessi di chi legge)
-- -----------------------------------------------------------------------------
create view public.eventi_copertura with (security_invoker = true) as
select
  e.id as evento_id,
  e.personale_richiesto as richiesti,
  count(t.id) filter (where t.stato in ('confermato', 'completato'))::int as confermati,
  count(t.id) filter (where t.stato = 'proposto')::int as in_attesa,
  count(t.id) filter (where t.stato = 'rifiutato')::int as rifiutati,
  greatest(e.personale_richiesto
           - count(t.id) filter (where t.stato in ('confermato', 'completato')), 0)::int as mancanti
from public.eventi e
left join public.turni t on t.evento_id = e.id
group by e.id;

create view public.riepilogo_mensile with (security_invoker = true) as
select
  t.collaboratore_id,
  date_trunc('month', t.data)::date as mese,
  count(distinct t.data)::int as giorni_lavorati,
  count(*)::int as turni,
  coalesce(sum(t.ore_totali), 0) as ore_totali,
  coalesce(sum(t.compenso_lordo), 0) as compenso_lordo
from public.turni t
where t.stato = 'completato'
group by t.collaboratore_id, date_trunc('month', t.data);
